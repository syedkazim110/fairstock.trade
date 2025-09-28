-- Fix RLS policies for bid_allocations table to ensure proper visibility
-- This addresses the issue where members can't see their allocation results

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Allow viewing bid allocations" ON bid_allocations;
DROP POLICY IF EXISTS "Allow inserting bid allocations" ON bid_allocations;
DROP POLICY IF EXISTS "Company owners can view all allocations" ON bid_allocations;
DROP POLICY IF EXISTS "Bidders can view their own allocations" ON bid_allocations;
DROP POLICY IF EXISTS "Users can view relevant bid allocations" ON bid_allocations;
DROP POLICY IF EXISTS "Company owners can insert bid allocations" ON bid_allocations;

-- Create simplified and working RLS policies

-- Policy 1: Bidders can view their own allocations
CREATE POLICY "Bidders can view own allocations" ON bid_allocations
  FOR SELECT USING (
    auth.uid() = bidder_id
  );

-- Policy 2: Company owners can view all allocations for their company's auctions
CREATE POLICY "Company owners can view company allocations" ON bid_allocations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM company_auctions ca
      JOIN companies c ON ca.company_id = c.id
      WHERE ca.id = bid_allocations.auction_id
      AND c.created_by = auth.uid()
    )
  );

-- Policy 3: System can insert allocations (for clearing process)
-- This allows the clearing API to insert allocations
CREATE POLICY "System can insert allocations" ON bid_allocations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_auctions ca
      JOIN companies c ON ca.company_id = c.id
      WHERE ca.id = bid_allocations.auction_id
      AND c.created_by = auth.uid()
    )
  );

-- Policy 4: Service role can manage all allocations (for automated processes)
CREATE POLICY "Service role can manage allocations" ON bid_allocations
  FOR ALL USING (
    auth.jwt() ->> 'role' = 'service_role'
  );

-- Ensure RLS is enabled
ALTER TABLE bid_allocations ENABLE ROW LEVEL SECURITY;

-- Add helpful comments
COMMENT ON POLICY "Bidders can view own allocations" ON bid_allocations IS 
'Allows bidders to view their own allocation results after clearing';

COMMENT ON POLICY "Company owners can view company allocations" ON bid_allocations IS 
'Allows company owners to view all allocations for their company auctions';

COMMENT ON POLICY "System can insert allocations" ON bid_allocations IS 
'Allows the clearing system to insert allocation records';

COMMENT ON POLICY "Service role can manage allocations" ON bid_allocations IS 
'Allows service role (automated processes) to manage all allocations';

-- Test the policies with some example queries (these are just for reference)
/*
-- Test 1: Bidder viewing their own allocation
-- This should work when executed by the bidder
SELECT * FROM bid_allocations WHERE bidder_id = auth.uid();

-- Test 2: Company owner viewing all allocations for their auction
-- This should work when executed by the company owner
SELECT ba.* FROM bid_allocations ba
JOIN company_auctions ca ON ba.auction_id = ca.id
JOIN companies c ON ca.company_id = c.id
WHERE c.created_by = auth.uid();

-- Test 3: Random user trying to view allocations they shouldn't see
-- This should return no results for unauthorized users
SELECT * FROM bid_allocations WHERE bidder_id != auth.uid();
*/

-- Success messages
DO $$
BEGIN
  RAISE NOTICE 'Fixed RLS policies for bid_allocations table';
  RAISE NOTICE 'Members should now be able to see their allocation results';
  RAISE NOTICE 'Company owners can see all allocations for their auctions';
END $$;
