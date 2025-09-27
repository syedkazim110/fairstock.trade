-- Fix auction member visibility by updating RLS policies
-- This addresses the issue where invited members can't see auctions with 'collecting_bids' status

-- Drop the existing policy for invited members
DROP POLICY IF EXISTS "Invited members can view auctions" ON company_auctions;

-- Create updated policy that includes 'collecting_bids' status
CREATE POLICY "Invited members can view auctions" ON company_auctions
  FOR SELECT USING (
    status IN ('active', 'collecting_bids', 'completed') AND 
    (SELECT email FROM auth.users WHERE id = auth.uid()) = ANY(invited_members)
  );

-- Also ensure auction bids are visible to invited members for their own auctions
DROP POLICY IF EXISTS "Invited members can view bids on their auctions" ON auction_bids;

CREATE POLICY "Invited members can view bids on their auctions" ON auction_bids
  FOR SELECT USING (
    auth.uid() = bidder_id OR 
    auction_id IN (
      SELECT id FROM company_auctions 
      WHERE company_id IN (SELECT id FROM companies WHERE auth.uid() = created_by)
    ) OR
    auction_id IN (
      SELECT id FROM company_auctions 
      WHERE status IN ('active', 'collecting_bids', 'completed') AND 
      (SELECT email FROM auth.users WHERE id = auth.uid()) = ANY(invited_members)
    )
  );

-- Update auction participants policy to allow invited members to see their participation status
DROP POLICY IF EXISTS "Invited members can view their participation" ON auction_participants;

CREATE POLICY "Invited members can view their participation" ON auction_participants
  FOR SELECT USING (
    participant_email = (SELECT email FROM auth.users WHERE id = auth.uid()) OR
    auction_id IN (
      SELECT id FROM company_auctions 
      WHERE company_id IN (SELECT id FROM companies WHERE auth.uid() = created_by)
    )
  );

-- Ensure price history is visible to invited members for active auctions
DROP POLICY IF EXISTS "Invited members can view price history" ON auction_price_history;

CREATE POLICY "Invited members can view price history" ON auction_price_history
  FOR SELECT USING (
    auction_id IN (
      SELECT id FROM company_auctions 
      WHERE status IN ('active', 'collecting_bids') AND 
      (SELECT email FROM auth.users WHERE id = auth.uid()) = ANY(invited_members)
    ) OR
    auction_id IN (
      SELECT id FROM company_auctions 
      WHERE company_id IN (SELECT id FROM companies WHERE auth.uid() = created_by)
    )
  );

-- Add policy for auction notifications visibility
DROP POLICY IF EXISTS "Invited members can view their notifications" ON auction_notifications;

CREATE POLICY "Invited members can view their notifications" ON auction_notifications
  FOR SELECT USING (
    recipient_email = (SELECT email FROM auth.users WHERE id = auth.uid()) OR
    auction_id IN (
      SELECT id FROM company_auctions 
      WHERE company_id IN (SELECT id FROM companies WHERE auth.uid() = created_by)
    )
  );

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Auction member visibility policies updated successfully!';
  RAISE NOTICE '';
  RAISE NOTICE 'Changes made:';
  RAISE NOTICE '- Updated auction visibility to include collecting_bids and completed status';
  RAISE NOTICE '- Added bid visibility for invited members';
  RAISE NOTICE '- Added participation status visibility';
  RAISE NOTICE '- Added price history visibility for invited members';
  RAISE NOTICE '- Added notification visibility for invited members';
  RAISE NOTICE '';
  RAISE NOTICE 'Invited members can now:';
  RAISE NOTICE '- View auctions they are invited to (active, collecting_bids, completed)';
  RAISE NOTICE '- See their own bids and participation status';
  RAISE NOTICE '- Access price history during active bidding periods';
  RAISE NOTICE '- View notifications sent to them';
END $$;
