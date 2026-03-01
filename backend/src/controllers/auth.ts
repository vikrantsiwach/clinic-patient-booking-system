import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { Request, Response } from 'express';
import { query } from '../db/pool';
import env from '../config/env';
import { sendSMS, templates } from '../services/sms';

function generateOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function sendPatientOtp(req: Request, res: Response): Promise<void> {
  const { phone } = req.body as { phone: string };
  try {
    const { rows } = await query<{ id: string }>('SELECT id FROM patients WHERE phone = $1', [phone]);
    if (!rows.length) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'No booking history for this number' });
      return;
    }

    const otp = env.SMS_MOCK ? '123456' : generateOtp();
    const hash = await bcrypt.hash(otp, env.BCRYPT_COST);
    const expiry = new Date(Date.now() + env.OTP_EXPIRY_MINUTES * 60 * 1000);

    await query(
      `UPDATE patients SET otp_code = $1, otp_expires_at = $2, otp_attempts = 0 WHERE phone = $3`,
      [hash, expiry, phone]
    );

    await sendSMS(phone, templates.otpMessage(otp));

    res.json({ message: 'OTP sent', expiresInMinutes: env.OTP_EXPIRY_MINUTES });
  } catch (err) {
    console.error('sendPatientOtp:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

export async function verifyPatientOtp(req: Request, res: Response): Promise<void> {
  const { phone, otp } = req.body as { phone: string; otp: string };
  try {
    const { rows } = await query<{
      id: string;
      otp_code: string | null;
      otp_expires_at: Date | null;
      otp_attempts: number;
    }>(
      `SELECT id, otp_code, otp_expires_at, otp_attempts FROM patients WHERE phone = $1`,
      [phone]
    );
    if (!rows.length) { res.status(404).json({ error: 'NOT_FOUND' }); return; }
    const patient = rows[0];

    if (patient.otp_attempts >= env.OTP_MAX_ATTEMPTS) {
      res.status(429).json({ error: 'RATE_LIMITED', message: 'Too many attempts. Request a new OTP.' });
      return;
    }

    if (!patient.otp_code || new Date() > new Date(patient.otp_expires_at!)) {
      res.status(400).json({ error: 'INVALID_OTP', message: 'OTP expired or not requested' });
      return;
    }

    const valid = await bcrypt.compare(otp, patient.otp_code);
    if (!valid) {
      await query('UPDATE patients SET otp_attempts = otp_attempts + 1 WHERE id = $1', [patient.id]);
      res.status(400).json({ error: 'INVALID_OTP', message: 'Incorrect OTP' });
      return;
    }

    await query('UPDATE patients SET otp_code = NULL, otp_expires_at = NULL, otp_attempts = 0 WHERE id = $1', [patient.id]);

    const token = jwt.sign({ id: patient.id, phone, role: 'patient' }, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRY as unknown as number });
    res.json({ token, role: 'patient' });
  } catch (err) {
    console.error('verifyPatientOtp:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

export async function staffLogin(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body as { email: string; password: string };
  try {
    const { rows } = await query<{
      id: string;
      email: string;
      password_hash: string;
      full_name: string;
      role: string;
      is_active: boolean;
      status: string;
      photo_url: string | null;
    }>(
      `SELECT id, email, password_hash, full_name, role, is_active, status, photo_url FROM users WHERE email = $1`,
      [email]
    );
    if (!rows.length) { res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid credentials' }); return; }
    const user = rows[0];

    if (!user.is_active || user.status === 'suspended') {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Account deactivated' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) { res.status(401).json({ error: 'UNAUTHORIZED', message: 'Invalid credentials' }); return; }

    await query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id]);
    await query(
      `INSERT INTO audit_logs (action, performed_by, entity_type, entity_id)
       VALUES ('login', $1, 'user', $1)`,
      [user.id]
    );

    // For doctors, include their doctorId in the JWT so they can self-identify
    let doctorId: string | undefined;
    if (user.role === 'doctor') {
      const { rows: docRows } = await query<{ id: string }>('SELECT id FROM doctors WHERE user_id = $1', [user.id]);
      doctorId = docRows[0]?.id;
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role, name: user.full_name, doctorId },
      env.JWT_SECRET,
      { expiresIn: env.JWT_EXPIRY as unknown as number }
    );
    res.json({ token, role: user.role, name: user.full_name, doctorId, photoUrl: user.photo_url });
  } catch (err) {
    console.error('staffLogin:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}
