-- Performance Optimization Database Indexes
-- These indexes will significantly improve query performance

-- Index for company_members table (used frequently in JOINs)
CREATE INDEX IF NOT EXISTS idx_company_members_company_email ON company_members(company_id, email);
CREATE INDEX IF NOT EXISTS idx_company_members_company_id ON company_members(company_id);

-- Index for cap_table_sessions table (used in active session checks)
CREATE INDEX IF NOT EXISTS idx_cap_table_sessions_company_active ON cap_table_sessions(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_cap_table_sessions_company_id ON cap_table_sessions(company_id);

-- Index for companies table (used in ownership verification)
CREATE INDEX IF NOT EXISTS idx_companies_created_by ON companies(created_by);

-- Index for profiles table (used in user lookups)
CREATE INDEX IF NOT EXISTS idx_profiles_id ON profiles(id);

-- Index for company_auctions table (used in company auction queries)
CREATE INDEX IF NOT EXISTS idx_company_auctions_company_id_perf ON company_auctions(company_id);
CREATE INDEX IF NOT EXISTS idx_company_auctions_status_perf ON company_auctions(status);
CREATE INDEX IF NOT EXISTS idx_company_auctions_created_by_perf ON company_auctions(created_by);

-- Index for transactions table (used in company transaction queries)
CREATE INDEX IF NOT EXISTS idx_company_transactions_company_id ON company_transactions(company_id);

-- Composite indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_company_members_company_email_composite ON company_members(company_id, email, id);
CREATE INDEX IF NOT EXISTS idx_cap_table_sessions_active_company ON cap_table_sessions(is_active, company_id) WHERE is_active = true;

-- Index for user accessible companies view optimization
CREATE INDEX IF NOT EXISTS idx_companies_id_created_by ON companies(id, created_by);
