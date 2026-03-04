-- Migration 006: Migrate old appointment status values to new names
-- Must run after 005 (which adds arrived_waiting/with_doctor enum values) so
-- those values are committed and visible before this UPDATE runs.
--   confirmed → booked        (confirmation step removed from flow)
--   arrived   → arrived_waiting (renamed)

UPDATE appointments SET status = 'booked'          WHERE status = 'confirmed';
UPDATE appointments SET status = 'arrived_waiting' WHERE status = 'arrived';
