import { Request, Response } from 'express';
import { query, transaction } from '../db/pool';
import { checkSpamFilters, checkVelocity, incrementRateLimit } from '../services/spamFilter';
import { getNextAvailableSlots, getDoctorId } from '../services/slotEngine';
import { sendSMS, templates } from '../services/sms';
import { queueAppointmentNotifications } from '../services/notification';
import env from '../config/env';

function fmtDate(dateStr: string): string {
  const [, m, d] = dateStr.split('-');
  const names = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${names[parseInt(m) - 1]}`;
}

export async function handleMissedCall(req: Request, res: Response): Promise<void> {
  res.status(200).json({ received: true });

  const body = req.body as Record<string, unknown>;
  const callerPhone = (body['caller_phone'] || body['callerPhone'] || body['mobile']) as string | undefined;
  if (!callerPhone) return;

  try {
    const { rows: cfg } = await query<{ value: string }>(`SELECT value FROM missed_call_config WHERE key='system_enabled'`);
    if (cfg[0]?.value === 'false') return;

    const { rows: eventRows } = await query<{ id: string }>(
      `INSERT INTO missed_call_events (caller_phone, call_duration_secs, provider_call_id, ip_of_webhook, raw_payload, status)
       VALUES ($1, $2, $3, $4, $5, 'received') RETURNING id`,
      [callerPhone, body['duration'] || 0, body['call_id'] || null, req.ip, JSON.stringify(body)]
    );
    const eventId = eventRows[0].id;

    const velocity = await checkVelocity();
    if (velocity.paused) {
      await query(`UPDATE missed_call_events SET status='velocity_blocked' WHERE id=$1`, [eventId]);
      return;
    }

    const filter = await checkSpamFilters(callerPhone);
    if (!filter.allowed) {
      const statusMap: Record<string, string> = {
        BLACKLISTED: 'blacklisted',
        RATE_LIMITED_24H: 'rate_limited',
        RATE_LIMITED_7D: 'rate_limited',
        DUPLICATE_ACTIVE_APPOINTMENT: 'duplicate_active',
      };
      await query(
        `UPDATE missed_call_events SET status=$1, block_reason=$2 WHERE id=$3`,
        [statusMap[filter.blockReason ?? ''] || 'rate_limited', filter.blockReason, eventId]
      );

      if (filter.blockReason === 'DUPLICATE_ACTIVE_APPOINTMENT' && filter.patientId) {
        const { rows: apptRows } = await query<Record<string, unknown>>(
          `SELECT appointment_date::text, to_char(slot_time,'HH24:MI') AS slot_time, reference_code
           FROM appointments WHERE patient_id=$1 AND status IN ('booked','confirmed') AND appointment_date >= CURRENT_DATE LIMIT 1`,
          [filter.patientId]
        );
        if (apptRows.length) {
          const a = apptRows[0];
          await sendSMS(callerPhone, templates.missedCallDuplicate(
            fmtDate(a['appointment_date'] as string),
            a['slot_time'] as string,
            a['reference_code'] as string
          ));
        }
      }
      return;
    }

    // TODO: assign token directly instead of sending slot options
    const slots = await getNextAvailableSlots(3);
    if (slots.length < 1) return;

    const { rows: tokenRows } = await query<{ token: string }>(`SELECT generate_session_token() AS token`);
    const token = tokenRows[0].token;

    const s1 = slots[0], s2 = slots[1] || slots[0], s3 = slots[2] || slots[1] || slots[0];

    const { rows: expiryCfg } = await query<{ value: string }>(`SELECT value FROM missed_call_config WHERE key='session_expiry_minutes'`);
    const expiryMins = parseInt(expiryCfg[0]?.value || '15');

    const { rows: sessionRows } = await query<{ id: string }>(
      `INSERT INTO missed_call_sessions
         (missed_call_event_id, patient_phone, patient_id, session_token,
          slot_option_1_date, slot_option_1_time, slot_option_2_date, slot_option_2_time,
          slot_option_3_date, slot_option_3_time, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, NOW() + ($11 || ' minutes')::interval)
       RETURNING id`,
      [eventId, callerPhone, filter.patientId || null, token,
       s1.date, s1.time + ':00', s2.date, s2.time + ':00', s3.date, s3.time + ':00',
       expiryMins]
    );
    const sessionId = sessionRows[0].id;

    const { rows: delayCfg } = await query<{ value: string }>(`SELECT value FROM missed_call_config WHERE key='new_number_delay_seconds'`);
    const delaySecs = !filter.isReturning ? parseInt(delayCfg[0]?.value || '60') : 0;

    const sendOptions = async () => {
      const msg = templates.missedCallOptions(
        token,
        { date: fmtDate(s1.date), time: s1.time },
        { date: fmtDate(s2.date), time: s2.time },
        { date: fmtDate(s3.date), time: s3.time },
        env.MSG91_MISSED_CALL_VMN
      );
      const smsResult = await sendSMS(callerPhone, msg);
      await query(`UPDATE missed_call_sessions SET sms_sent_at=NOW(), sms_provider_id=$1 WHERE id=$2`, [smsResult.messageId, sessionId]);
      await query(`UPDATE missed_call_events SET status='sms_sent', session_id=$1 WHERE id=$2`, [sessionId, eventId]);
      await incrementRateLimit(callerPhone);
    };

    if (delaySecs > 0) {
      setTimeout(sendOptions, delaySecs * 1000);
    } else {
      await sendOptions();
    }
  } catch (err) {
    console.error('handleMissedCall:', err);
  }
}

export async function handleSmsReply(req: Request, res: Response): Promise<void> {
  res.status(200).json({ received: true });

  const body = req.body as Record<string, unknown>;
  const phone = (body['mobile'] || body['phone']) as string | undefined;
  const rawReply = ((body['message'] as string) || '').trim().toUpperCase();
  if (!phone || !rawReply) return;

  try {
    if (rawReply === 'CANCEL') {
      const { rows: apptRows } = await query<Record<string, unknown>>(
        `SELECT a.id, a.appointment_date::text, to_char(a.slot_time,'HH24:MI') AS slot_time, a.reference_code
         FROM appointments a JOIN patients p ON a.patient_id=p.id
         WHERE p.phone=$1 AND a.status IN ('booked','confirmed') AND a.appointment_date >= CURRENT_DATE
         ORDER BY a.appointment_date ASC LIMIT 1`,
        [phone]
      );
      if (apptRows.length) {
        const a = apptRows[0];
        await query(`UPDATE appointments SET status='cancelled', cancelled_at=NOW(), cancelled_by_role='patient' WHERE id=$1`, [a['id']]);
        await sendSMS(phone, templates.cancellationConfirm('', fmtDate(a['appointment_date'] as string), a['slot_time'] as string));
      }
      return;
    }

    const match = rawReply.match(/^([123])([A-Z0-9]{3,6})$/);
    if (!match) return;

    const chosenOption = parseInt(match[1]);
    const token = match[2];

    const { rows: sessions } = await query<Record<string, unknown>>(
      `SELECT * FROM missed_call_sessions
       WHERE patient_phone=$1 AND session_token=$2 AND status='pending'
       ORDER BY created_at DESC LIMIT 1`,
      [phone, token]
    );
    if (!sessions.length) return;

    const session = sessions[0];

    if (new Date() > new Date(session['expires_at'] as string)) {
      await query(`UPDATE missed_call_sessions SET status='expired', updated_at=NOW() WHERE id=$1`, [session['id']]);
      await sendSMS(phone, templates.missedCallExpired());
      return;
    }

    const dateKey = `slot_option_${chosenOption}_date`;
    const timeKey = `slot_option_${chosenOption}_time`;
    const slotDate = session[dateKey] as string | undefined;
    const slotTime = (session[timeKey] as string | undefined)?.slice(0, 5);
    if (!slotDate || !slotTime) return;

    let patientId = session['patient_id'] as string | null;
    if (!patientId) {
      const { rows: patRows } = await query<{ id: string }>(
        `INSERT INTO patients (phone, full_name) VALUES ($1, 'Patient') ON CONFLICT (phone) DO UPDATE SET updated_at=NOW() RETURNING id`,
        [phone]
      );
      patientId = patRows[0].id;
    }

    const { rows: patRows } = await query<{ full_name: string }>(`SELECT full_name FROM patients WHERE id=$1`, [patientId]);
    const patientName = patRows[0]?.full_name || 'Patient';

    try {
      const doctorId = await getDoctorId();
      const { rows: seqRows } = await query<{ seq: number }>(`SELECT nextval('appointment_ref_seq') AS seq`);
      const refCode = `APT-${new Date().getFullYear()}-${String(seqRows[0].seq).padStart(5, '0')}`;

      const { rows: schedRows } = await query<{ slot_duration_mins: number }>(
        `SELECT slot_duration_mins FROM schedules
         WHERE doctor_id=$1 AND day_of_week=TRIM(LOWER(TO_CHAR($2::date,'Day')))::day_of_week`,
        [doctorId, slotDate]
      );
      const dur = schedRows[0]?.slot_duration_mins || 20;
      const [sh, sm] = slotTime.split(':').map(Number);
      const endMins = sh * 60 + sm + dur;
      const slotEndTime = `${String(Math.floor(endMins / 60)).padStart(2, '0')}:${String(endMins % 60).padStart(2, '0')}`;

      await transaction(async (client) => {
        const { rows: conflict } = await client.query(
          `SELECT id FROM appointments
           WHERE doctor_id=$1 AND appointment_date=$2 AND slot_time=$3 AND status NOT IN ('cancelled')
           FOR UPDATE SKIP LOCKED`,
          [doctorId, slotDate, slotTime + ':00']
        );
        if (conflict.length) {
          const newSlots = await getNextAvailableSlots(3);
          if (newSlots.length >= 1) {
            const { rows: newToken } = await client.query<{ token: string }>(`SELECT generate_session_token() AS token`);
            const nt = newToken[0].token;
            const ns1 = newSlots[0], ns2 = newSlots[1] || newSlots[0], ns3 = newSlots[2] || newSlots[1] || newSlots[0];

            await client.query(`UPDATE missed_call_sessions SET status='expired' WHERE id=$1`, [session['id']]);
            await client.query(
              `INSERT INTO missed_call_sessions (missed_call_event_id, patient_phone, patient_id, session_token,
               slot_option_1_date, slot_option_1_time, slot_option_2_date, slot_option_2_time,
               slot_option_3_date, slot_option_3_time, expires_at)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, NOW() + INTERVAL '15 minutes')`,
              [session['missed_call_event_id'], phone, patientId, nt,
               ns1.date, ns1.time+':00', ns2.date, ns2.time+':00', ns3.date, ns3.time+':00']
            );

            await sendSMS(phone, templates.missedCallSlotTaken(nt,
              { date: fmtDate(ns1.date), time: ns1.time },
              { date: fmtDate(ns2.date), time: ns2.time },
              { date: fmtDate(ns3.date), time: ns3.time }
            ));
          }
          return;
        }

        await client.query(
          `INSERT INTO appointments (patient_id, doctor_id, appointment_date, slot_time, slot_end_time, booking_channel, reference_code)
           VALUES ($1,$2,$3,$4,$5,'missed_call',$6)`,
          [patientId, doctorId, slotDate, slotTime+':00', slotEndTime+':00', refCode]
        );

        await client.query(
          `UPDATE missed_call_sessions SET status='completed', chosen_option=$1, patient_reply=$2, reply_received_at=NOW(), updated_at=NOW() WHERE id=$3`,
          [chosenOption, rawReply, session['id']]
        );
        await client.query(`UPDATE missed_call_events SET status='booked' WHERE id=$1`, [session['missed_call_event_id']]);
      });

      await sendSMS(phone, templates.missedCallConfirm(patientName, fmtDate(slotDate), slotTime, refCode));

      const { rows: newAppt } = await query<{ id: string }>(`SELECT id FROM appointments WHERE reference_code=$1`, [refCode]);
      if (newAppt.length) {
        await queueAppointmentNotifications({
          id: newAppt[0].id,
          referenceCode: refCode,
          patientName,
          patientPhone: phone,
          appointmentDate: slotDate,
          tokenNumber: 0,
          sessionIndex: 0,
        });
      }
    } catch (bookErr) {
      if ((bookErr as NodeJS.ErrnoException).code === '23505') {
        await sendSMS(phone, templates.missedCallExpired());
      } else {
        throw bookErr;
      }
    }
  } catch (err) {
    console.error('handleSmsReply:', err);
  }
}
