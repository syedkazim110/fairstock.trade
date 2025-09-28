import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

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

    // Verify user owns the company and auction exists
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

    // Check if user is company owner
    if (auction.companies.created_by !== user.id) {
      return NextResponse.json({ 
        error: 'Only company owners can access settlement management' 
      }, { status: 403 })
    }

    // Check if auction has been cleared
    if (auction.status !== 'completed' || !auction.clearing_calculated_at) {
      return NextResponse.json({ 
        error: 'Auction has not been cleared yet' 
      }, { status: 400 })
    }

    // Get settlement dashboard data using the view
    const { data: settlementData, error: settlementError } = await supabase
      .from('auction_settlement_dashboard')
      .select('*')
      .eq('auction_id', auctionId)
      .order('settlement_updated_at', { ascending: false })

    if (settlementError) {
      console.error('Error fetching settlement data:', settlementError)
      return NextResponse.json({ error: 'Failed to fetch settlement data' }, { status: 500 })
    }

    // Get settlement summary
    const { data: summaryData, error: summaryError } = await supabase
      .from('auction_settlement_summary')
      .select('*')
      .eq('auction_id', auctionId)
      .single()

    if (summaryError && summaryError.code !== 'PGRST116') {
      console.error('Error fetching settlement summary:', summaryError)
      return NextResponse.json({ error: 'Failed to fetch settlement summary' }, { status: 500 })
    }

    // Calculate additional metrics
    const allocations = settlementData || []
    const totalAllocations = allocations.length
    const pendingPayments = allocations.filter(a => a.settlement_status === 'pending_payment')
    const paymentsReceived = allocations.filter(a => a.settlement_status === 'payment_received')
    const sharesTransferred = allocations.filter(a => a.settlement_status === 'shares_transferred')
    const completed = allocations.filter(a => a.settlement_status === 'completed')

    // Group allocations by status for easier frontend handling
    const allocationsByStatus = {
      pending_payment: pendingPayments,
      payment_received: paymentsReceived,
      shares_transferred: sharesTransferred,
      completed: completed
    }

    return NextResponse.json({
      success: true,
      auction: {
        id: auction.id,
        title: auction.title,
        company_id: auction.company_id,
        company_name: auction.companies.name,
        clearing_calculated_at: auction.clearing_calculated_at,
        clearing_price: auction.clearing_price,
        shares_count: auction.shares_count
      },
      settlement_summary: summaryData || {
        total_successful_allocations: totalAllocations,
        pending_payment_count: pendingPayments.length,
        payment_received_count: paymentsReceived.length,
        shares_transferred_count: sharesTransferred.length,
        completed_count: completed.length,
        total_settlement_amount: allocations.reduce((sum, a) => sum + (a.total_amount || 0), 0),
        confirmed_payment_amount: [...paymentsReceived, ...sharesTransferred, ...completed]
          .reduce((sum, a) => sum + (a.total_amount || 0), 0),
        pending_payment_amount: pendingPayments.reduce((sum, a) => sum + (a.total_amount || 0), 0),
        total_shares_allocated: allocations.reduce((sum, a) => sum + (a.allocated_quantity || 0), 0),
        shares_transferred_to_cap_table: [...sharesTransferred, ...completed]
          .reduce((sum, a) => sum + (a.allocated_quantity || 0), 0),
        settlement_completion_percentage: totalAllocations > 0 ? 
          Math.round((completed.length / totalAllocations) * 100 * 100) / 100 : 0,
        payment_collection_percentage: totalAllocations > 0 ? 
          Math.round((([...paymentsReceived, ...sharesTransferred, ...completed].length) / totalAllocations) * 100 * 100) / 100 : 0,
        all_settlements_completed: completed.length === totalAllocations && totalAllocations > 0,
        has_pending_payments: pendingPayments.length > 0
      },
      allocations: {
        total_count: totalAllocations,
        by_status: allocationsByStatus,
        all: allocations
      },
      actions_available: {
        can_confirm_payments: pendingPayments.length > 0,
        can_transfer_shares: paymentsReceived.length > 0,
        can_complete_settlements: sharesTransferred.length > 0,
        can_bulk_confirm: pendingPayments.length > 1,
        can_bulk_transfer: paymentsReceived.length > 1
      }
    })

  } catch (error) {
    console.error('Error in GET /api/companies/[id]/auctions/[auctionId]/settlement:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

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
    const body = await request.json()
    const { action, allocation_ids, payment_reference, notes } = body

    // Validate required fields
    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 })
    }

    if (!allocation_ids || !Array.isArray(allocation_ids) || allocation_ids.length === 0) {
      return NextResponse.json({ error: 'At least one allocation ID is required' }, { status: 400 })
    }

    // Verify user owns the company and auction exists
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

    // Check if user is company owner
    if (auction.companies.created_by !== user.id) {
      return NextResponse.json({ 
        error: 'Only company owners can manage settlements' 
      }, { status: 403 })
    }

    // Verify all allocation IDs belong to this auction
    const { data: allocations, error: allocationsError } = await supabase
      .from('bid_allocations')
      .select('id, settlement_status, bidder_email, allocated_quantity, total_amount')
      .eq('auction_id', auctionId)
      .in('id', allocation_ids)

    if (allocationsError) {
      console.error('Error fetching allocations:', allocationsError)
      return NextResponse.json({ error: 'Failed to fetch allocations' }, { status: 500 })
    }

    if (allocations.length !== allocation_ids.length) {
      return NextResponse.json({ 
        error: 'Some allocation IDs are invalid or do not belong to this auction' 
      }, { status: 400 })
    }

    const results = []
    const errors = []

    // Process each allocation based on the action
    for (const allocation of allocations) {
      try {
        switch (action) {
          case 'confirm_payment':
            if (allocation.settlement_status !== 'pending_payment') {
              errors.push({
                allocation_id: allocation.id,
                error: `Allocation is not in pending_payment status (current: ${allocation.settlement_status})`
              })
              continue
            }

            // Call the database function to confirm payment
            const { error: confirmError } = await supabase.rpc('confirm_allocation_payment', {
              p_allocation_id: allocation.id,
              p_payment_reference: payment_reference || null,
              p_notes: notes || null
            })

            if (confirmError) {
              errors.push({
                allocation_id: allocation.id,
                error: confirmError.message
              })
            } else {
              results.push({
                allocation_id: allocation.id,
                action: 'payment_confirmed',
                bidder_email: allocation.bidder_email,
                amount: allocation.total_amount
              })
            }
            break

          case 'transfer_shares':
            if (allocation.settlement_status !== 'payment_received') {
              errors.push({
                allocation_id: allocation.id,
                error: `Allocation is not in payment_received status (current: ${allocation.settlement_status})`
              })
              continue
            }

            // Call the database function to transfer shares
            const { error: transferError } = await supabase.rpc('transfer_allocation_shares_to_cap_table', {
              p_allocation_id: allocation.id
            })

            if (transferError) {
              errors.push({
                allocation_id: allocation.id,
                error: transferError.message
              })
            } else {
              results.push({
                allocation_id: allocation.id,
                action: 'shares_transferred',
                bidder_email: allocation.bidder_email,
                shares: allocation.allocated_quantity
              })
            }
            break

          case 'complete_settlement':
            if (allocation.settlement_status !== 'shares_transferred') {
              errors.push({
                allocation_id: allocation.id,
                error: `Allocation is not in shares_transferred status (current: ${allocation.settlement_status})`
              })
              continue
            }

            // Call the database function to complete settlement
            const { error: completeError } = await supabase.rpc('complete_allocation_settlement', {
              p_allocation_id: allocation.id
            })

            if (completeError) {
              errors.push({
                allocation_id: allocation.id,
                error: completeError.message
              })
            } else {
              results.push({
                allocation_id: allocation.id,
                action: 'settlement_completed',
                bidder_email: allocation.bidder_email
              })
            }
            break

          case 'auto_process':
            // Automatically advance allocation to the next appropriate status
            let nextAction = null
            if (allocation.settlement_status === 'pending_payment') {
              nextAction = 'confirm_payment'
            } else if (allocation.settlement_status === 'payment_received') {
              nextAction = 'transfer_shares'
            } else if (allocation.settlement_status === 'shares_transferred') {
              nextAction = 'complete_settlement'
            }

            if (!nextAction) {
              errors.push({
                allocation_id: allocation.id,
                error: `No automatic action available for status: ${allocation.settlement_status}`
              })
              continue
            }

            // Recursively call the appropriate action
            // (This is a simplified version - in production, you might want to handle this differently)
            if (nextAction === 'confirm_payment') {
              const { error: confirmError } = await supabase.rpc('confirm_allocation_payment', {
                p_allocation_id: allocation.id,
                p_payment_reference: payment_reference || 'Auto-processed',
                p_notes: notes || 'Automatically processed'
              })
              if (confirmError) {
                errors.push({ allocation_id: allocation.id, error: confirmError.message })
              } else {
                results.push({
                  allocation_id: allocation.id,
                  action: 'payment_confirmed',
                  bidder_email: allocation.bidder_email
                })
              }
            }
            break

          default:
            errors.push({
              allocation_id: allocation.id,
              error: `Unknown action: ${action}`
            })
        }
      } catch (actionError) {
        console.error(`Error processing allocation ${allocation.id}:`, actionError)
        errors.push({
          allocation_id: allocation.id,
          error: actionError instanceof Error ? actionError.message : 'Unknown error'
        })
      }
    }

    // Return results
    const response = {
      success: errors.length === 0,
      processed_count: results.length,
      error_count: errors.length,
      results,
      errors: errors.length > 0 ? errors : undefined,
      summary: {
        action_performed: action,
        total_allocations: allocation_ids.length,
        successful_operations: results.length,
        failed_operations: errors.length
      }
    }

    return NextResponse.json(response, { 
      status: errors.length > 0 ? 207 : 200 // 207 Multi-Status for partial success
    })

  } catch (error) {
    console.error('Error in POST /api/companies/[id]/auctions/[auctionId]/settlement:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
