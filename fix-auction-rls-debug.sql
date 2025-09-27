-- Debug and fix auction RLS policies
-- This creates more permissive policies and adds debugging

-- Drop the existing policy for invited members
DROP POLICY IF EXISTS "Invited members can view auctions" ON company_auctions;

-- Drop company owner policy to recreate it
DROP POLICY IF EXISTS "Company owners can view their auctions" ON company_auctions;

-- Create a more permissive policy for company owners
CREATE POLICY "Company owners can view their auctions" ON company_auctions
  FOR SELECT USING (
    company_id IN (SELECT id FROM companies WHERE created_by = auth.uid())
  );

-- Create a more permissive policy for invited members
CREATE POLICY "Invited members can view auctions" ON company_auctions
  FOR SELECT USING (
    -- Allow if user's email is in invited_members array (regardless of status)
    (SELECT email FROM auth.users WHERE id = auth.uid()) = ANY(COALESCE(invited_members, ARRAY[]::TEXT[]))
  );

-- Also create a policy that allows viewing by auction ID for debugging
DROP POLICY IF EXISTS "Debug auction access" ON company_auctions;
CREATE POLICY "Debug auction access" ON company_auctions
  FOR SELECT USING (
    -- Temporarily allow all authenticated users to see auctions for debugging
    auth.uid() IS NOT NULL
  );

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Debug auction RLS policies created!';
  RAISE NOTICE '';
  RAISE NOTICE 'Policies created:';
  RAISE NOTICE '- Company owners can view their auctions';
  RAISE NOTICE '- Invited members can view auctions (permissive)';
  RAISE NOTICE '- Debug policy allows all authenticated users (TEMPORARY)';
  RAISE NOTICE '';
  RAISE NOTICE 'This should allow access for debugging. Remove debug policy after testing.';
END $$;
