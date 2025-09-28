import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

// Types for allocation data
interface AllocationData {
  id: string
  auction_id: string
  bid_id: string
  bidder_id: string
  bidder_email: string
  original_quantity: number
  allocated_quantity: number
  clearing_price: number
  total_amount: number
  allocation_type: 'full' | 'pro_rata' | 'rejected'
  pro_rata_percentage?: number
  created_at: string
  updated_at: string
}

interface ClearingResults {
  id: string
  auction_id: string
  clearing_price: number
  total_bids_count: number
  total_demand: number
  shares_allocated: number
  shares_remaining: number
  pro_rata_applied: boolean
  calculation_details: any
  created_at: string
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

    // Check if clearing has been completed
    const { data: clearingResults, error: clearingError } = await supabase
      .from('auction_clearing_results')
      .select('*')
      .eq('auction_id', auctionId)
      .single()

    if (clearingError && clearingError.code !== 'PGRST116') {
      console.error('Error fetching clearing results:', clearingError)
      return NextResponse.json({ error: 'Failed to fetch clearing results' }, { status: 500 })
    }

    if (!clearingResults) {
      return NextResponse.json({
        auction: {
          id: auction.id,
          title: auction.title,
          status: auction.status,
          shares_count: auction.shares_count,
          auction_mode: auction.auction_mode,
          bid_collection_end_time: auction.bid_collection_end_time
        },
        clearing_completed: false,
        message: 'Auction clearing has not been completed yet. Results will be available once the clearing process is finished.'
      })
    }

    // Determine user role
    const isCompanyOwner = auction.companies.created_by === user.id

    let allocations: AllocationData[] = []
    let userAllocation: AllocationData | null = null

    if (isCompanyOwner) {
      // Company owners can see all allocations
      const { data: allAllocations, error: allocationsError } = await supabase
        .from('bid_allocations')
        .select('*')
        .eq('auction_id', auctionId)
        .order('allocated_quantity', { ascending: false })

      if (allocationsError) {
        console.error('Error fetching allocations for company owner:', allocationsError)
        return NextResponse.json({ 
          error: 'Failed to fetch allocation results',
          details: allocationsError.message
        }, { status: 500 })
      }

      allocations = allAllocations || []
    } else {
      // Regular users can only see their own allocation
      const { data: userAlloc, error: userAllocError } = await supabase
        .from('bid_allocations')
        .select('*')
        .eq('auction_id', auctionId)
        .eq('bidder_id', user.id)
        .single()

      if (userAllocError && userAllocError.code !== 'PGRST116') {
        console.error('Error fetching user allocation:', userAllocError)
        return NextResponse.json({ 
          error: 'Failed to fetch your allocation results',
          details: userAllocError.message
        }, { status: 500 })
      }

      if (userAlloc) {
        userAllocation = userAlloc
        allocations = [userAlloc] // Consistent format for frontend
      }
    }

    // Calculate summary statistics
    const successfulAllocations = allocations.filter(a => a.allocated_quantity > 0)
    const rejectedAllocations = allocations.filter(a => a.allocated_quantity === 0)
    const totalRevenue = successfulAllocations.reduce((sum, a) => sum + a.total_amount, 0)

    // Return standardized response structure
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
      clearing_completed: true,
      user_role: isCompanyOwner ? 'company_owner' : 'member',
      allocations: {
        total_count: allocations.length,
        successful_count: successfulAllocations.length,
        rejected_count: rejectedAllocations.length,
        total_revenue: totalRevenue,
        data: allocations
      },
      user_allocation: userAllocation,
      summary: {
        clearing_price: clearingResults.clearing_price,
        total_demand: clearingResults.total_demand,
        shares_allocated: clearingResults.shares_allocated,
        shares_remaining: clearingResults.shares_remaining,
        pro_rata_applied: clearingResults.pro_rata_applied,
        subscription_ratio: ((clearingResults.total_demand / auction.shares_count) * 100).toFixed(1),
        allocation_ratio: ((clearingResults.shares_allocated / auction.shares_count) * 100).toFixed(1)
      }
    })

  } catch (error) {
    console.error('Error in GET /api/companies/[id]/auctions/[auctionId]/allocations:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      message: 'An unexpected error occurred while fetching allocation results'
    }, { status: 500 })
  }
}

// Optional: Add a POST endpoint for debugging/testing allocation visibility
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

    const body = await request.json().catch(() => ({}))
    const { debug = false } = body

    if (!debug) {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    // Run debug query to test allocation visibility
    const { data: debugData, error: debugError } = await supabase
      .rpc('test_allocation_visibility', {
        test_user_id: user.id,
        test_auction_id: auctionId
      })

    if (debugError) {
      console.error('Debug query error:', debugError)
      return NextResponse.json({ 
        error: 'Debug query failed',
        details: debugError.message
      }, { status: 500 })
    }

    return NextResponse.json({
      user_id: user.id,
      auction_id: auctionId,
      debug_results: debugData,
      message: 'Debug information for allocation visibility'
    })

  } catch (error) {
    console.error('Error in POST /api/companies/[id]/auctions/[auctionId]/allocations:', error)
    return NextResponse.json({ 
      error: 'Internal server error',
      message: 'An unexpected error occurred during debug operation'
    }, { status: 500 })
  }
}
