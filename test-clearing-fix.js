// Test script to verify the modified Dutch auction clearing fix
// This script tests the clearing algorithm and data structures

const { calculateClearingPrice, validateBids } = require('./src/lib/modified-dutch-auction.ts')

// Test data that mimics real auction bids
const testBids = [
  {
    id: 'bid-1',
    bidder_id: 'user-1',
    bidder_email: 'bidder1@example.com',
    quantity: 500,
    max_price: 120,
    bid_time: new Date('2024-01-01T10:00:00Z')
  },
  {
    id: 'bid-2', 
    bidder_id: 'user-2',
    bidder_email: 'bidder2@example.com',
    quantity: 200,
    max_price: 140,
    bid_time: new Date('2024-01-01T10:01:00Z')
  },
  {
    id: 'bid-3',
    bidder_id: 'user-3', 
    bidder_email: 'bidder3@example.com',
    quantity: 300,
    max_price: 100,
    bid_time: new Date('2024-01-01T10:02:00Z')
  },
  {
    id: 'bid-4',
    bidder_id: 'user-4',
    bidder_email: 'bidder4@example.com', 
    quantity: 400,
    max_price: 130,
    bid_time: new Date('2024-01-01T10:03:00Z')
  }
]

console.log('🧪 Testing Modified Dutch Auction Clearing Fix')
console.log('=' .repeat(50))

// Test 1: Validate bids
console.log('\n📋 Test 1: Bid Validation')
const validation = validateBids(testBids)
console.log('Validation result:', validation.isValid ? '✅ PASSED' : '❌ FAILED')
if (!validation.isValid) {
  console.log('Validation errors:', validation.errors)
}

// Test 2: Calculate clearing price
console.log('\n💰 Test 2: Clearing Price Calculation')
const totalSupply = 1000
const clearingResult = calculateClearingPrice(testBids, totalSupply)

console.log('Clearing Price:', clearingResult.clearing_price)
console.log('Total Demand:', clearingResult.total_demand)
console.log('Shares Allocated:', clearingResult.shares_allocated)
console.log('Pro-rata Applied:', clearingResult.pro_rata_applied)

// Test 3: Check allocation data structure (this was the main issue)
console.log('\n🔍 Test 3: Allocation Data Structure')
console.log('Number of allocations:', clearingResult.allocations.length)

clearingResult.allocations.forEach((allocation, index) => {
  console.log(`\nAllocation ${index + 1}:`)
  console.log('  bid_id:', allocation.bid_id) // This field was missing before
  console.log('  bidder_id:', allocation.bidder_id)
  console.log('  bidder_email:', allocation.bidder_email)
  console.log('  original_quantity:', allocation.original_quantity)
  console.log('  allocated_quantity:', allocation.allocated_quantity)
  console.log('  clearing_price:', allocation.clearing_price)
  console.log('  total_amount:', allocation.total_amount)
  console.log('  allocation_type:', allocation.allocation_type)
  console.log('  pro_rata_percentage:', allocation.pro_rata_percentage)
})

// Test 4: Simulate database insert structure
console.log('\n🗄️  Test 4: Database Insert Structure')
const allocationsToInsert = clearingResult.allocations.map(allocation => ({
  auction_id: 'test-auction-id',
  bid_id: allocation.bid_id, // Critical field that was missing
  bidder_id: allocation.bidder_id,
  bidder_email: allocation.bidder_email,
  original_quantity: allocation.original_quantity,
  allocated_quantity: allocation.allocated_quantity,
  clearing_price: allocation.clearing_price,
  total_amount: allocation.total_amount,
  allocation_type: allocation.allocation_type,
  pro_rata_percentage: allocation.pro_rata_percentage || null
}))

console.log('Database insert structure:')
console.log(JSON.stringify(allocationsToInsert[0], null, 2))

// Test 5: Summary
console.log('\n📊 Test 5: Summary')
const successfulBidders = clearingResult.allocations.filter(a => a.allocated_quantity > 0)
const rejectedBidders = clearingResult.allocations.filter(a => a.allocated_quantity === 0)
const totalRevenue = successfulBidders.reduce((sum, a) => sum + a.total_amount, 0)

console.log('Total Bidders:', clearingResult.allocations.length)
console.log('Successful Bidders:', successfulBidders.length)
console.log('Rejected Bidders:', rejectedBidders.length)
console.log('Total Revenue:', totalRevenue)

console.log('\n✅ All tests completed!')
console.log('The clearing algorithm should now work with the fixed database schema.')
