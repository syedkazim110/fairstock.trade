-- Fix RLS policies for auction tables to work with Supabase auth
-- This script updates the RLS policies to use proper Supabase auth patterns

-- Drop existing problematic policies
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

-- Create new RLS policies with proper Supabase auth patterns

-- Company auctions RLS policies
CREATE POLICY "Company owners can view their auctions" ON company_auctions
  FOR SELECT USING (
    company_id IN (SELECT id FROM companies WHERE auth.uid() = created_by)
  );

CREATE POLICY "Company owners can create auctions" ON company_auctions
  FOR INSERT WITH CHECK (
    company_id IN (SELECT id FROM companies WHERE auth.uid() = created_by) AND
    auth.uid() = created_by
  );

CREATE POLICY "Company owners can update their auctions" ON company_auctions
  FOR UPDATE USING (
    company_id IN (SELECT id FROM companies WHERE auth.uid() = created_by)
  );

CREATE POLICY "Company owners can delete their auctions" ON company_auctions
  FOR DELETE USING (
    company_id IN (SELECT id FROM companies WHERE auth.uid() = created_by)
  );

-- Invited members can view active auctions they're invited to
CREATE POLICY "Invited members can view auctions" ON company_auctions
  FOR SELECT USING (
    status = 'active' AND 
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.email = ANY(invited_members)
    )
  );

-- Auction bids RLS policies
CREATE POLICY "Users can view bids on auctions they participate in" ON auction_bids
  FOR SELECT USING (
    auth.uid() = bidder_id OR 
    auction_id IN (
      SELECT id FROM company_auctions 
      WHERE company_id IN (SELECT id FROM companies WHERE auth.uid() = created_by)
    )
  );

CREATE POLICY "Users can create their own bids" ON auction_bids
  FOR INSERT WITH CHECK (auth.uid() = bidder_id);

CREATE POLICY "Users can update their own bids" ON auction_bids
  FOR UPDATE USING (auth.uid() = bidder_id);

-- Auction participants RLS policies
CREATE POLICY "Company owners can view participants" ON auction_participants
  FOR SELECT USING (
    auction_id IN (
      SELECT id FROM company_auctions 
      WHERE company_id IN (SELECT id FROM companies WHERE auth.uid() = created_by)
    )
  );

CREATE POLICY "Company owners can manage participants" ON auction_participants
  FOR ALL USING (
    auction_id IN (
      SELECT id FROM company_auctions 
      WHERE company_id IN (SELECT id FROM companies WHERE auth.uid() = created_by)
    )
  );

-- Price history RLS policies
CREATE POLICY "Anyone can view price history for active auctions" ON auction_price_history
  FOR SELECT USING (
    auction_id IN (SELECT id FROM company_auctions WHERE status = 'active')
  );

CREATE POLICY "Company owners can view all price history" ON auction_price_history
  FOR SELECT USING (
    auction_id IN (
      SELECT id FROM company_auctions 
      WHERE company_id IN (SELECT id FROM companies WHERE auth.uid() = created_by)
    )
  );

-- Notifications RLS policies
CREATE POLICY "Company owners can view auction notifications" ON auction_notifications
  FOR SELECT USING (
    auction_id IN (
      SELECT id FROM company_auctions 
      WHERE company_id IN (SELECT id FROM companies WHERE auth.uid() = created_by)
    )
  );

CREATE POLICY "Users can view their own notifications" ON auction_notifications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE profiles.id = auth.uid() 
      AND profiles.email = recipient_email
    )
  );

-- Update the database views to avoid auth.users references
DROP VIEW IF EXISTS active_auctions_with_pricing;
CREATE OR REPLACE VIEW active_auctions_with_pricing AS
SELECT 
  ca.*,
  c.name as company_name,
  CASE 
    WHEN ca.status = 'active' AND ca.start_time IS NOT NULL AND ca.max_price IS NOT NULL AND ca.min_price IS NOT NULL AND ca.decreasing_minutes IS NOT NULL AND ca.duration_hours IS NOT NULL THEN
      GREATEST(
        ca.min_price,
        ca.max_price - (
          FLOOR(EXTRACT(EPOCH FROM (NOW() - ca.start_time)) / 60 / NULLIF(ca.decreasing_minutes, 0)) * 
          (ca.max_price - ca.min_price) / NULLIF(FLOOR(ca.duration_hours * 60.0 / NULLIF(ca.decreasing_minutes, 0)), 0)
        )
      )
    ELSE ca.max_price
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

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ RLS policies fixed successfully!';
  RAISE NOTICE 'All auction tables now use proper Supabase auth patterns.';
  RAISE NOTICE 'The permission denied error should be resolved.';
END $$;
