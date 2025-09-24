-- Fix RLS policies for company_transactions table
-- This removes the problematic reference to auth.users table

-- Drop existing problematic policies for company_transactions
DROP POLICY IF EXISTS "Company members can view transactions" ON company_transactions;
DROP POLICY IF EXISTS "Company owners can manage transactions" ON company_transactions;

-- Create simplified RLS policies that don't reference auth.users
-- These policies only allow company owners (creators) to access transactions

CREATE POLICY "Company owners can view transactions" ON company_transactions
  FOR SELECT USING (
    company_id IN (SELECT id FROM companies WHERE auth.uid() = created_by)
  );

CREATE POLICY "Company owners can insert transactions" ON company_transactions
  FOR INSERT WITH CHECK (
    company_id IN (SELECT id FROM companies WHERE auth.uid() = created_by)
  );

CREATE POLICY "Company owners can update transactions" ON company_transactions
  FOR UPDATE USING (
    company_id IN (SELECT id FROM companies WHERE auth.uid() = created_by)
  );

CREATE POLICY "Company owners can delete transactions" ON company_transactions
  FOR DELETE USING (
    company_id IN (SELECT id FROM companies WHERE auth.uid() = created_by)
  );

-- Also fix member_shareholdings policies if they have similar issues
DROP POLICY IF EXISTS "Company members can view shareholdings" ON member_shareholdings;
DROP POLICY IF EXISTS "Company owners can view shareholdings" ON member_shareholdings;
DROP POLICY IF EXISTS "Company owners can manage shareholdings" ON member_shareholdings;

CREATE POLICY "Company owners can view shareholdings" ON member_shareholdings
  FOR SELECT USING (
    company_id IN (SELECT id FROM companies WHERE auth.uid() = created_by)
  );

CREATE POLICY "Company owners can manage shareholdings" ON member_shareholdings
  FOR ALL USING (
    company_id IN (SELECT id FROM companies WHERE auth.uid() = created_by)
  );
