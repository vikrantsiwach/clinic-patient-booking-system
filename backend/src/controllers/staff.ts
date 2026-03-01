import bcrypt from 'bcrypt';
import { Request, Response } from 'express';
import { query } from '../db/pool';
import { createAppointment } from './appointments';
import { queueCancellationNotification } from '../services/notification';
import env from '../config/env';

const VALID_TRANSITIONS: Record<string, string[]> = {
  booked:          ['arrived_waiting', 'cancelled', 'no_show'],
  arrived_waiting: ['with_doctor', 'cancelled', 'no_show'],
  with_doctor:     ['completed', 'cancelled', 'no_show'],
  completed:       [],
  cancelled:       [],
  no_show:         [],
};

export async function getAppointmentsByDate(req: Request, res: Response): Promise<void> {
  try {
    const role = req.user!.role;
    const today = new Date().toISOString().slice(0, 10);

    // Receptionist sees today only; doctor/admin can specify date range
    let fromDate: string;
    let toDate: string;
    if (role === 'receptionist') {
      fromDate = today;
      toDate = today;
    } else {
      fromDate = (req.query.from as string) || today;
      toDate = (req.query.to as string) || fromDate;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
        res.status(400).json({ error: 'VALIDATION_ERROR', message: 'from/to must be YYYY-MM-DD' });
        return;
      }
    }

    // Doctor auto-filtered by own doctorId; others can pass doctorId query param
    let doctorIdFilter: string | undefined;
    if (role === 'doctor') {
      doctorIdFilter = req.user!.doctorId;
    } else if (req.query.doctorId) {
      doctorIdFilter = req.query.doctorId as string;
    }

    const patientName = req.query.patientName as string | undefined;
    const patientPhone = req.query.patientPhone as string | undefined;

    const params: unknown[] = [fromDate, toDate];
    const conditions: string[] = ['a.appointment_date BETWEEN $1 AND $2'];

    if (doctorIdFilter) {
      params.push(doctorIdFilter);
      conditions.push(`a.doctor_id = $${params.length}`);
    }
    if (patientName) {
      params.push(`%${patientName}%`);
      conditions.push(`p.full_name ILIKE $${params.length}`);
    }
    if (patientPhone) {
      params.push(`${patientPhone}%`);
      conditions.push(`p.phone LIKE $${params.length}`);
    }

    const where = conditions.join(' AND ');
    const { rows } = await query<Record<string, unknown>>(
      `SELECT a.id, a.reference_code, a.appointment_date::text,
              a.token_number, a.session_index, a.is_emergency,
              a.status, a.booking_channel, a.reason_for_visit, a.cancellation_reason,
              a.arrived_at, a.completed_at, a.doctor_notes,
              p.id AS patient_id, p.full_name AS patient_name, p.phone AS patient_phone,
              p.date_of_birth AS patient_dob, p.gender AS patient_gender,
              d.id AS doctor_id, d.display_name AS doctor_name,
              EXTRACT(YEAR FROM AGE(p.date_of_birth))::int AS patient_age
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       JOIN doctors d ON a.doctor_id = d.id
       WHERE ${where}
       ORDER BY a.appointment_date ASC, a.session_index ASC, a.is_emergency DESC, a.token_number ASC NULLS LAST`,
      params
    );

    const stats = {
      total: rows.length,
      booked: rows.filter((r) => r['status'] === 'booked').length,
      arrived_waiting: rows.filter((r) => r['status'] === 'arrived_waiting').length,
      with_doctor: rows.filter((r) => r['status'] === 'with_doctor').length,
      completed: rows.filter((r) => r['status'] === 'completed').length,
      cancelled: rows.filter((r) => r['status'] === 'cancelled').length,
      no_show: rows.filter((r) => r['status'] === 'no_show').length,
    };

    res.json({ from: fromDate, to: toDate, stats, appointments: rows });
  } catch (err) {
    console.error('getAppointmentsByDate:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

export async function getAppointmentById(req: Request, res: Response): Promise<void> {
  try {
    const { rows } = await query<Record<string, unknown>>(
      `SELECT a.id, a.reference_code, a.appointment_date::text,
              a.token_number, a.session_index, a.is_emergency,
              a.status, a.booking_channel, a.reason_for_visit, a.doctor_notes,
              a.cancellation_reason, a.arrived_at, a.completed_at,
              p.full_name AS patient_name, p.phone AS patient_phone,
              p.email AS patient_email, p.date_of_birth AS patient_dob,
              d.display_name AS doctor_name
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       JOIN doctors d ON a.doctor_id = d.id
       WHERE a.id = $1`,
      [req.params.id]
    );
    if (!rows.length) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
    res.json(rows[0]);
  } catch (err) {
    console.error('getAppointmentById:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

export async function updateAppointmentStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status, cancellationReason } = req.body as { status: string; cancellationReason?: string };

    const { rows } = await query<{
      status: string;
      patient_name: string;
      patient_phone: string;
      token_number: number;
      session_index: number;
      patient_id: string;
    }>(
      `SELECT a.status, p.full_name AS patient_name, p.phone AS patient_phone,
              a.token_number, a.session_index, a.patient_id
       FROM appointments a JOIN patients p ON a.patient_id = p.id
       WHERE a.id = $1`,
      [id]
    );
    if (!rows.length) { res.status(404).json({ error: 'NOT_FOUND' }); return; }

    const appt = rows[0];
    if (!VALID_TRANSITIONS[appt.status]?.includes(status)) {
      res.status(400).json({
        error: 'INVALID_TRANSITION',
        message: `Cannot transition from ${appt.status} to ${status}`,
      });
      return;
    }

    const updates = ['status = $1', 'updated_at = NOW()'];
    const params: unknown[] = [status];

    if (status === 'arrived_waiting') updates.push(`arrived_at = NOW()`);
    if (status === 'completed') updates.push(`completed_at = NOW()`);
    if (status === 'cancelled') {
      updates.push(
        `cancelled_at = NOW()`,
        `cancellation_reason = $${params.length + 1}`,
        `cancelled_by_role = $${params.length + 2}`
      );
      params.push(cancellationReason, req.user!.role);
    }

    params.push(id);
    await query(`UPDATE appointments SET ${updates.join(', ')} WHERE id = $${params.length}`, params);

    const auditAction =
      status === 'arrived_waiting' ? 'appointment_arrived' :
      status === 'with_doctor'     ? 'appointment_with_doctor' :
      'appointment_status_changed';

    await query(
      `INSERT INTO audit_logs (action, performed_by, patient_id, entity_type, entity_id, old_values, new_values)
       VALUES ($1, $2, $3, 'appointment', $4, $5, $6)`,
      [auditAction, req.user!.id, appt.patient_id, id,
       JSON.stringify({ status: appt.status }),
       JSON.stringify({ status, cancellationReason })]
    );

    if (status === 'cancelled') {
      await queueCancellationNotification({
        id,
        patientName: appt.patient_name,
        patientPhone: appt.patient_phone,
        tokenNumber: appt.token_number,
        sessionIndex: appt.session_index,
      });
    }

    res.json({ message: `Status updated to ${status}` });
  } catch (err) {
    console.error('updateAppointmentStatus:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

export async function addDoctorNotes(req: Request, res: Response): Promise<void> {
  try {
    await query(
      `UPDATE appointments SET doctor_notes = $1, updated_at = NOW() WHERE id = $2`,
      [(req.body as { doctorNotes: string }).doctorNotes, req.params.id]
    );
    res.json({ message: 'Notes saved' });
  } catch (err) {
    console.error('addDoctorNotes:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

export async function searchPatients(req: Request, res: Response): Promise<void> {
  try {
    const { q } = req.query as { q?: string };
    if (!q || q.length < 2) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Query must be at least 2 characters' });
      return;
    }
    const { rows } = await query<Record<string, unknown>>(
      `SELECT p.id, p.full_name, p.phone, p.email, p.date_of_birth,
              COUNT(a.id)::int AS visit_count,
              MAX(a.appointment_date)::text AS last_visit_date
       FROM patients p
       LEFT JOIN appointments a ON a.patient_id = p.id AND a.status = 'completed'
       WHERE p.full_name ILIKE $1 OR p.phone LIKE $2
       GROUP BY p.id
       ORDER BY MAX(a.appointment_date) DESC NULLS LAST
       LIMIT 10`,
      [`%${q}%`, `${q}%`]
    );
    res.json({ patients: rows });
  } catch (err) {
    console.error('searchPatients:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

export async function createWalkIn(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;
  body.bookingChannel = 'walkin';
  body.skipTimeCheck = true;
  body.initialStatus = 'arrived_waiting';
  if (req.user!.role === 'doctor' && !body.doctorId) {
    body.doctorId = req.user!.doctorId;
  }
  return createAppointment(req, res);
}

export async function createEmergency(req: Request, res: Response): Promise<void> {
  const body = req.body as Record<string, unknown>;
  body.bookingChannel = 'walkin';
  body.isEmergency = true;
  body.skipTimeCheck = true;
  body.initialStatus = 'with_doctor';
  if (req.user!.role === 'doctor' && !body.doctorId) {
    body.doctorId = req.user!.doctorId;
  }
  return createAppointment(req, res);
}

export async function checkPatientDuplicate(req: Request, res: Response): Promise<void> {
  try {
    const { phone, doctorId } = req.query as { phone?: string; doctorId?: string };
    if (!phone) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'phone required' });
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const params: unknown[] = [phone, today];
    let doctorCondition = '';
    if (doctorId) {
      params.push(doctorId);
      doctorCondition = `AND a.doctor_id = $${params.length}`;
    }

    const { rows } = await query<Record<string, unknown>>(
      `SELECT a.id, a.reference_code, a.token_number, a.status, d.display_name AS doctor_name
       FROM appointments a
       JOIN patients p ON a.patient_id = p.id
       JOIN doctors d ON a.doctor_id = d.id
       WHERE p.phone = $1
         AND a.appointment_date = $2
         AND a.status NOT IN ('cancelled', 'no_show', 'completed')
         ${doctorCondition}
       LIMIT 1`,
      params
    );

    res.json({ isDuplicate: rows.length > 0, appointment: rows[0] || null });
  } catch (err) {
    console.error('checkPatientDuplicate:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

export async function getMyProfile(req: Request, res: Response): Promise<void> {
  try {
    const { rows } = await query<Record<string, unknown>>(
      `SELECT id, email, full_name, role, photo_url, last_login_at FROM users WHERE id = $1`,
      [req.user!.id]
    );
    if (!rows.length) { res.status(404).json({ error: 'NOT_FOUND' }); return; }

    let doctorProfile: Record<string, unknown> | null = null;
    if (req.user!.role === 'doctor') {
      const { rows: docRows } = await query<Record<string, unknown>>(
        `SELECT id, display_name, specialization, qualifications, bio, photo_url, phone, registration_no
         FROM doctors WHERE user_id = $1`,
        [req.user!.id]
      );
      doctorProfile = docRows[0] || null;
    }

    res.json({ ...rows[0], doctorProfile });
  } catch (err) {
    console.error('getMyProfile:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

export async function updateMyProfile(req: Request, res: Response): Promise<void> {
  try {
    const { fullName, email, photoUrl, displayName, specialization, qualifications, bio, registrationNo } =
      req.body as Record<string, string | undefined>;

    const userFields: string[] = [];
    const userParams: unknown[] = [];

    if (fullName !== undefined) { userParams.push(fullName); userFields.push(`full_name = $${userParams.length}`); }
    if (email !== undefined) { userParams.push(email); userFields.push(`email = $${userParams.length}`); }
    if (photoUrl !== undefined) { userParams.push(photoUrl || null); userFields.push(`photo_url = $${userParams.length}`); }

    if (userFields.length) {
      userParams.push(req.user!.id);
      await query(
        `UPDATE users SET ${userFields.join(', ')}, updated_at = NOW() WHERE id = $${userParams.length}`,
        userParams
      );
    }

    if (req.user!.role === 'doctor') {
      const docFields: string[] = [];
      const docParams: unknown[] = [];

      if (displayName !== undefined) { docParams.push(displayName); docFields.push(`display_name = $${docParams.length}`); }
      if (specialization !== undefined) { docParams.push(specialization); docFields.push(`specialization = $${docParams.length}`); }
      if (qualifications !== undefined) { docParams.push(qualifications || null); docFields.push(`qualifications = $${docParams.length}`); }
      if (bio !== undefined) { docParams.push(bio || null); docFields.push(`bio = $${docParams.length}`); }
      if (registrationNo !== undefined) { docParams.push(registrationNo || null); docFields.push(`registration_no = $${docParams.length}`); }
      if (photoUrl !== undefined) { docParams.push(photoUrl || null); docFields.push(`photo_url = $${docParams.length}`); }

      if (docFields.length) {
        docParams.push(req.user!.id);
        await query(
          `UPDATE doctors SET ${docFields.join(', ')}, updated_at = NOW() WHERE user_id = $${docParams.length}`,
          docParams
        );
      }
    }

    await query(
      `INSERT INTO audit_logs (action, performed_by, entity_type, entity_id)
       VALUES ('profile_updated', $1, 'user', $1)`,
      [req.user!.id]
    );

    res.json({ message: 'Profile updated' });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === '23505') {
      res.status(409).json({ error: 'CONFLICT', message: 'Email already in use' });
      return;
    }
    console.error('updateMyProfile:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

export async function changePassword(req: Request, res: Response): Promise<void> {
  try {
    const { currentPassword, newPassword } = req.body as { currentPassword: string; newPassword: string };

    const { rows } = await query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.user!.id]
    );
    if (!rows.length) { res.status(404).json({ error: 'NOT_FOUND' }); return; }

    const valid = await bcrypt.compare(currentPassword, rows[0].password_hash);
    if (!valid) {
      res.status(400).json({ error: 'INVALID_PASSWORD', message: 'Current password is incorrect' });
      return;
    }

    const hash = await bcrypt.hash(newPassword, env.BCRYPT_COST);
    await query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hash, req.user!.id]);

    await query(
      `INSERT INTO audit_logs (action, performed_by, entity_type, entity_id)
       VALUES ('password_changed', $1, 'user', $1)`,
      [req.user!.id]
    );

    res.json({ message: 'Password changed' });
  } catch (err) {
    console.error('changePassword:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}
