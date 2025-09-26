// Test script for Dutch Auction functionality
// Run with: node test-dutch-auction.js

const { calculateCurrentPrice, validateAuctionParams, generatePriceSchedule } = require('./src/lib/dutch-auction.ts');

console.log('🧪 Testing Dutch Auction Implementation\n');

// Test 1: Basic price calculation
console.log('Test 1: Basic Price Calculation');
const testAuction = {
  maxPrice: 100,
  minPrice: 50,
  durationHours: 2,
  decreasingMinutes: 15,
  startTime: new Date(Date.now() - 30 * 60 * 1000) // Started 30 minutes ago
};

try {
  const result = calculateCurrentPrice(testAuction);
  console.log('✅ Current price calculation:', result);
  console.log(`   Price: $${result.currentPrice}`);
  console.log(`   Step: ${result.currentStep}/${result.totalSteps}`);
  console.log(`   Time to next decrease: ${result.timeToNextDecrease} minutes\n`);
} catch (error) {
  console.log('❌ Price calculation failed:', error.message);
}

// Test 2: Validation
console.log('Test 2: Parameter Validation');
const validParams = {
  maxPrice: 100,
  minPrice: 50,
  durationHours: 24,
  decreasingMinutes: 15
};

const invalidParams = {
  maxPrice: 50,
  minPrice: 100, // Invalid: min > max
  durationHours: 1,
  decreasingMinutes: 120 // Invalid: interval > duration
};

console.log('Valid params:', validateAuctionParams(validParams));
console.log('Invalid params:', validateAuctionParams(invalidParams));
console.log();

// Test 3: Price schedule generation
console.log('Test 3: Price Schedule Generation');
const scheduleTest = {
  maxPrice: 100,
  minPrice: 80,
  durationHours: 1,
  decreasingMinutes: 15,
  startTime: new Date()
};

try {
  const schedule = generatePriceSchedule(scheduleTest);
  console.log('✅ Generated price schedule:');
  schedule.forEach(item => {
    console.log(`   Step ${item.step}: $${item.price} at ${item.timeFromStart} minutes`);
  });
} catch (error) {
  console.log('❌ Schedule generation failed:', error.message);
}

console.log('\n🎯 Dutch Auction Implementation Test Complete!');
console.log('\nNext steps:');
console.log('1. Run database migration: dutch-auction-schema-enhancement.sql');
console.log('2. Start the development server: npm run dev');
console.log('3. Navigate to /dashboard/auction to test the UI');
console.log('4. Create a test auction and verify functionality');
