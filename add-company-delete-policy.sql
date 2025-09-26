-- Add DELETE policy for companies table
-- This allows company owners to delete their own companies

CREATE POLICY "Company creators can delete their companies" ON companies
  FOR DELETE USING (auth.uid() = created_by);
