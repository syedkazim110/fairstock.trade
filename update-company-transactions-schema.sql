-- Update company_transactions table to support the new transaction system
-- This adds the missing columns needed for equity and financial transactions

-- Add missing columns to company_transactions table
ALTER TABLE company_transactions 
ADD COLUMN IF NOT EXISTS share_quantity BIGINT,
ADD COLUMN IF NOT EXISTS from_member_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS to_member_email VARCHAR(255);

-- Update the existing columns to match our new schema
-- Note: The existing from_user_id and to_user_id columns can remain for backward compatibility
-- but we'll primarily use the email-based columns for member identification

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_company_transactions_company_id ON company_transactions(company_id);
CREATE INDEX IF NOT EXISTS idx_company_transactions_type ON company_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_company_transactions_from_member ON company_transactions(from_member_email);
CREATE INDEX IF NOT EXISTS idx_company_transactions_to_member ON company_transactions(to_member_email);
CREATE INDEX IF NOT EXISTS idx_company_transactions_created_at ON company_transactions(created_at);

-- Add comments to document the new columns
COMMENT ON COLUMN company_transactions.share_quantity IS 'Number of shares involved in equity transactions';
COMMENT ON COLUMN company_transactions.from_member_email IS 'Email of the member sending shares/credits';
COMMENT ON COLUMN company_transactions.to_member_email IS 'Email of the member receiving shares/credits';

-- Update the table comment
COMMENT ON TABLE company_transactions IS 'Records all company transactions including equity transfers and financial transactions between members';
