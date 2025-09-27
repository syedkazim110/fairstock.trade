-- Add 'collecting_bids' status to company_auctions table
-- This status is used for modified Dutch auctions during the bid collection period

-- Update the status constraint to include 'collecting_bids'
ALTER TABLE company_auctions 
DROP CONSTRAINT IF EXISTS company_auctions_status_check;

ALTER TABLE company_auctions 
ADD CONSTRAINT company_auctions_status_check 
CHECK (status IN ('draft', 'active', 'collecting_bids', 'completed', 'cancelled', 'expired'));

-- Add comment explaining the new status
COMMENT ON COLUMN company_auctions.status IS 'Auction status: draft, active (traditional Dutch), collecting_bids (modified Dutch), completed, cancelled, expired';

-- Completion message
DO $$
BEGIN
  RAISE NOTICE '✅ Added collecting_bids status to company_auctions table';
  RAISE NOTICE 'Modified Dutch auctions can now use the collecting_bids status during bid collection period';
END $$;
