-- ============================================================
-- SEED: Admin user + Doctor profile + Weekly schedule
-- Run after 001_merged_schema.sql
-- Default password: Admin@2026 (CHANGE ON FIRST LOGIN)
-- ============================================================

-- Admin user
-- Password hash for: Admin@2026
INSERT INTO users (email, password_hash, full_name, role) VALUES
  ('admin@clinic.local',
   '$2b$12$nXrEaQT04gAj2leDEs51WuDzOqt1xnXKtHIOj9/s2B/rdADsw/82a',
   'Clinic Administrator',
   'admin')
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;

-- Doctor user account
INSERT INTO users (email, password_hash, full_name, role) VALUES
  ('doctor@clinic.local',
   '$2b$12$nXrEaQT04gAj2leDEs51WuDzOqt1xnXKtHIOj9/s2B/rdADsw/82a',
   'Dr. Anil Sharma',
   'doctor')
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;

-- Receptionist account
INSERT INTO users (email, password_hash, full_name, role) VALUES
  ('reception@clinic.local',
   '$2b$12$nXrEaQT04gAj2leDEs51WuDzOqt1xnXKtHIOj9/s2B/rdADsw/82a',
   'Front Desk',
   'receptionist')
ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;

-- Doctor profile
INSERT INTO doctors (user_id, full_name, display_name, specialization, qualifications, bio, phone)
SELECT
  u.id,
  'Dr. Anil Sharma',
  'Dr. Anil Sharma',
  'General Physician',
  'MBBS, MD – AIIMS Delhi',
  'With over 15 years of experience in general medicine, Dr. Sharma specialises in preventive care, chronic disease management, and family health.',
  '+911234567890'
FROM users u WHERE u.email = 'doctor@clinic.local'
ON CONFLICT (user_id) DO NOTHING;

-- Weekly schedule: Mon–Fri two sessions (9–1, 5–8), Sat one session (9–1)
-- DO UPDATE ensures re-seeding always restores correct times
INSERT INTO schedules (doctor_id, day_of_week, sessions_json, slot_duration_mins, max_appointments, is_active)
SELECT
  d.id,
  day,
  CASE
    WHEN day = 'saturday' THEN '[{"from":"09:00","to":"13:00","slot":20,"max":null}]'::jsonb
    ELSE '[{"from":"09:00","to":"13:00","slot":20,"max":null},{"from":"17:00","to":"20:00","slot":20,"max":null}]'::jsonb
  END,
  20,
  9999,
  TRUE
FROM doctors d
CROSS JOIN (VALUES
  ('monday'::day_of_week),
  ('tuesday'::day_of_week),
  ('wednesday'::day_of_week),
  ('thursday'::day_of_week),
  ('friday'::day_of_week),
  ('saturday'::day_of_week)
) AS days(day)
WHERE d.display_name = 'Dr. Anil Sharma'
ON CONFLICT (doctor_id, day_of_week) DO UPDATE
  SET sessions_json      = EXCLUDED.sessions_json,
      max_appointments   = EXCLUDED.max_appointments,
      slot_duration_mins = EXCLUDED.slot_duration_mins,
      is_active          = EXCLUDED.is_active;
