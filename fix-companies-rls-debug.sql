-- Fix companies RLS policies for debugging
-- This allows invited auction members to see company information

-- Drop existing company policies to recreate them
DROP POLICY IF EXISTS "Company owners can view their companies" ON companies;
DROP POLICY IF EXISTS "Debug company access" ON companies;

-- Create a more permissive policy for company owners
CREATE POLICY "Company owners can view their companies" ON companies
  FOR SELECT USING (created_by = auth.uid());

-- Create a debug policy that allows auction participants to see company info
CREATE POLICY "Debug company access" ON companies
  FOR SELECT USING (
    -- Allow all authenticated users to see companies for debugging
    auth.uid() IS NOT NULL
  );

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Debug company RLS policies created!';
  RAISE NOTICE '';
  RAISE NOTICE 'Policies created:';
  RAISE NOTICE '- Company owners can view their companies';
  RAISE NOTICE '- Debug policy allows all authenticated users to see companies (TEMPORARY)';
  RAISE NOTICE '';
  RAISE NOTICE 'This should allow company data access for debugging. Remove debug policy after testing.';
END $$;
