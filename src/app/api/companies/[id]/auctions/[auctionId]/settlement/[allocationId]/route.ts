import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { settlementNotificationService } from '@/lib/email/settlementNotificationService'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; auctionId: string; allocationId: string }> }
) {
  try {
    const { id, auctionId, allocationId } = await params
    const supabase = await createClient()
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get allocation details with settlement information
    const { data: allocation, error: allocationError } = await supabase
      .from('auction_settlement_dashboard')
      .select('*')
      .eq('allocation_id', allocationId)
      .eq('auction_id', auctionId)
      .single()

    if (allocationError || !allocation) {
      return NextResponse.json({ error: 'Allocation not found' }, { status: 404 })
    }

    // Verify user has access (company owner or the bidder themselves)
    const isCompanyOwner = await supabase
      .from('companies')
      .select('id')
      .eq('id', id)
      .eq('created_by', user.id)
      .single()

    const isBidder = allocation.bidder_id === user.id

    if (!isCompanyOwner.data && !isBidder) {
      return NextResponse.json({ 
        error: 'Access denied. Only company owners and bidders can view allocation details.' 
      }, { status: 403 })
    }

    // Get related transaction if shares have been transferred
    let relatedTransaction = null
    if (allocation.settlement_status === 'shares_transferred' || allocation.settlement_status === 'completed') {
      const { data: transaction } = await supabase
        .from('company_transactions')
        .select('*')
        .eq('bid_allocation_id', allocationId)
        .eq('transaction_type', 'share_issuance')
        .single()
      
      relatedTransaction = transaction
    }

    // Calculate settlement timeline
    const timeline = []
    
    if (allocation.settlement_date) {
      timeline.push({
        status: 'settlement_initiated',
        timestamp: allocation.settlement_date,
        description: 'Settlement process initiated'
      })
    }

    if (allocation.payment_confirmation_date) {
      timeline.push({
        status: 'payment_confirmed',
        timestamp: allocation.payment_confirmation_date,
        description: 'Payment confirmed by company admin',
        reference: allocation.payment_reference
      })
    }

    if (allocation.share_transfer_date) {
      timeline.push({
        status: 'shares_transferred',
        timestamp: allocation.share_transfer_date,
        description: 'Shares transferred to cap table'
      })
    }

    if (allocation.settlement_status === 'completed') {
      timeline.push({
        status: 'settlement_completed',
        timestamp: allocation.settlement_updated_at,
        description: 'Settlement process completed'
      })
    }

    // Calculate next steps
    const nextSteps = []
    if (isCompanyOwner.data) {
      switch (allocation.settlement_status) {
        case 'pending_payment':
          nextSteps.push({
            action: 'confirm_payment',
            description: 'Confirm that payment has been received',
            required: true
          })
          break
        case 'payment_received':
          nextSteps.push({
            action: 'transfer_shares',
            description: 'Transfer shares to cap table',
            required: true,
            automatic: true
          })
          break
        case 'shares_transferred':
          nextSteps.push({
            action: 'complete_settlement',
            description: 'Mark settlement as completed',
            required: true
          })
          break
      }
    }

    return NextResponse.json({
      success: true,
      allocation: {
        id: allocation.allocation_id,
        auction_id: allocation.auction_id,
        auction_title: allocation.auction_title,
        bidder_id: allocation.bidder_id,
        bidder_email: allocation.bidder_email,
        allocated_quantity: allocation.allocated_quantity,
        clearing_price: allocation.clearing_price,
        total_amount: allocation.total_amount,
        settlement_status: allocation.settlement_status,
        settlement_progress_percentage: allocation.settlement_progress_percentage,
        payment_reference: allocation.payment_reference,
        settlement_notes: allocation.settlement_notes,
        days_since_settlement_started: allocation.days_since_settlement_started
      },
      settlement_timeline: timeline,
      next_steps: nextSteps,
      related_transaction: relatedTransaction,
      user_role: isCompanyOwner.data ? 'company_owner' : 'bidder',
      actions_available: {
        can_confirm_payment: isCompanyOwner.data && allocation.settlement_status === 'pending_payment',
        can_transfer_shares: isCompanyOwner.data && allocation.settlement_status === 'payment_received',
        can_complete_settlement: isCompanyOwner.data && allocation.settlement_status === 'shares_transferred',
        can_view_details: true,
        can_add_notes: isCompanyOwner.data
      }
    })

  } catch (error) {
    console.error('Error in GET /api/companies/[id]/auctions/[auctionId]/settlement/[allocationId]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; auctionId: string; allocationId: string }> }
) {
  try {
    const { id, auctionId, allocationId } = await params
    const supabase = await createClient()
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { action, payment_reference, notes } = body

    // Validate required fields
    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 })
    }

    // Verify user owns the company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, created_by')
      .eq('id', id)
      .single()

    if (companyError || !company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    if (company.created_by !== user.id) {
      return NextResponse.json({ 
        error: 'Only company owners can perform settlement actions' 
      }, { status: 403 })
    }

    // Verify allocation exists and belongs to the auction
    const { data: allocation, error: allocationError } = await supabase
      .from('bid_allocations')
      .select('id, settlement_status, bidder_email, allocated_quantity, total_amount')
      .eq('id', allocationId)
      .eq('auction_id', auctionId)
      .single()

    if (allocationError || !allocation) {
      return NextResponse.json({ error: 'Allocation not found' }, { status: 404 })
    }

    let result = null
    let error = null

    try {
      switch (action) {
        case 'confirm_payment':
          if (allocation.settlement_status !== 'pending_payment') {
            return NextResponse.json({ 
              error: `Cannot confirm payment. Allocation is in ${allocation.settlement_status} status` 
            }, { status: 400 })
          }

          // Call the database function to confirm payment
          const { error: confirmError } = await supabase.rpc('confirm_allocation_payment', {
            p_allocation_id: allocationId,
            p_payment_reference: payment_reference || null,
            p_notes: notes || null
          })

          if (confirmError) {
            throw new Error(confirmError.message)
          }

          result = {
            action: 'payment_confirmed',
            allocation_id: allocationId,
            bidder_email: allocation.bidder_email,
            amount: allocation.total_amount,
            payment_reference: payment_reference,
            message: 'Payment confirmed successfully'
          }

          // Send payment confirmation notification
          try {
            const notificationResult = await settlementNotificationService.sendStatusChangeNotifications(
              allocationId, 
              'payment_received'
            )
            if (!notificationResult.success) {
              console.warn('Failed to send payment confirmation notification:', notificationResult.error)
            }
          } catch (notificationError) {
            console.error('Error sending payment confirmation notification:', notificationError)
          }
          break

        case 'transfer_shares':
          if (allocation.settlement_status !== 'payment_received') {
            return NextResponse.json({ 
              error: `Cannot transfer shares. Allocation is in ${allocation.settlement_status} status` 
            }, { status: 400 })
          }

          // Call the database function to transfer shares
          const { error: transferError } = await supabase.rpc('transfer_allocation_shares_to_cap_table', {
            p_allocation_id: allocationId
          })

          if (transferError) {
            throw new Error(transferError.message)
          }

          result = {
            action: 'shares_transferred',
            allocation_id: allocationId,
            bidder_email: allocation.bidder_email,
            shares: allocation.allocated_quantity,
            message: 'Shares transferred to cap table successfully'
          }
          break

        case 'complete_settlement':
          if (allocation.settlement_status !== 'shares_transferred') {
            return NextResponse.json({ 
              error: `Cannot complete settlement. Allocation is in ${allocation.settlement_status} status` 
            }, { status: 400 })
          }

          // Call the database function to complete settlement
          const { error: completeError } = await supabase.rpc('complete_allocation_settlement', {
            p_allocation_id: allocationId
          })

          if (completeError) {
            throw new Error(completeError.message)
          }

          result = {
            action: 'settlement_completed',
            allocation_id: allocationId,
            bidder_email: allocation.bidder_email,
            message: 'Settlement completed successfully'
          }

          // Send settlement completion notification
          try {
            const notificationResult = await settlementNotificationService.sendStatusChangeNotifications(
              allocationId, 
              'completed'
            )
            if (!notificationResult.success) {
              console.warn('Failed to send settlement completion notification:', notificationResult.error)
            }
          } catch (notificationError) {
            console.error('Error sending settlement completion notification:', notificationError)
          }
          break

        case 'add_notes':
          // Add notes to the allocation
          const { error: notesError } = await supabase
            .from('bid_allocations')
            .update({
              settlement_notes: notes,
              settlement_updated_at: new Date().toISOString()
            })
            .eq('id', allocationId)

          if (notesError) {
            throw new Error(notesError.message)
          }

          result = {
            action: 'notes_added',
            allocation_id: allocationId,
            notes: notes,
            message: 'Notes added successfully'
          }
          break

        default:
          return NextResponse.json({ 
            error: `Unknown action: ${action}` 
          }, { status: 400 })
      }

    } catch (actionError) {
      console.error(`Error performing action ${action}:`, actionError)
      error = actionError instanceof Error ? actionError.message : 'Unknown error occurred'
    }

    if (error) {
      return NextResponse.json({ 
        success: false,
        error: error,
        allocation_id: allocationId,
        action: action
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      result: result,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('Error in POST /api/companies/[id]/auctions/[auctionId]/settlement/[allocationId]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; auctionId: string; allocationId: string }> }
) {
  try {
    const { id, auctionId, allocationId } = await params
    const supabase = await createClient()
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { payment_reference, settlement_notes } = body

    // Verify user owns the company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, created_by')
      .eq('id', id)
      .single()

    if (companyError || !company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 })
    }

    if (company.created_by !== user.id) {
      return NextResponse.json({ 
        error: 'Only company owners can update settlement details' 
      }, { status: 403 })
    }

    // Verify allocation exists and belongs to the auction
    const { data: allocation, error: allocationError } = await supabase
      .from('bid_allocations')
      .select('id, settlement_status')
      .eq('id', allocationId)
      .eq('auction_id', auctionId)
      .single()

    if (allocationError || !allocation) {
      return NextResponse.json({ error: 'Allocation not found' }, { status: 404 })
    }

    // Build update object
    const updateData: any = {
      settlement_updated_at: new Date().toISOString()
    }

    if (payment_reference !== undefined) {
      updateData.payment_reference = payment_reference
    }

    if (settlement_notes !== undefined) {
      updateData.settlement_notes = settlement_notes
    }

    // Update the allocation
    const { error: updateError } = await supabase
      .from('bid_allocations')
      .update(updateData)
      .eq('id', allocationId)

    if (updateError) {
      console.error('Error updating allocation:', updateError)
      return NextResponse.json({ error: 'Failed to update allocation' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Settlement details updated successfully',
      allocation_id: allocationId,
      updated_fields: Object.keys(updateData).filter(key => key !== 'settlement_updated_at')
    })

  } catch (error) {
    console.error('Error in PATCH /api/companies/[id]/auctions/[auctionId]/settlement/[allocationId]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
