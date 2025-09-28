import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user owns the company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id')
      .eq('id', id)
      .eq('created_by', user.id)
      .single()

    if (companyError || !company) {
      return NextResponse.json({ error: 'Company not found or access denied' }, { status: 404 })
    }

    // Get auctions for the company
    const { data: auctions, error: auctionsError } = await supabase
      .from('company_auctions')
      .select(`
        *,
        company:companies(name)
      `)
      .eq('company_id', id)
      .order('created_at', { ascending: false })

    if (auctionsError) {
      console.error('Error fetching auctions:', auctionsError)
      return NextResponse.json({ error: 'Failed to fetch auctions' }, { status: 500 })
    }

    return NextResponse.json({ auctions })
  } catch (error) {
    console.error('Error in GET /api/companies/[id]/auctions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user owns the company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id')
      .eq('id', id)
      .eq('created_by', user.id)
      .single()

    if (companyError || !company) {
      return NextResponse.json({ error: 'Company not found or access denied' }, { status: 404 })
    }

    // Parse request body
    const body = await request.json()
    
    // Validate required fields
    const requiredFields = [
      'title', 'shares_count', 'max_price', 'min_price', 
      'duration_hours', 'auction_mode'
    ]
    
    // For traditional auctions, decreasing_minutes is required
    if (body.auction_mode === 'traditional') {
      requiredFields.push('decreasing_minutes')
    }
    
    for (const field of requiredFields) {
      if (!body[field] && body[field] !== 0) {
        return NextResponse.json({ 
          error: `Missing required field: ${field}` 
        }, { status: 400 })
      }
    }

    // Validate auction_mode
    if (!['traditional', 'modified_dutch'].includes(body.auction_mode)) {
      return NextResponse.json({ 
        error: 'Invalid auction_mode. Must be "traditional" or "modified_dutch"' 
      }, { status: 400 })
    }

    // Validate price logic
    if (body.max_price <= body.min_price) {
      return NextResponse.json({ 
        error: 'Maximum price must be greater than minimum price' 
      }, { status: 400 })
    }

    // Create the auction
    const auctionData = {
      company_id: id,
      title: body.title,
      description: body.description || '',
      auction_mode: body.auction_mode,
      shares_count: body.shares_count,
      max_price: body.max_price,
      min_price: body.min_price,
      decreasing_minutes: body.decreasing_minutes || 0,
      duration_hours: body.duration_hours,
      duration_minutes: body.duration_minutes || 0,
      invited_members: body.invited_members || [],
      wire_account_name: body.wire_account_name || '',
      wire_account_number: body.wire_account_number || '',
      wire_routing_number: body.wire_routing_number || '',
      wire_bank_name: body.wire_bank_name || '',
      wire_bank_address: body.wire_bank_address || '',
      articles_document_id: body.articles_document_id || null,
      marketing_compliance_accepted: body.marketing_compliance_accepted || false,
      accredited_investor_compliance_accepted: body.accredited_investor_compliance_accepted || false,
      status: 'draft',
      created_by: user.id
    }

    const { data: auction, error: insertError } = await supabase
      .from('company_auctions')
      .insert(auctionData)
      .select()
      .single()

    if (insertError) {
      console.error('Error creating auction:', insertError)
      return NextResponse.json({ error: 'Failed to create auction' }, { status: 500 })
    }

    return NextResponse.json({ auction }, { status: 201 })
  } catch (error) {
    console.error('Error in POST /api/companies/[id]/auctions:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
