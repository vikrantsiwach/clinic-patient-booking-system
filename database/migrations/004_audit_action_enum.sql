-- Add missing audit_action enum values introduced by multi-doctor + clinic settings features
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'clinic_settings_updated';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'doctor_profile_updated';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'staff_details_updated';
