import bcrypt from 'bcrypt';
import { Request, Response } from 'express';
import { query, transaction } from '../db/pool';
import env from '../config/env';
import { clearClinicInfoCache } from './clinic';
import { getIST } from '../utils/time';

export async function getDoctors(_req: Request, res: Response): Promise<void> {
  try {
    const { rows } = await query<Record<string, unknown>>(
      `SELECT id, display_name, specialization FROM doctors WHERE is_active = TRUE ORDER BY display_name ASC`
    );
    res.json({ doctors: rows });
  } catch (err) {
    console.error('getDoctors:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

export async function getReports(req: Request, res: Response): Promise<void> {
  try {
    const { from, to } = req.query as { from?: string; to?: string };
    const { date: todayIST } = getIST();
    const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const toDate = to || todayIST;

    const rParams: unknown[] = [fromDate, toDate];
    let doctorFilter = '';
    if (req.user!.role === 'doctor') {
      rParams.push(req.user!.doctorId);
      doctorFilter = `AND doctor_id = $${rParams.length}`;
    } else if (req.query.doctorId) {
      rParams.push(req.query.doctorId);
      doctorFilter = `AND doctor_id = $${rParams.length}`;
    }

    const { rows: summary } = await query<Record<string, unknown>>(
      `SELECT
         COUNT(*)::int AS total,
         COUNT(*) FILTER (WHERE status='completed')::int AS completed,
         COUNT(*) FILTER (WHERE status='cancelled')::int AS cancelled,
         COUNT(*) FILTER (WHERE status='no_show')::int AS no_shows,
         COUNT(*) FILTER (WHERE booking_channel='online')::int AS online,
         COUNT(*) FILTER (WHERE booking_channel='missed_call')::int AS missed_call,
         COUNT(*) FILTER (WHERE booking_channel='walkin')::int AS walkin,
         ROUND(COUNT(*) FILTER (WHERE status='cancelled')::numeric / NULLIF(COUNT(*),0)*100,1) AS cancellation_rate,
         ROUND(COUNT(*) FILTER (WHERE status='no_show')::numeric / NULLIF(COUNT(*),0)*100,1) AS no_show_rate
       FROM appointments
       WHERE appointment_date BETWEEN $1 AND $2 ${doctorFilter}`,
      rParams
    );

    const { rows: daily } = await query<Record<string, unknown>>(
      `SELECT appointment_date::text AS date,
              COUNT(*)::int AS total,
              COUNT(*) FILTER (WHERE status='completed')::int AS completed,
              COUNT(*) FILTER (WHERE status='cancelled')::int AS cancelled
       FROM appointments
       WHERE appointment_date BETWEEN $1 AND $2 ${doctorFilter}
       GROUP BY appointment_date ORDER BY appointment_date DESC`,
      rParams
    );

    res.json({ period: { from: fromDate, to: toDate }, summary: summary[0], daily });
  } catch (err) {
    console.error('getReports:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

async function resolveDoctorId(req: Request): Promise<string | null> {
  if (req.user!.role === 'doctor') return req.user!.doctorId || null;
  const qId = (req.query.doctorId || (req.body as Record<string, unknown>)?.doctorId) as string | undefined;
  if (qId) return qId;
  const { rows } = await query<{ id: string }>('SELECT id FROM doctors WHERE is_active=TRUE LIMIT 1');
  return rows[0]?.id || null;
}

export async function getSchedule(req: Request, res: Response): Promise<void> {
  try {
    const doctorId = await resolveDoctorId(req);
    if (!doctorId) { res.status(404).json({ error: 'NOT_FOUND', message: 'No active doctor' }); return; }

    const { rows } = await query<{ day_of_week: string; sessions_json: unknown; is_active: boolean }>(
      `SELECT day_of_week AS "dayOfWeek", sessions_json AS sessions, is_active AS "isActive"
       FROM schedules WHERE doctor_id = $1 ORDER BY
         CASE day_of_week
           WHEN 'monday' THEN 1 WHEN 'tuesday' THEN 2 WHEN 'wednesday' THEN 3
           WHEN 'thursday' THEN 4 WHEN 'friday' THEN 5 WHEN 'saturday' THEN 6
           WHEN 'sunday' THEN 7 END`,
      [doctorId]
    );
    res.json({ doctorId, schedule: rows });
  } catch (err) {
    console.error('getSchedule:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

export async function updateSchedule(req: Request, res: Response): Promise<void> {
  try {
    const doctorId = await resolveDoctorId(req);
    if (!doctorId) { res.status(404).json({ error: 'NOT_FOUND', message: 'No active doctor' }); return; }

    await transaction(async (client) => {
      await client.query('DELETE FROM schedules WHERE doctor_id = $1', [doctorId]);
      for (const day of (req.body as { days: Record<string, unknown>[] }).days) {
        const sessions = (day['sessions'] as Record<string, unknown>[]) || [];
        const s1 = sessions[0] || null;
        const totalMax = sessions.some(s => !s['max'])
          ? 9999
          : sessions.reduce((acc, s) => acc + ((s['max'] as number) || 0), 0);
        await client.query(
          `INSERT INTO schedules (doctor_id, day_of_week, slot_duration_mins, max_appointments, is_active, sessions_json)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [doctorId, day['dayOfWeek'],
           (s1?.['slot'] as number) || 20, totalMax, day['isActive'] !== false,
           JSON.stringify(sessions)]
        );
      }
      await client.query(
        `INSERT INTO audit_logs (action, performed_by, entity_type, entity_id)
         VALUES ('schedule_updated', $1, 'doctor', $2)`,
        [req.user!.id, doctorId]
      );
    });

    clearClinicInfoCache();
    res.json({ message: 'Schedule updated' });
  } catch (err) {
    console.error('updateSchedule:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

export async function getBlockedDates(req: Request, res: Response): Promise<void> {
  try {
    const doctorId = await resolveDoctorId(req);
    if (!doctorId) { res.json({ blockedDates: [] }); return; }
    const { rows } = await query<Record<string, unknown>>(
      `SELECT id, block_date::text AS "blockDate", start_time AS "startTime",
              end_time AS "endTime", reason
       FROM blocked_dates
       WHERE doctor_id = $1 AND block_date >= CURRENT_DATE
       ORDER BY block_date ASC`,
      [doctorId]
    );
    res.json({ blockedDates: rows });
  } catch (err) {
    console.error('getBlockedDates:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

export async function addBlockedDate(req: Request, res: Response): Promise<void> {
  try {
    const doctorId = await resolveDoctorId(req);
    if (!doctorId) { res.status(404).json({ error: 'NOT_FOUND', message: 'No active doctor' }); return; }
    const { blockDate, startTime, endTime, reason } = req.body as Record<string, string>;

    const { rows } = await query<{ id: string }>(
      `INSERT INTO blocked_dates (doctor_id, block_date, start_time, end_time, reason, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [doctorId, blockDate, startTime || null, endTime || null, reason || null, req.user!.id]
    );

    await query(
      `INSERT INTO audit_logs (action, performed_by, entity_type, entity_id)
       VALUES ('blocked_date_added', $1, 'blocked_date', $2)`,
      [req.user!.id, rows[0].id]
    );

    res.status(201).json({ id: rows[0].id, message: 'Date blocked' });
  } catch (err) {
    console.error('addBlockedDate:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

export async function removeBlockedDate(req: Request, res: Response): Promise<void> {
  try {
    if (req.user!.role === 'doctor') {
      const { rows: bd } = await query<{ doctor_id: string }>(
        'SELECT doctor_id FROM blocked_dates WHERE id = $1',
        [req.params.id]
      );
      if (!bd.length || bd[0].doctor_id !== req.user!.doctorId) {
        res.status(403).json({ error: 'FORBIDDEN', message: 'You can only remove your own blocked dates' });
        return;
      }
    }
    const { rowCount } = await query('DELETE FROM blocked_dates WHERE id = $1', [req.params.id]);
    if (!rowCount) { res.status(404).json({ error: 'NOT_FOUND' }); return; }

    await query(
      `INSERT INTO audit_logs (action, performed_by, entity_type, entity_id)
       VALUES ('blocked_date_removed', $1, 'blocked_date', $2)`,
      [req.user!.id, req.params.id]
    );

    res.json({ message: 'Block removed' });
  } catch (err) {
    console.error('removeBlockedDate:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

export async function createStaff(req: Request, res: Response): Promise<void> {
  try {
    const { email, password, fullName, role } = req.body as Record<string, string>;
    const hash = await bcrypt.hash(password, env.BCRYPT_COST);

    const { rows } = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, full_name, role, status) VALUES ($1,$2,$3,$4,'active') RETURNING id`,
      [email, hash, fullName, role]
    );
    const userId = rows[0].id;

    if (role === 'doctor') {
      await query(
        `INSERT INTO doctors (user_id, full_name, display_name, specialization) VALUES ($1, $2, $2, 'General Physician')`,
        [userId, fullName]
      );
      clearClinicInfoCache();
    }

    await query(
      `INSERT INTO audit_logs (action, performed_by, entity_type, entity_id)
       VALUES ('staff_account_created', $1, 'user', $2)`,
      [req.user!.id, userId]
    );

    res.status(201).json({ id: userId, message: 'Staff account created' });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === '23505') {
      res.status(409).json({ error: 'CONFLICT', message: 'Email already exists' });
      return;
    }
    console.error('createStaff:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

export async function listStaff(req: Request, res: Response): Promise<void> {
  try {
    const { status } = req.query as { status?: string };
    const conditions = status ? `WHERE u.status = $1` : '';
    const params = status ? [status] : [];
    const { rows } = await query<Record<string, unknown>>(
      `SELECT u.id, u.email, u.full_name, u.role, u.status, u.is_active, u.created_at, u.last_login_at,
              d.display_name, d.specialization, d.qualifications, d.bio,
              d.photo_url, d.phone AS doctor_phone, d.registration_no
       FROM users u
       LEFT JOIN doctors d ON d.user_id = u.id
       ${conditions} ORDER BY u.created_at DESC`,
      params
    );
    res.json({ staff: rows });
  } catch (err) {
    console.error('listStaff:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

export async function updateStaffStatus(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { status } = req.body as { status: string };

    if (id === req.user!.id) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'Cannot change your own status' });
      return;
    }

    const isActive = status === 'active';
    const { rowCount } = await query(
      `UPDATE users SET status = $1, is_active = $2 WHERE id = $3`,
      [status, isActive, id]
    );
    if (!rowCount) { res.status(404).json({ error: 'NOT_FOUND' }); return; }

    // Cascade-cancel future appointments when deactivating a doctor
    if (!isActive) {
      const { rows: doc } = await query<{ id: string }>('SELECT id FROM doctors WHERE user_id = $1', [id]);
      if (doc.length) {
        await query(
          `UPDATE appointments SET status='cancelled', cancelled_at=NOW(), cancelled_by_role='admin'
           WHERE doctor_id=$1 AND appointment_date >= CURRENT_DATE
             AND status NOT IN ('completed','cancelled','no_show')`,
          [doc[0].id]
        );
        await query(
          `INSERT INTO audit_logs (action, performed_by, entity_type, entity_id)
           VALUES ('doctor_deactivated_appointments_cancelled', $1, 'doctor', $2)`,
          [req.user!.id, doc[0].id]
        );
      }
    }

    await query(
      `INSERT INTO audit_logs (action, performed_by, entity_type, entity_id, new_values)
       VALUES ('staff_status_updated', $1, 'user', $2, $3)`,
      [req.user!.id, id, JSON.stringify({ status })]
    );

    res.json({ message: `Account ${status}` });
  } catch (err) {
    console.error('updateStaffStatus:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

export async function updateStaffDetails(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { fullName, email, role, password,
            displayName, specialization, qualifications, bio, photoUrl, phone, registrationNo
          } = req.body as Record<string, string>;

    const updates = ['full_name = $1', 'email = $2', 'role = $3', 'updated_at = NOW()'];
    const params: unknown[] = [fullName, email, role];

    if (password) {
      const hash = await bcrypt.hash(password, env.BCRYPT_COST);
      updates.push(`password_hash = $${params.length + 1}`);
      params.push(hash);
    }

    params.push(id);
    const { rowCount } = await query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = $${params.length}`,
      params
    );
    if (!rowCount) { res.status(404).json({ error: 'NOT_FOUND' }); return; }

    // If doctor, also update the doctors profile
    if (role === 'doctor' && displayName && specialization) {
      await query(
        `UPDATE doctors
         SET display_name = $1, full_name = $2, specialization = $3,
             qualifications = $4, bio = $5, photo_url = $6, phone = $7,
             registration_no = $8, updated_at = NOW()
         WHERE user_id = $9`,
        [displayName, fullName, specialization,
         qualifications || null, bio || null, photoUrl || null,
         phone || null, registrationNo || null, id]
      );
      clearClinicInfoCache();
    }

    await query(
      `INSERT INTO audit_logs (action, performed_by, entity_type, entity_id, new_values)
       VALUES ('staff_details_updated', $1, 'user', $2, $3)`,
      [req.user!.id, id, JSON.stringify({ fullName, email, role, passwordChanged: !!password })]
    );

    res.json({ message: 'Staff details updated' });
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === '23505') {
      res.status(409).json({ error: 'CONFLICT', message: 'Email already in use' });
      return;
    }
    console.error('updateStaffDetails:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

export async function getDoctorProfile(_req: Request, res: Response): Promise<void> {
  try {
    const { rows } = await query<Record<string, unknown>>(
      `SELECT id, display_name, full_name, specialization, qualifications, bio, photo_url, phone, registration_no
       FROM doctors WHERE is_active = TRUE LIMIT 1`
    );
    if (!rows.length) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
    res.json({ doctor: rows[0] });
  } catch (err) {
    console.error('getDoctorProfile:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

export async function updateDoctorProfile(req: Request, res: Response): Promise<void> {
  try {
    const { displayName, fullName, specialization, qualifications, bio, photoUrl, phone, registrationNo } =
      req.body as Record<string, string>;

    const { rows: doctors } = await query<{ id: string }>('SELECT id FROM doctors WHERE is_active=TRUE LIMIT 1');
    if (!doctors.length) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
    const doctorId = doctors[0].id;

    await query(
      `UPDATE doctors
       SET display_name = $1, full_name = $2, specialization = $3,
           qualifications = $4, bio = $5, photo_url = $6, phone = $7,
           registration_no = $8, updated_at = NOW()
       WHERE id = $9`,
      [displayName, fullName, specialization, qualifications || null, bio || null,
       photoUrl || null, phone || null, registrationNo || null, doctorId]
    );

    await query(
      `INSERT INTO audit_logs (action, performed_by, entity_type, entity_id, new_values)
       VALUES ('doctor_profile_updated', $1, 'doctor', $2, $3)`,
      [req.user!.id, doctorId, JSON.stringify({ displayName, specialization })]
    );

    clearClinicInfoCache();
    res.json({ message: 'Doctor profile updated' });
  } catch (err) {
    console.error('updateDoctorProfile:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

export async function getMissedCallAnalytics(req: Request, res: Response): Promise<void> {
  try {
    const { from, to } = req.query as { from?: string; to?: string };
    const { date: todayIST2 } = getIST();
    const fromDate = from || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const toDate = to || todayIST2;

    const { rows: summary } = await query<Record<string, unknown>>(
      `SELECT COUNT(*)::int AS total_received,
              COUNT(*) FILTER (WHERE status='booked')::int AS booked,
              COUNT(*) FILTER (WHERE status IN ('rate_limited','blacklisted','velocity_blocked','duplicate_active','invalid_number'))::int AS blocked,
              COUNT(*) FILTER (WHERE status='session_expired')::int AS expired,
              COUNT(*) FILTER (WHERE status='rate_limited')::int AS rate_limited,
              COUNT(*) FILTER (WHERE status='blacklisted')::int AS blacklisted,
              COUNT(*) FILTER (WHERE status='velocity_blocked')::int AS velocity_blocked,
              COUNT(*) FILTER (WHERE status='duplicate_active')::int AS duplicate,
              ROUND(COUNT(*) FILTER (WHERE status='booked')::numeric /
                NULLIF(COUNT(*) FILTER (WHERE status IN ('sms_sent','booked','session_expired')),0)*100,1) AS conversion_rate
       FROM missed_call_events
       WHERE DATE(received_at) BETWEEN $1 AND $2`,
      [fromDate, toDate]
    );

    const { rows: daily } = await query<Record<string, unknown>>(
      `SELECT * FROM v_missed_call_daily_report WHERE call_date BETWEEN $1 AND $2`,
      [fromDate, toDate]
    );

    res.json({ period: { from: fromDate, to: toDate }, summary: summary[0], daily });
  } catch (err) {
    console.error('getMissedCallAnalytics:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

export async function updateMissedCallConfig(req: Request, res: Response): Promise<void> {
  try {
    const keyMap: Record<string, string> = {
      maxCallsPer24h: 'max_calls_per_number_24h',
      maxCallsPer7d: 'max_calls_per_number_7d',
      sessionExpiryMins: 'session_expiry_minutes',
      burstThreshold: 'system_burst_threshold',
      systemPauseMins: 'system_pause_minutes',
      newNumberDelaySecs: 'new_number_delay_seconds',
      systemEnabled: 'system_enabled',
    };

    for (const [bodyKey, dbKey] of Object.entries(keyMap)) {
      if ((req.body as Record<string, unknown>)[bodyKey] !== undefined) {
        await query(
          `UPDATE missed_call_config SET value=$1, updated_at=NOW() WHERE key=$2`,
          [String((req.body as Record<string, unknown>)[bodyKey]), dbKey]
        );
      }
    }

    res.json({ message: 'Config updated' });
  } catch (err) {
    console.error('updateMissedCallConfig:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

export async function addToBlacklist(req: Request, res: Response): Promise<void> {
  try {
    const { phone, reason, notes, isPermanent, expiresAt } = req.body as {
      phone: string;
      reason: string;
      notes?: string;
      isPermanent?: boolean;
      expiresAt?: string;
    };
    const { rows } = await query<{ id: string }>(
      `INSERT INTO phone_blacklist (phone, reason, notes, is_permanent, expires_at, added_by)
       VALUES ($1,$2,$3,$4,$5,$6)
       ON CONFLICT (phone) DO UPDATE
         SET reason=$2, notes=$3, is_permanent=$4, expires_at=$5, added_by=$6, created_at=NOW()
       RETURNING id`,
      [phone, reason, notes || null, isPermanent || false, isPermanent ? null : expiresAt, req.user!.id]
    );

    await query(
      `INSERT INTO audit_logs (action, performed_by, entity_type, entity_id, new_values)
       VALUES ('blacklist_add', $1, 'phone_blacklist', $2, $3)`,
      [req.user!.id, rows[0].id, JSON.stringify({ phone, reason })]
    );

    res.status(201).json({ message: 'Number blacklisted' });
  } catch (err) {
    console.error('addToBlacklist:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

export async function getClinicSettings(_req: Request, res: Response): Promise<void> {
  try {
    const { rows } = await query<{ key: string; value: string }>('SELECT key, value FROM clinic_settings');
    const settings: Record<string, string> = {};
    rows.forEach((r) => { settings[r.key] = r.value; });
    res.json({ clinicName: settings['clinic_name'] || 'My Clinic' });
  } catch {
    // Table may not exist yet (migration pending)
    res.json({ clinicName: 'My Clinic' });
  }
}

export async function updateClinicSettings(req: Request, res: Response): Promise<void> {
  try {
    const { clinicName } = req.body as { clinicName: string };
    // Create table if migration hasn't run yet
    await query(
      `CREATE TABLE IF NOT EXISTS clinic_settings (
        key        VARCHAR(100) PRIMARY KEY,
        value      TEXT NOT NULL,
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`
    );
    await query(
      `INSERT INTO clinic_settings (key, value) VALUES ('clinic_name', $1)
       ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
      [clinicName]
    );

    await query(
      `INSERT INTO audit_logs (action, performed_by, entity_type, new_values)
       VALUES ('clinic_settings_updated', $1, 'clinic_settings', $2)`,
      [req.user!.id, JSON.stringify({ clinicName })]
    );

    clearClinicInfoCache();
    res.json({ message: 'Clinic settings updated' });
  } catch (err) {
    console.error('updateClinicSettings:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

export async function removeFromBlacklist(req: Request, res: Response): Promise<void> {
  try {
    const phone = decodeURIComponent(req.params.phone);
    const { rowCount } = await query('DELETE FROM phone_blacklist WHERE phone=$1', [phone]);
    if (!rowCount) { res.status(404).json({ error: 'NOT_FOUND' }); return; }

    await query(
      `INSERT INTO audit_logs (action, performed_by, new_values)
       VALUES ('blacklist_remove', $1, $2)`,
      [req.user!.id, JSON.stringify({ phone })]
    );

    res.json({ message: 'Number removed from blacklist' });
  } catch (err) {
    console.error('removeFromBlacklist:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}
