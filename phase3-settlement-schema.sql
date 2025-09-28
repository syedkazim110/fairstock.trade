-- Phase 3: Post-Settlement Workflow Database Schema
-- This file adds settlement tracking capabilities to the auction system

-- =====================================================
-- SETTLEMENT TRACKING ENHANCEMENTS
-- =====================================================

-- Add settlement tracking fields to bid_allocations table
ALTER TABLE bid_allocations 
ADD COLUMN IF NOT EXISTS settlement_status VARCHAR(20) DEFAULT 'pending_payment' 
  CHECK (settlement_status IN ('pending_payment', 'payment_received', 'shares_transferred', 'completed')),
ADD COLUMN IF NOT EXISTS settlement_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS payment_confirmation_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS share_transfer_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(255),
ADD COLUMN IF NOT EXISTS settlement_notes TEXT,
ADD COLUMN IF NOT EXISTS settlement_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add auction reference fields to company_transactions table
ALTER TABLE company_transactions 
ADD COLUMN IF NOT EXISTS auction_id UUID REFERENCES company_auctions(id),
ADD COLUMN IF NOT EXISTS bid_allocation_id UUID REFERENCES bid_allocations(id);

-- Create settlement status enum type for better type safety
DO $$ BEGIN
    CREATE TYPE settlement_status_enum AS ENUM (
        'pending_payment', 
        'payment_received', 
        'shares_transferred', 
        'completed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Update the column to use the enum (if not already using CHECK constraint)
-- ALTER TABLE bid_allocations ALTER COLUMN settlement_status TYPE settlement_status_enum USING settlement_status::settlement_status_enum;

-- =====================================================
-- SETTLEMENT TRACKING INDEXES
-- =====================================================

-- Indexes for settlement queries
CREATE INDEX IF NOT EXISTS idx_bid_allocations_settlement_status ON bid_allocations(settlement_status);
CREATE INDEX IF NOT EXISTS idx_bid_allocations_auction_settlement ON bid_allocations(auction_id, settlement_status);
CREATE INDEX IF NOT EXISTS idx_bid_allocations_settlement_date ON bid_allocations(settlement_date);
CREATE INDEX IF NOT EXISTS idx_bid_allocations_payment_confirmation ON bid_allocations(payment_confirmation_date);

-- Indexes for transaction auction references
CREATE INDEX IF NOT EXISTS idx_company_transactions_auction_id ON company_transactions(auction_id);
CREATE INDEX IF NOT EXISTS idx_company_transactions_bid_allocation ON company_transactions(bid_allocation_id);

-- =====================================================
-- SETTLEMENT VIEWS
-- =====================================================

-- View for settlement dashboard - shows all allocations with settlement status
CREATE OR REPLACE VIEW auction_settlement_dashboard AS
SELECT 
    ba.id as allocation_id,
    ba.auction_id,
    ba.bidder_id,
    ba.bidder_email,
    ba.allocated_quantity,
    ba.clearing_price,
    ba.total_amount,
    ba.settlement_status,
    ba.settlement_date,
    ba.payment_confirmation_date,
    ba.share_transfer_date,
    ba.payment_reference,
    ba.settlement_notes,
    ba.settlement_updated_at,
    
    -- Auction details
    ca.title as auction_title,
    ca.company_id,
    c.name as company_name,
    
    -- Settlement progress indicators
    CASE 
        WHEN ba.settlement_status = 'completed' THEN 100
        WHEN ba.settlement_status = 'shares_transferred' THEN 75
        WHEN ba.settlement_status = 'payment_received' THEN 50
        WHEN ba.settlement_status = 'pending_payment' THEN 25
        ELSE 0
    END as settlement_progress_percentage,
    
    -- Time tracking
    CASE 
        WHEN ba.settlement_date IS NOT NULL THEN 
            EXTRACT(EPOCH FROM (NOW() - ba.settlement_date)) / 86400
        ELSE NULL
    END as days_since_settlement_started,
    
    -- Payment status
    ba.payment_confirmation_date IS NOT NULL as payment_confirmed,
    ba.share_transfer_date IS NOT NULL as shares_transferred
    
FROM bid_allocations ba
JOIN company_auctions ca ON ba.auction_id = ca.id
JOIN companies c ON ca.company_id = c.id
WHERE ba.allocated_quantity > 0  -- Only successful allocations need settlement
ORDER BY ba.settlement_updated_at DESC;

-- View for settlement summary by auction
CREATE OR REPLACE VIEW auction_settlement_summary AS
SELECT 
    ca.id as auction_id,
    ca.title as auction_title,
    ca.company_id,
    c.name as company_name,
    ca.clearing_calculated_at,
    
    -- Allocation counts
    COUNT(ba.id) as total_successful_allocations,
    COUNT(CASE WHEN ba.settlement_status = 'pending_payment' THEN 1 END) as pending_payment_count,
    COUNT(CASE WHEN ba.settlement_status = 'payment_received' THEN 1 END) as payment_received_count,
    COUNT(CASE WHEN ba.settlement_status = 'shares_transferred' THEN 1 END) as shares_transferred_count,
    COUNT(CASE WHEN ba.settlement_status = 'completed' THEN 1 END) as completed_count,
    
    -- Financial totals
    SUM(ba.total_amount) as total_settlement_amount,
    SUM(CASE WHEN ba.settlement_status IN ('payment_received', 'shares_transferred', 'completed') 
        THEN ba.total_amount ELSE 0 END) as confirmed_payment_amount,
    SUM(CASE WHEN ba.settlement_status = 'pending_payment' 
        THEN ba.total_amount ELSE 0 END) as pending_payment_amount,
    
    -- Share totals
    SUM(ba.allocated_quantity) as total_shares_allocated,
    SUM(CASE WHEN ba.settlement_status IN ('shares_transferred', 'completed') 
        THEN ba.allocated_quantity ELSE 0 END) as shares_transferred_to_cap_table,
    
    -- Progress metrics
    ROUND(
        (COUNT(CASE WHEN ba.settlement_status = 'completed' THEN 1 END)::DECIMAL / COUNT(ba.id)) * 100, 
        2
    ) as settlement_completion_percentage,
    
    ROUND(
        (SUM(CASE WHEN ba.settlement_status IN ('payment_received', 'shares_transferred', 'completed') 
             THEN ba.total_amount ELSE 0 END) / SUM(ba.total_amount)) * 100, 
        2
    ) as payment_collection_percentage,
    
    -- Status indicators
    COUNT(ba.id) = COUNT(CASE WHEN ba.settlement_status = 'completed' THEN 1 END) as all_settlements_completed,
    COUNT(CASE WHEN ba.settlement_status = 'pending_payment' THEN 1 END) > 0 as has_pending_payments,
    
    -- Timing
    MIN(ba.settlement_date) as first_settlement_date,
    MAX(ba.settlement_updated_at) as last_settlement_update

FROM company_auctions ca
JOIN companies c ON ca.company_id = c.id
LEFT JOIN bid_allocations ba ON ca.id = ba.auction_id AND ba.allocated_quantity > 0
WHERE ca.status = 'completed' AND ca.clearing_calculated_at IS NOT NULL
GROUP BY ca.id, ca.title, ca.company_id, c.name, ca.clearing_calculated_at
ORDER BY ca.clearing_calculated_at DESC;

-- =====================================================
-- SETTLEMENT FUNCTIONS
-- =====================================================

-- Function to initialize settlement tracking after clearing
CREATE OR REPLACE FUNCTION initialize_auction_settlement(p_auction_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Set settlement_date and status for all successful allocations
    UPDATE bid_allocations 
    SET 
        settlement_status = 'pending_payment',
        settlement_date = NOW(),
        settlement_updated_at = NOW()
    WHERE 
        auction_id = p_auction_id 
        AND allocated_quantity > 0 
        AND settlement_date IS NULL;
        
    RAISE NOTICE 'Settlement tracking initialized for auction %', p_auction_id;
END;
$$ LANGUAGE plpgsql;

-- Function to confirm payment for an allocation
CREATE OR REPLACE FUNCTION confirm_allocation_payment(
    p_allocation_id UUID,
    p_payment_reference VARCHAR(255) DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_allocation_record RECORD;
BEGIN
    -- Get allocation details
    SELECT * INTO v_allocation_record
    FROM bid_allocations 
    WHERE id = p_allocation_id AND allocated_quantity > 0;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Allocation not found or has zero quantity: %', p_allocation_id;
    END IF;
    
    IF v_allocation_record.settlement_status != 'pending_payment' THEN
        RAISE EXCEPTION 'Allocation is not in pending_payment status. Current status: %', v_allocation_record.settlement_status;
    END IF;
    
    -- Update allocation with payment confirmation
    UPDATE bid_allocations 
    SET 
        settlement_status = 'payment_received',
        payment_confirmation_date = NOW(),
        payment_reference = p_payment_reference,
        settlement_notes = COALESCE(settlement_notes || E'\n', '') || 
                          'Payment confirmed: ' || NOW()::TEXT || 
                          CASE WHEN p_notes IS NOT NULL THEN E'\nNotes: ' || p_notes ELSE '' END,
        settlement_updated_at = NOW()
    WHERE id = p_allocation_id;
    
    RAISE NOTICE 'Payment confirmed for allocation %', p_allocation_id;
END;
$$ LANGUAGE plpgsql;

-- Function to transfer shares to cap table after payment confirmation
CREATE OR REPLACE FUNCTION transfer_allocation_shares_to_cap_table(p_allocation_id UUID)
RETURNS VOID AS $$
DECLARE
    v_allocation_record RECORD;
    v_company_id UUID;
BEGIN
    -- Get allocation and auction details
    SELECT 
        ba.*,
        ca.company_id,
        ca.title as auction_title
    INTO v_allocation_record
    FROM bid_allocations ba
    JOIN company_auctions ca ON ba.auction_id = ca.id
    WHERE ba.id = p_allocation_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Allocation not found: %', p_allocation_id;
    END IF;
    
    IF v_allocation_record.settlement_status != 'payment_received' THEN
        RAISE EXCEPTION 'Allocation payment not confirmed. Current status: %', v_allocation_record.settlement_status;
    END IF;
    
    v_company_id := v_allocation_record.company_id;
    
    -- Process share issuance transaction
    PERFORM process_company_transaction(
        p_company_id := v_company_id,
        p_transaction_type := 'share_issuance',
        p_to_member_email := v_allocation_record.bidder_email,
        p_share_quantity := v_allocation_record.allocated_quantity,
        p_description := 'Share issuance from auction: ' || v_allocation_record.auction_title || 
                        ' (Allocation ID: ' || p_allocation_id || ')'
    );
    
    -- Update the transaction record with auction references
    UPDATE company_transactions 
    SET 
        auction_id = v_allocation_record.auction_id,
        bid_allocation_id = p_allocation_id
    WHERE id = (
        SELECT id FROM company_transactions
        WHERE 
            company_id = v_company_id 
            AND transaction_type = 'share_issuance'
            AND to_member_email = v_allocation_record.bidder_email
            AND share_quantity = v_allocation_record.allocated_quantity
            AND auction_id IS NULL  -- Only update the most recent matching transaction
            AND created_at >= v_allocation_record.payment_confirmation_date
        ORDER BY created_at DESC
        LIMIT 1
    );
    
    -- Update allocation status
    UPDATE bid_allocations 
    SET 
        settlement_status = 'shares_transferred',
        share_transfer_date = NOW(),
        settlement_notes = COALESCE(settlement_notes || E'\n', '') || 
                          'Shares transferred to cap table: ' || NOW()::TEXT,
        settlement_updated_at = NOW()
    WHERE id = p_allocation_id;
    
    RAISE NOTICE 'Shares transferred to cap table for allocation %', p_allocation_id;
END;
$$ LANGUAGE plpgsql;

-- Function to complete settlement
CREATE OR REPLACE FUNCTION complete_allocation_settlement(p_allocation_id UUID)
RETURNS VOID AS $$
BEGIN
    -- Verify allocation is ready for completion
    IF NOT EXISTS (
        SELECT 1 FROM bid_allocations 
        WHERE id = p_allocation_id 
        AND settlement_status = 'shares_transferred'
        AND share_transfer_date IS NOT NULL
    ) THEN
        RAISE EXCEPTION 'Allocation is not ready for completion. Must be in shares_transferred status.';
    END IF;
    
    -- Mark as completed
    UPDATE bid_allocations 
    SET 
        settlement_status = 'completed',
        settlement_notes = COALESCE(settlement_notes || E'\n', '') || 
                          'Settlement completed: ' || NOW()::TEXT,
        settlement_updated_at = NOW()
    WHERE id = p_allocation_id;
    
    RAISE NOTICE 'Settlement completed for allocation %', p_allocation_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SETTLEMENT TRIGGERS
-- =====================================================

-- Trigger to update settlement_updated_at timestamp
CREATE OR REPLACE FUNCTION update_settlement_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.settlement_updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to bid_allocations
DROP TRIGGER IF EXISTS update_bid_allocations_settlement_timestamp ON bid_allocations;
CREATE TRIGGER update_bid_allocations_settlement_timestamp
    BEFORE UPDATE ON bid_allocations
    FOR EACH ROW 
    WHEN (OLD.settlement_status IS DISTINCT FROM NEW.settlement_status OR
          OLD.payment_confirmation_date IS DISTINCT FROM NEW.payment_confirmation_date OR
          OLD.share_transfer_date IS DISTINCT FROM NEW.share_transfer_date)
    EXECUTE FUNCTION update_settlement_timestamp();

-- =====================================================
-- RLS POLICIES FOR SETTLEMENT
-- =====================================================

-- Settlement dashboard view policies
CREATE POLICY "Company owners can view settlement dashboard" ON bid_allocations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM company_auctions ca
      JOIN companies c ON ca.company_id = c.id
      WHERE ca.id = bid_allocations.auction_id
      AND c.created_by = auth.uid()
    )
  );

-- Allow company owners to update settlement status
CREATE POLICY "Company owners can update settlement status" ON bid_allocations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM company_auctions ca
      JOIN companies c ON ca.company_id = c.id
      WHERE ca.id = bid_allocations.auction_id
      AND c.created_by = auth.uid()
    )
  );

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant execute permissions on settlement functions
GRANT EXECUTE ON FUNCTION initialize_auction_settlement TO authenticated;
GRANT EXECUTE ON FUNCTION confirm_allocation_payment TO authenticated;
GRANT EXECUTE ON FUNCTION transfer_allocation_shares_to_cap_table TO authenticated;
GRANT EXECUTE ON FUNCTION complete_allocation_settlement TO authenticated;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON COLUMN bid_allocations.settlement_status IS 'Current status of settlement process';
COMMENT ON COLUMN bid_allocations.settlement_date IS 'When settlement process was initiated';
COMMENT ON COLUMN bid_allocations.payment_confirmation_date IS 'When admin confirmed payment received';
COMMENT ON COLUMN bid_allocations.share_transfer_date IS 'When shares were transferred to cap table';
COMMENT ON COLUMN bid_allocations.payment_reference IS 'Admin reference for payment tracking';
COMMENT ON COLUMN bid_allocations.settlement_notes IS 'Admin notes about settlement process';

COMMENT ON COLUMN company_transactions.auction_id IS 'Reference to originating auction';
COMMENT ON COLUMN company_transactions.bid_allocation_id IS 'Reference to specific bid allocation';

COMMENT ON VIEW auction_settlement_dashboard IS 'Complete settlement tracking view for admin dashboard';
COMMENT ON VIEW auction_settlement_summary IS 'Settlement progress summary by auction';

COMMENT ON FUNCTION initialize_auction_settlement IS 'Initialize settlement tracking after auction clearing';
COMMENT ON FUNCTION confirm_allocation_payment IS 'Confirm payment received for allocation';
COMMENT ON FUNCTION transfer_allocation_shares_to_cap_table IS 'Transfer shares to cap table after payment';
COMMENT ON FUNCTION complete_allocation_settlement IS 'Mark settlement as completed';

-- =====================================================
-- SUCCESS MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Phase 3A: Settlement Schema Enhancement Complete!';
  RAISE NOTICE '';
  RAISE NOTICE 'Added Features:';
  RAISE NOTICE '- Settlement status tracking on bid_allocations';
  RAISE NOTICE '- Auction references on company_transactions';
  RAISE NOTICE '- Settlement dashboard and summary views';
  RAISE NOTICE '- Settlement management functions';
  RAISE NOTICE '- Settlement-specific RLS policies';
  RAISE NOTICE '- Settlement progress tracking';
  RAISE NOTICE '';
  RAISE NOTICE 'Settlement Workflow:';
  RAISE NOTICE '1. initialize_auction_settlement() - after clearing';
  RAISE NOTICE '2. confirm_allocation_payment() - when payment received';
  RAISE NOTICE '3. transfer_allocation_shares_to_cap_table() - auto share transfer';
  RAISE NOTICE '4. complete_allocation_settlement() - mark completed';
  RAISE NOTICE '';
  RAISE NOTICE 'Next: Implementing Settlement Management APIs...';
END $$;
