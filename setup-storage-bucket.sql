-- Supabase Storage Bucket Setup for Company Documents
-- Run this in your Supabase SQL Editor to set up the storage bucket

-- Create the storage bucket for company documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-documents', 'company-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Set up RLS policies for the storage bucket
-- Policy to allow authenticated users to upload files to their own folder
CREATE POLICY "Users can upload to own folder" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'company-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy to allow authenticated users to view files in their own folder
CREATE POLICY "Users can view own files" ON storage.objects
FOR SELECT USING (
  bucket_id = 'company-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy to allow authenticated users to delete files in their own folder
CREATE POLICY "Users can delete own files" ON storage.objects
FOR DELETE USING (
  bucket_id = 'company-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Policy to allow authenticated users to update files in their own folder
CREATE POLICY "Users can update own files" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'company-documents' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Optional: Set file size limits (10MB = 10485760 bytes)
-- This is handled in the application code, but you can also set it at the bucket level
-- UPDATE storage.buckets 
-- SET file_size_limit = 10485760 
-- WHERE id = 'company-documents';
