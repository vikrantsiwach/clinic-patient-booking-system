import { query } from '../db/pool';

interface SpamFilterResult {
  allowed: boolean;
  blockReason: string | null;
  isReturning: boolean;
  patientId: string | null;
}

interface VelocityResult {
  paused: boolean;
  callCount: number;
}

export async function checkSpamFilters(phone: string): Promise<SpamFilterResult> {
  const { rows } = await query<Record<string, unknown>>('SELECT * FROM check_spam_filters($1)', [phone]);
  if (!rows.length) return { allowed: false, blockReason: 'FILTER_ERROR', isReturning: false, patientId: null };
  const r = rows[0];
  return {
    allowed: r['allowed'] as boolean,
    blockReason: r['block_reason'] as string | null,
    isReturning: r['is_returning'] as boolean,
    patientId: r['patient_id_out'] as string | null,
  };
}

export async function checkVelocity(): Promise<VelocityResult> {
  const windowStart = new Date(Math.floor(Date.now() / (10 * 60 * 1000)) * 10 * 60 * 1000);

  const { rows } = await query<{ call_count: number; is_paused: boolean }>(
    `INSERT INTO missed_call_velocity (window_start, call_count, is_paused)
     VALUES ($1, 1, FALSE)
     ON CONFLICT (window_start)
     DO UPDATE SET call_count = missed_call_velocity.call_count + 1
     RETURNING call_count, is_paused`,
    [windowStart]
  );

  const { rows: config } = await query<{ value: number }>(
    `SELECT value::int FROM missed_call_config WHERE key = 'system_burst_threshold'`
  );
  const threshold = config[0]?.value || 15;
  const callCount = rows[0]?.call_count || 1;
  const paused = callCount > threshold;

  if (paused) {
    await query(
      `UPDATE missed_call_velocity SET is_paused = TRUE WHERE window_start = $1`,
      [windowStart]
    );
  }

  return { paused, callCount };
}

export async function incrementRateLimit(phone: string): Promise<void> {
  await query(
    `INSERT INTO missed_call_rate_limits (phone, window_24h, window_7d, last_call_at)
     VALUES ($1, 1, 1, NOW())
     ON CONFLICT (phone)
     DO UPDATE SET
       window_24h = missed_call_rate_limits.window_24h + 1,
       window_7d  = missed_call_rate_limits.window_7d + 1,
       last_call_at = NOW(),
       updated_at = NOW()`,
    [phone]
  );

  const { rows: rl } = await query<{ violation_count: number }>(
    `SELECT violation_count FROM missed_call_rate_limits WHERE phone = $1`, [phone]
  );
  const { rows: cfg } = await query<{ value: number }>(
    `SELECT value::int FROM missed_call_config WHERE key = 'violation_auto_blacklist_at'`
  );
  const autoBlacklistAt = cfg[0]?.value || 5;

  if (rl[0] && rl[0].violation_count >= autoBlacklistAt) {
    await query(
      `INSERT INTO phone_blacklist (phone, reason, is_permanent, expires_at, notes)
       VALUES ($1, 'auto_repeated_spam', FALSE, NOW() + INTERVAL '7 days', 'Auto-blacklisted after repeated violations')
       ON CONFLICT (phone) DO NOTHING`,
      [phone]
    );
  }
}

export async function expireOldSessions(): Promise<number> {
  const { rowCount } = await query(
    `UPDATE missed_call_sessions
     SET status = 'expired', updated_at = NOW()
     WHERE status = 'pending' AND expires_at < NOW()`
  );
  return rowCount ?? 0;
}

export async function cleanupRateLimits(): Promise<number> {
  const { rowCount } = await query(
    `DELETE FROM missed_call_rate_limits WHERE last_call_at < NOW() - INTERVAL '7 days'`
  );
  return rowCount ?? 0;
}
