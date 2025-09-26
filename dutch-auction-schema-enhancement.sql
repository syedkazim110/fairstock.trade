-- Dutch Auction Schema Enhancement
-- Extend the existing company_auctions table to support Dutch auction functionality

-- Add Dutch auction specific columns to company_auctions table
ALTER TABLE company_auctions ADD COLUMN IF NOT EXISTS auction_type VARCHAR(20) DEFAULT 'dutch' CHECK (auction_type IN ('dutch', 'english'));
ALTER TABLE company_auctions ADD COLUMN IF NOT EXISTS shares_count BIGINT;
ALTER TABLE company_auctions ADD COLUMN IF NOT EXISTS max_price DECIMAL(10,2);
ALTER TABLE company_auctions ADD COLUMN IF NOT EXISTS min_price DECIMAL(10,2);
ALTER TABLE company_auctions ADD COLUMN IF NOT EXISTS decreasing_minutes INTEGER;
ALTER TABLE company_auctions ADD COLUMN IF NOT EXISTS duration_hours INTEGER;
ALTER TABLE company_auctions ADD COLUMN IF NOT EXISTS invited_members TEXT[];
ALTER TABLE company_auctions ADD COLUMN IF NOT EXISTS wire_account_name VARCHAR(255);
ALTER TABLE company_auctions ADD COLUMN IF NOT EXISTS wire_account_number VARCHAR(255);
ALTER TABLE company_auctions ADD COLUMN IF NOT EXISTS wire_routing_number VARCHAR(255);
ALTER TABLE company_auctions ADD COLUMN IF NOT EXISTS wire_bank_name VARCHAR(255);
ALTER TABLE company_auctions ADD COLUMN IF NOT EXISTS wire_bank_address TEXT;
ALTER TABLE company_auctions ADD COLUMN IF NOT EXISTS articles_document_id UUID REFERENCES company_documents(id);
ALTER TABLE company_auctions ADD COLUMN IF NOT EXISTS marketing_compliance_accepted BOOLEAN DEFAULT FALSE;
ALTER TABLE company_auctions ADD COLUMN IF NOT EXISTS accredited_investor_compliance_accepted BOOLEAN DEFAULT FALSE;
ALTER TABLE company_auctions ADD COLUMN IF NOT EXISTS start_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE company_auctions ADD COLUMN IF NOT EXISTS end_time TIMESTAMP WITH TIME ZONE;
ALTER TABLE company_auctions ADD COLUMN IF NOT EXISTS current_price DECIMAL(10,2);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_company_auctions_auction_type ON company_auctions(auction_type);
CREATE INDEX IF NOT EXISTS idx_company_auctions_status ON company_auctions(status);
CREATE INDEX IF NOT EXISTS idx_company_auctions_start_time ON company_auctions(start_time);
CREATE INDEX IF NOT EXISTS idx_company_auctions_end_time ON company_auctions(end_time);
CREATE INDEX IF NOT EXISTS idx_company_auctions_articles_document ON company_auctions(articles_document_id);

-- Update status check constraint to include more auction states
ALTER TABLE company_auctions DROP CONSTRAINT IF EXISTS company_auctions_status_check;
ALTER TABLE company_auctions ADD CONSTRAINT company_auctions_status_check 
  CHECK (status IN ('draft', 'active', 'completed', 'cancelled', 'expired'));

-- Add comments for documentation
COMMENT ON COLUMN company_auctions.auction_type IS 'Type of auction: dutch or english';
COMMENT ON COLUMN company_auctions.shares_count IS 'Number of shares being auctioned';
COMMENT ON COLUMN company_auctions.max_price IS 'Starting maximum price for Dutch auction';
COMMENT ON COLUMN company_auctions.min_price IS 'Minimum reserve price for Dutch auction';
COMMENT ON COLUMN company_auctions.decreasing_minutes IS 'Minutes between price decreases';
COMMENT ON COLUMN company_auctions.duration_hours IS 'Total auction duration in hours';
COMMENT ON COLUMN company_auctions.invited_members IS 'Array of member emails invited to participate';
COMMENT ON COLUMN company_auctions.current_price IS 'Current auction price (calculated in real-time)';
COMMENT ON COLUMN company_auctions.articles_document_id IS 'Reference to articles of incorporation document';
COMMENT ON COLUMN company_auctions.marketing_compliance_accepted IS 'SEC Rule 506(b) compliance acceptance';
COMMENT ON COLUMN company_auctions.accredited_investor_compliance_accepted IS 'Accredited investor compliance acceptance';
