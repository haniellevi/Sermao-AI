
-- Add is_active column to users table
ALTER TABLE users ADD COLUMN is_active BOOLEAN DEFAULT true NOT NULL;

-- Update existing users to be active by default
UPDATE users SET is_active = true WHERE is_active IS NULL;
