-- Complete Dutch Auction Database Schema for FairStock Platform
-- This file contains all auction-related database tables and enhancements
-- Run this file to set up the complete auction system

-- =====================================================
-- AUCTION CORE TABLES
-- =====================================================

-- Main company auctions table with Dutch auction support
CREATE TABLE IF NOT EXISTS company_auctions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  auction_type VARCHAR(20) DEFAULT 'dutch' CHECK (auction_type IN ('dutch', 'english')),
  
  -- Share and pricing information
  shares_count BIGINT NOT NULL,
  max_price DECIMAL(10,2) NOT NULL,
  min_price DECIMAL(10,2) NOT NULL,
  current_price DECIMAL(10,2),
  
  -- Dutch auction timing parameters
  decreasing_minutes INTEGER NOT NULL DEFAULT 15,
  duration_hours INTEGER NOT NULL DEFAULT 24,
  
  -- Auction timing
  start_time TIMESTAMP WITH TIME ZONE,
  end_time TIMESTAMP WITH TIME ZONE,
  
  -- Member invitations
  invited_members TEXT[], -- Array of member emails
  
  -- Wire transfer information
  wire_account_name VARCHAR(255),
  wire_account_number VARCHAR(255),
  wire_routing_number VARCHAR(255),
  wire_bank_name VARCHAR(255),
  wire_bank_address TEXT,
  
  -- Document references
  articles_document_id UUID REFERENCES company_documents(id),
  
  -- Compliance tracking
  marketing_compliance_accepted BOOLEAN DEFAULT FALSE,
  accredited_investor_compliance_accepted BOOLEAN DEFAULT FALSE,
  
  -- Auction status and metadata
  status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'completed', 'cancelled', 'expired')),
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  winner_id UUID REFERENCES auth.users(id),
  winning_price DECIMAL(10,2),
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Auction bids table for tracking bidding activity
CREATE TABLE IF NOT EXISTS auction_bids (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auction_id UUID REFERENCES company_auctions(id) ON DELETE CASCADE NOT NULL,
  bidder_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  bidder_email VARCHAR(255) NOT NULL,
  bid_amount DECIMAL(10,2) NOT NULL,
  bid_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_winning_bid BOOLEAN DEFAULT FALSE,
  bid_status VARCHAR(20) DEFAULT 'active' CHECK (bid_status IN ('active', 'withdrawn', 'expired')),
  
  -- Additional bid metadata
  bid_type VARCHAR(20) DEFAULT 'accept' CHECK (bid_type IN ('accept', 'offer')),
  notes TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Auction participants table for tracking who was invited and their status
CREATE TABLE IF NOT EXISTS auction_participants (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auction_id UUID REFERENCES company_auctions(id) ON DELETE CASCADE NOT NULL,
  participant_email VARCHAR(255) NOT NULL,
  participant_name VARCHAR(255),
  invitation_sent_at TIMESTAMP WITH TIME ZONE,
  invitation_opened_at TIMESTAMP WITH TIME ZONE,
  participated_at TIMESTAMP WITH TIME ZONE,
  participation_status VARCHAR(20) DEFAULT 'invited' CHECK (participation_status IN ('invited', 'viewed', 'participated', 'declined')),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(auction_id, participant_email)
);

-- Auction price history table for tracking price changes over time
CREATE TABLE IF NOT EXISTS auction_price_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auction_id UUID REFERENCES company_auctions(id) ON DELETE CASCADE NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  step_number INTEGER NOT NULL,
  price_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Calculated fields for analysis
  minutes_elapsed INTEGER,
  participants_viewing INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Auction notifications table for tracking email communications
CREATE TABLE IF NOT EXISTS auction_notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auction_id UUID REFERENCES company_auctions(id) ON DELETE CASCADE NOT NULL,
  recipient_email VARCHAR(255) NOT NULL,
  notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN ('invitation', 'price_update', 'auction_start', 'auction_end', 'winner_notification')),
  subject VARCHAR(255),
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  opened_at TIMESTAMP WITH TIME ZONE,
  clicked_at TIMESTAMP WITH TIME ZONE,
  status VARCHAR(20) DEFAULT 'sent' CHECK (status IN ('pending', 'sent', 'delivered', 'opened', 'failed')),
  
  -- Email content reference
  email_content TEXT,
  error_message TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Company auctions indexes
CREATE INDEX IF NOT EXISTS idx_company_auctions_company_id ON company_auctions(company_id);
CREATE INDEX IF NOT EXISTS idx_company_auctions_status ON company_auctions(status);
CREATE INDEX IF NOT EXISTS idx_company_auctions_auction_type ON company_auctions(auction_type);
CREATE INDEX IF NOT EXISTS idx_company_auctions_start_time ON company_auctions(start_time);
CREATE INDEX IF NOT EXISTS idx_company_auctions_end_time ON company_auctions(end_time);
CREATE INDEX IF NOT EXISTS idx_company_auctions_created_by ON company_auctions(created_by);
CREATE INDEX IF NOT EXISTS idx_company_auctions_articles_document ON company_auctions(articles_document_id);

-- Auction bids indexes
CREATE INDEX IF NOT EXISTS idx_auction_bids_auction_id ON auction_bids(auction_id);
CREATE INDEX IF NOT EXISTS idx_auction_bids_bidder_id ON auction_bids(bidder_id);
CREATE INDEX IF NOT EXISTS idx_auction_bids_bid_time ON auction_bids(bid_time);
CREATE INDEX IF NOT EXISTS idx_auction_bids_winning ON auction_bids(auction_id, is_winning_bid) WHERE is_winning_bid = true;

-- Auction participants indexes
CREATE INDEX IF NOT EXISTS idx_auction_participants_auction_id ON auction_participants(auction_id);
CREATE INDEX IF NOT EXISTS idx_auction_participants_email ON auction_participants(participant_email);
CREATE INDEX IF NOT EXISTS idx_auction_participants_status ON auction_participants(participation_status);

-- Price history indexes
CREATE INDEX IF NOT EXISTS idx_auction_price_history_auction_id ON auction_price_history(auction_id);
CREATE INDEX IF NOT EXISTS idx_auction_price_history_time ON auction_price_history(price_time);
CREATE INDEX IF NOT EXISTS idx_auction_price_history_step ON auction_price_history(auction_id, step_number);

-- Notifications indexes
CREATE INDEX IF NOT EXISTS idx_auction_notifications_auction_id ON auction_notifications(auction_id);
CREATE INDEX IF NOT EXISTS idx_auction_notifications_recipient ON auction_notifications(recipient_email);
CREATE INDEX IF NOT EXISTS idx_auction_notifications_type ON auction_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_auction_notifications_sent_at ON auction_notifications(sent_at);

-- =====================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS on all auction tables
ALTER TABLE company_auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_notifications ENABLE ROW LEVEL SECURITY;

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
    (SELECT email FROM auth.users WHERE id = auth.uid()) = ANY(invited_members)
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
    recipient_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- =====================================================
-- TRIGGERS AND FUNCTIONS
-- =====================================================

-- Function to update auction updated_at timestamp
CREATE OR REPLACE FUNCTION update_auction_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for company_auctions updated_at
DROP TRIGGER IF EXISTS update_company_auctions_updated_at ON company_auctions;
CREATE TRIGGER update_company_auctions_updated_at
  BEFORE UPDATE ON company_auctions
  FOR EACH ROW EXECUTE FUNCTION update_auction_updated_at();

-- Trigger for auction_participants updated_at
DROP TRIGGER IF EXISTS update_auction_participants_updated_at ON auction_participants;
CREATE TRIGGER update_auction_participants_updated_at
  BEFORE UPDATE ON auction_participants
  FOR EACH ROW EXECUTE FUNCTION update_auction_updated_at();

-- Function to automatically create price history entries
CREATE OR REPLACE FUNCTION create_price_history_entry()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create history entry if price actually changed
  IF OLD.current_price IS DISTINCT FROM NEW.current_price AND NEW.current_price IS NOT NULL THEN
    INSERT INTO auction_price_history (auction_id, price, step_number, minutes_elapsed)
    VALUES (
      NEW.id,
      NEW.current_price,
      COALESCE(
        (SELECT MAX(step_number) + 1 FROM auction_price_history WHERE auction_id = NEW.id),
        0
      ),
      CASE 
        WHEN NEW.start_time IS NOT NULL THEN 
          EXTRACT(EPOCH FROM (NOW() - NEW.start_time)) / 60
        ELSE 0
      END
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for automatic price history
DROP TRIGGER IF EXISTS create_auction_price_history ON company_auctions;
CREATE TRIGGER create_auction_price_history
  AFTER UPDATE ON company_auctions
  FOR EACH ROW EXECUTE FUNCTION create_price_history_entry();

-- Function to automatically create auction participants from invited_members
CREATE OR REPLACE FUNCTION sync_auction_participants()
RETURNS TRIGGER AS $$
DECLARE
  member_email TEXT;
BEGIN
  -- Only sync when invited_members changes
  IF OLD.invited_members IS DISTINCT FROM NEW.invited_members THEN
    -- Remove participants not in the new list
    DELETE FROM auction_participants 
    WHERE auction_id = NEW.id 
    AND participant_email != ALL(COALESCE(NEW.invited_members, ARRAY[]::TEXT[]));
    
    -- Add new participants
    IF NEW.invited_members IS NOT NULL THEN
      FOREACH member_email IN ARRAY NEW.invited_members
      LOOP
        INSERT INTO auction_participants (auction_id, participant_email)
        VALUES (NEW.id, member_email)
        ON CONFLICT (auction_id, participant_email) DO NOTHING;
      END LOOP;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for participant synchronization
DROP TRIGGER IF EXISTS sync_auction_participants_trigger ON company_auctions;
CREATE TRIGGER sync_auction_participants_trigger
  AFTER INSERT OR UPDATE ON company_auctions
  FOR EACH ROW EXECUTE FUNCTION sync_auction_participants();

-- =====================================================
-- VIEWS FOR COMMON QUERIES
-- =====================================================

-- View for active auctions with current pricing
CREATE OR REPLACE VIEW active_auctions_with_pricing AS
SELECT 
  ca.*,
  c.name as company_name,
  CASE 
    WHEN ca.status = 'active' AND ca.start_time IS NOT NULL THEN
      GREATEST(
        ca.min_price,
        ca.max_price - (
          FLOOR(EXTRACT(EPOCH FROM (NOW() - ca.start_time)) / 60 / ca.decreasing_minutes) * 
          (ca.max_price - ca.min_price) / FLOOR(ca.duration_hours * 60.0 / ca.decreasing_minutes)
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

-- View for auction statistics
CREATE OR REPLACE VIEW auction_statistics AS
SELECT 
  ca.id,
  ca.title,
  ca.status,
  c.name as company_name,
  COUNT(DISTINCT ap.participant_email) as invited_count,
  COUNT(DISTINCT ab.bidder_id) as bidders_count,
  COUNT(DISTINCT CASE WHEN ap.participation_status = 'viewed' THEN ap.participant_email END) as viewers_count,
  MAX(ab.bid_amount) as highest_bid,
  MIN(ab.bid_amount) as lowest_bid,
  AVG(ab.bid_amount) as average_bid
FROM company_auctions ca
JOIN companies c ON ca.company_id = c.id
LEFT JOIN auction_participants ap ON ca.id = ap.auction_id
LEFT JOIN auction_bids ab ON ca.id = ab.auction_id AND ab.bid_status = 'active'
GROUP BY ca.id, ca.title, ca.status, c.name;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE company_auctions IS 'Main table for Dutch and English auctions with comprehensive auction parameters';
COMMENT ON TABLE auction_bids IS 'Tracks all bids placed on auctions with bidder information and status';
COMMENT ON TABLE auction_participants IS 'Manages invited participants and their engagement status';
COMMENT ON TABLE auction_price_history IS 'Historical record of price changes during Dutch auctions';
COMMENT ON TABLE auction_notifications IS 'Email notification tracking for auction communications';

COMMENT ON COLUMN company_auctions.auction_type IS 'Type of auction: dutch or english';
COMMENT ON COLUMN company_auctions.shares_count IS 'Number of shares being auctioned';
COMMENT ON COLUMN company_auctions.max_price IS 'Starting maximum price for Dutch auction';
COMMENT ON COLUMN company_auctions.min_price IS 'Minimum reserve price for Dutch auction';
COMMENT ON COLUMN company_auctions.decreasing_minutes IS 'Minutes between price decreases in Dutch auction';
COMMENT ON COLUMN company_auctions.duration_hours IS 'Total auction duration in hours';
COMMENT ON COLUMN company_auctions.invited_members IS 'Array of member emails invited to participate';
COMMENT ON COLUMN company_auctions.current_price IS 'Current auction price (calculated in real-time)';
COMMENT ON COLUMN company_auctions.articles_document_id IS 'Reference to articles of incorporation document';
COMMENT ON COLUMN company_auctions.marketing_compliance_accepted IS 'SEC Rule 506(b) compliance acceptance';
COMMENT ON COLUMN company_auctions.accredited_investor_compliance_accepted IS 'Accredited investor compliance acceptance';

-- =====================================================
-- SAMPLE DATA (OPTIONAL - REMOVE IN PRODUCTION)
-- =====================================================

-- Uncomment the following to insert sample data for testing
/*
-- Sample auction (requires existing company and user)
INSERT INTO company_auctions (
  company_id, 
  title, 
  description, 
  shares_count, 
  max_price, 
  min_price, 
  decreasing_minutes, 
  duration_hours,
  created_by,
  marketing_compliance_accepted,
  accredited_investor_compliance_accepted
) VALUES (
  (SELECT id FROM companies LIMIT 1),
  'Series A Preferred Shares - Test Auction',
  'Test Dutch auction for Series A preferred shares',
  1000,
  100.00,
  50.00,
  15,
  24,
  (SELECT id FROM auth.users LIMIT 1),
  true,
  true
);
*/

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Dutch Auction Database Schema Setup Complete!';
  RAISE NOTICE '';
  RAISE NOTICE 'Created Tables:';
  RAISE NOTICE '- company_auctions (main auction table)';
  RAISE NOTICE '- auction_bids (bid tracking)';
  RAISE NOTICE '- auction_participants (invitation management)';
  RAISE NOTICE '- auction_price_history (price tracking)';
  RAISE NOTICE '- auction_notifications (email tracking)';
  RAISE NOTICE '';
  RAISE NOTICE 'Created Views:';
  RAISE NOTICE '- active_auctions_with_pricing';
  RAISE NOTICE '- auction_statistics';
  RAISE NOTICE '';
  RAISE NOTICE 'Features Enabled:';
  RAISE NOTICE '- Row Level Security (RLS)';
  RAISE NOTICE '- Automatic timestamps';
  RAISE NOTICE '- Price history tracking';
  RAISE NOTICE '- Participant synchronization';
  RAISE NOTICE '- Performance indexes';
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '1. Start your application: npm run dev';
  RAISE NOTICE '2. Navigate to /dashboard/auction';
  RAISE NOTICE '3. Create your first Dutch auction!';
END $$;
