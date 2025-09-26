// Modified Dutch Auction with Uniform Clearing Price Implementation
// This implements the algorithm described in the user's requirements

export interface Bid {
  id: string
  bidder_id: string
  bidder_email: string
  quantity: number
  max_price: number
  bid_time: Date
}

export interface ClearingResult {
  clearing_price: number
  total_demand: number
  shares_allocated: number
  shares_remaining: number
  pro_rata_applied: boolean
  allocations: BidAllocation[]
  calculation_details: CalculationDetails
}

export interface BidAllocation {
  bid_id: string
  bidder_id: string
  bidder_email: string
  original_quantity: number
  allocated_quantity: number
  clearing_price: number
  total_amount: number
  allocation_type: 'full' | 'pro_rata' | 'rejected'
  pro_rata_percentage?: number
}

export interface CalculationDetails {
  total_bids: number
  clearing_logic: 'full_allocation' | 'pro_rata_at_clearing_price' | 'undersubscribed'
  bid_steps: BidStep[]
  pro_rata_percentage?: number
}

export interface BidStep {
  step: number
  bid_id: string
  bidder_email: string
  max_price: number
  quantity: number
  running_demand_before: number
  running_demand_after: number
  is_clearing_price: boolean
}

/**
 * Calculate clearing price and allocations for a Modified Dutch Auction
 * 
 * Algorithm:
 * 1. Sort bids by price descending (highest first)
 * 2. Accumulate demand until total supply is reached
 * 3. The price where supply is met becomes the clearing price
 * 4. All winners pay the same clearing price
 * 5. Pro-rata allocation if oversubscribed at clearing price
 */
export function calculateClearingPrice(
  bids: Bid[],
  total_supply: number
): ClearingResult {
  // Validate inputs
  if (total_supply <= 0) {
    throw new Error('Total supply must be greater than 0')
  }

  if (bids.length === 0) {
    return {
      clearing_price: 0,
      total_demand: 0,
      shares_allocated: 0,
      shares_remaining: total_supply,
      pro_rata_applied: false,
      allocations: [],
      calculation_details: {
        total_bids: 0,
        clearing_logic: 'undersubscribed',
        bid_steps: []
      }
    }
  }

  // Step 1: Sort bids by price descending, then by time ascending (FIFO for same price)
  const sorted_bids = [...bids].sort((a, b) => {
    if (b.max_price !== a.max_price) {
      return b.max_price - a.max_price // Higher price first
    }
    return a.bid_time.getTime() - b.bid_time.getTime() // Earlier time first for same price
  })

  // Step 2: Accumulate demand and find clearing price
  let running_demand = 0
  let clearing_price = 0
  let clearing_bid_index = -1
  const bid_steps: BidStep[] = []

  for (let i = 0; i < sorted_bids.length; i++) {
    const bid = sorted_bids[i]
    const demand_before = running_demand
    running_demand += bid.quantity

    const step: BidStep = {
      step: i + 1,
      bid_id: bid.id,
      bidder_email: bid.bidder_email,
      max_price: bid.max_price,
      quantity: bid.quantity,
      running_demand_before: demand_before,
      running_demand_after: running_demand,
      is_clearing_price: false
    }

    // Check if we've reached or exceeded the supply
    if (running_demand >= total_supply) {
      clearing_price = bid.max_price
      clearing_bid_index = i
      step.is_clearing_price = true
      bid_steps.push(step)
      break
    }

    bid_steps.push(step)
  }

  // Step 3: Determine clearing logic
  let clearing_logic: CalculationDetails['clearing_logic']
  let pro_rata_applied = false
  let pro_rata_percentage: number | undefined

  if (clearing_bid_index === -1) {
    // Undersubscribed - not enough demand to meet supply
    clearing_logic = 'undersubscribed'
    // In undersubscribed case, all bids are accepted at their bid price
    // But for uniform pricing, we could use the lowest bid or reserve price
    clearing_price = sorted_bids[sorted_bids.length - 1]?.max_price || 0
  } else {
    const clearing_bid = sorted_bids[clearing_bid_index]
    const demand_before_clearing = running_demand - clearing_bid.quantity

    if (running_demand > total_supply && demand_before_clearing < total_supply) {
      // Pro-rata needed at clearing price
      clearing_logic = 'pro_rata_at_clearing_price'
      pro_rata_applied = true
      const shares_available_at_clearing = total_supply - demand_before_clearing
      pro_rata_percentage = shares_available_at_clearing / clearing_bid.quantity
    } else {
      // Full allocation possible
      clearing_logic = 'full_allocation'
    }
  }

  // Step 4: Calculate allocations
  const allocations: BidAllocation[] = []
  let shares_allocated = 0

  for (let i = 0; i < sorted_bids.length; i++) {
    const bid = sorted_bids[i]
    let allocated_quantity = 0
    let allocation_type: BidAllocation['allocation_type'] = 'rejected'
    let allocation_pro_rata_percentage: number | undefined

    if (bid.max_price > clearing_price) {
      // Full allocation for bids above clearing price
      allocated_quantity = Math.min(bid.quantity, total_supply - shares_allocated)
      allocation_type = 'full'
    } else if (bid.max_price === clearing_price) {
      if (pro_rata_applied && pro_rata_percentage !== undefined) {
        // Pro-rata allocation at clearing price
        allocated_quantity = Math.floor(bid.quantity * pro_rata_percentage)
        allocation_type = allocated_quantity > 0 ? 'pro_rata' : 'rejected'
        allocation_pro_rata_percentage = pro_rata_percentage
      } else {
        // Full allocation at clearing price (if shares available)
        allocated_quantity = Math.min(bid.quantity, total_supply - shares_allocated)
        allocation_type = allocated_quantity > 0 ? 'full' : 'rejected'
      }
    }
    // Bids below clearing price are automatically rejected (allocated_quantity = 0)

    const allocation: BidAllocation = {
      bid_id: bid.id,
      bidder_id: bid.bidder_id,
      bidder_email: bid.bidder_email,
      original_quantity: bid.quantity,
      allocated_quantity,
      clearing_price,
      total_amount: allocated_quantity * clearing_price,
      allocation_type,
      pro_rata_percentage: allocation_pro_rata_percentage
    }

    allocations.push(allocation)
    shares_allocated += allocated_quantity
  }

  return {
    clearing_price,
    total_demand: running_demand,
    shares_allocated,
    shares_remaining: total_supply - shares_allocated,
    pro_rata_applied,
    allocations,
    calculation_details: {
      total_bids: bids.length,
      clearing_logic,
      bid_steps,
      pro_rata_percentage
    }
  }
}

/**
 * Validate bid data before processing
 */
export function validateBids(bids: Bid[]): { isValid: boolean; errors: string[] } {
  const errors: string[] = []

  for (const bid of bids) {
    if (!bid.id || bid.id.trim() === '') {
      errors.push('Bid ID is required')
    }
    if (!bid.bidder_id || bid.bidder_id.trim() === '') {
      errors.push('Bidder ID is required')
    }
    if (!bid.bidder_email || bid.bidder_email.trim() === '') {
      errors.push('Bidder email is required')
    }
    if (bid.quantity <= 0) {
      errors.push(`Invalid quantity for bid ${bid.id}: must be greater than 0`)
    }
    if (bid.max_price <= 0) {
      errors.push(`Invalid max price for bid ${bid.id}: must be greater than 0`)
    }
    if (!bid.bid_time || isNaN(bid.bid_time.getTime())) {
      errors.push(`Invalid bid time for bid ${bid.id}`)
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Generate a summary report of the auction results
 */
export function generateAuctionSummary(result: ClearingResult, total_supply: number): string {
  const {
    clearing_price,
    total_demand,
    shares_allocated,
    shares_remaining,
    pro_rata_applied,
    allocations,
    calculation_details
  } = result

  const successful_bidders = allocations.filter(a => a.allocated_quantity > 0)
  const rejected_bidders = allocations.filter(a => a.allocated_quantity === 0)
  const total_revenue = successful_bidders.reduce((sum, a) => sum + a.total_amount, 0)

  let summary = `
=== MODIFIED DUTCH AUCTION RESULTS ===

📊 AUCTION OVERVIEW:
• Total Supply: ${total_supply.toLocaleString()} shares
• Total Demand: ${total_demand.toLocaleString()} shares
• Demand Ratio: ${((total_demand / total_supply) * 100).toFixed(1)}%
• Clearing Price: $${clearing_price.toFixed(2)}

📈 ALLOCATION RESULTS:
• Shares Allocated: ${shares_allocated.toLocaleString()} shares
• Shares Remaining: ${shares_remaining.toLocaleString()} shares
• Allocation Rate: ${((shares_allocated / total_supply) * 100).toFixed(1)}%
• Total Revenue: $${total_revenue.toLocaleString()}

👥 BIDDER STATISTICS:
• Total Bidders: ${calculation_details.total_bids}
• Successful Bidders: ${successful_bidders.length}
• Rejected Bidders: ${rejected_bidders.length}
• Pro-rata Applied: ${pro_rata_applied ? 'Yes' : 'No'}
${pro_rata_applied ? `• Pro-rata Percentage: ${((calculation_details.pro_rata_percentage || 0) * 100).toFixed(2)}%` : ''}

🔄 CLEARING LOGIC: ${calculation_details.clearing_logic.replace(/_/g, ' ').toUpperCase()}
`

  if (successful_bidders.length > 0) {
    summary += `
💰 SUCCESSFUL ALLOCATIONS:
${successful_bidders.map(a => 
  `• ${a.bidder_email}: ${a.allocated_quantity.toLocaleString()} shares @ $${clearing_price.toFixed(2)} = $${a.total_amount.toLocaleString()} ${a.allocation_type === 'pro_rata' ? '(Pro-rata)' : ''}`
).join('\n')}
`
  }

  if (rejected_bidders.length > 0) {
    summary += `
❌ REJECTED BIDS:
${rejected_bidders.map(a => 
  `• ${a.bidder_email}: ${a.original_quantity.toLocaleString()} shares (Below clearing price of $${clearing_price.toFixed(2)})`
).join('\n')}
`
  }

  return summary
}

/**
 * Example usage and test function
 */
export function runExampleAuction(): ClearingResult {
  // Example from the user's requirements
  const example_bids: Bid[] = [
    {
      id: 'bid-1',
      bidder_id: 'bidder-a',
      bidder_email: 'bidder.a@example.com',
      quantity: 500,
      max_price: 120,
      bid_time: new Date('2024-01-01T10:00:00Z')
    },
    {
      id: 'bid-2',
      bidder_id: 'bidder-b',
      bidder_email: 'bidder.b@example.com',
      quantity: 200,
      max_price: 140,
      bid_time: new Date('2024-01-01T10:01:00Z')
    },
    {
      id: 'bid-3',
      bidder_id: 'bidder-c',
      bidder_email: 'bidder.c@example.com',
      quantity: 300,
      max_price: 100,
      bid_time: new Date('2024-01-01T10:02:00Z')
    },
    {
      id: 'bid-4',
      bidder_id: 'bidder-d',
      bidder_email: 'bidder.d@example.com',
      quantity: 400,
      max_price: 130,
      bid_time: new Date('2024-01-01T10:03:00Z')
    }
  ]

  const total_supply = 1000
  return calculateClearingPrice(example_bids, total_supply)
}

/**
 * Utility function to format currency
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

/**
 * Utility function to format numbers with commas
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num)
}
