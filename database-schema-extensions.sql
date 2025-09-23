-- Database Schema Extensions for Company Management Features
-- Add these tables to your existing Supabase database

-- User Wallet System
CREATE TABLE IF NOT EXISTS user_wallets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  balance DECIMAL(12,2) DEFAULT 0.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Individual Shareholding System
CREATE TABLE IF NOT EXISTS member_shareholdings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  member_email VARCHAR(255) NOT NULL,
  shares_owned BIGINT DEFAULT 0,
  share_percentage DECIMAL(8,4),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(company_id, member_email)
);

-- Company Auctions (placeholder for future implementation)
CREATE TABLE IF NOT EXISTS company_auctions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Company Transactions (placeholder for future implementation)
CREATE TABLE IF NOT EXISTS company_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  transaction_type VARCHAR(50) NOT NULL,
  amount DECIMAL(12,2),
  description TEXT,
  from_user_id UUID REFERENCES auth.users(id),
  to_user_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on new tables
ALTER TABLE user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_shareholdings ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_auctions ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_wallets
CREATE POLICY "Users can view own wallet" ON user_wallets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own wallet" ON user_wallets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own wallet" ON user_wallets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- RLS Policies for member_shareholdings
CREATE POLICY "Company owners can view shareholdings" ON member_shareholdings
  FOR SELECT USING (
    company_id IN (SELECT id FROM companies WHERE auth.uid() = created_by)
  );

CREATE POLICY "Company owners can manage shareholdings" ON member_shareholdings
  FOR ALL USING (
    company_id IN (SELECT id FROM companies WHERE auth.uid() = created_by)
  );

-- RLS Policies for company_auctions
CREATE POLICY "Company members can view auctions" ON company_auctions
  FOR SELECT USING (
    company_id IN (
      SELECT id FROM companies 
      WHERE auth.uid() = created_by 
      OR id IN (
        SELECT company_id FROM company_members 
        WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      )
    )
  );

CREATE POLICY "Company owners can manage auctions" ON company_auctions
  FOR ALL USING (
    company_id IN (SELECT id FROM companies WHERE auth.uid() = created_by)
  );

-- RLS Policies for company_transactions
CREATE POLICY "Company members can view transactions" ON company_transactions
  FOR SELECT USING (
    company_id IN (
      SELECT id FROM companies 
      WHERE auth.uid() = created_by 
      OR id IN (
        SELECT company_id FROM company_members 
        WHERE email = (SELECT email FROM auth.users WHERE id = auth.uid())
      )
    )
  );

CREATE POLICY "Company owners can manage transactions" ON company_transactions
  FOR ALL USING (
    company_id IN (SELECT id FROM companies WHERE auth.uid() = created_by)
  );

-- Function to automatically create wallet when user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user_wallet()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_wallets (user_id, balance)
  VALUES (NEW.id, 0.00)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create wallet for new users
DROP TRIGGER IF EXISTS on_auth_user_created_wallet ON auth.users;
CREATE TRIGGER on_auth_user_created_wallet
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_wallet();

-- Insert sample data for existing users (optional)
INSERT INTO user_wallets (user_id, balance)
SELECT id, 1000.00 FROM auth.users
ON CONFLICT (user_id) DO NOTHING;
