-- Fix Modified Dutch Auction Clearing Results Schema
-- This script ensures the clearing results tables are properly configured
-- and fixes any inconsistencies that might cause the clearing process to fail

-- Drop existing tables if they exist (to ensure clean state)
DROP TABLE IF EXISTS bid_allocations CASCADE;
DROP TABLE IF EXISTS auction_clearing_results CASCADE;

-- Create auction_clearing_results table with correct schema
CREATE TABLE auction_clearing_results (
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

-- Create bid_allocations table with correct schema
CREATE TABLE bid_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id UUID NOT NULL REFERENCES company_auctions(id) ON DELETE CASCADE,
  bid_id TEXT NOT NULL, -- This was missing in some schemas
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
  
  -- Unique constraint to prevent duplicate allocations for same bid in same auction
  CONSTRAINT unique_bid_auction_allocation UNIQUE (auction_id, bid_id)
);

-- Add indexes for better query performance
CREATE INDEX idx_auction_clearing_results_auction_id ON auction_clearing_results(auction_id);
CREATE INDEX idx_bid_allocations_auction_id ON bid_allocations(auction_id);
CREATE INDEX idx_bid_allocations_bidder_id ON bid_allocations(bidder_id);
CREATE INDEX idx_bid_allocations_allocation_type ON bid_allocations(allocation_type);
CREATE INDEX idx_bid_allocations_bid_id ON bid_allocations(bid_id);

-- Add updated_at triggers
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

-- Enable RLS
ALTER TABLE auction_clearing_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE bid_allocations ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view clearing results for accessible auctions" ON auction_clearing_results;
DROP POLICY IF EXISTS "Company owners can insert clearing results" ON auction_clearing_results;
DROP POLICY IF EXISTS "Users can view relevant bid allocations" ON bid_allocations;
DROP POLICY IF EXISTS "Company owners can insert bid allocations" ON bid_allocations;
DROP POLICY IF EXISTS "Company owners can view clearing results" ON auction_clearing_results;
DROP POLICY IF EXISTS "Participants can view clearing results for their auctions" ON auction_clearing_results;
DROP POLICY IF EXISTS "Company owners can view all allocations" ON bid_allocations;
DROP POLICY IF EXISTS "Bidders can view their own allocations" ON bid_allocations;

-- Create simplified RLS policies that allow proper access
-- Policy for auction_clearing_results - SELECT
CREATE POLICY "Allow viewing clearing results" ON auction_clearing_results
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM company_auctions ca
      JOIN companies c ON ca.company_id = c.id
      WHERE ca.id = auction_clearing_results.auction_id
      AND (
        -- Company owner can see all results
        c.created_by = auth.uid()
        OR
        -- Users who have bids in this auction can see results
        EXISTS (
          SELECT 1 FROM auction_bids ab
          WHERE ab.auction_id = ca.id
          AND ab.bidder_id = auth.uid()
        )
      )
    )
  );

-- Policy for auction_clearing_results - INSERT
CREATE POLICY "Allow inserting clearing results" ON auction_clearing_results
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM company_auctions ca
      JOIN companies c ON ca.company_id = c.id
      WHERE ca.id = auction_clearing_results.auction_id
      AND c.created_by = auth.uid()
    )
  );

-- Policy for bid_allocations - SELECT
CREATE POLICY "Allow viewing bid allocations" ON bid_allocations
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

-- Policy for bid_allocations - INSERT
CREATE POLICY "Allow inserting bid allocations" ON bid_allocations
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
COMMENT ON COLUMN bid_allocations.bid_id IS 'Reference to the original bid ID from the clearing algorithm';
COMMENT ON COLUMN bid_allocations.allocation_type IS 'Type of allocation: full, pro_rata, or rejected';
COMMENT ON COLUMN bid_allocations.pro_rata_percentage IS 'Percentage applied for pro-rata allocations (0.0 to 1.0)';

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Clearing results schema has been successfully updated!';
  RAISE NOTICE 'Tables created:';
  RAISE NOTICE '- auction_clearing_results (with proper constraints and indexes)';
  RAISE NOTICE '- bid_allocations (with bid_id field and proper constraints)';
  RAISE NOTICE 'RLS policies updated for proper access control';
END $$;
