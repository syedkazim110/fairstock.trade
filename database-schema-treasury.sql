-- Treasury & Shares Database Schema Extensions
-- Add these columns to the existing companies table

-- Add treasury and shares related columns to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS total_shares BIGINT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS par_value DECIMAL(10,4);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS issued_shares BIGINT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS option_pool_shares BIGINT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS option_pool_percentage DECIMAL(5,2);
ALTER TABLE companies ADD COLUMN IF NOT EXISTS option_pool_type VARCHAR(10) CHECK (option_pool_type IN ('number', 'percentage'));

-- Add constraints to ensure data integrity
ALTER TABLE companies ADD CONSTRAINT check_positive_total_shares 
  CHECK (total_shares > 0);

ALTER TABLE companies ADD CONSTRAINT check_positive_par_value 
  CHECK (par_value > 0);

ALTER TABLE companies ADD CONSTRAINT check_positive_issued_shares 
  CHECK (issued_shares >= 0);

ALTER TABLE companies ADD CONSTRAINT check_positive_option_pool_shares 
  CHECK (option_pool_shares >= 0);

ALTER TABLE companies ADD CONSTRAINT check_valid_option_pool_percentage 
  CHECK (option_pool_percentage >= 0 AND option_pool_percentage <= 100);

ALTER TABLE companies ADD CONSTRAINT check_issued_shares_not_exceed_total 
  CHECK (issued_shares <= total_shares);

-- Add comment for documentation
COMMENT ON COLUMN companies.total_shares IS 'Total authorized shares for the company';
COMMENT ON COLUMN companies.par_value IS 'Par value per share in currency';
COMMENT ON COLUMN companies.issued_shares IS 'Number of shares currently issued';
COMMENT ON COLUMN companies.option_pool_shares IS 'Number of shares in option pool (when type is number)';
COMMENT ON COLUMN companies.option_pool_percentage IS 'Percentage of total shares in option pool (when type is percentage)';
COMMENT ON COLUMN companies.option_pool_type IS 'Whether option pool is specified as number or percentage';
