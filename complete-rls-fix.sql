-- Complete RLS fix for all auction-related permission issues
-- This script addresses all RLS policies and ensures proper access patterns

-- First, let's temporarily disable RLS to clean up
ALTER TABLE company_auctions DISABLE ROW LEVEL SECURITY;
ALTER TABLE auction_bids DISABLE ROW LEVEL SECURITY;
ALTER TABLE auction_participants DISABLE ROW LEVEL SECURITY;
ALTER TABLE auction_price_history DISABLE ROW LEVEL SECURITY;
ALTER TABLE auction_notifications DISABLE ROW LEVEL SECURITY;

-- Drop all existing policies
DROP POLICY IF EXISTS "Company owners can view their auctions" ON company_auctions;
DROP POLICY IF EXISTS "Company owners can create auctions" ON company_auctions;
DROP POLICY IF EXISTS "Company owners can update their auctions" ON company_auctions;
DROP POLICY IF EXISTS "Company owners can delete their auctions" ON company_auctions;
DROP POLICY IF EXISTS "Invited members can view auctions" ON company_auctions;

DROP POLICY IF EXISTS "Users can view bids on auctions they participate in" ON auction_bids;
DROP POLICY IF EXISTS "Users can create their own bids" ON auction_bids;
DROP POLICY IF EXISTS "Users can update their own bids" ON auction_bids;

DROP POLICY IF EXISTS "Company owners can view participants" ON auction_participants;
DROP POLICY IF EXISTS "Company owners can manage participants" ON auction_participants;

DROP POLICY IF EXISTS "Anyone can view price history for active auctions" ON auction_price_history;
DROP POLICY IF EXISTS "Company owners can view all price history" ON auction_price_history;

DROP POLICY IF EXISTS "Company owners can view auction notifications" ON auction_notifications;
DROP POLICY IF EXISTS "Users can view their own notifications" ON auction_notifications;

-- Re-enable RLS
ALTER TABLE company_auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_notifications ENABLE ROW LEVEL SECURITY;

-- Create simplified RLS policies that work with Supabase

-- Company auctions policies - Allow company owners to access their auctions
CREATE POLICY "Enable read access for company owners" ON company_auctions
  FOR SELECT USING (
    company_id IN (
      SELECT id FROM companies WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Enable insert for company owners" ON company_auctions
  FOR INSERT WITH CHECK (
    company_id IN (
      SELECT id FROM companies WHERE created_by = auth.uid()
    ) AND created_by = auth.uid()
  );

CREATE POLICY "Enable update for company owners" ON company_auctions
  FOR UPDATE USING (
    company_id IN (
      SELECT id FROM companies WHERE created_by = auth.uid()
    )
  );

CREATE POLICY "Enable delete for company owners" ON company_auctions
  FOR DELETE USING (
    company_id IN (
      SELECT id FROM companies WHERE created_by = auth.uid()
    )
  );

-- Allow invited members to view active auctions (simplified)
CREATE POLICY "Enable read for invited members" ON company_auctions
  FOR SELECT USING (
    status = 'active' AND 
    invited_members IS NOT NULL AND
    (
      SELECT email FROM profiles WHERE id = auth.uid()
    ) = ANY(invited_members)
  );

-- Auction bids policies
CREATE POLICY "Enable read for bidders and auction owners" ON auction_bids
  FOR SELECT USING (
    bidder_id = auth.uid() OR 
    auction_id IN (
      SELECT ca.id FROM company_auctions ca
      JOIN companies c ON ca.company_id = c.id
      WHERE c.created_by = auth.uid()
    )
  );

CREATE POLICY "Enable insert for authenticated users" ON auction_bids
  FOR INSERT WITH CHECK (bidder_id = auth.uid());

CREATE POLICY "Enable update for bid owners" ON auction_bids
  FOR UPDATE USING (bidder_id = auth.uid());

-- Auction participants policies
CREATE POLICY "Enable all for auction owners" ON auction_participants
  FOR ALL USING (
    auction_id IN (
      SELECT ca.id FROM company_auctions ca
      JOIN companies c ON ca.company_id = c.id
      WHERE c.created_by = auth.uid()
    )
  );

-- Price history policies
CREATE POLICY "Enable read for all on active auctions" ON auction_price_history
  FOR SELECT USING (
    auction_id IN (
      SELECT id FROM company_auctions WHERE status = 'active'
    )
  );

CREATE POLICY "Enable read for auction owners" ON auction_price_history
  FOR SELECT USING (
    auction_id IN (
      SELECT ca.id FROM company_auctions ca
      JOIN companies c ON ca.company_id = c.id
      WHERE c.created_by = auth.uid()
    )
  );

CREATE POLICY "Enable insert for system" ON auction_price_history
  FOR INSERT WITH CHECK (true);

-- Notifications policies
CREATE POLICY "Enable read for auction owners" ON auction_notifications
  FOR SELECT USING (
    auction_id IN (
      SELECT ca.id FROM company_auctions ca
      JOIN companies c ON ca.company_id = c.id
      WHERE c.created_by = auth.uid()
    )
  );

CREATE POLICY "Enable read for recipients" ON auction_notifications
  FOR SELECT USING (
    recipient_email = (
      SELECT email FROM profiles WHERE id = auth.uid()
    )
  );

CREATE POLICY "Enable insert for system" ON auction_notifications
  FOR INSERT WITH CHECK (true);

-- Update views to be more robust
DROP VIEW IF EXISTS active_auctions_with_pricing;
CREATE OR REPLACE VIEW active_auctions_with_pricing AS
SELECT 
  ca.id,
  ca.company_id,
  ca.title,
  ca.description,
  ca.auction_type,
  ca.shares_count,
  ca.max_price,
  ca.min_price,
  ca.current_price,
  ca.decreasing_minutes,
  ca.duration_hours,
  ca.start_time,
  ca.end_time,
  ca.status,
  ca.created_at,
  ca.updated_at,
  c.name as company_name,
  CASE 
    WHEN ca.status = 'active' 
         AND ca.start_time IS NOT NULL 
         AND ca.max_price IS NOT NULL 
         AND ca.min_price IS NOT NULL 
         AND ca.decreasing_minutes > 0 
         AND ca.duration_hours > 0 THEN
      GREATEST(
        ca.min_price,
        ca.max_price - (
          FLOOR(EXTRACT(EPOCH FROM (NOW() - ca.start_time)) / 60 / ca.decreasing_minutes) * 
          (ca.max_price - ca.min_price) / FLOOR(ca.duration_hours * 60.0 / ca.decreasing_minutes)
        )
      )
    ELSE COALESCE(ca.max_price, 0)
  END as calculated_current_price,
  CASE 
    WHEN ca.start_time IS NOT NULL THEN
      EXTRACT(EPOCH FROM (NOW() - ca.start_time)) / 60
    ELSE 0
  END as minutes_elapsed,
  CASE 
    WHEN ca.start_time IS NOT NULL AND ca.end_time IS NOT NULL THEN
      EXTRACT(EPOCH FROM (ca.end_time - NOW())) / 60
    ELSE NULL
  END as minutes_remaining
FROM company_auctions ca
JOIN companies c ON ca.company_id = c.id
WHERE ca.status = 'active';

-- Grant necessary permissions
GRANT SELECT ON company_auctions TO authenticated;
GRANT INSERT ON company_auctions TO authenticated;
GRANT UPDATE ON company_auctions TO authenticated;
GRANT DELETE ON company_auctions TO authenticated;

GRANT SELECT ON auction_bids TO authenticated;
GRANT INSERT ON auction_bids TO authenticated;
GRANT UPDATE ON auction_bids TO authenticated;

GRANT SELECT ON auction_participants TO authenticated;
GRANT INSERT ON auction_participants TO authenticated;
GRANT UPDATE ON auction_participants TO authenticated;
GRANT DELETE ON auction_participants TO authenticated;

GRANT SELECT ON auction_price_history TO authenticated;
GRANT INSERT ON auction_price_history TO authenticated;

GRANT SELECT ON auction_notifications TO authenticated;
GRANT INSERT ON auction_notifications TO authenticated;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Complete RLS fix applied successfully!';
  RAISE NOTICE 'All auction tables now have simplified, working RLS policies.';
  RAISE NOTICE 'Both direct queries and API access should work properly.';
  RAISE NOTICE 'The permission denied errors should be completely resolved.';
END $$;
