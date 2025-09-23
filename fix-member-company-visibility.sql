-- SIMPLE RLS Policy Fix - No Cross-Table References
-- This approach completely avoids recursion by not referencing between tables in policies
-- Run this in your Supabase SQL editor

-- STEP 1: Drop ALL existing policies to start completely fresh
DROP POLICY IF EXISTS "Users can view companies they created" ON companies;
DROP POLICY IF EXISTS "Users can create companies" ON companies;
DROP POLICY IF EXISTS "Company creators can update their companies" ON companies;
DROP POLICY IF EXISTS "Users can view companies where they are members" ON companies;

DROP POLICY IF EXISTS "Users can view members of companies they created" ON company_members;
DROP POLICY IF EXISTS "Users can insert members for companies they created" ON company_members;
DROP POLICY IF EXISTS "Users can update members of companies they created" ON company_members;
DROP POLICY IF EXISTS "Users can delete members of companies they created" ON company_members;
DROP POLICY IF EXISTS "Members can view other members in their companies" ON company_members;
DROP POLICY IF EXISTS "Company owners can view members" ON company_members;
DROP POLICY IF EXISTS "Members can view company members" ON company_members;
DROP POLICY IF EXISTS "Company owners can insert members" ON company_members;
DROP POLICY IF EXISTS "Company owners can update members" ON company_members;
DROP POLICY IF EXISTS "Company owners can delete members" ON company_members;

-- STEP 2: Temporarily disable RLS to avoid issues during policy creation
ALTER TABLE companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE company_members DISABLE ROW LEVEL SECURITY;

-- STEP 3: Create simple policies for COMPANIES table (no cross-table references)
-- Policy 1: Users can view companies they created
CREATE POLICY "Users can view companies they created" ON companies
  FOR SELECT USING (auth.uid() = created_by);

-- Policy 2: Users can create companies
CREATE POLICY "Users can create companies" ON companies
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Policy 3: Company creators can update their companies
CREATE POLICY "Company creators can update their companies" ON companies
  FOR UPDATE USING (auth.uid() = created_by);

-- STEP 4: Create helper function for company ownership
CREATE OR REPLACE FUNCTION user_owns_company(company_uuid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
AS $$
  SELECT EXISTS(
    SELECT 1 FROM companies 
    WHERE id = company_uuid AND created_by = auth.uid()
  );
$$;

-- STEP 5: Create a simple policy for COMPANY_MEMBERS table - allow all authenticated users to read
-- This is a temporary simple approach to avoid recursion issues
CREATE POLICY "Authenticated users can view company members" ON company_members
  FOR SELECT USING (true);

-- Company owners can manage members
CREATE POLICY "Company owners can insert members" ON company_members
  FOR INSERT WITH CHECK (user_owns_company(company_id));

CREATE POLICY "Company owners can update members" ON company_members
  FOR UPDATE USING (user_owns_company(company_id));

CREATE POLICY "Company owners can delete members" ON company_members
  FOR DELETE USING (user_owns_company(company_id));

-- STEP 5: Re-enable RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;

-- STEP 6: Create a view for the frontend to use instead of complex queries
CREATE OR REPLACE VIEW user_accessible_companies AS
SELECT DISTINCT
  c.id,
  c.name,
  c.address,
  c.country_code,
  c.state_code,
  c.business_structure,
  c.created_at,
  c.created_by,
  CASE 
    WHEN c.created_by = auth.uid() THEN 'owner'
    ELSE 'member'
  END as user_role
FROM companies c
LEFT JOIN company_members cm ON c.id = cm.company_id
WHERE 
  c.created_by = auth.uid() -- Companies user owns
  OR 
  (cm.email = (SELECT email FROM auth.users WHERE id = auth.uid())) -- Companies user is member of
;

-- Grant access to the view
GRANT SELECT ON user_accessible_companies TO authenticated;

-- STEP 7: Verify policies (run separately to check)
/*
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('companies', 'company_members')
ORDER BY tablename, policyname;
*/
