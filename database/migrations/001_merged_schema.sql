-- ============================================================
--  CLINIC APPOINTMENT SYSTEM — MERGED DATABASE SCHEMA
--  PostgreSQL — All 14 Tables
--  Merged from: clinic_schema.sql (v1.0) + clinic_schema_missed_call.sql (v1.1)
--  Generated: March 2026
--
--  Tables:
--    CORE (v1.0)
--    1.  users
--    2.  doctors
--    3.  schedules
--    4.  blocked_dates
--    5.  patients
--    6.  appointments
--    7.  notifications
--    8.  audit_logs
--
--    MISSED CALL (v1.1)
--    9.  missed_call_events
--    10. missed_call_sessions
--    11. missed_call_rate_limits
--    12. phone_blacklist
--    13. missed_call_config
--    14. missed_call_velocity
-- ============================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMS — CORE
-- ============================================================

CREATE TYPE user_role AS ENUM (
  'admin',
  'doctor',
  'receptionist'
);

CREATE TYPE appointment_status AS ENUM (
  'booked',
  'confirmed',
  'arrived',
  'completed',
  'cancelled',
  'no_show'
);

CREATE TYPE booking_channel AS ENUM (
  'online',
  'missed_call',
  'walkin'
);

CREATE TYPE notification_type AS ENUM (
  'confirmation',
  'reminder_48h',
  'reminder_2h',
  'cancellation',
  'reschedule',
  'missed_call_options',
  'missed_call_confirmation'
);

CREATE TYPE notification_channel AS ENUM (
  'sms',
  'whatsapp',
  'email'
);

CREATE TYPE notification_status AS ENUM (
  'pending',
  'sent',
  'failed',
  'skipped'
);

CREATE TYPE day_of_week AS ENUM (
  'monday', 'tuesday', 'wednesday', 'thursday',
  'friday', 'saturday', 'sunday'
);

CREATE TYPE audit_action AS ENUM (
  'login',
  'logout',
  'appointment_created',
  'appointment_cancelled',
  'appointment_rescheduled',
  'appointment_status_changed',
  'schedule_updated',
  'blocked_date_added',
  'blocked_date_removed',
  'patient_record_updated',
  'staff_account_created',
  'staff_account_deactivated',
  'staff_status_updated',
  'blacklist_add',
  'blacklist_remove'
);

-- ============================================================
-- ENUMS — MISSED CALL
-- ============================================================

CREATE TYPE missed_call_status AS ENUM (
  'received',
  'rate_limited',
  'blacklisted',
  'invalid_number',
  'velocity_blocked',
  'duplicate_active',
  'sms_sent',
  'sms_failed',
  'session_expired',
  'booked',
  'cancelled_by_patient'
);

CREATE TYPE session_status AS ENUM (
  'pending',
  'completed',
  'expired',
  'cancelled'
);

CREATE TYPE blacklist_reason AS ENUM (
  'manual_staff',
  'auto_velocity',
  'auto_repeated_spam',
  'dnd_registry',
  'invalid_format'
);

-- ============================================================
-- 1. USERS
-- ============================================================

CREATE TABLE users (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  email             VARCHAR(255)  NOT NULL UNIQUE,
  password_hash     VARCHAR(255)  NOT NULL,
  full_name         VARCHAR(255)  NOT NULL,
  role              user_role     NOT NULL DEFAULT 'receptionist',
  status            VARCHAR(20)   NOT NULL DEFAULT 'active' CHECK (status IN ('pending', 'active', 'suspended')),
  is_active         BOOLEAN       NOT NULL DEFAULT TRUE,
  last_login_at     TIMESTAMPTZ,
  password_reset_token        VARCHAR(255),
  password_reset_token_expiry TIMESTAMPTZ,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_users_email  ON users (email);
CREATE INDEX idx_users_status ON users (status);

COMMENT ON TABLE  users               IS 'Internal staff, doctor, and admin accounts. NOT used for patients.';
COMMENT ON COLUMN users.password_hash IS 'bcrypt hash, cost factor 12. Never store plaintext.';
COMMENT ON COLUMN users.is_active     IS 'Set FALSE to deactivate without deleting (preserves audit trail).';

-- ============================================================
-- 2. DOCTORS
-- ============================================================

CREATE TABLE doctors (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID          NOT NULL UNIQUE REFERENCES users(id) ON DELETE RESTRICT,
  full_name         VARCHAR(255)  NOT NULL,
  display_name      VARCHAR(255)  NOT NULL,
  specialization    VARCHAR(255)  NOT NULL,
  qualifications    TEXT,
  bio               TEXT,
  photo_url         VARCHAR(500),
  phone             VARCHAR(20),
  registration_no   VARCHAR(100),
  is_active         BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE  doctors            IS 'Doctor profile. Linked 1:1 to a user account.';
COMMENT ON COLUMN doctors.user_id    IS 'Every doctor must have a login account.';
COMMENT ON COLUMN doctors.display_name IS 'Public-facing name shown to patients on booking UI.';

-- ============================================================
-- 3. SCHEDULES
-- ============================================================

CREATE TABLE schedules (
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id           UUID          NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  day_of_week         day_of_week   NOT NULL,
  sessions_json       JSONB         NOT NULL DEFAULT '[]'::jsonb,
  slot_duration_mins  SMALLINT      NOT NULL DEFAULT 20  CHECK (slot_duration_mins IN (10, 15, 20, 30, 45, 60)),
  max_appointments    SMALLINT      NOT NULL DEFAULT 30  CHECK (max_appointments > 0),
  is_active           BOOLEAN       NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_schedule_doctor_day UNIQUE (doctor_id, day_of_week)
);

COMMENT ON TABLE  schedules                    IS 'Weekly recurring schedule. Slot times computed on-the-fly — never stored.';
COMMENT ON COLUMN schedules.slot_duration_mins IS 'Changing this updates all future available slot times immediately.';
COMMENT ON COLUMN schedules.max_appointments   IS 'Hard cap per day. Prevents overbooking even if time slots exist.';

-- ============================================================
-- 4. BLOCKED_DATES
-- ============================================================

CREATE TABLE blocked_dates (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id     UUID          NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  block_date    DATE          NOT NULL,
  start_time    TIME,
  end_time      TIME,
  reason        VARCHAR(500),
  created_by    UUID          REFERENCES users(id),
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_partial_block_valid CHECK (
    (start_time IS NULL AND end_time IS NULL) OR
    (start_time IS NOT NULL AND end_time IS NOT NULL AND end_time > start_time)
  )
);

CREATE INDEX idx_blocked_dates_doctor_date ON blocked_dates (doctor_id, block_date);

COMMENT ON TABLE  blocked_dates        IS 'Date-specific overrides. Full-day (NULL times) or partial time range.';
COMMENT ON COLUMN blocked_dates.reason IS 'Internal only — never exposed via public API.';

-- ============================================================
-- 5. PATIENTS
-- ============================================================

CREATE TABLE patients (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  phone           VARCHAR(15)   NOT NULL UNIQUE,
  full_name       VARCHAR(255)  NOT NULL,
  email           VARCHAR(255),
  date_of_birth   DATE,
  gender          VARCHAR(10)   CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
  otp_code        VARCHAR(72),
  otp_expires_at  TIMESTAMPTZ,
  otp_attempts    SMALLINT      NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_patients_phone ON patients (phone);
CREATE INDEX idx_patients_name  ON patients (full_name);

COMMENT ON TABLE  patients           IS 'Patient records. Created automatically on first booking. Phone is the primary identifier.';
COMMENT ON COLUMN patients.phone     IS 'Stored in E.164 format (+919876543210). Used for SMS/WhatsApp and OTP login.';
COMMENT ON COLUMN patients.otp_code  IS 'Bcrypt-hashed 6-digit OTP. Expires after 10 minutes. Deleted after use.';

-- ============================================================
-- 6. APPOINTMENTS
-- ============================================================

CREATE TABLE appointments (
  id                  UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id          UUID                NOT NULL REFERENCES patients(id) ON DELETE RESTRICT,
  doctor_id           UUID                NOT NULL REFERENCES doctors(id) ON DELETE RESTRICT,
  appointment_date    DATE                NOT NULL,
  token_number        INTEGER,
  session_index       SMALLINT            NOT NULL DEFAULT 0,
  is_emergency        BOOLEAN             NOT NULL DEFAULT FALSE,
  reason_for_visit    TEXT,
  status              appointment_status  NOT NULL DEFAULT 'booked',
  booking_channel     booking_channel     NOT NULL DEFAULT 'online',
  booked_by_user_id   UUID                REFERENCES users(id),
  arrived_at          TIMESTAMPTZ,
  completed_at        TIMESTAMPTZ,
  cancelled_at        TIMESTAMPTZ,
  cancellation_reason TEXT,
  cancelled_by_role   VARCHAR(20)         CHECK (cancelled_by_role IN ('patient', 'receptionist', 'admin', 'doctor')),
  doctor_notes        TEXT,
  reference_code      VARCHAR(20)         NOT NULL UNIQUE,
  created_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ         NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_appointment_future CHECK (appointment_date >= CURRENT_DATE)
);

CREATE INDEX idx_appointments_doctor_date  ON appointments (doctor_id, appointment_date);
CREATE INDEX idx_appointments_patient      ON appointments (patient_id);
CREATE INDEX idx_appointments_status       ON appointments (status);
CREATE INDEX idx_appointments_date_status  ON appointments (appointment_date, status);
CREATE INDEX idx_appointments_reference    ON appointments (reference_code);

CREATE UNIQUE INDEX uq_appt_token
  ON appointments(doctor_id, appointment_date, session_index, token_number)
  WHERE status NOT IN ('cancelled');

COMMENT ON TABLE  appointments                IS 'Core table. Token-based queue — patients receive sequential token numbers per session.';
COMMENT ON COLUMN appointments.reference_code IS 'Human-readable ID. Format: APT-YYYY-NNNNN.';
COMMENT ON COLUMN appointments.booking_channel IS 'Tracks whether booking came from online form, missed call, or walk-in.';
COMMENT ON COLUMN appointments.doctor_notes   IS 'Internal post-visit notes. NEVER exposed via public or patient API.';

-- ============================================================
-- 7. NOTIFICATIONS
-- ============================================================

CREATE TABLE notifications (
  id                  UUID                    PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id      UUID                    NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  notification_type   notification_type       NOT NULL,
  channel             notification_channel    NOT NULL,
  recipient_phone     VARCHAR(15),
  recipient_email     VARCHAR(255),
  message_body        TEXT,
  status              notification_status     NOT NULL DEFAULT 'pending',
  provider_message_id VARCHAR(255),
  error_message       TEXT,
  retry_count         SMALLINT                NOT NULL DEFAULT 0,
  scheduled_for       TIMESTAMPTZ             NOT NULL,
  sent_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ             NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_appointment  ON notifications (appointment_id);
CREATE INDEX idx_notifications_status_sched ON notifications (status, scheduled_for)
  WHERE status IN ('pending', 'failed');

COMMENT ON TABLE notifications IS 'Full audit log of all outbound notifications. Background job queries pending+scheduled_for<=NOW() every 30 min.';

-- ============================================================
-- 8. AUDIT_LOGS
-- ============================================================

CREATE TABLE audit_logs (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  action        audit_action  NOT NULL,
  performed_by  UUID          REFERENCES users(id),
  patient_id    UUID          REFERENCES patients(id),
  entity_type   VARCHAR(50),
  entity_id     UUID,
  old_values    JSONB,
  new_values    JSONB,
  ip_address    INET,
  user_agent    TEXT,
  notes         TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_performed_by ON audit_logs (performed_by);
CREATE INDEX idx_audit_logs_entity       ON audit_logs (entity_type, entity_id);
CREATE INDEX idx_audit_logs_created_at   ON audit_logs (created_at DESC);

COMMENT ON TABLE audit_logs IS 'Append-only audit trail. NEVER UPDATE or DELETE from this table.';

-- ============================================================
-- 9. MISSED_CALL_EVENTS
-- ============================================================

CREATE TABLE missed_call_events (
  id                  UUID                  PRIMARY KEY DEFAULT gen_random_uuid(),
  caller_phone        VARCHAR(15)           NOT NULL,
  received_at         TIMESTAMPTZ           NOT NULL DEFAULT NOW(),
  call_duration_secs  SMALLINT              NOT NULL DEFAULT 0,
  provider_call_id    VARCHAR(255),
  telecom_circle      VARCHAR(50),
  status              missed_call_status    NOT NULL DEFAULT 'received',
  block_reason        TEXT,
  session_id          UUID,
  ip_of_webhook       INET,
  raw_payload         JSONB,
  created_at          TIMESTAMPTZ           NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mce_phone       ON missed_call_events (caller_phone, received_at DESC);
CREATE INDEX idx_mce_received_at ON missed_call_events (received_at DESC);
CREATE INDEX idx_mce_status      ON missed_call_events (status);

COMMENT ON TABLE  missed_call_events                  IS 'Immutable log of every incoming missed call event. Append-only.';
COMMENT ON COLUMN missed_call_events.call_duration_secs IS 'True missed calls = 0–3 seconds.';
COMMENT ON COLUMN missed_call_events.raw_payload      IS 'Full provider webhook payload stored for debugging and replay.';

-- ============================================================
-- 10. MISSED_CALL_SESSIONS
-- ============================================================

CREATE TABLE missed_call_sessions (
  id                   UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  missed_call_event_id UUID              NOT NULL REFERENCES missed_call_events(id),
  patient_phone        VARCHAR(15)       NOT NULL,
  patient_id           UUID              REFERENCES patients(id),
  session_token        VARCHAR(6)        NOT NULL,
  status               session_status    NOT NULL DEFAULT 'pending',
  slot_option_1_date   DATE,
  slot_option_1_time   TIME,
  slot_option_2_date   DATE,
  slot_option_2_time   TIME,
  slot_option_3_date   DATE,
  slot_option_3_time   TIME,
  chosen_option        SMALLINT          CHECK (chosen_option IN (1, 2, 3)),
  patient_reply        VARCHAR(20),
  reply_received_at    TIMESTAMPTZ,
  appointment_id       UUID              REFERENCES appointments(id),
  sms_sent_at          TIMESTAMPTZ,
  sms_provider_id      VARCHAR(255),
  expires_at           TIMESTAMPTZ       NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes'),
  created_at           TIMESTAMPTZ       NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ       NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_mcs_phone         ON missed_call_sessions (patient_phone);
CREATE INDEX idx_mcs_token         ON missed_call_sessions (session_token, patient_phone);
CREATE INDEX idx_mcs_status_expiry ON missed_call_sessions (status, expires_at)
  WHERE status = 'pending';

COMMENT ON TABLE  missed_call_sessions              IS 'Active booking session from a valid missed call. Expires in 15 minutes.';
COMMENT ON COLUMN missed_call_sessions.session_token IS '4–6 char alphanumeric token embedded in SMS. Required in patient reply to prevent spoofing.';

-- ============================================================
-- 11. MISSED_CALL_RATE_LIMITS
-- ============================================================

CREATE TABLE missed_call_rate_limits (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  phone           VARCHAR(15)   NOT NULL,
  window_24h      SMALLINT      NOT NULL DEFAULT 0,
  window_7d       SMALLINT      NOT NULL DEFAULT 0,
  violation_count SMALLINT      NOT NULL DEFAULT 0,
  last_call_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  first_call_at   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),

  CONSTRAINT uq_rate_limit_phone UNIQUE (phone)
);

CREATE INDEX idx_mcrl_phone ON missed_call_rate_limits (phone);

COMMENT ON TABLE  missed_call_rate_limits               IS 'Per-number rate limit counters. Cleaned up nightly for numbers inactive >7 days.';
COMMENT ON COLUMN missed_call_rate_limits.violation_count IS 'Auto-blacklists the number at 5+ violations (configurable).';

-- ============================================================
-- 12. PHONE_BLACKLIST
-- ============================================================

CREATE TABLE phone_blacklist (
  id              UUID              PRIMARY KEY DEFAULT gen_random_uuid(),
  phone           VARCHAR(15)       NOT NULL UNIQUE,
  reason          blacklist_reason  NOT NULL,
  notes           TEXT,
  is_permanent    BOOLEAN           NOT NULL DEFAULT FALSE,
  expires_at      TIMESTAMPTZ,
  added_by        UUID              REFERENCES users(id),
  created_at      TIMESTAMPTZ       NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_temp_block_has_expiry CHECK (
    is_permanent = TRUE OR expires_at IS NOT NULL
  )
);

CREATE INDEX idx_blacklist_phone ON phone_blacklist (phone);

COMMENT ON TABLE  phone_blacklist              IS 'Numbers blocked from missed call flow.';
COMMENT ON COLUMN phone_blacklist.is_permanent IS 'Permanent blocks never expire regardless of expires_at.';

-- ============================================================
-- 13. MISSED_CALL_CONFIG
-- ============================================================

CREATE TABLE missed_call_config (
  key         VARCHAR(100) PRIMARY KEY,
  value       VARCHAR(255) NOT NULL,
  description TEXT,
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

INSERT INTO missed_call_config (key, value, description) VALUES
  ('max_calls_per_number_24h',    '2',   'Max missed calls from a single number in 24 hours'),
  ('max_calls_per_number_7d',     '5',   'Max missed calls from a single number in 7 days'),
  ('session_expiry_minutes',      '15',  'Minutes before an unanswered SMS session expires'),
  ('system_burst_threshold',      '15',  'Max missed calls system-wide in any 10-minute window'),
  ('system_pause_minutes',        '30',  'Minutes to pause system after burst threshold hit'),
  ('violation_auto_blacklist_at', '5',   'Auto-blacklist after this many rate limit violations'),
  ('new_number_delay_seconds',    '60',  'Delay before sending SMS to first-time callers'),
  ('slot_options_count',          '3',   'Number of slot choices to offer per session'),
  ('slots_lookahead_days',        '7',   'How many days ahead to look for available slots'),
  ('missed_call_number',          '',    'The VMN/toll-free number for missed calls (set on deploy)'),
  ('admin_alert_phone',           '',    'Admin phone for burst/anomaly alerts'),
  ('system_enabled',              'true','Master switch for the missed call system');

-- ============================================================
-- 14. MISSED_CALL_VELOCITY
-- ============================================================

CREATE TABLE missed_call_velocity (
  window_start  TIMESTAMPTZ   NOT NULL,
  call_count    INTEGER       NOT NULL DEFAULT 0,
  is_paused     BOOLEAN       NOT NULL DEFAULT FALSE,
  PRIMARY KEY (window_start)
);

COMMENT ON TABLE missed_call_velocity IS 'Rolling 10-minute call volume windows. Checked on every webhook to detect spam bursts.';

-- ============================================================
-- TRIGGERS: auto-update updated_at timestamps
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at         BEFORE UPDATE ON users         FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_doctors_updated_at       BEFORE UPDATE ON doctors       FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_schedules_updated_at     BEFORE UPDATE ON schedules     FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_patients_updated_at      BEFORE UPDATE ON patients      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_appointments_updated_at  BEFORE UPDATE ON appointments  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_mcs_updated_at           BEFORE UPDATE ON missed_call_sessions   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_mcrl_updated_at          BEFORE UPDATE ON missed_call_rate_limits FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- FUNCTION: generate_reference_code
--    Format: APT-2026-00342
-- ============================================================

CREATE SEQUENCE appointment_ref_seq START 1000;

CREATE OR REPLACE FUNCTION generate_reference_code()
RETURNS TEXT AS $$
BEGIN
  RETURN 'APT-' || EXTRACT(YEAR FROM NOW())::TEXT || '-' ||
         LPAD(nextval('appointment_ref_seq')::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: generate_session_token
--    Returns a 4-char alphanumeric (unambiguous charset).
-- ============================================================

CREATE OR REPLACE FUNCTION generate_session_token()
RETURNS VARCHAR(4) AS $$
DECLARE
  chars  TEXT    := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result VARCHAR := '';
  i      INT;
BEGIN
  FOR i IN 1..4 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- FUNCTION: check_spam_filters(phone)
--    Returns (allowed, block_reason, is_returning, patient_id).
--    Used by webhook handler before creating a session.
-- ============================================================

CREATE OR REPLACE FUNCTION check_spam_filters(p_phone VARCHAR)
RETURNS TABLE (
  allowed         BOOLEAN,
  block_reason    TEXT,
  is_returning    BOOLEAN,
  patient_id_out  UUID
) AS $$
DECLARE
  v_blacklisted   BOOLEAN  := FALSE;
  v_24h_count     SMALLINT := 0;
  v_7d_count      SMALLINT := 0;
  v_max_24h       SMALLINT;
  v_max_7d        SMALLINT;
  v_patient_id    UUID;
  v_has_upcoming  BOOLEAN  := FALSE;
BEGIN
  SELECT value::SMALLINT INTO v_max_24h FROM missed_call_config WHERE key = 'max_calls_per_number_24h';
  SELECT value::SMALLINT INTO v_max_7d  FROM missed_call_config WHERE key = 'max_calls_per_number_7d';

  -- 1. Blacklist check
  SELECT TRUE INTO v_blacklisted
  FROM phone_blacklist
  WHERE phone = p_phone
    AND (is_permanent = TRUE OR expires_at > NOW())
  LIMIT 1;

  IF v_blacklisted THEN
    RETURN QUERY SELECT FALSE, 'BLACKLISTED'::TEXT, FALSE, NULL::UUID;
    RETURN;
  END IF;

  -- 2. Rate limit check
  SELECT window_24h, window_7d INTO v_24h_count, v_7d_count
  FROM missed_call_rate_limits WHERE phone = p_phone;

  IF v_24h_count >= v_max_24h THEN
    RETURN QUERY SELECT FALSE, 'RATE_LIMITED_24H'::TEXT, FALSE, NULL::UUID;
    RETURN;
  END IF;

  IF v_7d_count >= v_max_7d THEN
    RETURN QUERY SELECT FALSE, 'RATE_LIMITED_7D'::TEXT, FALSE, NULL::UUID;
    RETURN;
  END IF;

  -- 3. Duplicate active appointment check
  SELECT id INTO v_patient_id FROM patients WHERE phone = p_phone LIMIT 1;

  IF v_patient_id IS NOT NULL THEN
    SELECT TRUE INTO v_has_upcoming
    FROM appointments
    WHERE patient_id = v_patient_id
      AND status IN ('booked', 'confirmed')
      AND appointment_date >= CURRENT_DATE
    LIMIT 1;

    IF v_has_upcoming THEN
      RETURN QUERY SELECT FALSE, 'DUPLICATE_ACTIVE_APPOINTMENT'::TEXT, TRUE, v_patient_id;
      RETURN;
    END IF;
  END IF;

  -- All checks passed
  RETURN QUERY SELECT TRUE, NULL::TEXT, (v_patient_id IS NOT NULL), v_patient_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- SEED DATA
-- ============================================================

INSERT INTO users (email, password_hash, full_name, role)
VALUES (
  'admin@clinic.local',
  '$2b$12$PLACEHOLDER_HASH_CHANGE_ON_FIRST_RUN',
  'Clinic Administrator',
  'admin'
);

-- ============================================================
-- VIEWS
-- ============================================================

CREATE VIEW v_todays_appointments AS
SELECT
  a.id, a.reference_code, a.appointment_date,
  a.token_number, a.session_index, a.is_emergency,
  a.status, a.booking_channel, a.reason_for_visit,
  p.full_name AS patient_name, p.phone AS patient_phone, p.date_of_birth AS patient_dob,
  d.display_name AS doctor_name,
  a.arrived_at, a.created_at AS booked_at
FROM appointments a
JOIN patients p ON a.patient_id = p.id
JOIN doctors  d ON a.doctor_id  = d.id
WHERE a.appointment_date = CURRENT_DATE
  AND a.status NOT IN ('cancelled')
ORDER BY a.is_emergency DESC, a.session_index ASC, a.token_number ASC;

CREATE VIEW v_notification_queue AS
SELECT
  n.id, n.appointment_id, n.notification_type, n.channel,
  n.recipient_phone, n.recipient_email, n.message_body,
  n.scheduled_for, n.retry_count,
  a.appointment_date, a.token_number, a.session_index,
  p.full_name AS patient_name
FROM notifications n
JOIN appointments a ON n.appointment_id = a.id
JOIN patients     p ON a.patient_id     = p.id
WHERE n.status IN ('pending', 'failed')
  AND n.scheduled_for <= NOW()
  AND n.retry_count < 3
  AND a.status NOT IN ('cancelled')
ORDER BY n.scheduled_for ASC;

CREATE VIEW v_monthly_summary AS
SELECT
  DATE_TRUNC('month', appointment_date) AS month,
  COUNT(*)                               AS total_booked,
  COUNT(*) FILTER (WHERE status = 'completed')              AS completed,
  COUNT(*) FILTER (WHERE status = 'cancelled')              AS cancelled,
  COUNT(*) FILTER (WHERE status = 'no_show')                AS no_shows,
  COUNT(*) FILTER (WHERE booking_channel = 'online')        AS online_bookings,
  COUNT(*) FILTER (WHERE booking_channel = 'missed_call')   AS missed_call_bookings,
  COUNT(*) FILTER (WHERE booking_channel = 'walkin')        AS walkin_bookings,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'cancelled')::NUMERIC /
    NULLIF(COUNT(*), 0) * 100, 1
  ) AS cancellation_rate_pct
FROM appointments
GROUP BY DATE_TRUNC('month', appointment_date)
ORDER BY month DESC;

CREATE VIEW v_missed_call_daily_report AS
SELECT
  DATE(received_at)                                          AS call_date,
  COUNT(*)                                                   AS total_received,
  COUNT(*) FILTER (WHERE status = 'booked')                  AS booked,
  COUNT(*) FILTER (WHERE status = 'sms_sent')                AS sms_sent_pending,
  COUNT(*) FILTER (WHERE status = 'session_expired')         AS expired,
  COUNT(*) FILTER (WHERE status = 'rate_limited')            AS rate_limited,
  COUNT(*) FILTER (WHERE status = 'blacklisted')             AS blacklisted,
  COUNT(*) FILTER (WHERE status = 'velocity_blocked')        AS velocity_blocked,
  COUNT(*) FILTER (WHERE status = 'duplicate_active')        AS duplicate_blocked,
  ROUND(
    COUNT(*) FILTER (WHERE status = 'booked')::NUMERIC /
    NULLIF(COUNT(*) FILTER (WHERE status IN ('sms_sent', 'booked', 'session_expired')), 0) * 100, 1
  ) AS conversion_rate_pct
FROM missed_call_events
GROUP BY DATE(received_at)
ORDER BY call_date DESC;

CREATE VIEW v_active_sessions AS
SELECT
  s.id, s.patient_phone, s.session_token,
  s.slot_option_1_date, s.slot_option_1_time,
  s.slot_option_2_date, s.slot_option_2_time,
  s.slot_option_3_date, s.slot_option_3_time,
  s.expires_at, s.sms_sent_at,
  p.full_name AS patient_name
FROM missed_call_sessions s
LEFT JOIN patients p ON s.patient_id = p.id
WHERE s.status = 'pending'
  AND s.expires_at > NOW()
ORDER BY s.expires_at ASC;

-- ============================================================
-- END OF MERGED SCHEMA
-- ============================================================
