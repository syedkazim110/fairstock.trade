-- Add duration_minutes column to company_auctions table
-- This allows auctions to be specified in both hours and minutes
-- Total duration = (duration_hours * 60) + duration_minutes

DO $$
BEGIN
    -- Add duration_minutes column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                   WHERE table_name = 'company_auctions' AND column_name = 'duration_minutes') THEN
        ALTER TABLE company_auctions ADD COLUMN duration_minutes INTEGER DEFAULT 0;
        RAISE NOTICE 'Added duration_minutes column';
    END IF;
    
    -- Add comment to explain the field
    COMMENT ON COLUMN company_auctions.duration_minutes IS 'Additional minutes to add to duration_hours for total auction duration';
    
    -- Update any existing auctions to have 0 minutes (they already have hours set)
    UPDATE company_auctions SET duration_minutes = 0 WHERE duration_minutes IS NULL;
    
    RAISE NOTICE 'Duration minutes column setup complete';
END $$;
