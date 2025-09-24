import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface TransactionRequest {
  transaction_type: string
  amount?: number
  share_quantity?: number
  from_member_email?: string
  to_member_email: string
  description?: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const resolvedParams = await params
    const companyId = resolvedParams.id

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user owns the company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, created_by')
      .eq('id', companyId)
      .single()

    if (companyError || !company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    if (company.created_by !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Parse request body
    const body: TransactionRequest = await request.json()
    const {
      transaction_type,
      amount,
      share_quantity,
      from_member_email,
      to_member_email,
      description
    } = body

    // Validate required fields
    if (!transaction_type || !to_member_email) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Define transaction categories
    const equityTransactions = ['share_purchase', 'share_sale', 'share_transfer', 'share_issuance']
    const financialTransactions = ['credit_transfer', 'credit_payment']

    const isEquityTransaction = equityTransactions.includes(transaction_type)
    const isFinancialTransaction = financialTransactions.includes(transaction_type)

    if (!isEquityTransaction && !isFinancialTransaction) {
      return NextResponse.json({ error: 'Invalid transaction type' }, { status: 400 })
    }

    // Validate transaction-specific requirements
    if (isEquityTransaction && (!share_quantity || share_quantity <= 0)) {
      return NextResponse.json({ error: 'Valid share quantity required for equity transactions' }, { status: 400 })
    }

    if (isFinancialTransaction && (!amount || amount <= 0)) {
      return NextResponse.json({ error: 'Valid amount required for financial transactions' }, { status: 400 })
    }

    // Validate member requirements
    if (transaction_type !== 'share_issuance' && !from_member_email) {
      return NextResponse.json({ error: 'Source member required for this transaction type' }, { status: 400 })
    }

    if (from_member_email === to_member_email) {
      return NextResponse.json({ error: 'Source and recipient must be different' }, { status: 400 })
    }

    // Start database transaction
    const { error: transactionError } = await supabase.rpc('process_company_transaction', {
      p_company_id: companyId,
      p_transaction_type: transaction_type,
      p_to_member_email: to_member_email,
      p_amount: amount || null,
      p_share_quantity: share_quantity || null,
      p_from_member_email: from_member_email || null,
      p_description: description || null
    })

    if (transactionError) {
      console.error('Transaction processing error:', transactionError)
      return NextResponse.json({ 
        error: transactionError.message || 'Failed to process transaction' 
      }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Transaction created successfully' 
    })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const resolvedParams = await params
    const companyId = resolvedParams.id

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user has access to the company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, created_by')
      .eq('id', companyId)
      .single()

    if (companyError || !company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    if (company.created_by !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch transactions
    const { data: transactions, error: fetchError } = await supabase
      .from('company_transactions')
      .select(`
        id,
        transaction_type,
        amount,
        share_quantity,
        from_member_email,
        to_member_email,
        description,
        created_at
      `)
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })

    if (fetchError) {
      console.error('Error fetching transactions:', fetchError)
      return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
    }

    return NextResponse.json({ transactions: transactions || [] })

  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 })
  }
}
