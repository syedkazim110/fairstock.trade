-- Fix existing auctions that may have incorrect auction_mode values
-- This script updates any auctions that might be missing the auction_mode field

-- First, let's see what we're working with
SELECT id, title, auction_mode, auction_type, created_at 
FROM company_auctions 
WHERE auction_mode IS NULL OR auction_mode = '';

-- Update any auctions that don't have auction_mode set
-- Default to 'traditional' for existing auctions unless they have specific modified dutch characteristics
UPDATE company_auctions 
SET auction_mode = 'traditional'
WHERE auction_mode IS NULL OR auction_mode = '';

-- If there are any auctions that were intended to be modified dutch but got saved incorrectly,
-- you can manually update them like this:
-- UPDATE company_auctions 
-- SET auction_mode = 'modified_dutch'
-- WHERE id = 'your-auction-id-here';

-- Verify the update
SELECT id, title, auction_mode, status, created_at 
FROM company_auctions 
ORDER BY created_at DESC;
