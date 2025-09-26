-- Cap Table Session Performance Optimizations
-- Run these SQL commands in your Supabase SQL Editor

-- 1. Enhanced Performance Indexes (if not already applied)
CREATE INDEX IF NOT EXISTS idx_company_members_company_email ON company_members(company_id, email);
CREATE INDEX IF NOT EXISTS idx_company_members_company_id ON company_members(company_id);
CREATE INDEX IF NOT EXISTS idx_cap_table_sessions_company_active ON cap_table_sessions(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_cap_table_sessions_company_id ON cap_table_sessions(company_id);
CREATE INDEX IF NOT EXISTS idx_companies_created_by ON companies(created_by);
CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);

-- 2. Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_company_members_company_email_composite ON company_members(company_id, email, id, credit_balance);
CREATE INDEX IF NOT EXISTS idx_cap_table_sessions_active_company ON cap_table_sessions(is_active, company_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_companies_id_created_by ON companies(id, created_by);

-- 3. Optimized stored procedure for atomic cap table session operations
CREATE OR REPLACE FUNCTION start_cap_table_session_transaction(
  p_company_id UUID,
  p_owner_id UUID,
  p_admin_member_id UUID,
  p_session_fee DECIMAL,
  p_current_balance DECIMAL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_balance DECIMAL;
  v_session_id UUID;
  v_result JSON;
BEGIN
  -- Start transaction
  BEGIN
    -- Check if admin has sufficient balance, if not assign $1000
    IF p_current_balance < p_session_fee THEN
      p_current_balance := 1000.00;
      
      -- Update admin member balance to $1000
      UPDATE company_members 
      SET credit_balance = p_current_balance,
          updated_at = NOW()
      WHERE id = p_admin_member_id;
    END IF;
    
    -- Calculate new balance after deducting session fee
    v_new_balance := p_current_balance - p_session_fee;
    
    -- Update admin member balance
    UPDATE company_members 
    SET credit_balance = v_new_balance,
        updated_at = NOW()
    WHERE id = p_admin_member_id;
    
    -- Deactivate any existing active sessions for this company
    UPDATE cap_table_sessions 
    SET is_active = false,
        updated_at = NOW()
    WHERE company_id = p_company_id AND is_active = true;
    
    -- Create new session
    INSERT INTO cap_table_sessions (
      company_id,
      owner_id,
      session_fee,
      is_active,
      created_at,
      updated_at
    ) VALUES (
      p_company_id,
      p_owner_id,
      p_session_fee,
      true,
      NOW(),
      NOW()
    ) RETURNING id INTO v_session_id;
    
    -- Prepare result
    v_result := json_build_object(
      'session', json_build_object(
        'id', v_session_id,
        'company_id', p_company_id,
        'owner_id', p_owner_id,
        'session_fee', p_session_fee,
        'is_active', true,
        'created_at', NOW()
      ),
      'new_balance', v_new_balance,
      'success', true
    );
    
    RETURN v_result;
    
  EXCEPTION WHEN OTHERS THEN
    -- Rollback is automatic in PostgreSQL for failed transactions
    RAISE EXCEPTION 'Failed to start cap table session: %', SQLERRM;
  END;
END;
$$;

-- 4. Optimized function for batch session operations
CREATE OR REPLACE FUNCTION get_cap_table_session_data(
  p_company_id UUID,
  p_user_id UUID,
  p_user_email TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_company RECORD;
  v_admin_member RECORD;
  v_active_session RECORD;
  v_result JSON;
BEGIN
  -- Get company data
  SELECT id, name, created_by
  INTO v_company
  FROM companies
  WHERE id = p_company_id AND created_by = p_user_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company not found or access denied';
  END IF;
  
  -- Get admin member data
  SELECT id, credit_balance, name
  INTO v_admin_member
  FROM company_members
  WHERE company_id = p_company_id AND email = p_user_email;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Admin member not found in cap table';
  END IF;
  
  -- Get active session if exists
  SELECT id, session_fee, paid_at, is_active, created_at
  INTO v_active_session
  FROM cap_table_sessions
  WHERE company_id = p_company_id AND is_active = true;
  
  -- Build result
  v_result := json_build_object(
    'company', json_build_object(
      'id', v_company.id,
      'name', v_company.name,
      'owner_credit_balance', COALESCE(v_admin_member.credit_balance, 0)
    ),
    'session', CASE 
      WHEN v_active_session.id IS NOT NULL THEN
        json_build_object(
          'id', v_active_session.id,
          'session_fee', v_active_session.session_fee,
          'paid_at', v_active_session.paid_at,
          'is_active', v_active_session.is_active,
          'created_at', v_active_session.created_at
        )
      ELSE NULL
    END,
    'has_active_session', v_active_session.id IS NOT NULL,
    'admin_member', json_build_object(
      'id', v_admin_member.id,
      'name', v_admin_member.name,
      'credit_balance', COALESCE(v_admin_member.credit_balance, 0)
    )
  );
  
  RETURN v_result;
END;
$$;

-- 5. Add performance monitoring view
CREATE OR REPLACE VIEW cap_table_session_performance AS
SELECT 
  c.id as company_id,
  c.name as company_name,
  COUNT(cts.id) as total_sessions,
  COUNT(CASE WHEN cts.is_active THEN 1 END) as active_sessions,
  AVG(EXTRACT(EPOCH FROM (cts.completed_at - cts.created_at))) as avg_session_duration_seconds,
  MAX(cts.created_at) as last_session_created
FROM companies c
LEFT JOIN cap_table_sessions cts ON c.id = cts.company_id
GROUP BY c.id, c.name;

-- 6. Add indexes for the new functions
CREATE INDEX IF NOT EXISTS idx_cap_table_sessions_company_owner ON cap_table_sessions(company_id, owner_id);
CREATE INDEX IF NOT EXISTS idx_company_members_email_lookup ON company_members(email, company_id);

-- 7. Update RLS policies for better performance (if needed)
-- Note: Only run this if you're experiencing RLS performance issues
-- DROP POLICY IF EXISTS "Company owners can manage their cap table sessions" ON cap_table_sessions;
-- CREATE POLICY "Company owners can manage their cap table sessions" ON cap_table_sessions
--   FOR ALL USING (
--     owner_id = auth.uid() OR
--     company_id IN (
--       SELECT id FROM companies WHERE created_by = auth.uid()
--     )
--   );

-- 8. Performance analysis query (run this to check current performance)
-- SELECT 
--   schemaname,
--   tablename,
--   attname,
--   n_distinct,
--   correlation
-- FROM pg_stats 
-- WHERE tablename IN ('cap_table_sessions', 'company_members', 'companies')
-- ORDER BY tablename, attname;

COMMENT ON FUNCTION start_cap_table_session_transaction IS 'Atomic transaction for starting cap table sessions with automatic balance management';
COMMENT ON FUNCTION get_cap_table_session_data IS 'Optimized function to retrieve all cap table session data in a single call';
COMMENT ON VIEW cap_table_session_performance IS 'Performance monitoring view for cap table sessions';
