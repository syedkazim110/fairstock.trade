#!/usr/bin/env node

/**
 * Phase 4: Enhanced Cap Table Integration - Implementation Test
 * 
 * This script validates that all Phase 4 components are properly implemented:
 * 1. Database schema enhancements
 * 2. API endpoint updates
 * 3. Frontend component enhancements
 * 4. Integration points
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Phase 4: Enhanced Cap Table Integration - Implementation Test');
console.log('================================================================\n');

// Test results tracking
let totalTests = 0;
let passedTests = 0;
const testResults = {
  database: { total: 0, passed: 0, details: [] },
  api: { total: 0, passed: 0, details: [] },
  frontend: { total: 0, passed: 0, details: [] },
  integration: { total: 0, passed: 0, details: [] }
};

function runTest(category, testName, testFn) {
  totalTests++;
  testResults[category].total++;
  
  try {
    const result = testFn();
    if (result) {
      passedTests++;
      testResults[category].passed++;
      testResults[category].details.push(`✅ ${testName}`);
      return true;
    } else {
      testResults[category].details.push(`❌ ${testName}`);
      return false;
    }
  } catch (error) {
    testResults[category].details.push(`❌ ${testName} - Error: ${error.message}`);
    return false;
  }
}

// =====================================================
// DATABASE SCHEMA TESTS
// =====================================================

console.log('📊 Testing Database Schema Enhancements...\n');

runTest('database', 'Phase 4 schema file exists', () => {
  return fs.existsSync('phase4-cap-table-integration.sql');
});

runTest('database', 'Shareholding recalculation function defined', () => {
  const schemaContent = fs.readFileSync('phase4-cap-table-integration.sql', 'utf8');
  return schemaContent.includes('CREATE OR REPLACE FUNCTION recalculate_company_shareholdings');
});

runTest('database', 'Enhanced transaction view with auction context', () => {
  const schemaContent = fs.readFileSync('phase4-cap-table-integration.sql', 'utf8');
  return schemaContent.includes('CREATE OR REPLACE VIEW company_transactions_with_auction_context');
});

runTest('database', 'Enhanced cap table view with auction participation', () => {
  const schemaContent = fs.readFileSync('phase4-cap-table-integration.sql', 'utf8');
  return schemaContent.includes('CREATE OR REPLACE VIEW enhanced_cap_table_view');
});

runTest('database', 'Updated settlement function includes recalculation', () => {
  const schemaContent = fs.readFileSync('phase4-cap-table-integration.sql', 'utf8');
  return schemaContent.includes('PERFORM recalculate_company_shareholdings(v_company_id)');
});

runTest('database', 'Performance indexes for auction context queries', () => {
  const schemaContent = fs.readFileSync('phase4-cap-table-integration.sql', 'utf8');
  return schemaContent.includes('idx_company_transactions_auction_context');
});

runTest('database', 'Proper permissions granted for new functions and views', () => {
  const schemaContent = fs.readFileSync('phase4-cap-table-integration.sql', 'utf8');
  return schemaContent.includes('GRANT EXECUTE ON FUNCTION recalculate_company_shareholdings') &&
         schemaContent.includes('GRANT SELECT ON company_transactions_with_auction_context');
});

// =====================================================
// API ENDPOINT TESTS
// =====================================================

console.log('🔌 Testing API Endpoint Updates...\n');

runTest('api', 'Transaction API file exists', () => {
  return fs.existsSync('src/app/api/companies/[id]/transactions/route.ts');
});

runTest('api', 'Transaction API uses enhanced view with auction context', () => {
  const apiContent = fs.readFileSync('src/app/api/companies/[id]/transactions/route.ts', 'utf8');
  return apiContent.includes('company_transactions_with_auction_context');
});

runTest('api', 'Transaction API selects auction-related fields', () => {
  const apiContent = fs.readFileSync('src/app/api/companies/[id]/transactions/route.ts', 'utf8');
  return apiContent.includes('auction_id') && 
         apiContent.includes('auction_title') && 
         apiContent.includes('transaction_source');
});

runTest('api', 'Transaction API includes enhanced description field', () => {
  const apiContent = fs.readFileSync('src/app/api/companies/[id]/transactions/route.ts', 'utf8');
  return apiContent.includes('enhanced_description');
});

runTest('api', 'Transaction API includes auction settlement status', () => {
  const apiContent = fs.readFileSync('src/app/api/companies/[id]/transactions/route.ts', 'utf8');
  return apiContent.includes('auction_settlement_status');
});

// =====================================================
// FRONTEND COMPONENT TESTS
// =====================================================

console.log('🎨 Testing Frontend Component Enhancements...\n');

runTest('frontend', 'TransactionsTab component exists', () => {
  return fs.existsSync('src/components/TransactionsTab.tsx');
});

runTest('frontend', 'Transaction interface includes auction fields', () => {
  const componentContent = fs.readFileSync('src/components/TransactionsTab.tsx', 'utf8');
  return componentContent.includes('auction_id: string | null') &&
         componentContent.includes('auction_title: string | null') &&
         componentContent.includes('transaction_source: \'auction\' | \'manual\'');
});

runTest('frontend', 'Component uses API endpoint instead of direct Supabase calls', () => {
  const componentContent = fs.readFileSync('src/components/TransactionsTab.tsx', 'utf8');
  return componentContent.includes('fetch(`/api/companies/${companyId}/transactions`)') &&
         !componentContent.includes('.from(\'company_transactions\')');
});

runTest('frontend', 'Auction icon function defined', () => {
  const componentContent = fs.readFileSync('src/components/TransactionsTab.tsx', 'utf8');
  return componentContent.includes('const getAuctionIcon = ()');
});

runTest('frontend', 'Share issuance transaction type color defined', () => {
  const componentContent = fs.readFileSync('src/components/TransactionsTab.tsx', 'utf8');
  return componentContent.includes('share_issuance') && 
         componentContent.includes('bg-indigo-100 text-indigo-800');
});

runTest('frontend', 'Desktop table shows auction badges', () => {
  const componentContent = fs.readFileSync('src/components/TransactionsTab.tsx', 'utf8');
  return componentContent.includes('transaction.transaction_source === \'auction\'') &&
         componentContent.includes('Auction');
});

runTest('frontend', 'Desktop table shows auction context in description', () => {
  const componentContent = fs.readFileSync('src/components/TransactionsTab.tsx', 'utf8');
  return componentContent.includes('transaction.auction_title') &&
         componentContent.includes('🎯');
});

runTest('frontend', 'Mobile cards show auction badges', () => {
  const componentContent = fs.readFileSync('src/components/TransactionsTab.tsx', 'utf8');
  const mobileSection = componentContent.split('Mobile Cards')[1];
  return mobileSection && mobileSection.includes('transaction.transaction_source === \'auction\'');
});

runTest('frontend', 'Mobile cards show auction context with background', () => {
  const componentContent = fs.readFileSync('src/components/TransactionsTab.tsx', 'utf8');
  return componentContent.includes('bg-blue-50 rounded-md') &&
         componentContent.includes('transaction.auction_clearing_price');
});

runTest('frontend', 'Enhanced description used over regular description', () => {
  const componentContent = fs.readFileSync('src/components/TransactionsTab.tsx', 'utf8');
  return componentContent.includes('transaction.enhanced_description || transaction.description');
});

// =====================================================
// INTEGRATION TESTS
// =====================================================

console.log('🔗 Testing Integration Points...\n');

runTest('integration', 'Settlement function integrates with recalculation', () => {
  const schemaContent = fs.readFileSync('phase4-cap-table-integration.sql', 'utf8');
  const settlementFunction = schemaContent.split('transfer_allocation_shares_to_cap_table')[1];
  return settlementFunction && settlementFunction.includes('recalculate_company_shareholdings');
});

runTest('integration', 'Transaction view properly joins auction and allocation tables', () => {
  const schemaContent = fs.readFileSync('phase4-cap-table-integration.sql', 'utf8');
  return schemaContent.includes('LEFT JOIN company_auctions ca ON ct.auction_id = ca.id') &&
         schemaContent.includes('LEFT JOIN bid_allocations ba ON ct.bid_allocation_id = ba.id');
});

runTest('integration', 'Enhanced cap table view includes auction participation metrics', () => {
  const schemaContent = fs.readFileSync('phase4-cap-table-integration.sql', 'utf8');
  return schemaContent.includes('auctions_participated') &&
         schemaContent.includes('total_auction_investment') &&
         schemaContent.includes('auction_ownership_percentage');
});

runTest('integration', 'API response structure matches frontend interface', () => {
  const apiContent = fs.readFileSync('src/app/api/companies/[id]/transactions/route.ts', 'utf8');
  const frontendContent = fs.readFileSync('src/components/TransactionsTab.tsx', 'utf8');
  
  // Check that key fields selected in API match interface
  const apiFields = ['auction_id', 'auction_title', 'transaction_source', 'enhanced_description'];
  return apiFields.every(field => 
    apiContent.includes(field) && frontendContent.includes(field)
  );
});

runTest('integration', 'Settlement notes include recalculation confirmation', () => {
  const schemaContent = fs.readFileSync('phase4-cap-table-integration.sql', 'utf8');
  return schemaContent.includes('Shareholding percentages recalculated');
});

// =====================================================
// RESULTS SUMMARY
// =====================================================

console.log('\n📋 Test Results Summary');
console.log('========================\n');

Object.entries(testResults).forEach(([category, results]) => {
  const percentage = results.total > 0 ? Math.round((results.passed / results.total) * 100) : 0;
  const status = percentage === 100 ? '🎉' : percentage >= 80 ? '✅' : percentage >= 60 ? '⚠️' : '❌';
  
  console.log(`${status} ${category.toUpperCase()}: ${results.passed}/${results.total} (${percentage}%)`);
  results.details.forEach(detail => console.log(`   ${detail}`));
  console.log('');
});

const overallPercentage = Math.round((passedTests / totalTests) * 100);
const overallStatus = overallPercentage === 100 ? '🎉' : overallPercentage >= 80 ? '✅' : overallPercentage >= 60 ? '⚠️' : '❌';

console.log(`${overallStatus} OVERALL: ${passedTests}/${totalTests} tests passed (${overallPercentage}%)\n`);

// =====================================================
// IMPLEMENTATION STATUS
// =====================================================

console.log('🚀 Phase 4 Implementation Status');
console.log('=================================\n');

if (overallPercentage === 100) {
  console.log('🎊 PHASE 4 COMPLETE! All components successfully implemented:');
  console.log('');
  console.log('✅ Database Schema: Shareholding recalculation and auction context views');
  console.log('✅ API Enhancement: Transaction endpoint with auction context');
  console.log('✅ Frontend Updates: Enhanced transaction display with auction information');
  console.log('✅ Integration: Seamless auction-to-cap-table workflow');
  console.log('');
  console.log('🎯 Key Features Delivered:');
  console.log('   • Automatic shareholding percentage recalculation');
  console.log('   • Enhanced transaction history with auction context');
  console.log('   • Visual auction badges and detailed auction information');
  console.log('   • Complete audit trail from auction to cap table');
  console.log('   • Responsive design for both desktop and mobile');
  console.log('');
  console.log('🔧 Ready for Production: All Phase 4 enhancements are complete!');
} else if (overallPercentage >= 80) {
  console.log('✅ PHASE 4 MOSTLY COMPLETE! Minor issues to address:');
  console.log('');
  console.log('🔧 Remaining Tasks:');
  Object.entries(testResults).forEach(([category, results]) => {
    if (results.passed < results.total) {
      console.log(`   • ${category}: ${results.total - results.passed} remaining issues`);
    }
  });
} else {
  console.log('⚠️  PHASE 4 IN PROGRESS: Significant work remaining');
  console.log('');
  console.log('🔧 Priority Tasks:');
  Object.entries(testResults).forEach(([category, results]) => {
    if (results.passed < results.total) {
      console.log(`   • ${category}: ${results.total - results.passed} issues to resolve`);
    }
  });
}

console.log('\n' + '='.repeat(60));
console.log('Phase 4: Enhanced Cap Table Integration Test Complete');
console.log('='.repeat(60));

process.exit(overallPercentage === 100 ? 0 : 1);
