-- Migration 005: Multi-doctor roles, new appointment statuses, staff photos
-- Run after 004_audit_action_enum.sql

-- 1. New appointment statuses
ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'arrived_waiting';
ALTER TYPE appointment_status ADD VALUE IF NOT EXISTS 'with_doctor';

-- 2. Profile photo for all users (staff + doctors)
ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url VARCHAR(500);

-- 3. Migrate old statuses to new flow
--    confirmed → booked (confirmed step removed)
--    arrived   → arrived_waiting (renamed)
UPDATE appointments SET status = 'booked'          WHERE status = 'confirmed';
UPDATE appointments SET status = 'arrived_waiting' WHERE status = 'arrived';

-- 4. Drop unused column (confirmed step removed from flow)
ALTER TABLE appointments DROP COLUMN IF EXISTS confirmed_at;

-- 5. New audit_action enum values
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'appointment_arrived';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'appointment_with_doctor';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'profile_updated';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'password_changed';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'doctor_deactivated_appointments_cancelled';
