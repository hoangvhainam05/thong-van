-- Extend sessions that are still valid to the new 30-day lifetime.
-- Expired sessions stay expired; the application issues future sessions for 30 days.
UPDATE user_session
SET expires_at = DATE_ADD(created_at, INTERVAL 30 DAY)
WHERE expires_at > NOW();
