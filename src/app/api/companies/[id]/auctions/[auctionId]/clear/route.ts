import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { calculateClearingPrice, validateBids, type Bid } from '@/lib/modified-dutch-auction'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; auctionId: string }> }
) {
  try {
    const { id, auctionId } = await params
    const supabase = await createClient()
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json().catch(() => ({}))
    const { manual_trigger = false } = body

    // Get the auction and verify it exists and belongs to the company
    const { data: auction, error: auctionError } = await supabase
      .from('company_auctions')
      .select(`
        *,
        companies!inner(id, name, created_by)
      `)
      .eq('id', auctionId)
      .eq('companies.id', id)
      .single()

    if (auctionError || !auction) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 })
    }

    // Check if user is company owner (for manual triggers)
    if (manual_trigger && auction.companies.created_by !== user.id) {
      return NextResponse.json({ 
        error: 'Only company owners can manually trigger clearing' 
      }, { status: 403 })
    }

    // Validate auction mode
    if (auction.auction_mode !== 'modified_dutch') {
      return NextResponse.json({ 
        error: 'Clearing is only available for modified Dutch auctions' 
      }, { status: 400 })
    }

    // Check if auction is in collecting_bids status
    if (auction.status !== 'collecting_bids') {
      return NextResponse.json({ 
        error: `Auction is not in bid collection phase. Current status: ${auction.status}` 
      }, { status: 400 })
    }

    // Check if bid collection period has ended (unless manual trigger by owner)
    const now = new Date()
    const bidCollectionEndTime = new Date(auction.bid_collection_end_time)
    
    if (!manual_trigger && now < bidCollectionEndTime) {
      return NextResponse.json({ 
        error: 'Bid collection period has not ended yet',
        bid_collection_end_time: auction.bid_collection_end_time
      }, { status: 400 })
    }

    // Check if clearing has already been calculated
    const { data: existingResults, error: existingError } = await supabase
      .from('auction_clearing_results')
      .select('id')
      .eq('auction_id', auctionId)
      .single()

    if (existingResults && !existingError) {
      return NextResponse.json({ 
        error: 'Clearing has already been calculated for this auction' 
      }, { status: 400 })
    }

    // Get all active bids for this auction
    const { data: bidsData, error: bidsError } = await supabase
      .from('auction_bids')
      .select('*')
      .eq('auction_id', auctionId)
      .eq('bid_status', 'active')
      .order('max_price', { ascending: false })

    if (bidsError) {
      console.error('Error fetching bids:', bidsError)
      return NextResponse.json({ error: 'Failed to fetch auction bids' }, { status: 500 })
    }

    // Convert to the format expected by the clearing algorithm
    const bids: Bid[] = (bidsData || []).map(bid => ({
      id: bid.id,
      bidder_id: bid.bidder_id,
      bidder_email: bid.bidder_email,
      quantity: bid.quantity_requested,
      max_price: bid.max_price,
      bid_time: new Date(bid.bid_time)
    }))

    // Validate bids before processing
    const validation = validateBids(bids)
    if (!validation.isValid) {
      console.error('Bid validation failed:', validation.errors)
      return NextResponse.json({ 
        error: 'Invalid bid data found',
        details: validation.errors
      }, { status: 400 })
    }

    // Calculate clearing price and allocations
    const clearingResult = calculateClearingPrice(bids, auction.shares_count)

    // Start a database transaction
    const { data: clearingResultRecord, error: clearingError } = await supabase
      .from('auction_clearing_results')
      .insert({
        auction_id: auctionId,
        clearing_price: clearingResult.clearing_price,
        total_bids_count: clearingResult.calculation_details.total_bids,
        total_demand: clearingResult.total_demand,
        shares_allocated: clearingResult.shares_allocated,
        shares_remaining: clearingResult.shares_remaining,
        pro_rata_applied: clearingResult.pro_rata_applied,
        calculation_details: clearingResult.calculation_details
      })
      .select()
      .single()

    if (clearingError) {
      console.error('Error saving clearing results:', clearingError)
      return NextResponse.json({ error: 'Failed to save clearing results' }, { status: 500 })
    }

    // Save individual bid allocations with proper transaction handling
    const allocationsToInsert = clearingResult.allocations.map(allocation => ({
      auction_id: auctionId,
      bid_id: allocation.bid_id, // This was missing - critical for the database schema
      bidder_id: allocation.bidder_id,
      bidder_email: allocation.bidder_email,
      original_quantity: allocation.original_quantity,
      allocated_quantity: allocation.allocated_quantity,
      clearing_price: allocation.clearing_price,
      total_amount: allocation.total_amount,
      allocation_type: allocation.allocation_type,
      pro_rata_percentage: allocation.pro_rata_percentage || null
    }))

    // Use a proper transaction approach by attempting the insert and handling rollback
    const { error: allocationsError } = await supabase
      .from('bid_allocations')
      .insert(allocationsToInsert)

    if (allocationsError) {
      console.error('Error saving bid allocations:', allocationsError)
      console.error('Allocation data that failed:', JSON.stringify(allocationsToInsert, null, 2))
      
      // Rollback clearing results
      const { error: rollbackError } = await supabase
        .from('auction_clearing_results')
        .delete()
        .eq('id', clearingResultRecord.id)
      
      if (rollbackError) {
        console.error('Error rolling back clearing results:', rollbackError)
      }
      
      return NextResponse.json({ 
        error: 'Failed to save bid allocations',
        details: allocationsError.message,
        code: allocationsError.code
      }, { status: 500 })
    }

    // Update auction status and clearing information
    const { error: updateError } = await supabase
      .from('company_auctions')
      .update({
        status: 'completed',
        clearing_price: clearingResult.clearing_price,
        total_demand: clearingResult.total_demand,
        clearing_calculated_at: new Date().toISOString()
      })
      .eq('id', auctionId)

    if (updateError) {
      console.error('Error updating auction status:', updateError)
      return NextResponse.json({ error: 'Failed to update auction status' }, { status: 500 })
    }

    // Calculate total revenue for successful bidders
    const totalRevenue = clearingResult.allocations
      .filter(a => a.allocated_quantity > 0)
      .reduce((sum, a) => sum + a.total_amount, 0)

    // Return success response
    return NextResponse.json({
      success: true,
      clearing_results: {
        clearing_price: clearingResult.clearing_price,
        total_demand: clearingResult.total_demand,
        shares_allocated: clearingResult.shares_allocated,
        shares_remaining: clearingResult.shares_remaining,
        pro_rata_applied: clearingResult.pro_rata_applied,
        total_revenue: totalRevenue,
        successful_bidders: clearingResult.allocations.filter(a => a.allocated_quantity > 0).length,
        rejected_bidders: clearingResult.allocations.filter(a => a.allocated_quantity === 0).length
      },
      allocations_count: clearingResult.allocations.length,
      calculation_details: clearingResult.calculation_details
    })

  } catch (error) {
    console.error('Error in POST /api/companies/[id]/auctions/[auctionId]/clear:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; auctionId: string }> }
) {
  try {
    const { id, auctionId } = await params
    const supabase = await createClient()
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get the auction and verify it exists
    const { data: auction, error: auctionError } = await supabase
      .from('company_auctions')
      .select(`
        *,
        companies!inner(id, name, created_by)
      `)
      .eq('id', auctionId)
      .eq('companies.id', id)
      .single()

    if (auctionError || !auction) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 })
    }

    // Get clearing results if they exist
    const { data: clearingResults, error: clearingError } = await supabase
      .from('auction_clearing_results')
      .select('*')
      .eq('auction_id', auctionId)
      .single()

    if (clearingError && clearingError.code !== 'PGRST116') {
      console.error('Error fetching clearing results:', clearingError)
      return NextResponse.json({ error: 'Failed to fetch clearing results' }, { status: 500 })
    }

    // Check if user is company owner
    const isCompanyOwner = auction.companies.created_by === user.id

    let bidAllocations = null
    let userAllocation = null

    if (clearingResults) {
      if (isCompanyOwner) {
        // Company owners can see all allocations
        const { data: allocations, error: allocationsError } = await supabase
          .from('bid_allocations')
          .select('*')
          .eq('auction_id', auctionId)
          .order('allocated_quantity', { ascending: false })

        if (allocationsError) {
          console.error('Error fetching allocations:', allocationsError)
        } else {
          bidAllocations = allocations
        }
      } else {
        // Regular users can only see their own allocation
        const { data: userAlloc, error: userAllocError } = await supabase
          .from('bid_allocations')
          .select('*')
          .eq('auction_id', auctionId)
          .eq('bidder_id', user.id)
          .single()

        if (!userAllocError && userAlloc) {
          userAllocation = userAlloc
        }
      }
    }

    return NextResponse.json({
      auction: {
        id: auction.id,
        title: auction.title,
        status: auction.status,
        shares_count: auction.shares_count,
        auction_mode: auction.auction_mode,
        bid_collection_end_time: auction.bid_collection_end_time,
        clearing_price: auction.clearing_price,
        total_demand: auction.total_demand,
        clearing_calculated_at: auction.clearing_calculated_at
      },
      clearing_results: clearingResults,
      bid_allocations: bidAllocations,
      user_allocation: userAllocation,
      is_company_owner: isCompanyOwner,
      can_trigger_clearing: isCompanyOwner && auction.status === 'collecting_bids'
    })

  } catch (error) {
    console.error('Error in GET /api/companies/[id]/auctions/[auctionId]/clear:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
