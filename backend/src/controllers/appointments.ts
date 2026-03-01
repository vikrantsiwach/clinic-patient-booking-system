import { Request, Response } from 'express';
import { transaction, query } from '../db/pool';
import { queueAppointmentNotifications } from '../services/notification';
import { getIST } from '../utils/time';
import { Session } from '../types';

function generateReferenceCode(seq: number): string {
  const year = new Date().getFullYear();
  return `APT-${year}-${String(seq).padStart(5, '0')}`;
}

export async function createAppointment(req: Request, res: Response): Promise<void> {
  const {
    doctorId,
    sessionIndex,
    patientName,
    patientPhone,
    patientGender,
    patientDob,
    patientEmail,
    patientHeightCm,
    patientWeightKg,
    reasonForVisit,
  } = req.body as Record<string, unknown>;
  const bookingChannel = (req.body as Record<string, unknown>).bookingChannel || 'online';
  const isEmergency = (req.body as Record<string, unknown>).isEmergency || false;
  const skipTimeCheck = (req.body as Record<string, unknown>).skipTimeCheck || false;
  const initialStatus = (req.body as Record<string, unknown>).initialStatus as string | undefined
    || (isEmergency ? 'with_doctor' : skipTimeCheck ? 'arrived_waiting' : 'booked');
  const bookedByUserId = req.user?.id || null;

  try {
    const { date: today, dayOfWeek } = getIST();

    const { rows: schedRows } = await query<{
      sessions_json: Session[];
      max_appointments: number;
    }>(
      `SELECT sessions_json, max_appointments
       FROM schedules
       WHERE doctor_id = $1 AND day_of_week = $2::day_of_week AND is_active = TRUE`,
      [doctorId, dayOfWeek]
    );
    if (!schedRows.length) {
      res.status(400).json({ error: 'CLINIC_CLOSED', message: 'Clinic is not open today' });
      return;
    }

    const sched = schedRows[0];
    const sessions = sched.sessions_json;

    const idx = (sessionIndex as number) || 0;
    const session = sessions[idx];
    if (!session) {
      res.status(400).json({ error: 'INVALID_SESSION', message: 'Session not found' });
      return;
    }

    const { rows: blocked } = await query(
      `SELECT id FROM blocked_dates WHERE doctor_id = $1 AND block_date = $2 AND (start_time IS NULL AND end_time IS NULL)`,
      [doctorId, today]
    );
    if (blocked.length) {
      res.status(400).json({ error: 'CLINIC_CLOSED', message: 'Clinic is closed today' });
      return;
    }

    const { nowMins } = getIST();
    const [th, tm] = session.to.split(':').map(Number);
    const [fh, fm] = session.from.split(':').map(Number);
    let toMins = th * 60 + tm;
    const fromMins = fh * 60 + fm;
    if (toMins < fromMins) toMins += 24 * 60;

    if (!skipTimeCheck) {
      if (nowMins < fromMins) {
        res.status(400).json({ error: 'SESSION_NOT_OPEN', message: 'This session has not started yet' });
        return;
      }
      if (nowMins >= toMins) {
        res.status(400).json({ error: 'SESSION_CLOSED', message: 'This session has ended' });
        return;
      }
    }

    const result = await transaction(async (client) => {
      const maxTokens = session.max != null ? session.max : null;
      if (maxTokens !== null) {
        const { rows: countRows } = await client.query<{ count: number }>(
          `SELECT COUNT(*)::int AS count FROM appointments
           WHERE doctor_id = $1 AND appointment_date = $2 AND session_index = $3
             AND status NOT IN ('cancelled')`,
          [doctorId, today, idx]
        );
        if (countRows[0].count >= maxTokens) return { sessionFull: true as const };
      }

      const { rows: patientRows } = await client.query<{ id: string }>(
        `INSERT INTO patients (phone, full_name, gender, email, date_of_birth, height_cm, weight_kg)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (phone) DO UPDATE
           SET full_name = EXCLUDED.full_name,
               gender = COALESCE(EXCLUDED.gender, patients.gender),
               email = COALESCE(EXCLUDED.email, patients.email),
               date_of_birth = COALESCE(EXCLUDED.date_of_birth, patients.date_of_birth),
               height_cm = COALESCE(EXCLUDED.height_cm, patients.height_cm),
               weight_kg = COALESCE(EXCLUDED.weight_kg, patients.weight_kg),
               updated_at = NOW()
         RETURNING id`,
        [patientPhone, patientName, patientGender || null, patientEmail || null, patientDob || null,
         patientHeightCm || null, patientWeightKg || null]
      );
      const patientId = patientRows[0].id;

      const { rows: maxRows } = await client.query<{ max_token: number }>(
        `SELECT COALESCE(MAX(token_number), 0) AS max_token
         FROM appointments
         WHERE doctor_id = $1 AND appointment_date = $2 AND session_index = $3
           AND status NOT IN ('cancelled')`,
        [doctorId, today, idx]
      );
      const tokenNumber = maxRows[0].max_token + 1;

      const { rows: seqRows } = await client.query<{ seq: number }>(`SELECT nextval('appointment_ref_seq') AS seq`);
      const refCode = generateReferenceCode(seqRows[0].seq);

      const { rows: apptRows } = await client.query<{ id: string; reference_code: string }>(
        `INSERT INTO appointments
           (patient_id, doctor_id, appointment_date, token_number, session_index,
            is_emergency, reason_for_visit, booking_channel, booked_by_user_id, reference_code, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING id, reference_code`,
        [patientId, doctorId, today, tokenNumber, idx,
         isEmergency, reasonForVisit || null, bookingChannel, bookedByUserId, refCode, initialStatus]
      );

      await client.query(
        `INSERT INTO audit_logs (action, patient_id, entity_type, entity_id, new_values)
         VALUES ('appointment_created', $1, 'appointment', $2, $3)`,
        [patientId, apptRows[0].id, JSON.stringify({ today, sessionIndex: idx, tokenNumber, bookingChannel })]
      );

      return {
        sessionFull: false as const,
        appointment: {
          id: apptRows[0].id,
          referenceCode: refCode,
          patientName: patientName as string,
          patientPhone: patientPhone as string,
          appointmentDate: today,
          tokenNumber,
          sessionIndex: idx,
          sessionLabel: session,
        },
      };
    });

    if (result.sessionFull) {
      res.status(409).json({ error: 'SESSION_FULL', message: 'This session is full. Please try another.' });
      return;
    }

    await queueAppointmentNotifications(result.appointment);

    res.status(201).json({
      message: 'Token booked successfully',
      appointment: {
        referenceCode: result.appointment.referenceCode,
        token: result.appointment.tokenNumber,
        sessionIndex: result.appointment.sessionIndex,
      },
    });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === '23505') {
      res.status(409).json({ error: 'TOKEN_CONFLICT', message: 'Token assignment conflict, please try again' });
      return;
    }
    console.error('createAppointment:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}
