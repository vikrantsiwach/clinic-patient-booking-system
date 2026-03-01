// TODO: implement patient history — persistent notes per patient across all visits
import { Request, Response } from 'express';
import { query } from '../db/pool';
import { queueCancellationNotification } from '../services/notification';
import { getIST } from '../utils/time';

export async function getMyAppointments(req: Request, res: Response): Promise<void> {
  try {
    const patientId = req.user!.id;
    const { date: today } = getIST();

    const { rows } = await query<Record<string, unknown>>(
      `SELECT a.id, a.reference_code, a.appointment_date::text,
              a.token_number, a.session_index, a.is_emergency,
              a.status, a.booking_channel, a.reason_for_visit, a.cancellation_reason,
              a.cancelled_by_role,
              d.display_name AS doctor_name, d.specialization
       FROM appointments a
       JOIN doctors d ON a.doctor_id = d.id
       WHERE a.patient_id = $1
       ORDER BY a.appointment_date DESC, a.token_number ASC`,
      [patientId]
    );

    const terminalStatuses = new Set(['cancelled', 'completed', 'no_show']);
    const upcoming = rows.filter(
      (r) => (r['appointment_date'] as string) >= today && !terminalStatuses.has(r['status'] as string)
    );
    const past = rows.filter(
      (r) => (r['appointment_date'] as string) < today || terminalStatuses.has(r['status'] as string)
    );

    res.json({ upcoming, past });
  } catch (err) {
    console.error('getMyAppointments:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

export async function cancelMyAppointment(req: Request, res: Response): Promise<void> {
  try {
    const patientId = req.user!.id;
    const { id } = req.params;
    const { cancellationReason } = req.body as { cancellationReason?: string };

    const { rows } = await query<{
      id: string;
      status: string;
      appointment_date: string;
      token_number: number;
      session_index: number;
      patient_id: string;
      patient_name: string;
      patient_phone: string;
    }>(
      `SELECT a.id, a.status, a.appointment_date::text, a.token_number, a.session_index,
              a.patient_id, p.full_name AS patient_name, p.phone AS patient_phone
       FROM appointments a JOIN patients p ON a.patient_id = p.id
       WHERE a.id = $1`,
      [id]
    );
    if (!rows.length) { res.status(404).json({ error: 'NOT_FOUND' }); return; }

    const appt = rows[0];
    if (appt.patient_id !== patientId) { res.status(403).json({ error: 'FORBIDDEN' }); return; }
    if (['cancelled', 'completed', 'no_show'].includes(appt.status)) {
      res.status(400).json({ error: 'INVALID_STATE', message: `Cannot cancel a ${appt.status} appointment` });
      return;
    }
    if (appt.status === 'arrived') {
      res.status(403).json({ error: 'FORBIDDEN', message: 'Cannot cancel after you have arrived' });
      return;
    }

    await query(
      `UPDATE appointments
       SET status='cancelled', cancelled_at=NOW(), cancellation_reason=$1,
           cancelled_by_role='patient', updated_at=NOW()
       WHERE id=$2`,
      [cancellationReason || null, id]
    );

    await query(
      `INSERT INTO audit_logs (action, patient_id, entity_type, entity_id, new_values)
       VALUES ('appointment_cancelled', $1, 'appointment', $2, $3)`,
      [patientId, id, JSON.stringify({ cancelledBy: 'patient', reason: cancellationReason })]
    );

    await queueCancellationNotification({
      id,
      patientName: appt.patient_name,
      patientPhone: appt.patient_phone,
      tokenNumber: appt.token_number,
      sessionIndex: appt.session_index,
    });

    res.json({ message: 'Appointment cancelled' });
  } catch (err) {
    console.error('cancelMyAppointment:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}
