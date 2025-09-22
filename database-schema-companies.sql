-- Company Creation Database Schema Extensions
-- Add these tables to your existing Supabase database

-- Countries table for dropdown options
CREATE TABLE IF NOT EXISTS countries (
  id SERIAL PRIMARY KEY,
  code VARCHAR(2) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- States/Provinces table
CREATE TABLE IF NOT EXISTS states (
  id SERIAL PRIMARY KEY,
  country_code VARCHAR(2) REFERENCES countries(code) ON DELETE CASCADE,
  code VARCHAR(10) NOT NULL,
  name VARCHAR(100) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(country_code, code)
);

-- Business structures enum
CREATE TYPE business_structure AS ENUM (
  'sole_proprietorship',
  'gp',
  'lp', 
  'llp',
  'llc',
  'c_corp',
  's_corp',
  'nonprofit',
  'other'
);

-- Companies table
CREATE TABLE IF NOT EXISTS companies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  address TEXT NOT NULL,
  country_code VARCHAR(2) REFERENCES countries(code) NOT NULL,
  state_code VARCHAR(10) NOT NULL,
  business_structure business_structure NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Company members table
CREATE TABLE IF NOT EXISTS company_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  position VARCHAR(50) CHECK (position IN ('CEO', 'CTO', 'COO', 'Secretary')) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE countries ENABLE ROW LEVEL SECURITY;
ALTER TABLE states ENABLE ROW LEVEL SECURITY;

-- RLS Policies for companies
CREATE POLICY "Users can view companies they created" ON companies
  FOR SELECT USING (auth.uid() = created_by);

CREATE POLICY "Users can create companies" ON companies
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Company creators can update their companies" ON companies
  FOR UPDATE USING (auth.uid() = created_by);

-- RLS Policies for company members
CREATE POLICY "Users can view members of companies they created" ON company_members
  FOR SELECT USING (
    company_id IN (SELECT id FROM companies WHERE auth.uid() = created_by)
  );

CREATE POLICY "Users can insert members for companies they created" ON company_members
  FOR INSERT WITH CHECK (
    company_id IN (SELECT id FROM companies WHERE auth.uid() = created_by)
  );

CREATE POLICY "Users can update members of companies they created" ON company_members
  FOR UPDATE USING (
    company_id IN (SELECT id FROM companies WHERE auth.uid() = created_by)
  );

CREATE POLICY "Users can delete members of companies they created" ON company_members
  FOR DELETE USING (
    company_id IN (SELECT id FROM companies WHERE auth.uid() = created_by)
  );

-- RLS Policies for countries and states (public read access)
CREATE POLICY "Anyone can view countries" ON countries FOR SELECT USING (true);
CREATE POLICY "Anyone can view states" ON states FOR SELECT USING (true);

-- Insert sample countries and states
INSERT INTO countries (code, name) VALUES 
('US', 'United States'),
('CA', 'Canada'),
('GB', 'United Kingdom'),
('AU', 'Australia'),
('DE', 'Germany'),
('FR', 'France'),
('IN', 'India'),
('JP', 'Japan'),
('CN', 'China'),
('BR', 'Brazil')
ON CONFLICT (code) DO NOTHING;

-- Insert US states
INSERT INTO states (country_code, code, name) VALUES 
('US', 'AL', 'Alabama'),
('US', 'AK', 'Alaska'),
('US', 'AZ', 'Arizona'),
('US', 'AR', 'Arkansas'),
('US', 'CA', 'California'),
('US', 'CO', 'Colorado'),
('US', 'CT', 'Connecticut'),
('US', 'DE', 'Delaware'),
('US', 'FL', 'Florida'),
('US', 'GA', 'Georgia'),
('US', 'HI', 'Hawaii'),
('US', 'ID', 'Idaho'),
('US', 'IL', 'Illinois'),
('US', 'IN', 'Indiana'),
('US', 'IA', 'Iowa'),
('US', 'KS', 'Kansas'),
('US', 'KY', 'Kentucky'),
('US', 'LA', 'Louisiana'),
('US', 'ME', 'Maine'),
('US', 'MD', 'Maryland'),
('US', 'MA', 'Massachusetts'),
('US', 'MI', 'Michigan'),
('US', 'MN', 'Minnesota'),
('US', 'MS', 'Mississippi'),
('US', 'MO', 'Missouri'),
('US', 'MT', 'Montana'),
('US', 'NE', 'Nebraska'),
('US', 'NV', 'Nevada'),
('US', 'NH', 'New Hampshire'),
('US', 'NJ', 'New Jersey'),
('US', 'NM', 'New Mexico'),
('US', 'NY', 'New York'),
('US', 'NC', 'North Carolina'),
('US', 'ND', 'North Dakota'),
('US', 'OH', 'Ohio'),
('US', 'OK', 'Oklahoma'),
('US', 'OR', 'Oregon'),
('US', 'PA', 'Pennsylvania'),
('US', 'RI', 'Rhode Island'),
('US', 'SC', 'South Carolina'),
('US', 'SD', 'South Dakota'),
('US', 'TN', 'Tennessee'),
('US', 'TX', 'Texas'),
('US', 'UT', 'Utah'),
('US', 'VT', 'Vermont'),
('US', 'VA', 'Virginia'),
('US', 'WA', 'Washington'),
('US', 'WV', 'West Virginia'),
('US', 'WI', 'Wisconsin'),
('US', 'WY', 'Wyoming')
ON CONFLICT (country_code, code) DO NOTHING;

-- Insert Canadian provinces
INSERT INTO states (country_code, code, name) VALUES 
('CA', 'AB', 'Alberta'),
('CA', 'BC', 'British Columbia'),
('CA', 'MB', 'Manitoba'),
('CA', 'NB', 'New Brunswick'),
('CA', 'NL', 'Newfoundland and Labrador'),
('CA', 'NS', 'Nova Scotia'),
('CA', 'ON', 'Ontario'),
('CA', 'PE', 'Prince Edward Island'),
('CA', 'QC', 'Quebec'),
('CA', 'SK', 'Saskatchewan'),
('CA', 'NT', 'Northwest Territories'),
('CA', 'NU', 'Nunavut'),
('CA', 'YT', 'Yukon')
ON CONFLICT (country_code, code) DO NOTHING;

-- Insert UK regions
INSERT INTO states (country_code, code, name) VALUES 
('GB', 'ENG', 'England'),
('GB', 'SCT', 'Scotland'),
('GB', 'WLS', 'Wales'),
('GB', 'NIR', 'Northern Ireland')
ON CONFLICT (country_code, code) DO NOTHING;
