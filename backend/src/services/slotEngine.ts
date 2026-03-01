import { query } from '../db/pool';
import { SlotOption } from '../types';

interface SlotResult {
  morning: string[];
  evening: string[];
  slotDurationMins: number;
}

function generateTimes(start: string | null, end: string | null, intervalMins: number): string[] {
  const slots: string[] = [];
  if (!start || !end) return slots;

  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let cur = sh * 60 + sm;
  let endMins = eh * 60 + em;

  if (endMins < cur) endMins += 24 * 60;

  while (cur + intervalMins <= endMins) {
    const h = (Math.floor(cur / 60) % 24).toString().padStart(2, '0');
    const m = (cur % 60).toString().padStart(2, '0');
    slots.push(`${h}:${m}`);
    cur += intervalMins;
  }
  return slots;
}

export async function getDoctorId(): Promise<string> {
  const { rows } = await query<{ id: string }>('SELECT id FROM doctors WHERE is_active = TRUE LIMIT 1');
  if (!rows.length) throw new Error('No active doctor found');
  return rows[0].id;
}

export async function getAvailableSlots(date: string): Promise<SlotResult> {
  const doctorId = await getDoctorId();

  const dayName = new Date(date + 'T00:00:00')
    .toLocaleDateString('en-US', { weekday: 'long' })
    .toLowerCase();

  const { rows: schedRows } = await query<Record<string, unknown>>(
    `SELECT * FROM schedules WHERE doctor_id = $1 AND day_of_week = $2 AND is_active = TRUE`,
    [doctorId, dayName]
  );
  if (!schedRows.length) return { morning: [], evening: [], slotDurationMins: 20 };

  const sched = schedRows[0];
  const sessions = (sched['sessions_json'] as Array<Record<string, unknown>>) || [];
  const duration = (sessions[0]?.['slot'] as number) || (sched['slot_duration_mins'] as number);

  const allMorning = generateTimes(
    (sessions[0]?.['from'] as string) || null,
    (sessions[0]?.['to'] as string) || null,
    (sessions[0]?.['slot'] as number) || duration
  );
  const allEvening = sessions.slice(1).flatMap((s) =>
    generateTimes(s['from'] as string, s['to'] as string, (s['slot'] as number) || duration)
  );

  const { rows: bookedRows } = await query<{ slot_time: string }>(
    `SELECT to_char(slot_time, 'HH24:MI') AS slot_time
     FROM appointments
     WHERE doctor_id = $1 AND appointment_date = $2
       AND status NOT IN ('cancelled')`,
    [doctorId, date]
  );
  const booked = new Set(bookedRows.map((r) => r.slot_time));

  const { rows: blockedRows } = await query<{ start_time: string | null; end_time: string | null }>(
    `SELECT start_time, end_time FROM blocked_dates WHERE doctor_id = $1 AND block_date = $2`,
    [doctorId, date]
  );

  const isBlocked = (slot: string): boolean => {
    for (const b of blockedRows) {
      if (!b.start_time) return true;
      const slotMins = timeToMins(slot);
      const startMins = timeToMins(b.start_time.slice(0, 5));
      const endMins = timeToMins((b.end_time as string).slice(0, 5));
      if (slotMins >= startMins && slotMins < endMins) return true;
    }
    return false;
  };

  const isPast = (slot: string): boolean => {
    const today = new Date().toISOString().slice(0, 10);
    if (date > today) return false;
    if (date < today) return true;
    const now = new Date();
    const [h, m] = slot.split(':').map(Number);
    return h * 60 + m <= now.getHours() * 60 + now.getMinutes();
  };

  const filterSlots = (slots: string[]) =>
    slots.filter((s) => !booked.has(s) && !isBlocked(s) && !isPast(s));

  return {
    morning: filterSlots(allMorning),
    evening: filterSlots(allEvening),
    slotDurationMins: duration,
  };
}

export async function getAvailableMonthDates(month: string): Promise<string[]> {
  const doctorId = await getDoctorId();

  const [year, mon] = month.split('-').map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);

  const { rows: schedRows } = await query<{ day_of_week: string }>(
    `SELECT day_of_week FROM schedules WHERE doctor_id = $1 AND is_active = TRUE`,
    [doctorId]
  );
  const scheduledDays = new Set(schedRows.map((r) => r.day_of_week));

  const { rows: blockedRows } = await query<{ block_date: string }>(
    `SELECT block_date::text AS block_date
     FROM blocked_dates
     WHERE doctor_id = $1
       AND block_date >= $2 AND block_date <= $3
       AND start_time IS NULL`,
    [doctorId, `${month}-01`, `${month}-${String(daysInMonth).padStart(2, '0')}`]
  );
  const fullyBlocked = new Set(blockedRows.map((r) => r.block_date));

  const { rows: maxedRows } = await query<{ d: string }>(
    `SELECT appointment_date::text AS d, COUNT(*) AS cnt, s.max_appointments
     FROM appointments a
     JOIN schedules s ON s.doctor_id = a.doctor_id
       AND s.day_of_week = TRIM(LOWER(TO_CHAR(a.appointment_date, 'Day')))::day_of_week
     WHERE a.doctor_id = $1
       AND a.appointment_date >= $2 AND a.appointment_date <= $3
       AND a.status NOT IN ('cancelled')
     GROUP BY a.appointment_date, s.max_appointments
     HAVING COUNT(*) >= s.max_appointments`,
    [doctorId, `${month}-01`, `${month}-${String(daysInMonth).padStart(2, '0')}`]
  );
  const maxed = new Set(maxedRows.map((r) => r.d));

  const availableDates: string[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${month}-${String(d).padStart(2, '0')}`;
    if (dateStr < today) continue;
    const dayName = new Date(dateStr + 'T00:00:00')
      .toLocaleDateString('en-US', { weekday: 'long' })
      .toLowerCase();
    if (!scheduledDays.has(dayName)) continue;
    if (fullyBlocked.has(dateStr)) continue;
    if (maxed.has(dateStr)) continue;
    availableDates.push(dateStr);
  }

  return availableDates;
}

export async function getNextAvailableSlots(count = 3): Promise<SlotOption[]> {
  const slots: SlotOption[] = [];
  const today = new Date().toISOString().slice(0, 10);
  const [ty, tm, td] = today.split('-').map(Number);

  let checked = 0;
  const maxLookahead = 14;

  while (slots.length < count && checked < maxLookahead) {
    const d = new Date(ty, tm - 1, td + checked);
    const dateStr = d.toISOString().slice(0, 10);
    const available = await getAvailableSlots(dateStr);
    const all = [...available.morning, ...available.evening];
    for (const time of all) {
      if (slots.length >= count) break;
      slots.push({ date: dateStr, time });
    }
    checked++;
  }
  return slots;
}

function timeToMins(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
