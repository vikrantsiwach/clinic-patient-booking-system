import env from '../config/env';
import fs from 'fs';
import path from 'path';
import { SmsResult } from '../types';

const LOG_FILE = path.join(__dirname, '../../sms_mock_log.jsonl');

function logMock(to: string, message: string, type = 'SMS'): SmsResult {
  const entry = {
    timestamp: new Date().toISOString(),
    type,
    to,
    message,
    mockId: `MOCK-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
  };
  console.log(`\n📱 [MOCK ${type}] → ${to}\n   ${message}\n   ID: ${entry.mockId}\n`);
  try {
    fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
  } catch {}
  return { success: true, messageId: entry.mockId, mock: true };
}

export async function sendSMS(phone: string, message: string): Promise<SmsResult> {
  if (env.SMS_MOCK) return logMock(phone, message, 'SMS');

  const url = 'https://api.msg91.com/api/v5/flow/';
  const res = await fetch(url, {
    method: 'POST',
    headers: { authkey: env.MSG91_AUTH_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: env.MSG91_SENDER_ID,
      route: '4',
      country: '91',
      sms: [{ message, to: [phone] }],
    }),
  });
  const data = await res.json() as Record<string, unknown>;
  return { success: data['type'] === 'success', messageId: data['request_id'] as string, raw: data };
}

interface SlotLabel { date: string; time: string }

export const templates = {
  appointmentConfirmation: (name: string, date: string, time: string, ref: string) =>
    `Hi ${name}, your appointment is confirmed for ${date} at ${time}. Ref: ${ref}. Reply CANCEL to cancel. - Clinic`,

  reminder: (name: string, date: string, time: string) =>
    `Reminder: Hi ${name}, your appointment is tomorrow (${date}) at ${time}. Please arrive 5 mins early. - Clinic`,

  reminder2h: (name: string, time: string) =>
    `Reminder: Hi ${name}, your appointment is in 2 hours at ${time}. - Clinic`,

  cancellationConfirm: (name: string, date: string, time: string) =>
    `Hi ${name}, your appointment on ${date} at ${time} has been cancelled. To rebook visit our website. - Clinic`,

  rescheduleConfirm: (name: string, newDate: string, newTime: string, ref: string) =>
    `Hi ${name}, your appointment has been rescheduled to ${newDate} at ${newTime}. Ref: ${ref}. - Clinic`,

  otpMessage: (otp: string) =>
    `Your clinic OTP is ${otp}. Valid for 10 minutes. Do not share. - Clinic`,

  missedCallOptions: (token: string, s1: SlotLabel, s2: SlotLabel, s3: SlotLabel, vmn: string) =>
    `Clinic Appointment Options:\n` +
    `Reply 1${token} for ${s1.date} ${s1.time}\n` +
    `Reply 2${token} for ${s2.date} ${s2.time}\n` +
    `Reply 3${token} for ${s3.date} ${s3.time}\n` +
    `Reply CANCEL to skip. Expires in 15 mins. Missed call # ${vmn}`,

  missedCallConfirm: (name: string, date: string, time: string, ref: string) =>
    `Confirmed! Appointment on ${date} at ${time}. Ref: ${ref}. Reply CANCEL to cancel. - Clinic`,

  missedCallExpired: () =>
    `Your booking session expired (15 min window). Give another missed call to rebook. - Clinic`,

  missedCallSlotTaken: (token: string, s1: SlotLabel, s2: SlotLabel, s3: SlotLabel) =>
    `Sorry, that slot was just taken. New options:\n` +
    `Reply 1${token} for ${s1.date} ${s1.time}\n` +
    `Reply 2${token} for ${s2.date} ${s2.time}\n` +
    `Reply 3${token} for ${s3.date} ${s3.time}`,

  missedCallDuplicate: (date: string, time: string, ref: string) =>
    `You already have an upcoming appointment on ${date} at ${time}. Ref: ${ref}. - Clinic`,

  tokenConfirmation: (name: string, token: number, sessionLabel: string, ref: string) =>
    `Hi ${name}, Token #${token} booked for ${sessionLabel} session today. Ref: ${ref}. Track queue at clinic. - Clinic`,

  tokenCancellation: (name: string, token: number, sessionLabel: string) =>
    `Hi ${name}, Token #${token} (${sessionLabel} session) has been cancelled. To rebook visit our website. - Clinic`,
};
