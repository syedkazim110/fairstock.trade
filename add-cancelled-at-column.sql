-- Add cancelled_at column to cap_table_sessions table
ALTER TABLE cap_table_sessions ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMP WITH TIME ZONE NULL;

-- Add comment for documentation
COMMENT ON COLUMN cap_table_sessions.cancelled_at IS 'Timestamp when the session was cancelled (with refund)';

-- Update the deactivate function to handle cancellation properly
CREATE OR REPLACE FUNCTION deactivate_old_cap_table_sessions()
RETURNS TRIGGER AS $$
BEGIN
  -- Deactivate any existing active sessions for this company
  UPDATE cap_table_sessions 
  SET is_active = false, 
      completed_at = CASE 
        WHEN cancelled_at IS NULL THEN NOW() 
        ELSE completed_at 
      END,
      updated_at = NOW()
  WHERE company_id = NEW.company_id 
    AND is_active = true 
    AND id != NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
