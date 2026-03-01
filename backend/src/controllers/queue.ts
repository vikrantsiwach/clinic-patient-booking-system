import { Request, Response } from 'express';
import { query } from '../db/pool';
import { getIST } from '../utils/time';
import { Session } from '../types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatTime(t: string | null): string {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hr = h % 12 || 12;
  return m === 0 ? `${hr} ${period}` : `${hr}:${String(m).padStart(2, '0')} ${period}`;
}

export async function getTodayQueue(req: Request, res: Response): Promise<void> {
  try {
    const doctorId = req.query.doctorId as string;
    if (!doctorId || !UUID_RE.test(doctorId)) {
      res.status(400).json({ error: 'BAD_REQUEST', message: 'doctorId query param is required' });
      return;
    }

    const { date: today, dayOfWeek, nowMins } = getIST();

    const { rows: blocked } = await query(
      `SELECT id FROM blocked_dates WHERE doctor_id = $1 AND block_date = $2 AND (start_time IS NULL AND end_time IS NULL)`,
      [doctorId, today]
    );
    if (blocked.length) { res.json({ date: today, closed: true, reason: 'blocked', sessions: [] }); return; }

    const { rows: schedRows } = await query<{
      sessions_json: Session[];
      slot_duration_mins: number;
      max_appointments: number;
    }>(
      `SELECT sessions_json, slot_duration_mins, max_appointments
       FROM schedules WHERE doctor_id = $1 AND day_of_week = $2::day_of_week AND is_active = TRUE`,
      [doctorId, dayOfWeek]
    );

    if (!schedRows.length) { res.json({ date: today, closed: true, reason: 'no_schedule', sessions: [] }); return; }

    const sched = schedRows[0];
    const sessions = sched.sessions_json;
    if (!sessions || !sessions.length) { res.json({ date: today, closed: true, reason: 'no_sessions', sessions: [] }); return; }

    const { rows: tokenCounts } = await query<{ session_index: number; count: number }>(
      `SELECT session_index, COUNT(*)::int AS count
       FROM appointments
       WHERE doctor_id = $1 AND appointment_date = $2 AND status NOT IN ('cancelled')
       GROUP BY session_index`,
      [doctorId, today]
    );
    const countMap: Record<number, number> = {};
    tokenCounts.forEach(r => { countMap[r.session_index] = r.count; });

    const sessionData = sessions.map((s: Session, idx: number) => {
      const [fh, fm] = s.from.split(':').map(Number);
      const [th, tm] = s.to.split(':').map(Number);
      const fromMins = fh * 60 + fm;
      let toMins = th * 60 + tm;
      if (toMins < fromMins) toMins += 24 * 60;

      const maxTokens = s.max != null ? s.max : null;
      const tokenCount = countMap[idx] || 0;
      const isFull = maxTokens !== null && tokenCount >= maxTokens;
      const isUpcoming = nowMins < fromMins;
      const isEnded = nowMins >= toMins;
      const isOpen = !isUpcoming && !isEnded && !isFull;

      return {
        index: idx,
        label: `Session ${idx + 1}`,
        from: s.from,
        to: s.to,
        fromLabel: formatTime(s.from),
        toLabel: formatTime(s.to),
        isOpen,
        isUpcoming,
        isEnded,
        tokenCount,
        maxTokens,
        isFull,
      };
    });

    res.json({ date: today, closed: false, sessions: sessionData });
  } catch (err) {
    console.error('getTodayQueue:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

export async function getQueuePosition(req: Request, res: Response): Promise<void> {
  try {
    const { refCode } = req.params;

    const { rows: apptRows } = await query<{
      id: string;
      token_number: number;
      session_index: number;
      is_emergency: boolean;
      status: string;
      doctor_id: string;
      appointment_date: string;
    }>(
      `SELECT a.id, a.token_number, a.session_index, a.is_emergency,
              a.status, a.doctor_id, a.appointment_date
       FROM appointments a WHERE a.reference_code = $1`,
      [refCode]
    );
    if (!apptRows.length) { res.status(404).json({ error: 'NOT_FOUND' }); return; }

    const appt = apptRows[0];
    const label = `Session ${appt.session_index + 1}`;

    const { rows: queueRows } = await query<{
      id: string;
      token_number: number;
      is_emergency: boolean;
      status: string;
    }>(
      `SELECT id, token_number, is_emergency, status
       FROM appointments
       WHERE doctor_id = $1 AND appointment_date = $2 AND session_index = $3
         AND status NOT IN ('cancelled')
       ORDER BY is_emergency DESC, token_number ASC`,
      [appt.doctor_id, appt.appointment_date, appt.session_index]
    );

    const myRank = queueRows.findIndex(r => r.id === appt.id);
    const tokensAhead = queueRows.slice(0, myRank).filter(
      r => !['completed', 'no_show', 'cancelled'].includes(r.status)
    ).length;

    const serving = queueRows.slice(0, myRank + 1).reverse().find(
      r => ['confirmed', 'arrived'].includes(r.status)
    );

    res.json({
      token: appt.token_number,
      isEmergency: appt.is_emergency,
      status: appt.status,
      tokensAhead,
      currentlyServing: serving?.token_number || null,
      sessionLabel: label,
    });
  } catch (err) {
    console.error('getQueuePosition:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}
