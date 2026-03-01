import { query } from '../db/pool';
import { sendSMS, templates } from './sms';
import { AppointmentCore } from '../types';

interface NotificationPayload {
  appointmentId: string;
  type: string;
  channel: string;
  recipientPhone: string;
  recipientEmail?: string | null;
  messageBody: string;
  scheduledFor: Date;
}

async function queueNotification(payload: NotificationPayload): Promise<void> {
  const { appointmentId, type, channel, recipientPhone, recipientEmail, messageBody, scheduledFor } = payload;
  await query(
    `INSERT INTO notifications (appointment_id, notification_type, channel, recipient_phone, recipient_email, message_body, scheduled_for)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [appointmentId, type, channel, recipientPhone, recipientEmail, messageBody, scheduledFor]
  );
}

export async function queueAppointmentNotifications(appointment: AppointmentCore): Promise<void> {
  const { id, patientName, patientPhone, tokenNumber, referenceCode, sessionIndex } = appointment;
  const sessionLabel = `Session ${(sessionIndex ?? 0) + 1}`;

  await queueNotification({
    appointmentId: id,
    type: 'confirmation',
    channel: 'sms',
    recipientPhone: patientPhone,
    messageBody: templates.tokenConfirmation(patientName, tokenNumber, sessionLabel, referenceCode),
    scheduledFor: new Date(),
  });
}

export async function queueCancellationNotification(appointment: Pick<AppointmentCore, 'id' | 'patientName' | 'patientPhone' | 'tokenNumber' | 'sessionIndex'>): Promise<void> {
  const { id, patientName, patientPhone, tokenNumber, sessionIndex } = appointment;
  const sessionLabel = `Session ${(sessionIndex ?? 0) + 1}`;

  await queueNotification({
    appointmentId: id,
    type: 'cancellation',
    channel: 'sms',
    recipientPhone: patientPhone,
    messageBody: templates.tokenCancellation(patientName, tokenNumber, sessionLabel),
    scheduledFor: new Date(),
  });
}

export async function sendPendingNotifications(): Promise<{ sent: number; failed: number }> {
  const { rows } = await query<Record<string, unknown>>(
    `SELECT * FROM v_notification_queue LIMIT 50`
  );

  let sent = 0, failed = 0;
  for (const notif of rows) {
    try {
      const result = await sendSMS(notif['recipient_phone'] as string, notif['message_body'] as string);
      await query(
        `UPDATE notifications SET status = 'sent', sent_at = NOW(), provider_message_id = $1 WHERE id = $2`,
        [result.messageId, notif['id']]
      );
      sent++;
    } catch (err) {
      await query(
        `UPDATE notifications SET status = 'failed', error_message = $1, retry_count = retry_count + 1 WHERE id = $2`,
        [(err as Error).message, notif['id']]
      );
      failed++;
    }
  }
  return { sent, failed };
}
