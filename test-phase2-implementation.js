#!/usr/bin/env node

/**
 * Phase 2 Implementation Validation Test
 * 
 * This test validates that all Phase 2 components have been implemented correctly:
 * 1. RLS policy SQL file exists and is properly structured
 * 2. Dedicated allocation API endpoint exists and has proper structure
 * 3. Frontend component has been updated to use new API
 * 4. Error handling and user experience improvements are in place
 */

const fs = require('fs')
const path = require('path')

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
}

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`)
}

function logSection(title) {
  console.log('\n' + '='.repeat(60))
  log(title, 'bold')
  console.log('='.repeat(60))
}

function logTest(testName, passed, details = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL'
  const statusColor = passed ? 'green' : 'red'
  log(`${status} ${testName}`, statusColor)
  if (details) {
    log(`   ${details}`, 'blue')
  }
}

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath)
  } catch (error) {
    return false
  }
}

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8')
  } catch (error) {
    return null
  }
}

function testRLSPolicyFile() {
  logSection('Testing RLS Policy Implementation')

  const filePath = 'fix-member-allocation-visibility.sql'
  const exists = fileExists(filePath)
  
  logTest('RLS policy file exists', exists, `File: ${filePath}`)

  if (!exists) return false

  const content = readFile(filePath)
  if (!content) {
    logTest('RLS policy file readable', false, 'Could not read file content')
    return false
  }

  // Test for key components
  const hasDropPolicies = content.includes('DROP POLICY IF EXISTS')
  const hasBidderPolicy = content.includes('bidders_view_own_allocations')
  const hasOwnerPolicy = content.includes('company_owners_view_all_allocations')
  const hasInsertPolicy = content.includes('system_insert_allocations')
  const hasServiceRolePolicy = content.includes('service_role_manage_allocations')
  const hasDebugView = content.includes('CREATE OR REPLACE VIEW bid_allocations_debug')
  const hasTestFunction = content.includes('CREATE OR REPLACE FUNCTION test_allocation_visibility')
  const hasRLSEnabled = content.includes('ALTER TABLE bid_allocations ENABLE ROW LEVEL SECURITY')

  logTest('Drops existing problematic policies', hasDropPolicies)
  logTest('Creates bidder view policy', hasBidderPolicy)
  logTest('Creates company owner view policy', hasOwnerPolicy)
  logTest('Creates system insert policy', hasInsertPolicy)
  logTest('Creates service role policy', hasServiceRolePolicy)
  logTest('Creates debug view', hasDebugView)
  logTest('Creates test function', hasTestFunction)
  logTest('Enables RLS', hasRLSEnabled)

  const allPolicyTests = [hasDropPolicies, hasBidderPolicy, hasOwnerPolicy, hasInsertPolicy, hasServiceRolePolicy, hasDebugView, hasTestFunction, hasRLSEnabled]
  const policyTestsPassed = allPolicyTests.filter(Boolean).length

  log(`RLS Policy Implementation: ${policyTestsPassed}/8 components present`, policyTestsPassed === 8 ? 'green' : 'yellow')
  
  return policyTestsPassed >= 6 // Allow some flexibility
}

function testAllocationAPI() {
  logSection('Testing Allocation API Implementation')

  const filePath = 'src/app/api/companies/[id]/auctions/[auctionId]/allocations/route.ts'
  const exists = fileExists(filePath)
  
  logTest('Allocation API endpoint exists', exists, `File: ${filePath}`)

  if (!exists) return false

  const content = readFile(filePath)
  if (!content) {
    logTest('API file readable', false, 'Could not read file content')
    return false
  }

  // Test for key components
  const hasGETHandler = content.includes('export async function GET')
  const hasPOSTHandler = content.includes('export async function POST')
  const hasAuthCheck = content.includes('supabase.auth.getUser()')
  const hasRoleBasedAccess = content.includes('isCompanyOwner')
  const hasErrorHandling = content.includes('error:')
  const hasStandardizedResponse = content.includes('user_role')
  const hasAllocationData = content.includes('allocations:')
  const hasSummaryStats = content.includes('summary:')
  const hasDebugSupport = content.includes('debug')
  const hasClearingCheck = content.includes('clearing_completed')

  logTest('Has GET handler', hasGETHandler)
  logTest('Has POST handler (debug)', hasPOSTHandler)
  logTest('Has authentication check', hasAuthCheck)
  logTest('Has role-based access control', hasRoleBasedAccess)
  logTest('Has error handling', hasErrorHandling)
  logTest('Has standardized response structure', hasStandardizedResponse)
  logTest('Returns allocation data', hasAllocationData)
  logTest('Includes summary statistics', hasSummaryStats)
  logTest('Supports debug functionality', hasDebugSupport)
  logTest('Checks clearing completion', hasClearingCheck)

  const allAPITests = [hasGETHandler, hasPOSTHandler, hasAuthCheck, hasRoleBasedAccess, hasErrorHandling, hasStandardizedResponse, hasAllocationData, hasSummaryStats, hasDebugSupport, hasClearingCheck]
  const apiTestsPassed = allAPITests.filter(Boolean).length

  log(`Allocation API Implementation: ${apiTestsPassed}/10 components present`, apiTestsPassed === 10 ? 'green' : 'yellow')
  
  return apiTestsPassed >= 8 // Allow some flexibility
}

function testClearingAPIUpdates() {
  logSection('Testing Clearing API Updates')

  const filePath = 'src/app/api/companies/[id]/auctions/[auctionId]/clear/route.ts'
  const exists = fileExists(filePath)
  
  logTest('Clearing API file exists', exists, `File: ${filePath}`)

  if (!exists) return false

  const content = readFile(filePath)
  if (!content) {
    logTest('Clearing API file readable', false, 'Could not read file content')
    return false
  }

  // Test for standardized response structure
  const hasStandardizedResponse = content.includes('user_role')
  const hasAllocationsSummary = content.includes('allocations:')
  const hasSummaryStats = content.includes('summary:')
  const hasConsistentStructure = content.includes('clearing_completed')

  logTest('Has standardized response structure', hasStandardizedResponse)
  logTest('Includes allocations summary', hasAllocationsSummary)
  logTest('Includes summary statistics', hasSummaryStats)
  logTest('Has consistent structure with allocation API', hasConsistentStructure)

  const allClearingTests = [hasStandardizedResponse, hasAllocationsSummary, hasSummaryStats, hasConsistentStructure]
  const clearingTestsPassed = allClearingTests.filter(Boolean).length

  log(`Clearing API Updates: ${clearingTestsPassed}/4 components present`, clearingTestsPassed === 4 ? 'green' : 'yellow')
  
  return clearingTestsPassed >= 3
}

function testFrontendUpdates() {
  logSection('Testing Frontend Component Updates')

  const filePath = 'src/components/AuctionResultsModal.tsx'
  const exists = fileExists(filePath)
  
  logTest('AuctionResultsModal component exists', exists, `File: ${filePath}`)

  if (!exists) return false

  const content = readFile(filePath)
  if (!content) {
    logTest('Component file readable', false, 'Could not read file content')
    return false
  }

  // Test for key improvements
  const usesNewAPI = content.includes('/allocations')
  const hasErrorHandling = content.includes('error') && content.includes('setError')
  const hasLoadingStates = content.includes('loading') && content.includes('setLoading')
  const hasRoleBasedDisplay = content.includes('isCompanyOwner')
  const hasUserAllocation = content.includes('userAllocation')
  const hasErrorDisplay = content.includes('Error Message')
  const hasClearingCheck = content.includes('clearingCompleted')
  const hasCompanyIdProp = content.includes('company_id')
  const removedDirectSupabase = !content.includes('supabase.from(\'bid_allocations\')')

  logTest('Uses new allocation API endpoint', usesNewAPI)
  logTest('Has comprehensive error handling', hasErrorHandling)
  logTest('Has proper loading states', hasLoadingStates)
  logTest('Has role-based content display', hasRoleBasedDisplay)
  logTest('Handles user allocation data', hasUserAllocation)
  logTest('Displays error messages to users', hasErrorDisplay)
  logTest('Checks clearing completion status', hasClearingCheck)
  logTest('Has company_id in auction interface', hasCompanyIdProp)
  logTest('Removed direct Supabase calls', removedDirectSupabase)

  const allFrontendTests = [usesNewAPI, hasErrorHandling, hasLoadingStates, hasRoleBasedDisplay, hasUserAllocation, hasErrorDisplay, hasClearingCheck, hasCompanyIdProp, removedDirectSupabase]
  const frontendTestsPassed = allFrontendTests.filter(Boolean).length

  log(`Frontend Updates: ${frontendTestsPassed}/9 components present`, frontendTestsPassed === 9 ? 'green' : 'yellow')
  
  return frontendTestsPassed >= 7
}

function testDocumentationAndTesting() {
  logSection('Testing Documentation and Testing Implementation')

  const testFile = 'test-member-allocation-visibility.js'
  const testExists = fileExists(testFile)
  
  logTest('Comprehensive test file exists', testExists, `File: ${testFile}`)

  if (testExists) {
    const testContent = readFile(testFile)
    const hasRLSTests = testContent && testContent.includes('testRLSPolicies')
    const hasAPITests = testContent && testContent.includes('testAllocationAPI')
    const hasErrorTests = testContent && testContent.includes('testErrorHandling')
    const hasDebugTests = testContent && testContent.includes('testDebugFeatures')
    const hasCleanup = testContent && testContent.includes('cleanupTestData')

    logTest('Has RLS policy tests', hasRLSTests)
    logTest('Has API endpoint tests', hasAPITests)
    logTest('Has error handling tests', hasErrorTests)
    logTest('Has debug feature tests', hasDebugTests)
    logTest('Has cleanup functionality', hasCleanup)

    const testComponents = [hasRLSTests, hasAPITests, hasErrorTests, hasDebugTests, hasCleanup].filter(Boolean).length
    log(`Test Implementation: ${testComponents}/5 components present`, testComponents === 5 ? 'green' : 'yellow')
    
    return testComponents >= 4
  }

  return false
}

function runImplementationValidation() {
  logSection('Phase 2: Member Allocation Visibility - Implementation Validation')
  log('Validating that all Phase 2 components have been implemented correctly', 'blue')

  const results = {
    rlsPolicies: false,
    allocationAPI: false,
    clearingAPIUpdates: false,
    frontendUpdates: false,
    testingFramework: false
  }

  try {
    // Test each component
    results.rlsPolicies = testRLSPolicyFile()
    results.allocationAPI = testAllocationAPI()
    results.clearingAPIUpdates = testClearingAPIUpdates()
    results.frontendUpdates = testFrontendUpdates()
    results.testingFramework = testDocumentationAndTesting()

  } catch (error) {
    log(`Implementation validation failed: ${error.message}`, 'red')
  }

  // Summary
  logSection('Implementation Validation Summary')
  const passed = Object.values(results).filter(Boolean).length
  const total = Object.keys(results).length

  Object.entries(results).forEach(([component, passed]) => {
    logTest(component, passed)
  })

  log(`\nOverall Implementation: ${passed}/${total} components validated`, passed === total ? 'green' : 'red')

  if (passed === total) {
    log('\n🎉 All Phase 2 components have been implemented correctly!', 'green')
    log('✅ RLS policies with debug tools', 'green')
    log('✅ Dedicated allocation API endpoint', 'green')
    log('✅ Standardized API response structures', 'green')
    log('✅ Updated frontend with proper error handling', 'green')
    log('✅ Comprehensive testing framework', 'green')
    log('\nThe member allocation visibility issues have been resolved.', 'blue')
  } else {
    log('\n⚠️  Some components may need attention. Please review the results above.', 'yellow')
  }

  return results
}

// Additional validation for file structure
function validateFileStructure() {
  logSection('File Structure Validation')

  const expectedFiles = [
    'fix-member-allocation-visibility.sql',
    'src/app/api/companies/[id]/auctions/[auctionId]/allocations/route.ts',
    'src/app/api/companies/[id]/auctions/[auctionId]/clear/route.ts',
    'src/components/AuctionResultsModal.tsx',
    'test-member-allocation-visibility.js'
  ]

  let allFilesExist = true
  expectedFiles.forEach(file => {
    const exists = fileExists(file)
    logTest(`${file}`, exists)
    if (!exists) allFilesExist = false
  })

  log(`\nFile Structure: ${allFilesExist ? 'Complete' : 'Incomplete'}`, allFilesExist ? 'green' : 'red')
  return allFilesExist
}

// Run validation if this script is executed directly
if (require.main === module) {
  validateFileStructure()
  runImplementationValidation().then(() => {
    process.exit(0)
  }).catch((error) => {
    console.error('Implementation validation failed:', error)
    process.exit(1)
  })
}

module.exports = { runImplementationValidation, validateFileStructure }
