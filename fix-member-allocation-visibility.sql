-- Phase 2: Fix Member Allocation Visibility Issues
-- This addresses the core problems preventing members from seeing their allocation results

-- First, let's drop all existing problematic policies
DROP POLICY IF EXISTS "Allow viewing bid allocations" ON bid_allocations;
DROP POLICY IF EXISTS "Allow inserting bid allocations" ON bid_allocations;
DROP POLICY IF EXISTS "Company owners can view all allocations" ON bid_allocations;
DROP POLICY IF EXISTS "Bidders can view their own allocations" ON bid_allocations;
DROP POLICY IF EXISTS "Users can view relevant bid allocations" ON bid_allocations;
DROP POLICY IF EXISTS "Company owners can insert bid allocations" ON bid_allocations;
DROP POLICY IF EXISTS "Bidders can view own allocations" ON bid_allocations;
DROP POLICY IF EXISTS "Company owners can view company allocations" ON bid_allocations;
DROP POLICY IF EXISTS "System can insert allocations" ON bid_allocations;
DROP POLICY IF EXISTS "Service role can manage allocations" ON bid_allocations;

-- Ensure RLS is enabled
ALTER TABLE bid_allocations ENABLE ROW LEVEL SECURITY;

-- Policy 1: Bidders can view their own allocations (improved with better error handling)
CREATE POLICY "bidders_view_own_allocations" ON bid_allocations
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND 
    auth.uid() = bidder_id
  );

-- Policy 2: Company owners can view all allocations for their company's auctions (improved)
CREATE POLICY "company_owners_view_all_allocations" ON bid_allocations
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM company_auctions ca
      JOIN companies c ON ca.company_id = c.id
      WHERE ca.id = bid_allocations.auction_id
      AND c.created_by = auth.uid()
    )
  );

-- Policy 3: System can insert allocations (for clearing process)
CREATE POLICY "system_insert_allocations" ON bid_allocations
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM company_auctions ca
      JOIN companies c ON ca.company_id = c.id
      WHERE ca.id = bid_allocations.auction_id
      AND c.created_by = auth.uid()
    )
  );

-- Policy 4: Service role can manage all allocations (for automated processes)
CREATE POLICY "service_role_manage_allocations" ON bid_allocations
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'service_role'
  );

-- Add helpful comments for debugging
COMMENT ON POLICY "bidders_view_own_allocations" ON bid_allocations IS 
'Allows authenticated bidders to view their own allocation results. Requires auth.uid() to match bidder_id.';

COMMENT ON POLICY "company_owners_view_all_allocations" ON bid_allocations IS 
'Allows company owners to view all allocations for auctions of their companies. Joins through company_auctions and companies tables.';

COMMENT ON POLICY "system_insert_allocations" ON bid_allocations IS 
'Allows the clearing system to insert allocation records. Only company owners can trigger clearing.';

COMMENT ON POLICY "service_role_manage_allocations" ON bid_allocations IS 
'Allows service role (automated processes like schedulers) to manage all allocations.';

-- Create a debug view to help troubleshoot RLS issues
CREATE OR REPLACE VIEW bid_allocations_debug AS
SELECT 
  ba.id,
  ba.auction_id,
  ba.bidder_id,
  ba.bidder_email,
  ba.allocated_quantity,
  ba.allocation_type,
  auth.uid() as current_user_id,
  (auth.uid() = ba.bidder_id) as is_own_allocation,
  c.created_by as company_owner_id,
  (auth.uid() = c.created_by) as is_company_owner,
  ca.title as auction_title,
  c.name as company_name
FROM bid_allocations ba
JOIN company_auctions ca ON ba.auction_id = ca.id
JOIN companies c ON ca.company_id = c.id;

COMMENT ON VIEW bid_allocations_debug IS 
'Debug view to help troubleshoot RLS policy issues. Shows user context and ownership relationships.';

-- Create a function to test allocation visibility for a specific user
CREATE OR REPLACE FUNCTION test_allocation_visibility(
  test_user_id UUID,
  test_auction_id UUID
) RETURNS TABLE (
  allocation_id UUID,
  bidder_email TEXT,
  allocated_quantity INTEGER,
  can_view_as_bidder BOOLEAN,
  can_view_as_owner BOOLEAN,
  error_message TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ba.id as allocation_id,
    ba.bidder_email,
    ba.allocated_quantity,
    (test_user_id = ba.bidder_id) as can_view_as_bidder,
    EXISTS(
      SELECT 1 FROM company_auctions ca
      JOIN companies c ON ca.company_id = c.id
      WHERE ca.id = ba.auction_id
      AND c.created_by = test_user_id
    ) as can_view_as_owner,
    CASE 
      WHEN test_user_id IS NULL THEN 'User ID is null'
      WHEN ba.bidder_id IS NULL THEN 'Bidder ID is null'
      WHEN test_user_id != ba.bidder_id AND NOT EXISTS(
        SELECT 1 FROM company_auctions ca
        JOIN companies c ON ca.company_id = c.id
        WHERE ca.id = ba.auction_id
        AND c.created_by = test_user_id
      ) THEN 'User is neither bidder nor company owner'
      ELSE 'Should have access'
    END as error_message
  FROM bid_allocations ba
  WHERE ba.auction_id = test_auction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION test_allocation_visibility IS 
'Test function to check if a user should be able to see allocations for a specific auction. Useful for debugging RLS issues.';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Fixed RLS policies for bid_allocations table';
  RAISE NOTICE '✅ Added debug view and test function for troubleshooting';
  RAISE NOTICE '✅ Members should now be able to see their allocation results';
  RAISE NOTICE '✅ Company owners can see all allocations for their auctions';
  RAISE NOTICE '';
  RAISE NOTICE 'Debug tools available:';
  RAISE NOTICE '- View: bid_allocations_debug';
  RAISE NOTICE '- Function: test_allocation_visibility(user_id, auction_id)';
END $$;
