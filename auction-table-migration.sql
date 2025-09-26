-- Migration script to add Dutch auction columns to existing company_auctions table
-- This script safely adds columns only if they don't already exist

-- First, let's check if the table exists and add missing columns
DO $$
BEGIN
    -- Add auction_type column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'company_auctions' AND column_name = 'auction_type') THEN
        ALTER TABLE company_auctions ADD COLUMN auction_type VARCHAR(20) DEFAULT 'dutch' CHECK (auction_type IN ('dutch', 'english'));
        RAISE NOTICE 'Added auction_type column';
    END IF;

    -- Add shares_count column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'company_auctions' AND column_name = 'shares_count') THEN
        ALTER TABLE company_auctions ADD COLUMN shares_count BIGINT;
        RAISE NOTICE 'Added shares_count column';
    END IF;

    -- Add max_price column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'company_auctions' AND column_name = 'max_price') THEN
        ALTER TABLE company_auctions ADD COLUMN max_price DECIMAL(10,2);
        RAISE NOTICE 'Added max_price column';
    END IF;

    -- Add min_price column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'company_auctions' AND column_name = 'min_price') THEN
        ALTER TABLE company_auctions ADD COLUMN min_price DECIMAL(10,2);
        RAISE NOTICE 'Added min_price column';
    END IF;

    -- Add current_price column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'company_auctions' AND column_name = 'current_price') THEN
        ALTER TABLE company_auctions ADD COLUMN current_price DECIMAL(10,2);
        RAISE NOTICE 'Added current_price column';
    END IF;

    -- Add decreasing_minutes column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'company_auctions' AND column_name = 'decreasing_minutes') THEN
        ALTER TABLE company_auctions ADD COLUMN decreasing_minutes INTEGER DEFAULT 15;
        RAISE NOTICE 'Added decreasing_minutes column';
    END IF;

    -- Add duration_hours column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'company_auctions' AND column_name = 'duration_hours') THEN
        ALTER TABLE company_auctions ADD COLUMN duration_hours INTEGER DEFAULT 24;
        RAISE NOTICE 'Added duration_hours column';
    END IF;

    -- Add start_time column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'company_auctions' AND column_name = 'start_time') THEN
        ALTER TABLE company_auctions ADD COLUMN start_time TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added start_time column';
    END IF;

    -- Add end_time column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'company_auctions' AND column_name = 'end_time') THEN
        ALTER TABLE company_auctions ADD COLUMN end_time TIMESTAMP WITH TIME ZONE;
        RAISE NOTICE 'Added end_time column';
    END IF;

    -- Add invited_members column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'company_auctions' AND column_name = 'invited_members') THEN
        ALTER TABLE company_auctions ADD COLUMN invited_members TEXT[];
        RAISE NOTICE 'Added invited_members column';
    END IF;

    -- Add wire transfer columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'company_auctions' AND column_name = 'wire_account_name') THEN
        ALTER TABLE company_auctions ADD COLUMN wire_account_name VARCHAR(255);
        RAISE NOTICE 'Added wire_account_name column';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'company_auctions' AND column_name = 'wire_account_number') THEN
        ALTER TABLE company_auctions ADD COLUMN wire_account_number VARCHAR(255);
        RAISE NOTICE 'Added wire_account_number column';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'company_auctions' AND column_name = 'wire_routing_number') THEN
        ALTER TABLE company_auctions ADD COLUMN wire_routing_number VARCHAR(255);
        RAISE NOTICE 'Added wire_routing_number column';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'company_auctions' AND column_name = 'wire_bank_name') THEN
        ALTER TABLE company_auctions ADD COLUMN wire_bank_name VARCHAR(255);
        RAISE NOTICE 'Added wire_bank_name column';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'company_auctions' AND column_name = 'wire_bank_address') THEN
        ALTER TABLE company_auctions ADD COLUMN wire_bank_address TEXT;
        RAISE NOTICE 'Added wire_bank_address column';
    END IF;

    -- Add articles_document_id column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'company_auctions' AND column_name = 'articles_document_id') THEN
        ALTER TABLE company_auctions ADD COLUMN articles_document_id UUID REFERENCES company_documents(id);
        RAISE NOTICE 'Added articles_document_id column';
    END IF;

    -- Add compliance columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'company_auctions' AND column_name = 'marketing_compliance_accepted') THEN
        ALTER TABLE company_auctions ADD COLUMN marketing_compliance_accepted BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added marketing_compliance_accepted column';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'company_auctions' AND column_name = 'accredited_investor_compliance_accepted') THEN
        ALTER TABLE company_auctions ADD COLUMN accredited_investor_compliance_accepted BOOLEAN DEFAULT FALSE;
        RAISE NOTICE 'Added accredited_investor_compliance_accepted column';
    END IF;

    -- Add winner columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'company_auctions' AND column_name = 'winner_id') THEN
        ALTER TABLE company_auctions ADD COLUMN winner_id UUID REFERENCES auth.users(id);
        RAISE NOTICE 'Added winner_id column';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'company_auctions' AND column_name = 'winning_price') THEN
        ALTER TABLE company_auctions ADD COLUMN winning_price DECIMAL(10,2);
        RAISE NOTICE 'Added winning_price column';
    END IF;

    -- Update status column constraint if needed
    BEGIN
        ALTER TABLE company_auctions DROP CONSTRAINT IF EXISTS company_auctions_status_check;
        ALTER TABLE company_auctions ADD CONSTRAINT company_auctions_status_check 
            CHECK (status IN ('draft', 'active', 'completed', 'cancelled', 'expired'));
        RAISE NOTICE 'Updated status constraint';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'Status constraint update failed or not needed: %', SQLERRM;
    END;

END $$;

-- Now create the additional tables that don't exist yet
CREATE TABLE IF NOT EXISTS auction_bids (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auction_id UUID REFERENCES company_auctions(id) ON DELETE CASCADE NOT NULL,
  bidder_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  bidder_email VARCHAR(255) NOT NULL,
  bid_amount DECIMAL(10,2) NOT NULL,
  bid_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_winning_bid BOOLEAN DEFAULT FALSE,
  bid_status VARCHAR(20) DEFAULT 'active' CHECK (bid_status IN ('active', 'withdrawn', 'expired')),
  bid_type VARCHAR(20) DEFAULT 'accept' CHECK (bid_type IN ('accept', 'offer')),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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

CREATE TABLE IF NOT EXISTS auction_price_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  auction_id UUID REFERENCES company_auctions(id) ON DELETE CASCADE NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  step_number INTEGER NOT NULL,
  price_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  minutes_elapsed INTEGER,
  participants_viewing INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

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
  email_content TEXT,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_company_auctions_auction_type ON company_auctions(auction_type);
CREATE INDEX IF NOT EXISTS idx_company_auctions_start_time ON company_auctions(start_time);
CREATE INDEX IF NOT EXISTS idx_company_auctions_end_time ON company_auctions(end_time);
CREATE INDEX IF NOT EXISTS idx_company_auctions_articles_document ON company_auctions(articles_document_id);

CREATE INDEX IF NOT EXISTS idx_auction_bids_auction_id ON auction_bids(auction_id);
CREATE INDEX IF NOT EXISTS idx_auction_bids_bidder_id ON auction_bids(bidder_id);
CREATE INDEX IF NOT EXISTS idx_auction_bids_bid_time ON auction_bids(bid_time);
CREATE INDEX IF NOT EXISTS idx_auction_bids_winning ON auction_bids(auction_id, is_winning_bid) WHERE is_winning_bid = true;

CREATE INDEX IF NOT EXISTS idx_auction_participants_auction_id ON auction_participants(auction_id);
CREATE INDEX IF NOT EXISTS idx_auction_participants_email ON auction_participants(participant_email);
CREATE INDEX IF NOT EXISTS idx_auction_participants_status ON auction_participants(participation_status);

CREATE INDEX IF NOT EXISTS idx_auction_price_history_auction_id ON auction_price_history(auction_id);
CREATE INDEX IF NOT EXISTS idx_auction_price_history_time ON auction_price_history(price_time);
CREATE INDEX IF NOT EXISTS idx_auction_price_history_step ON auction_price_history(auction_id, step_number);

CREATE INDEX IF NOT EXISTS idx_auction_notifications_auction_id ON auction_notifications(auction_id);
CREATE INDEX IF NOT EXISTS idx_auction_notifications_recipient ON auction_notifications(recipient_email);
CREATE INDEX IF NOT EXISTS idx_auction_notifications_type ON auction_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_auction_notifications_sent_at ON auction_notifications(sent_at);

-- Enable RLS on new tables
ALTER TABLE auction_bids ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_price_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE auction_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for auction_bids
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

-- RLS Policies for auction_participants
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

-- RLS Policies for auction_price_history
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

-- RLS Policies for auction_notifications
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

-- Create views
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

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Auction table migration completed successfully!';
  RAISE NOTICE 'All Dutch auction columns have been added to your existing company_auctions table.';
  RAISE NOTICE 'Additional auction tables and features are now ready to use.';
END $$;
