-- Company Documents Database Schema Extensions
-- Add this table to your existing Supabase database

-- Company documents table for storing uploaded files
CREATE TABLE IF NOT EXISTS company_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  document_type VARCHAR(50) CHECK (document_type IN ('articles_of_incorporation', 'bylaws')) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  mime_type VARCHAR(100),
  uploaded_by UUID REFERENCES auth.users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE company_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for company documents
CREATE POLICY "Users can view documents of companies they created" ON company_documents
  FOR SELECT USING (
    company_id IN (SELECT id FROM companies WHERE auth.uid() = created_by)
  );

CREATE POLICY "Users can insert documents for companies they created" ON company_documents
  FOR INSERT WITH CHECK (
    company_id IN (SELECT id FROM companies WHERE auth.uid() = created_by) AND
    auth.uid() = uploaded_by
  );

CREATE POLICY "Users can update documents of companies they created" ON company_documents
  FOR UPDATE USING (
    company_id IN (SELECT id FROM companies WHERE auth.uid() = created_by)
  );

CREATE POLICY "Users can delete documents of companies they created" ON company_documents
  FOR DELETE USING (
    company_id IN (SELECT id FROM companies WHERE auth.uid() = created_by)
  );

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_company_documents_company_id ON company_documents(company_id);
CREATE INDEX IF NOT EXISTS idx_company_documents_type ON company_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_company_documents_uploaded_by ON company_documents(uploaded_by);

-- Add comments for documentation
COMMENT ON TABLE company_documents IS 'Stores uploaded documents for companies (articles of incorporation, bylaws, etc.)';
COMMENT ON COLUMN company_documents.document_type IS 'Type of document: articles_of_incorporation or bylaws';
COMMENT ON COLUMN company_documents.file_path IS 'Path to the file in Supabase storage';
COMMENT ON COLUMN company_documents.file_size IS 'File size in bytes';
COMMENT ON COLUMN company_documents.mime_type IS 'MIME type of the uploaded file';
