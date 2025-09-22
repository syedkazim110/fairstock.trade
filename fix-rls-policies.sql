-- Fix RLS policies to prevent infinite recursion
-- Run this in your Supabase SQL editor to fix the existing policies

-- Drop existing problematic policies
DROP POLICY IF EXISTS "Users can view companies they created or are members of" ON companies;
DROP POLICY IF EXISTS "Users can view members of companies they have access to" ON company_members;
DROP POLICY IF EXISTS "Users can manage members of companies they created" ON company_members;

-- Create corrected policies for companies
CREATE POLICY "Users can view companies they created" ON companies
  FOR SELECT USING (auth.uid() = created_by);

-- Create corrected policies for company members (separate policies for each operation)
CREATE POLICY "Users can view members of companies they created" ON company_members
  FOR SELECT USING (
    company_id IN (SELECT id FROM companies WHERE auth.uid() = created_by)
  );

CREATE POLICY "Users can insert members for companies they created" ON company_members
  FOR INSERT WITH CHECK (
    company_id IN (SELECT id FROM companies WHERE auth.uid() = created_by)
  );

CREATE POLICY "Users can update members of companies they created" ON company_members
  FOR UPDATE USING (
    company_id IN (SELECT id FROM companies WHERE auth.uid() = created_by)
  );

CREATE POLICY "Users can delete members of companies they created" ON company_members
  FOR DELETE USING (
    company_id IN (SELECT id FROM companies WHERE auth.uid() = created_by)
  );
