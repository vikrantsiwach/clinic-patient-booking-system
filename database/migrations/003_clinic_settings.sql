-- Migration 003: Clinic settings table
-- Stores clinic-level configuration (clinic name, etc.)

CREATE TABLE IF NOT EXISTS clinic_settings (
  key        VARCHAR(100) PRIMARY KEY,
  value      TEXT         NOT NULL,
  updated_at TIMESTAMPTZ  DEFAULT NOW()
);

INSERT INTO clinic_settings (key, value) VALUES
  ('clinic_name', 'My Clinic')
ON CONFLICT (key) DO NOTHING;
