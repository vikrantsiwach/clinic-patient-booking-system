-- Migration 002: Add height and weight to patients table
ALTER TABLE patients
  ADD COLUMN IF NOT EXISTS height_cm  SMALLINT     CHECK (height_cm  > 0 AND height_cm  < 300),
  ADD COLUMN IF NOT EXISTS weight_kg  NUMERIC(5,2) CHECK (weight_kg  > 0 AND weight_kg  < 500);
