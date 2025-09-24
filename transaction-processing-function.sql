-- Database function to process company transactions atomically
-- This function handles both equity and financial transactions with proper validation

CREATE OR REPLACE FUNCTION process_company_transaction(
  p_company_id UUID,
  p_transaction_type VARCHAR(50),
  p_to_member_email VARCHAR(255),
  p_amount DECIMAL(12,2) DEFAULT NULL,
  p_share_quantity BIGINT DEFAULT NULL,
  p_from_member_email VARCHAR(255) DEFAULT NULL,
  p_description TEXT DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_from_member_id UUID;
  v_to_member_id UUID;
  v_from_current_balance DECIMAL(12,2);
  v_to_current_balance DECIMAL(12,2);
  v_from_current_shares BIGINT;
  v_to_current_shares BIGINT;
  v_company_total_shares BIGINT;
  v_company_issued_shares BIGINT;
  v_new_share_percentage DECIMAL(8,4);
  v_transaction_id UUID;
BEGIN
  -- Validate company exists
  SELECT total_shares, issued_shares 
  INTO v_company_total_shares, v_company_issued_shares
  FROM companies 
  WHERE id = p_company_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Company not found';
  END IF;

  -- Get member IDs and validate they exist
  IF p_from_member_email IS NOT NULL THEN
    SELECT id, credit_balance 
    INTO v_from_member_id, v_from_current_balance
    FROM company_members 
    WHERE company_id = p_company_id AND email = p_from_member_email;
    
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Source member not found: %', p_from_member_email;
    END IF;
  END IF;

  SELECT id, credit_balance 
  INTO v_to_member_id, v_to_current_balance
  FROM company_members 
  WHERE company_id = p_company_id AND email = p_to_member_email;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recipient member not found: %', p_to_member_email;
  END IF;

  -- Process based on transaction type
  CASE p_transaction_type
    
    -- EQUITY TRANSACTIONS
    WHEN 'share_purchase', 'share_sale', 'share_transfer' THEN
      -- Get current shareholdings
      SELECT COALESCE(shares_owned, 0) 
      INTO v_from_current_shares
      FROM member_shareholdings 
      WHERE company_id = p_company_id AND member_email = p_from_member_email;
      
      SELECT COALESCE(shares_owned, 0) 
      INTO v_to_current_shares
      FROM member_shareholdings 
      WHERE company_id = p_company_id AND member_email = p_to_member_email;
      
      -- Validate source member has enough shares
      IF v_from_current_shares < p_share_quantity THEN
        RAISE EXCEPTION 'Insufficient shares. Available: %, Required: %', v_from_current_shares, p_share_quantity;
      END IF;
      
      -- Update source member shareholding
      IF v_from_current_shares - p_share_quantity = 0 THEN
        -- Remove shareholding record if shares become 0
        DELETE FROM member_shareholdings 
        WHERE company_id = p_company_id AND member_email = p_from_member_email;
      ELSE
        -- Calculate new percentage for source member
        v_new_share_percentage := CASE 
          WHEN v_company_total_shares > 0 THEN ((v_from_current_shares - p_share_quantity)::DECIMAL / v_company_total_shares) * 100
          ELSE 0
        END;
        
        UPDATE member_shareholdings 
        SET shares_owned = v_from_current_shares - p_share_quantity,
            share_percentage = v_new_share_percentage,
            updated_at = NOW()
        WHERE company_id = p_company_id AND member_email = p_from_member_email;
      END IF;
      
      -- Update recipient member shareholding
      v_new_share_percentage := CASE 
        WHEN v_company_total_shares > 0 THEN ((v_to_current_shares + p_share_quantity)::DECIMAL / v_company_total_shares) * 100
        ELSE 0
      END;
      
      INSERT INTO member_shareholdings (company_id, member_email, shares_owned, share_percentage)
      VALUES (p_company_id, p_to_member_email, v_to_current_shares + p_share_quantity, v_new_share_percentage)
      ON CONFLICT (company_id, member_email) 
      DO UPDATE SET 
        shares_owned = v_to_current_shares + p_share_quantity,
        share_percentage = v_new_share_percentage,
        updated_at = NOW();

    WHEN 'share_issuance' THEN
      -- Check if issuing shares would exceed total authorized shares
      IF v_company_total_shares IS NOT NULL AND (COALESCE(v_company_issued_shares, 0) + p_share_quantity) > v_company_total_shares THEN
        RAISE EXCEPTION 'Cannot issue % shares. Would exceed total authorized shares (%)', p_share_quantity, v_company_total_shares;
      END IF;
      
      -- Get current shareholding for recipient
      SELECT COALESCE(shares_owned, 0) 
      INTO v_to_current_shares
      FROM member_shareholdings 
      WHERE company_id = p_company_id AND member_email = p_to_member_email;
      
      -- Calculate new percentage
      v_new_share_percentage := CASE 
        WHEN v_company_total_shares > 0 THEN ((v_to_current_shares + p_share_quantity)::DECIMAL / v_company_total_shares) * 100
        ELSE 0
      END;
      
      -- Update or insert shareholding
      INSERT INTO member_shareholdings (company_id, member_email, shares_owned, share_percentage)
      VALUES (p_company_id, p_to_member_email, v_to_current_shares + p_share_quantity, v_new_share_percentage)
      ON CONFLICT (company_id, member_email) 
      DO UPDATE SET 
        shares_owned = v_to_current_shares + p_share_quantity,
        share_percentage = v_new_share_percentage,
        updated_at = NOW();
      
      -- Update company issued shares
      UPDATE companies 
      SET issued_shares = COALESCE(issued_shares, 0) + p_share_quantity,
          updated_at = NOW()
      WHERE id = p_company_id;

    -- FINANCIAL TRANSACTIONS
    WHEN 'credit_transfer', 'credit_payment' THEN
      -- Validate source member has enough balance
      IF v_from_current_balance < p_amount THEN
        RAISE EXCEPTION 'Insufficient balance. Available: $%, Required: $%', v_from_current_balance, p_amount;
      END IF;
      
      -- Update source member balance
      UPDATE company_members 
      SET credit_balance = v_from_current_balance - p_amount,
          updated_at = NOW()
      WHERE id = v_from_member_id;
      
      -- Update recipient member balance
      UPDATE company_members 
      SET credit_balance = COALESCE(v_to_current_balance, 0) + p_amount,
          updated_at = NOW()
      WHERE id = v_to_member_id;

    ELSE
      RAISE EXCEPTION 'Invalid transaction type: %', p_transaction_type;
  END CASE;

  -- Insert transaction record
  INSERT INTO company_transactions (
    company_id,
    transaction_type,
    amount,
    share_quantity,
    from_member_email,
    to_member_email,
    description
  ) VALUES (
    p_company_id,
    p_transaction_type,
    p_amount,
    p_share_quantity,
    p_from_member_email,
    p_to_member_email,
    p_description
  );

END;
$$ LANGUAGE plpgsql;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION process_company_transaction TO authenticated;
