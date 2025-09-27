import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

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
    const { quantity_requested, max_price } = await request.json()

    // Validate input
    if (!quantity_requested || quantity_requested <= 0) {
      return NextResponse.json({ error: 'Quantity must be greater than 0' }, { status: 400 })
    }

    if (!max_price || max_price <= 0) {
      return NextResponse.json({ error: 'Maximum price must be greater than 0' }, { status: 400 })
    }

    // Get the auction and verify it exists and is in collecting_bids status
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

    // Check if auction is in collecting_bids status
    if (auction.status !== 'collecting_bids') {
      return NextResponse.json({ 
        error: `Auction is not accepting bids. Current status: ${auction.status}` 
      }, { status: 400 })
    }

    // Check if bid collection period has ended
    if (auction.bid_collection_end_time && new Date() > new Date(auction.bid_collection_end_time)) {
      return NextResponse.json({ 
        error: 'Bid collection period has ended' 
      }, { status: 400 })
    }

    // Validate auction mode
    if (auction.auction_mode !== 'modified_dutch') {
      return NextResponse.json({ 
        error: 'This endpoint is only for modified Dutch auctions' 
      }, { status: 400 })
    }

    // Validate price range
    if (max_price < auction.min_price) {
      return NextResponse.json({ 
        error: `Maximum price must be at least $${auction.min_price} (auction minimum)` 
      }, { status: 400 })
    }

    if (max_price > auction.max_price) {
      return NextResponse.json({ 
        error: `Maximum price cannot exceed $${auction.max_price} (auction maximum)` 
      }, { status: 400 })
    }

    // Check if user is invited to this auction
    if (auction.invited_members && auction.invited_members.length > 0) {
      if (!auction.invited_members.includes(user.email)) {
        return NextResponse.json({ 
          error: 'You are not invited to participate in this auction' 
        }, { status: 403 })
      }
    }

    // Check if user already has a bid for this auction
    const { data: existingBid, error: bidCheckError } = await supabase
      .from('auction_bids')
      .select('id')
      .eq('auction_id', auctionId)
      .eq('bidder_id', user.id)
      .eq('bid_status', 'active')
      .single()

    const bidData = {
      auction_id: auctionId,
      bidder_id: user.id,
      bidder_email: user.email,
      quantity_requested: parseInt(quantity_requested),
      max_price: parseFloat(max_price),
      bid_amount: parseFloat(max_price), // For compatibility
      bid_status: 'active',
      bid_time: new Date().toISOString()
    }

    let result
    if (existingBid && !bidCheckError) {
      // Update existing bid
      result = await supabase
        .from('auction_bids')
        .update(bidData)
        .eq('id', existingBid.id)
        .select()
        .single()
    } else {
      // Create new bid
      result = await supabase
        .from('auction_bids')
        .insert(bidData)
        .select()
        .single()
    }

    if (result.error) {
      console.error('Error saving bid:', result.error)
      return NextResponse.json({ error: 'Failed to save bid' }, { status: 500 })
    }

    // Get updated demand analysis
    const { data: allBids, error: bidsError } = await supabase
      .from('auction_bids')
      .select('quantity_requested, max_price, bid_time')
      .eq('auction_id', auctionId)
      .eq('bid_status', 'active')
      .order('max_price', { ascending: false })

    let demandAnalysis = null
    if (!bidsError && allBids && allBids.length > 0) {
      const totalDemand = allBids.reduce((sum, bid) => sum + bid.quantity_requested, 0)
      const demandRatio = (totalDemand / auction.shares_count) * 100

      // Simple clearing price estimation (more sophisticated logic in clearing phase)
      let runningDemand = 0
      let estimatedClearingPrice = auction.min_price
      
      for (const bid of allBids) {
        runningDemand += bid.quantity_requested
        if (runningDemand >= auction.shares_count) {
          estimatedClearingPrice = bid.max_price
          break
        }
      }

      demandAnalysis = {
        totalBids: allBids.length,
        totalDemand,
        demandRatio,
        estimatedClearingPrice,
        isOversubscribed: totalDemand > auction.shares_count
      }
    }

    return NextResponse.json({ 
      bid: result.data,
      demandAnalysis,
      message: existingBid ? 'Bid updated successfully' : 'Bid placed successfully'
    })

  } catch (error) {
    console.error('Error in POST /api/companies/[id]/auctions/[auctionId]/bids:', error)
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

    // Get the auction
    const { data: auction, error: auctionError } = await supabase
      .from('company_auctions')
      .select(`
        *,
        companies!inner(id, name)
      `)
      .eq('id', auctionId)
      .eq('companies.id', id)
      .single()

    if (auctionError || !auction) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 })
    }

    // Get user's current bid
    const { data: userBid, error: userBidError } = await supabase
      .from('auction_bids')
      .select('*')
      .eq('auction_id', auctionId)
      .eq('bidder_id', user.id)
      .eq('bid_status', 'active')
      .single()

    // Get all bids for demand analysis (anonymized)
    const { data: allBids, error: bidsError } = await supabase
      .from('auction_bids')
      .select('quantity_requested, max_price, bid_time')
      .eq('auction_id', auctionId)
      .eq('bid_status', 'active')
      .order('max_price', { ascending: false })

    let demandAnalysis = null
    if (!bidsError && allBids && allBids.length > 0) {
      const totalDemand = allBids.reduce((sum, bid) => sum + bid.quantity_requested, 0)
      const demandRatio = (totalDemand / auction.shares_count) * 100

      // Simple clearing price estimation
      let runningDemand = 0
      let estimatedClearingPrice = auction.min_price
      
      for (const bid of allBids) {
        runningDemand += bid.quantity_requested
        if (runningDemand >= auction.shares_count) {
          estimatedClearingPrice = bid.max_price
          break
        }
      }

      demandAnalysis = {
        totalBids: allBids.length,
        totalDemand,
        demandRatio,
        estimatedClearingPrice,
        isOversubscribed: totalDemand > auction.shares_count
      }
    }

    return NextResponse.json({ 
      userBid: userBidError ? null : userBid,
      demandAnalysis,
      auction: {
        id: auction.id,
        title: auction.title,
        status: auction.status,
        shares_count: auction.shares_count,
        min_price: auction.min_price,
        max_price: auction.max_price,
        bid_collection_end_time: auction.bid_collection_end_time
      }
    })

  } catch (error) {
    console.error('Error in GET /api/companies/[id]/auctions/[auctionId]/bids:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
