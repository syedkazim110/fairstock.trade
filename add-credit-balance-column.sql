-- Add credit_balance column to company_members table
-- This allows admins to manage member credit balances directly

ALTER TABLE company_members 
ADD COLUMN IF NOT EXISTS credit_balance DECIMAL(10,2) DEFAULT 0.00;

-- Add a comment to document the column
COMMENT ON COLUMN company_members.credit_balance IS 'Credit balance for company members managed by admin';
