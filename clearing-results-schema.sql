-- Create tables for modified Dutch auction clearing results and bid allocations
-- This schema supports the clearing process for Phase 3 implementation

-- Table to store clearing calculation results for each auction
CREATE TABLE IF NOT EXISTS auction_clearing_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES company_auctions(id) ON DELETE CASCADE,
  clearing_price DECIMAL(10,2) NOT NULL,
  total_bids_count INTEGER NOT NULL DEFAULT 0,
  total_demand INTEGER NOT NULL DEFAULT 0,
  shares_allocated INTEGER NOT NULL DEFAULT 0,
  shares_remaining INTEGER NOT NULL DEFAULT 0,
  pro_rata_applied BOOLEAN NOT NULL DEFAULT false,
  calculation_details JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT clearing_price_positive CHECK (clearing_price >= 0),
  CONSTRAINT total_bids_count_non_negative CHECK (total_bids_count >= 0),
  CONSTRAINT total_demand_non_negative CHECK (total_demand >= 0),
  CONSTRAINT shares_allocated_non_negative CHECK (shares_allocated >= 0),
  CONSTRAINT shares_remaining_non_negative CHECK (shares_remaining >= 0),
  
  -- Unique constraint to prevent duplicate clearing calculations
  CONSTRAINT unique_auction_clearing UNIQUE (auction_id)
);

-- Table to store individual bid allocations after clearing
CREATE TABLE IF NOT EXISTS bid_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES company_auctions(id) ON DELETE CASCADE,
  bidder_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bidder_email TEXT NOT NULL,
  original_quantity INTEGER NOT NULL,
  allocated_quantity INTEGER NOT NULL DEFAULT 0,
  clearing_price DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  allocation_type TEXT NOT NULL CHECK (allocation_type IN ('full', 'pro_rata', 'rejected')),
  pro_rata_percentage DECIMAL(5,4) NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT original_quantity_positive CHECK (original_quantity > 0),
  CONSTRAINT allocated_quantity_non_negative CHECK (allocated_quantity >= 0),
  CONSTRAINT allocated_not_exceed_original CHECK (allocated_quantity <= original_quantity),
  CONSTRAINT clearing_price_positive CHECK (clearing_price >= 0),
  CONSTRAINT total_amount_non_negative CHECK (total_amount >= 0),
  CONSTRAINT pro_rata_percentage_valid CHECK (
    pro_rata_percentage IS NULL OR 
    (pro_rata_percentage >= 0 AND pro_rata_percentage <= 1)
  ),
  
  -- Unique constraint to prevent duplicate allocations for same bidder in same auction
  CONSTRAINT unique_bidder_auction_allocation UNIQUE (auction_id, bidder_id)
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_auction_clearing_results_auction_id 
ON auction_clearing_results(auction_id);

CREATE INDEX IF NOT EXISTS idx_bid_allocations_auction_id 
ON bid_allocations(auction_id);

CREATE INDEX IF NOT EXISTS idx_bid_allocations_bidder_id 
ON bid_allocations(bidder_id);

CREATE INDEX IF NOT EXISTS idx_bid_allocations_allocation_type 
ON bid_allocations(allocation_type);

-- Add updated_at trigger for auction_clearing_results
CREATE OR REPLACE FUNCTION update_auction_clearing_results_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auction_clearing_results_updated_at
  BEFORE UPDATE ON auction_clearing_results
  FOR EACH ROW
  EXECUTE FUNCTION update_auction_clearing_results_updated_at();

-- Add updated_at trigger for bid_allocations
CREATE OR REPLACE FUNCTION update_bid_allocations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_bid_allocations_updated_at
  BEFORE UPDATE ON bid_allocations
  FOR EACH ROW
  EXECUTE FUNCTION update_bid_allocations_updated_at();

-- Add RLS (Row Level Security) policies for auction_clearing_results
ALTER TABLE auction_clearing_results ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view clearing results for auctions they have access to
CREATE POLICY "Users can view clearing results for accessible auctions" ON auction_clearing_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM company_auctions ca
      JOIN companies c ON ca.company_id = c.id
      WHERE ca.id = auction_clearing_results.auction_id
      AND (
        -- Company owner can see all results
        c.created_by = auth.uid()
        OR
        -- Invited members can see results
        (ca.invited_members IS NULL OR auth.jwt() ->> 'email' = ANY(ca.invited_members))
        OR
        -- Public auctions (if any)
        ca.invited_members IS NULL
      )
    )
  );

-- Policy: Only company owners can insert clearing results (via API)
CREATE POLICY "Company owners can insert clearing results" ON auction_clearing_results
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_auctions ca
      JOIN companies c ON ca.company_id = c.id
      WHERE ca.id = auction_clearing_results.auction_id
      AND c.created_by = auth.uid()
    )
  );

-- Add RLS policies for bid_allocations
ALTER TABLE bid_allocations ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own allocations, company owners can view all
CREATE POLICY "Users can view relevant bid allocations" ON bid_allocations
  FOR SELECT USING (
    -- Users can see their own allocations
    bidder_id = auth.uid()
    OR
    -- Company owners can see all allocations for their auctions
    EXISTS (
      SELECT 1 FROM company_auctions ca
      JOIN companies c ON ca.company_id = c.id
      WHERE ca.id = bid_allocations.auction_id
      AND c.created_by = auth.uid()
    )
  );

-- Policy: Only company owners can insert bid allocations (via API)
CREATE POLICY "Company owners can insert bid allocations" ON bid_allocations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_auctions ca
      JOIN companies c ON ca.company_id = c.id
      WHERE ca.id = bid_allocations.auction_id
      AND c.created_by = auth.uid()
    )
  );

-- Add comments for documentation
COMMENT ON TABLE auction_clearing_results IS 'Stores clearing price calculation results for modified Dutch auctions';
COMMENT ON TABLE bid_allocations IS 'Stores individual bid allocation results after clearing calculation';

COMMENT ON COLUMN auction_clearing_results.clearing_price IS 'The uniform clearing price determined by the algorithm';
COMMENT ON COLUMN auction_clearing_results.calculation_details IS 'JSON object containing detailed calculation steps and metadata';
COMMENT ON COLUMN bid_allocations.allocation_type IS 'Type of allocation: full, pro_rata, or rejected';
COMMENT ON COLUMN bid_allocations.pro_rata_percentage IS 'Percentage applied for pro-rata allocations (0.0 to 1.0)';

-- Grant necessary permissions (adjust based on your setup)
-- GRANT SELECT, INSERT ON auction_clearing_results TO authenticated;
-- GRANT SELECT, INSERT ON bid_allocations TO authenticated;
