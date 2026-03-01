import { Request, Response } from 'express';
import { query } from '../db/pool';

let clinicInfoCache: unknown = null;
let cacheExpiry = 0;

export function clearClinicInfoCache(): void {
  clinicInfoCache = null;
  cacheExpiry = 0;
}

export async function getClinicInfo(_req: Request, res: Response): Promise<void> {
  try {
    if (clinicInfoCache && Date.now() < cacheExpiry) {
      res.json(clinicInfoCache);
      return;
    }

    let clinicName = 'My Clinic';
    try {
      const { rows: settingsRows } = await query<{ key: string; value: string }>(
        `SELECT key, value FROM clinic_settings`
      );
      const settings: Record<string, string> = {};
      settingsRows.forEach((r) => { settings[r.key] = r.value; });
      clinicName = settings['clinic_name'] || 'My Clinic';
    } catch { /* table may not exist yet — migration pending */ }

    const { rows: doctors } = await query<{
      id: string;
      display_name: string;
      specialization: string;
      qualifications: string | null;
      bio: string | null;
      photo_url: string | null;
      phone: string | null;
      registration_no: string | null;
    }>(
      `SELECT d.id, d.display_name, d.specialization, d.qualifications,
              d.bio, d.photo_url, d.phone, d.registration_no
       FROM doctors d WHERE d.is_active = TRUE
       ORDER BY d.display_name ASC`
    );

    const { rows: mcConfig } = await query<{ value: string }>(
      `SELECT value FROM missed_call_config WHERE key = 'missed_call_number'`
    );

    const data = {
      clinicName,
      doctors: doctors.map((d) => ({
        id: d.id,
        displayName: d.display_name,
        specialization: d.specialization,
        qualifications: d.qualifications,
        bio: d.bio,
        photoUrl: d.photo_url,
        phone: d.phone,
        registrationNo: d.registration_no,
      })),
      missedCallNumber: mcConfig[0]?.value || null,
    };

    clinicInfoCache = data;
    cacheExpiry = Date.now() + 5 * 60 * 1000;

    res.json(data);
  } catch (err) {
    console.error('getClinicInfo:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}
