-- Cap Table Payment System Database Schema
-- Add owner credit balance and session tracking for cap table changes

-- Add owner credit balance to companies table with $1000 default
ALTER TABLE companies ADD COLUMN IF NOT EXISTS owner_credit_balance DECIMAL(10,2) DEFAULT 1000.00;

-- Add comment for documentation
COMMENT ON COLUMN companies.owner_credit_balance IS 'Credit balance for company owner to pay for cap table changes ($20 per session)';

-- Cap table change sessions tracking
CREATE TABLE IF NOT EXISTS cap_table_sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  owner_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_fee DECIMAL(10,2) DEFAULT 20.00 NOT NULL,
  paid_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on cap_table_sessions
ALTER TABLE cap_table_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policy for cap_table_sessions - owners can manage their own sessions
CREATE POLICY "Company owners can manage their cap table sessions" ON cap_table_sessions
  FOR ALL USING (
    owner_id = auth.uid() OR 
    company_id IN (SELECT id FROM companies WHERE created_by = auth.uid())
  );

-- Index for better performance
CREATE INDEX IF NOT EXISTS idx_cap_table_sessions_company_active 
  ON cap_table_sessions(company_id, is_active) 
  WHERE is_active = true;

-- Function to automatically deactivate old sessions when a new one is created
CREATE OR REPLACE FUNCTION deactivate_old_cap_table_sessions()
RETURNS TRIGGER AS $$
BEGIN
  -- Deactivate any existing active sessions for this company
  UPDATE cap_table_sessions 
  SET is_active = false, 
      completed_at = NOW(),
      updated_at = NOW()
  WHERE company_id = NEW.company_id 
    AND is_active = true 
    AND id != NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function when a new session is created
DROP TRIGGER IF EXISTS trigger_deactivate_old_sessions ON cap_table_sessions;
CREATE TRIGGER trigger_deactivate_old_sessions
  AFTER INSERT ON cap_table_sessions
  FOR EACH ROW EXECUTE FUNCTION deactivate_old_cap_table_sessions();
