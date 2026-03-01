// All session times in the DB are configured as IST (Asia/Kolkata, UTC+5:30).
// Vercel functions run in UTC, so we must shift to IST before any comparisons.

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // 5h 30m

const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'] as const;

export interface ISTNow {
  /** YYYY-MM-DD in IST */
  date: string;
  /** e.g. 'wednesday' */
  dayOfWeek: string;
  /** minutes since midnight IST, e.g. 13*60+30 = 810 for 1:30 PM */
  nowMins: number;
}

export function getIST(): ISTNow {
  // Shift UTC epoch to IST by adding 5h30m, then use UTC accessors to read IST values.
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  const date = ist.toISOString().slice(0, 10);         // YYYY-MM-DD (UTC of shifted time = IST date)
  const dayOfWeek = DAYS[ist.getUTCDay()];
  const nowMins = ist.getUTCHours() * 60 + ist.getUTCMinutes();
  return { date, dayOfWeek, nowMins };
}
