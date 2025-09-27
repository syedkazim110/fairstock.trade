import { createClient } from '@/lib/supabase/server'
import { calculateClearingPrice, validateBids, type Bid } from '@/lib/modified-dutch-auction'

/**
 * Automatic clearing scheduler for modified Dutch auctions
 * This function checks for auctions that have expired bid collection periods
 * and automatically triggers the clearing process
 */
export async function processExpiredAuctions() {
  const supabase = await createClient()
  
  try {
    console.log('🔍 Checking for expired auctions...')
    
    // Find auctions that are collecting bids and have expired
    const now = new Date().toISOString()
    const { data: expiredAuctions, error: auctionsError } = await supabase
      .from('company_auctions')
      .select('*')
      .eq('status', 'collecting_bids')
      .eq('auction_mode', 'modified_dutch')
      .lt('bid_collection_end_time', now)

    if (auctionsError) {
      console.error('❌ Error fetching expired auctions:', auctionsError)
      return { success: false, error: auctionsError.message }
    }

    if (!expiredAuctions || expiredAuctions.length === 0) {
      console.log('✅ No expired auctions found')
      return { success: true, processed: 0, results: [] }
    }

    console.log(`📋 Found ${expiredAuctions.length} expired auction(s)`)
    
    const results = []
    
    for (const auction of expiredAuctions) {
      try {
        console.log(`🎯 Processing auction: ${auction.title} (${auction.id})`)
        
        // Check if clearing has already been calculated
        const { data: existingResults } = await supabase
          .from('auction_clearing_results')
          .select('id')
          .eq('auction_id', auction.id)
          .single()

        if (existingResults) {
          console.log(`⏭️  Skipping auction ${auction.id} - already cleared`)
          results.push({
            auction_id: auction.id,
            title: auction.title,
            status: 'skipped',
            reason: 'Already cleared'
          })
          continue
        }

        // Get all active bids for this auction
        const { data: bidsData, error: bidsError } = await supabase
          .from('auction_bids')
          .select('*')
          .eq('auction_id', auction.id)
          .eq('bid_status', 'active')
          .order('max_price', { ascending: false })

        if (bidsError) {
          console.error(`❌ Error fetching bids for auction ${auction.id}:`, bidsError)
          results.push({
            auction_id: auction.id,
            title: auction.title,
            status: 'error',
            reason: `Failed to fetch bids: ${bidsError.message}`
          })
          continue
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

        console.log(`📊 Processing ${bids.length} bids for auction ${auction.id}`)

        // Validate bids before processing
        const validation = validateBids(bids)
        if (!validation.isValid) {
          console.error(`❌ Bid validation failed for auction ${auction.id}:`, validation.errors)
          results.push({
            auction_id: auction.id,
            title: auction.title,
            status: 'error',
            reason: `Invalid bid data: ${validation.errors.join(', ')}`
          })
          continue
        }

        // Calculate clearing price and allocations
        const clearingResult = calculateClearingPrice(bids, auction.shares_count)
        console.log(`💰 Calculated clearing price: $${clearingResult.clearing_price}`)

        // Save clearing results to database
        const { data: clearingResultRecord, error: clearingError } = await supabase
          .from('auction_clearing_results')
          .insert({
            auction_id: auction.id,
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
          console.error(`❌ Error saving clearing results for auction ${auction.id}:`, clearingError)
          results.push({
            auction_id: auction.id,
            title: auction.title,
            status: 'error',
            reason: `Failed to save clearing results: ${clearingError.message}`
          })
          continue
        }

        // Save individual bid allocations
        const allocationsToInsert = clearingResult.allocations.map(allocation => ({
          auction_id: auction.id,
          bidder_id: allocation.bidder_id,
          bidder_email: allocation.bidder_email,
          original_quantity: allocation.original_quantity,
          allocated_quantity: allocation.allocated_quantity,
          clearing_price: allocation.clearing_price,
          total_amount: allocation.total_amount,
          allocation_type: allocation.allocation_type,
          pro_rata_percentage: allocation.pro_rata_percentage
        }))

        const { error: allocationsError } = await supabase
          .from('bid_allocations')
          .insert(allocationsToInsert)

        if (allocationsError) {
          console.error(`❌ Error saving bid allocations for auction ${auction.id}:`, allocationsError)
          // Try to rollback clearing results
          await supabase
            .from('auction_clearing_results')
            .delete()
            .eq('id', clearingResultRecord.id)
          
          results.push({
            auction_id: auction.id,
            title: auction.title,
            status: 'error',
            reason: `Failed to save bid allocations: ${allocationsError.message}`
          })
          continue
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
          .eq('id', auction.id)

        if (updateError) {
          console.error(`❌ Error updating auction status for ${auction.id}:`, updateError)
          results.push({
            auction_id: auction.id,
            title: auction.title,
            status: 'error',
            reason: `Failed to update auction status: ${updateError.message}`
          })
          continue
        }

        // Calculate total revenue for successful bidders
        const totalRevenue = clearingResult.allocations
          .filter(a => a.allocated_quantity > 0)
          .reduce((sum, a) => sum + a.total_amount, 0)

        console.log(`✅ Successfully processed auction ${auction.id}`)
        console.log(`   - Clearing price: $${clearingResult.clearing_price}`)
        console.log(`   - Total revenue: $${totalRevenue}`)
        console.log(`   - Successful bidders: ${clearingResult.allocations.filter(a => a.allocated_quantity > 0).length}`)

        results.push({
          auction_id: auction.id,
          title: auction.title,
          status: 'success',
          clearing_price: clearingResult.clearing_price,
          total_revenue: totalRevenue,
          successful_bidders: clearingResult.allocations.filter(a => a.allocated_quantity > 0).length,
          rejected_bidders: clearingResult.allocations.filter(a => a.allocated_quantity === 0).length
        })

      } catch (error) {
        console.error(`❌ Unexpected error processing auction ${auction.id}:`, error)
        results.push({
          auction_id: auction.id,
          title: auction.title,
          status: 'error',
          reason: `Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`
        })
      }
    }

    const successCount = results.filter(r => r.status === 'success').length
    const errorCount = results.filter(r => r.status === 'error').length
    const skippedCount = results.filter(r => r.status === 'skipped').length

    console.log(`🎉 Clearing process completed:`)
    console.log(`   - Successful: ${successCount}`)
    console.log(`   - Errors: ${errorCount}`)
    console.log(`   - Skipped: ${skippedCount}`)

    return {
      success: true,
      processed: expiredAuctions.length,
      successful: successCount,
      errors: errorCount,
      skipped: skippedCount,
      results
    }

  } catch (error) {
    console.error('❌ Fatal error in processExpiredAuctions:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Check if an auction is ready for clearing
 */
export function isAuctionReadyForClearing(auction: any): boolean {
  if (auction.auction_mode !== 'modified_dutch') return false
  if (auction.status !== 'collecting_bids') return false
  if (!auction.bid_collection_end_time) return false
  
  const now = new Date()
  const endTime = new Date(auction.bid_collection_end_time)
  return now >= endTime
}

/**
 * Get time remaining until clearing for an auction
 */
export function getTimeUntilClearing(auction: any): number | null {
  if (!auction.bid_collection_end_time) return null
  
  const now = new Date()
  const endTime = new Date(auction.bid_collection_end_time)
  return endTime.getTime() - now.getTime()
}

/**
 * Format time remaining in a human-readable format
 */
export function formatTimeRemaining(milliseconds: number): string {
  if (milliseconds <= 0) return 'Expired'
  
  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  
  if (days > 0) return `${days}d ${hours % 24}h`
  if (hours > 0) return `${hours}h ${minutes % 60}m`
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`
  return `${seconds}s`
}
