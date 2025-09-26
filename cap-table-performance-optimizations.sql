-- Cap Table Performance Optimizations - Enhanced Version
-- Run these SQL commands in your Supabase SQL Editor for maximum performance

-- 1. Drop existing functions if they exist to avoid conflicts
DROP FUNCTION IF EXISTS get_complete_cap_table_data(UUID, UUID, TEXT);
DROP FUNCTION IF EXISTS start_cap_table_session_optimized(UUID, UUID, UUID, DECIMAL, DECIMAL);

-- 2. Enhanced Performance Indexes
CREATE INDEX IF NOT EXISTS idx_company_members_company_email_fast ON company_members(company_id, email) INCLUDE (id, name, position, credit_balance);
CREATE INDEX IF NOT EXISTS idx_member_shareholdings_company_email ON member_shareholdings(company_id, member_email) INCLUDE (shares_owned, share_percentage);
CREATE INDEX IF NOT EXISTS idx_cap_table_sessions_company_active_fast ON cap_table_sessions(company_id, is_active) INCLUDE (id, session_fee, paid_at, created_at) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_companies_id_created_by_fast ON companies(id, created_by) INCLUDE (name, total_shares, issued_shares);
CREATE INDEX IF NOT EXISTS idx_profiles_id_fast ON profiles(id) INCLUDE (email);

-- 3. Materialized view for frequently accessed cap table data
CREATE MATERIALIZED VIEW IF NOT EXISTS cap_table_summary AS
SELECT 
    c.id as company_id,
    c.name as company_name,
    c.total_shares,
    c.issued_shares,
    c.created_by as owner_id,
    COUNT(cm.id) as member_count,
    SUM(ms.shares_owned) as total_allocated_shares,
    SUM(cm.credit_balance) as total_credit_balance,
    MAX(cm.updated_at) as last_member_update,
    MAX(ms.updated_at) as last_shareholding_update
FROM companies c
LEFT JOIN company_members cm ON c.id = cm.company_id
LEFT JOIN member_shareholdings ms ON c.id = ms.company_id AND cm.email = ms.member_email
GROUP BY c.id, c.name, c.total_shares, c.issued_shares, c.created_by;

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_cap_table_summary_company_id ON cap_table_summary(company_id);
CREATE INDEX IF NOT EXISTS idx_cap_table_summary_owner_id ON cap_table_summary(owner_id);

-- 4. Function to refresh materialized view (call this after cap table changes)
CREATE OR REPLACE FUNCTION refresh_cap_table_summary(p_company_id UUID DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF p_company_id IS NOT NULL THEN
        -- Refresh specific company data (PostgreSQL doesn't support partial refresh of materialized views)
        -- So we'll refresh the entire view but this is still faster than individual queries
        REFRESH MATERIALIZED VIEW CONCURRENTLY cap_table_summary;
    ELSE
        REFRESH MATERIALIZED VIEW CONCURRENTLY cap_table_summary;
    END IF;
END;
$$;

-- 5. Ultra-optimized function to get complete cap table data in one call
CREATE OR REPLACE FUNCTION get_complete_cap_table_data(
    p_company_id UUID,
    p_user_id UUID,
    p_user_email TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
    v_company_data JSON;
    v_members_data JSON;
    v_session_data JSON;
    v_admin_member JSON;
BEGIN
    -- Single query to get all company and session data
    WITH company_info AS (
        SELECT 
            c.id,
            c.name,
            c.total_shares,
            c.issued_shares,
            c.created_by,
            p.email as owner_email,
            cts.id as session_id,
            cts.session_fee,
            cts.paid_at,
            cts.is_active as session_active,
            cts.created_at as session_created_at
        FROM companies c
        INNER JOIN profiles p ON c.created_by = p.id
        LEFT JOIN cap_table_sessions cts ON c.id = cts.company_id AND cts.is_active = true
        WHERE c.id = p_company_id AND c.created_by = p_user_id
    ),
    members_with_shares AS (
        SELECT 
            cm.id,
            cm.name,
            cm.email,
            cm.position,
            COALESCE(cm.credit_balance, 0) as credit_balance,
            COALESCE(ms.shares_owned, 0) as shares_owned,
            COALESCE(ms.share_percentage, 0) as share_percentage,
            cm.email = p_user_email as is_admin
        FROM company_members cm
        LEFT JOIN member_shareholdings ms ON cm.company_id = ms.company_id AND cm.email = ms.member_email
        WHERE cm.company_id = p_company_id
        ORDER BY cm.name
    )
    SELECT 
        json_build_object(
            'company', json_build_object(
                'id', ci.id,
                'name', ci.name,
                'total_shares', ci.total_shares,
                'issued_shares', ci.issued_shares,
                'owner_credit_balance', COALESCE((SELECT credit_balance FROM members_with_shares WHERE is_admin = true LIMIT 1), 0)
            ),
            'session', CASE 
                WHEN ci.session_id IS NOT NULL THEN
                    json_build_object(
                        'id', ci.session_id,
                        'session_fee', ci.session_fee,
                        'paid_at', ci.paid_at,
                        'is_active', ci.session_active,
                        'created_at', ci.session_created_at
                    )
                ELSE NULL
            END,
            'has_active_session', COALESCE(ci.session_active, false),
            'admin_member', (
                SELECT json_build_object(
                    'id', id,
                    'name', name,
                    'credit_balance', credit_balance
                )
                FROM members_with_shares 
                WHERE is_admin = true 
                LIMIT 1
            ),
            'members', (
                SELECT json_agg(
                    json_build_object(
                        'id', id,
                        'name', name,
                        'email', email,
                        'position', position,
                        'balance', credit_balance,
                        'shares_owned', shares_owned,
                        'share_percentage', share_percentage
                    )
                )
                FROM members_with_shares
            ),
            'summary', json_build_object(
                'total_members', (SELECT COUNT(*) FROM members_with_shares),
                'total_allocated_shares', (SELECT SUM(shares_owned) FROM members_with_shares),
                'total_credit_balance', (SELECT SUM(credit_balance) FROM members_with_shares)
            )
        )
    INTO v_result
    FROM company_info ci;
    
    -- Check if company was found
    IF v_result IS NULL THEN
        RAISE EXCEPTION 'Company not found or access denied';
    END IF;
    
    -- Check if admin member was found
    IF (v_result->>'admin_member')::json IS NULL THEN
        RAISE EXCEPTION 'Admin member not found in cap table';
    END IF;
    
    RETURN v_result;
END;
$$;

-- 6. Optimized session management function
CREATE OR REPLACE FUNCTION start_cap_table_session_optimized(
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
    -- Atomic transaction
    BEGIN
        -- Auto-assign $1000 if insufficient balance
        IF p_current_balance < p_session_fee THEN
            p_current_balance := 1000.00;
        END IF;
        
        v_new_balance := p_current_balance - p_session_fee;
        
        -- Single UPDATE with RETURNING to get confirmation
        UPDATE company_members 
        SET credit_balance = v_new_balance,
            updated_at = NOW()
        WHERE id = p_admin_member_id;
        
        -- Deactivate existing sessions and create new one in single operation
        WITH deactivated AS (
            UPDATE cap_table_sessions 
            SET is_active = false,
                updated_at = NOW()
            WHERE company_id = p_company_id AND is_active = true
            RETURNING id
        ),
        new_session AS (
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
            ) RETURNING *
        )
        SELECT 
            json_build_object(
                'session', row_to_json(ns.*),
                'new_balance', v_new_balance,
                'success', true,
                'deactivated_sessions', (SELECT COUNT(*) FROM deactivated)
            )
        INTO v_result
        FROM new_session ns;
        
        -- Refresh materialized view for this company
        PERFORM refresh_cap_table_summary(p_company_id);
        
        RETURN v_result;
        
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Failed to start cap table session: %', SQLERRM;
    END;
END;
$$;

-- 7. Function to complete session with cleanup
CREATE OR REPLACE FUNCTION complete_cap_table_session_optimized(
    p_company_id UUID,
    p_owner_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSON;
BEGIN
    WITH completed_session AS (
        UPDATE cap_table_sessions
        SET is_active = false,
            completed_at = NOW(),
            updated_at = NOW()
        WHERE company_id = p_company_id 
        AND owner_id = p_owner_id 
        AND is_active = true
        RETURNING id, session_fee
    )
    SELECT json_build_object(
        'success', true,
        'session_id', cs.id,
        'message', 'Cap table session completed successfully'
    )
    INTO v_result
    FROM completed_session cs;
    
    IF v_result IS NULL THEN
        RAISE EXCEPTION 'No active cap table session found';
    END IF;
    
    -- Refresh materialized view
    PERFORM refresh_cap_table_summary(p_company_id);
    
    RETURN v_result;
END;
$$;

-- 8. Performance monitoring and analytics
CREATE OR REPLACE VIEW cap_table_performance_metrics AS
SELECT 
    c.id as company_id,
    c.name as company_name,
    cts.total_sessions,
    cts.active_sessions,
    cts.avg_session_duration_seconds,
    cts.last_session_created,
    cs.member_count,
    cs.total_allocated_shares,
    cs.total_credit_balance,
    CASE 
        WHEN cs.total_shares > 0 THEN 
            ROUND((cs.total_allocated_shares::DECIMAL / cs.total_shares * 100), 2)
        ELSE 0 
    END as allocation_percentage
FROM cap_table_summary cs
LEFT JOIN (
    SELECT 
        company_id,
        COUNT(*) as total_sessions,
        COUNT(CASE WHEN is_active THEN 1 END) as active_sessions,
        AVG(EXTRACT(EPOCH FROM (COALESCE(completed_at, NOW()) - created_at))) as avg_session_duration_seconds,
        MAX(created_at) as last_session_created
    FROM cap_table_sessions
    GROUP BY company_id
) cts ON cs.company_id = cts.company_id
LEFT JOIN companies c ON cs.company_id = c.id;

-- 9. Trigger to auto-refresh materialized view on data changes
CREATE OR REPLACE FUNCTION trigger_refresh_cap_table_summary()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Schedule a refresh (in production, you might want to use a job queue)
    PERFORM refresh_cap_table_summary();
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- Create triggers for automatic refresh
DROP TRIGGER IF EXISTS refresh_cap_table_on_member_change ON company_members;
CREATE TRIGGER refresh_cap_table_on_member_change
    AFTER INSERT OR UPDATE OR DELETE ON company_members
    FOR EACH STATEMENT
    EXECUTE FUNCTION trigger_refresh_cap_table_summary();

DROP TRIGGER IF EXISTS refresh_cap_table_on_shareholding_change ON member_shareholdings;
CREATE TRIGGER refresh_cap_table_on_shareholding_change
    AFTER INSERT OR UPDATE OR DELETE ON member_shareholdings
    FOR EACH STATEMENT
    EXECUTE FUNCTION trigger_refresh_cap_table_summary();

-- 10. Initial refresh of materialized view
REFRESH MATERIALIZED VIEW cap_table_summary;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION get_complete_cap_table_data(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION start_cap_table_session_optimized(UUID, UUID, UUID, DECIMAL, DECIMAL) TO authenticated;
GRANT EXECUTE ON FUNCTION complete_cap_table_session_optimized(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_cap_table_summary(UUID) TO authenticated;
GRANT SELECT ON cap_table_summary TO authenticated;
GRANT SELECT ON cap_table_performance_metrics TO authenticated;

-- Comments for documentation
COMMENT ON FUNCTION get_complete_cap_table_data IS 'Ultra-optimized function to retrieve all cap table data in a single database call';
COMMENT ON FUNCTION start_cap_table_session_optimized IS 'Optimized atomic transaction for starting cap table sessions';
COMMENT ON FUNCTION complete_cap_table_session_optimized IS 'Optimized function for completing cap table sessions';
COMMENT ON MATERIALIZED VIEW cap_table_summary IS 'Materialized view for fast cap table summary data';
COMMENT ON VIEW cap_table_performance_metrics IS 'Performance metrics and analytics for cap table operations';

-- Performance analysis query (run this to verify optimizations)
-- SELECT 
--   tablename,
--   indexname,
--   indexdef
-- FROM pg_indexes 
-- WHERE tablename IN ('cap_table_sessions', 'company_members', 'companies', 'member_shareholdings')
-- ORDER BY tablename, indexname;
