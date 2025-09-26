-- Modified Dutch Auction Database Schema Enhancement
-- This adds support for uniform clearing price auctions with quantity-based bidding

-- =====================================================
-- SCHEMA MODIFICATIONS FOR MODIFIED DUTCH AUCTION
-- =====================================================

-- Add new columns to auction_bids table for quantity-based bidding
ALTER TABLE auction_bids 
ADD COLUMN IF NOT EXISTS quantity_requested BIGINT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS quantity_allocated BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_price DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS allocation_status VARCHAR(20) DEFAULT 'pending' CHECK (allocation_status IN ('pending', 'allocated', 'rejected', 'partial'));

-- Update existing bid_amount to be max_price for clarity
UPDATE auction_bids SET max_price = bid_amount WHERE max_price IS NULL;

-- Add clearing price and allocation tracking to company_auctions
ALTER TABLE company_auctions 
ADD COLUMN IF NOT EXISTS clearing_price DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS total_demand BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS clearing_calculated_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS auction_mode VARCHAR(20) DEFAULT 'traditional' CHECK (auction_mode IN ('traditional', 'modified_dutch')),
ADD COLUMN IF NOT EXISTS bid_collection_end_time TIMESTAMP WITH TIME ZONE;

-- Create auction clearing results table
CREATE TABLE IF NOT EXISTS auction_clearing_results (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auction_id UUID REFERENCES company_auctions(id) ON DELETE CASCADE NOT NULL,
  clearing_price DECIMAL(10,2) NOT NULL,
  total_bids_count INTEGER NOT NULL,
  total_demand BIGINT NOT NULL,
  shares_allocated BIGINT NOT NULL,
  shares_remaining BIGINT NOT NULL,
  clearing_step INTEGER NOT NULL,
  pro_rata_applied BOOLEAN DEFAULT FALSE,
  calculation_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(auction_id)
);

-- Create bid allocation details table for tracking individual allocations
CREATE TABLE IF NOT EXISTS bid_allocations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auction_id UUID REFERENCES company_auctions(id) ON DELETE CASCADE NOT NULL,
  bid_id UUID REFERENCES auction_bids(id) ON DELETE CASCADE NOT NULL,
  bidder_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  original_quantity BIGINT NOT NULL,
  allocated_quantity BIGINT NOT NULL,
  clearing_price DECIMAL(10,2) NOT NULL,
  total_amount DECIMAL(12,2) NOT NULL,
  allocation_type VARCHAR(20) DEFAULT 'full' CHECK (allocation_type IN ('full', 'pro_rata', 'rejected')),
  pro_rata_percentage DECIMAL(5,4),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_auction_bids_quantity_requested ON auction_bids(quantity_requested);
CREATE INDEX IF NOT EXISTS idx_auction_bids_max_price ON auction_bids(max_price DESC);
CREATE INDEX IF NOT EXISTS idx_auction_bids_allocation_status ON auction_bids(allocation_status);
CREATE INDEX IF NOT EXISTS idx_company_auctions_auction_mode ON company_auctions(auction_mode);
CREATE INDEX IF NOT EXISTS idx_company_auctions_clearing_price ON company_auctions(clearing_price);
CREATE INDEX IF NOT EXISTS idx_auction_clearing_results_auction_id ON auction_clearing_results(auction_id);
CREATE INDEX IF NOT EXISTS idx_bid_allocations_auction_id ON bid_allocations(auction_id);
CREATE INDEX IF NOT EXISTS idx_bid_allocations_bid_id ON bid_allocations(bid_id);
CREATE INDEX IF NOT EXISTS idx_bid_allocations_bidder_id ON bid_allocations(bidder_id);

-- =====================================================
-- RLS POLICIES FOR NEW TABLES
-- =====================================================

-- Enable RLS on new tables
ALTER TABLE auction_clearing_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE bid_allocations ENABLE ROW LEVEL SECURITY;

-- Clearing results policies
CREATE POLICY "Company owners can view clearing results" ON auction_clearing_results
  FOR SELECT USING (
    auction_id IN (
      SELECT id FROM company_auctions 
      WHERE company_id IN (SELECT id FROM companies WHERE auth.uid() = created_by)
    )
  );

CREATE POLICY "Participants can view clearing results for their auctions" ON auction_clearing_results
  FOR SELECT USING (
    auction_id IN (
      SELECT id FROM company_auctions 
      WHERE status IN ('completed', 'active') AND 
      (SELECT email FROM auth.users WHERE id = auth.uid()) = ANY(invited_members)
    )
  );

-- Bid allocations policies
CREATE POLICY "Company owners can view all allocations" ON bid_allocations
  FOR SELECT USING (
    auction_id IN (
      SELECT id FROM company_auctions 
      WHERE company_id IN (SELECT id FROM companies WHERE auth.uid() = created_by)
    )
  );

CREATE POLICY "Bidders can view their own allocations" ON bid_allocations
  FOR SELECT USING (auth.uid() = bidder_id);

-- =====================================================
-- FUNCTIONS FOR CLEARING PRICE CALCULATION
-- =====================================================

-- Function to calculate clearing price and allocations
CREATE OR REPLACE FUNCTION calculate_auction_clearing(auction_id_param UUID)
RETURNS TABLE (
  clearing_price DECIMAL(10,2),
  total_demand BIGINT,
  shares_allocated BIGINT,
  pro_rata_applied BOOLEAN,
  calculation_details JSONB
) AS $$
DECLARE
  auction_record RECORD;
  bid_record RECORD;
  running_demand BIGINT := 0;
  calculated_clearing_price DECIMAL(10,2);
  remaining_shares BIGINT;
  pro_rata_needed BOOLEAN := FALSE;
  pro_rata_percentage DECIMAL(5,4);
  calculation_json JSONB := '{}';
  bid_details JSONB := '[]';
BEGIN
  -- Get auction details
  SELECT * INTO auction_record 
  FROM company_auctions 
  WHERE id = auction_id_param;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Auction not found';
  END IF;
  
  -- Initialize variables
  remaining_shares := auction_record.shares_count;
  
  -- Process bids in descending price order
  FOR bid_record IN 
    SELECT ab.*, au.email as bidder_email
    FROM auction_bids ab
    JOIN auth.users au ON ab.bidder_id = au.id
    WHERE ab.auction_id = auction_id_param 
    AND ab.bid_status = 'active'
    ORDER BY ab.max_price DESC, ab.bid_time ASC
  LOOP
    -- Add bid details to calculation
    bid_details := bid_details || jsonb_build_object(
      'bid_id', bid_record.id,
      'bidder_email', bid_record.bidder_email,
      'max_price', bid_record.max_price,
      'quantity_requested', bid_record.quantity_requested,
      'running_demand_before', running_demand
    );
    
    -- Check if this bid price level clears the auction
    IF running_demand + bid_record.quantity_requested >= auction_record.shares_count THEN
      calculated_clearing_price := bid_record.max_price;
      
      -- Check if we need pro-rata allocation at this price level
      IF running_demand + bid_record.quantity_requested > auction_record.shares_count THEN
        pro_rata_needed := TRUE;
        pro_rata_percentage := (auction_record.shares_count - running_demand)::DECIMAL / bid_record.quantity_requested;
      END IF;
      
      EXIT; -- Found clearing price
    END IF;
    
    running_demand := running_demand + bid_record.quantity_requested;
  END LOOP;
  
  -- If no clearing price found, auction is undersubscribed
  IF calculated_clearing_price IS NULL THEN
    calculated_clearing_price := auction_record.min_price;
    remaining_shares := auction_record.shares_count - running_demand;
  ELSE
    remaining_shares := 0;
  END IF;
  
  -- Build calculation details
  calculation_json := jsonb_build_object(
    'total_bids', (SELECT COUNT(*) FROM auction_bids WHERE auction_id = auction_id_param AND bid_status = 'active'),
    'bid_details', bid_details,
    'clearing_logic', CASE 
      WHEN pro_rata_needed THEN 'pro_rata_at_clearing_price'
      WHEN remaining_shares > 0 THEN 'undersubscribed'
      ELSE 'full_allocation'
    END,
    'pro_rata_percentage', pro_rata_percentage
  );
  
  -- Return results
  RETURN QUERY SELECT 
    calculated_clearing_price,
    running_demand + COALESCE(bid_record.quantity_requested, 0),
    auction_record.shares_count - remaining_shares,
    pro_rata_needed,
    calculation_json;
END;
$$ LANGUAGE plpgsql;

-- Function to execute clearing and create allocations
CREATE OR REPLACE FUNCTION execute_auction_clearing(auction_id_param UUID)
RETURNS BOOLEAN AS $$
DECLARE
  clearing_result RECORD;
  bid_record RECORD;
  running_allocated BIGINT := 0;
  shares_remaining BIGINT;
  allocation_quantity BIGINT;
  pro_rata_percentage DECIMAL(5,4);
BEGIN
  -- Calculate clearing price
  SELECT * INTO clearing_result 
  FROM calculate_auction_clearing(auction_id_param);
  
  -- Update auction with clearing results
  UPDATE company_auctions 
  SET 
    clearing_price = clearing_result.clearing_price,
    total_demand = clearing_result.total_demand,
    clearing_calculated_at = NOW(),
    status = 'completed'
  WHERE id = auction_id_param;
  
  -- Insert clearing results
  INSERT INTO auction_clearing_results (
    auction_id, clearing_price, total_bids_count, total_demand, 
    shares_allocated, shares_remaining, clearing_step, pro_rata_applied, calculation_details
  ) VALUES (
    auction_id_param,
    clearing_result.clearing_price,
    (clearing_result.calculation_details->>'total_bids')::INTEGER,
    clearing_result.total_demand,
    clearing_result.shares_allocated,
    (SELECT shares_count FROM company_auctions WHERE id = auction_id_param) - clearing_result.shares_allocated,
    1,
    clearing_result.pro_rata_applied,
    clearing_result.calculation_details
  );
  
  -- Get shares remaining for allocation
  SELECT shares_count INTO shares_remaining 
  FROM company_auctions 
  WHERE id = auction_id_param;
  
  -- Get pro-rata percentage if needed
  pro_rata_percentage := (clearing_result.calculation_details->>'pro_rata_percentage')::DECIMAL;
  
  -- Process each bid for allocation
  FOR bid_record IN 
    SELECT * FROM auction_bids 
    WHERE auction_id = auction_id_param 
    AND bid_status = 'active'
    ORDER BY max_price DESC, bid_time ASC
  LOOP
    -- Determine allocation
    IF bid_record.max_price > clearing_result.clearing_price THEN
      -- Full allocation for bids above clearing price
      allocation_quantity := LEAST(bid_record.quantity_requested, shares_remaining);
      
      INSERT INTO bid_allocations (
        auction_id, bid_id, bidder_id, original_quantity, allocated_quantity,
        clearing_price, total_amount, allocation_type
      ) VALUES (
        auction_id_param, bid_record.id, bid_record.bidder_id,
        bid_record.quantity_requested, allocation_quantity,
        clearing_result.clearing_price, allocation_quantity * clearing_result.clearing_price,
        'full'
      );
      
      -- Update bid record
      UPDATE auction_bids 
      SET quantity_allocated = allocation_quantity, allocation_status = 'allocated'
      WHERE id = bid_record.id;
      
    ELSIF bid_record.max_price = clearing_result.clearing_price THEN
      -- Pro-rata allocation at clearing price if needed
      IF clearing_result.pro_rata_applied AND pro_rata_percentage IS NOT NULL THEN
        allocation_quantity := FLOOR(bid_record.quantity_requested * pro_rata_percentage);
        
        INSERT INTO bid_allocations (
          auction_id, bid_id, bidder_id, original_quantity, allocated_quantity,
          clearing_price, total_amount, allocation_type, pro_rata_percentage
        ) VALUES (
          auction_id_param, bid_record.id, bid_record.bidder_id,
          bid_record.quantity_requested, allocation_quantity,
          clearing_result.clearing_price, allocation_quantity * clearing_result.clearing_price,
          'pro_rata', pro_rata_percentage
        );
        
        UPDATE auction_bids 
        SET quantity_allocated = allocation_quantity, 
            allocation_status = CASE WHEN allocation_quantity > 0 THEN 'partial' ELSE 'rejected' END
        WHERE id = bid_record.id;
      ELSE
        -- Full allocation at clearing price
        allocation_quantity := LEAST(bid_record.quantity_requested, shares_remaining);
        
        INSERT INTO bid_allocations (
          auction_id, bid_id, bidder_id, original_quantity, allocated_quantity,
          clearing_price, total_amount, allocation_type
        ) VALUES (
          auction_id_param, bid_record.id, bid_record.bidder_id,
          bid_record.quantity_requested, allocation_quantity,
          clearing_result.clearing_price, allocation_quantity * clearing_result.clearing_price,
          'full'
        );
        
        UPDATE auction_bids 
        SET quantity_allocated = allocation_quantity, allocation_status = 'allocated'
        WHERE id = bid_record.id;
      END IF;
      
    ELSE
      -- Reject bids below clearing price
      UPDATE auction_bids 
      SET quantity_allocated = 0, allocation_status = 'rejected'
      WHERE id = bid_record.id;
    END IF;
    
    shares_remaining := shares_remaining - allocation_quantity;
    running_allocated := running_allocated + allocation_quantity;
  END LOOP;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VIEWS FOR MODIFIED DUTCH AUCTION
-- =====================================================

-- View for auction demand analysis
CREATE OR REPLACE VIEW auction_demand_analysis AS
SELECT 
  ca.id as auction_id,
  ca.title,
  ca.shares_count,
  ca.auction_mode,
  ca.clearing_price,
  COUNT(ab.id) as total_bids,
  SUM(ab.quantity_requested) as total_demand,
  ROUND(SUM(ab.quantity_requested)::DECIMAL / ca.shares_count * 100, 2) as demand_ratio_percent,
  MIN(ab.max_price) as lowest_bid,
  MAX(ab.max_price) as highest_bid,
  AVG(ab.max_price) as average_bid,
  ca.status
FROM company_auctions ca
LEFT JOIN auction_bids ab ON ca.id = ab.auction_id AND ab.bid_status = 'active'
WHERE ca.auction_mode = 'modified_dutch'
GROUP BY ca.id, ca.title, ca.shares_count, ca.auction_mode, ca.clearing_price, ca.status;

-- View for bidder allocation summary
CREATE OR REPLACE VIEW bidder_allocation_summary AS
SELECT 
  ba.auction_id,
  ba.bidder_id,
  au.email as bidder_email,
  ba.original_quantity,
  ba.allocated_quantity,
  ba.clearing_price,
  ba.total_amount,
  ba.allocation_type,
  ba.pro_rata_percentage,
  CASE 
    WHEN ba.allocated_quantity = ba.original_quantity THEN 'Full'
    WHEN ba.allocated_quantity > 0 THEN 'Partial'
    ELSE 'None'
  END as allocation_status_text
FROM bid_allocations ba
JOIN auth.users au ON ba.bidder_id = au.id;

-- =====================================================
-- COMMENTS AND DOCUMENTATION
-- =====================================================

COMMENT ON COLUMN auction_bids.quantity_requested IS 'Number of shares the bidder wants to purchase';
COMMENT ON COLUMN auction_bids.quantity_allocated IS 'Number of shares actually allocated to the bidder';
COMMENT ON COLUMN auction_bids.max_price IS 'Maximum price per share the bidder is willing to pay';
COMMENT ON COLUMN auction_bids.allocation_status IS 'Status of bid allocation: pending, allocated, rejected, partial';

COMMENT ON COLUMN company_auctions.clearing_price IS 'Final uniform price paid by all winning bidders';
COMMENT ON COLUMN company_auctions.total_demand IS 'Total shares requested across all bids';
COMMENT ON COLUMN company_auctions.auction_mode IS 'Type of auction: traditional or modified_dutch';
COMMENT ON COLUMN company_auctions.bid_collection_end_time IS 'When bid collection period ends';

COMMENT ON TABLE auction_clearing_results IS 'Results of clearing price calculation for modified Dutch auctions';
COMMENT ON TABLE bid_allocations IS 'Individual bid allocation details with clearing price and amounts';

COMMENT ON FUNCTION calculate_auction_clearing IS 'Calculates clearing price and allocation details for a modified Dutch auction';
COMMENT ON FUNCTION execute_auction_clearing IS 'Executes the clearing process and creates final allocations';

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Modified Dutch Auction Schema Enhancement Complete!';
  RAISE NOTICE '';
  RAISE NOTICE 'New Features Added:';
  RAISE NOTICE '- Quantity-based bidding (quantity + max price)';
  RAISE NOTICE '- Uniform clearing price calculation';
  RAISE NOTICE '- Pro-rata allocation for oversubscription';
  RAISE NOTICE '- Comprehensive bid allocation tracking';
  RAISE NOTICE '- Clearing price calculation functions';
  RAISE NOTICE '';
  RAISE NOTICE 'New Tables:';
  RAISE NOTICE '- auction_clearing_results';
  RAISE NOTICE '- bid_allocations';
  RAISE NOTICE '';
  RAISE NOTICE 'Enhanced Tables:';
  RAISE NOTICE '- auction_bids (added quantity fields)';
  RAISE NOTICE '- company_auctions (added clearing price fields)';
  RAISE NOTICE '';
  RAISE NOTICE 'Next: Update application code to use new schema!';
END $$;
