// Cap Table Session Performance Test
// Run this with: node test-cap-table-performance.js

const API_BASE_URL = 'http://localhost:3000/api';
const COMPANY_ID = '964a6f64-021b-45c0-ac3e-57cbadc54429'; // Replace with your test company ID

// Test configuration
const TEST_CONFIG = {
  warmupRequests: 5,
  testRequests: 20,
  concurrentRequests: 5,
  delayBetweenRequests: 100 // ms
};

class PerformanceTest {
  constructor() {
    this.results = {
      get: [],
      post: []
    };
  }

  async makeRequest(method, url, body = null) {
    const startTime = Date.now();
    
    try {
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          // Add your auth headers here if needed
          // 'Authorization': 'Bearer your-token'
        }
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      const response = await fetch(url, options);
      const endTime = Date.now();
      const duration = endTime - startTime;

      return {
        success: response.ok,
        status: response.status,
        duration,
        size: response.headers.get('content-length') || 0
      };
    } catch (error) {
      const endTime = Date.now();
      return {
        success: false,
        status: 0,
        duration: endTime - startTime,
        error: error.message
      };
    }
  }

  async testGetEndpoint() {
    console.log('\n🔍 Testing GET /cap-table-session endpoint...');
    
    const url = `${API_BASE_URL}/companies/${COMPANY_ID}/cap-table-session`;
    
    // Warmup requests
    console.log('Warming up...');
    for (let i = 0; i < TEST_CONFIG.warmupRequests; i++) {
      await this.makeRequest('GET', url);
      await this.delay(TEST_CONFIG.delayBetweenRequests);
    }

    // Test requests
    console.log('Running performance tests...');
    const promises = [];
    
    for (let i = 0; i < TEST_CONFIG.testRequests; i++) {
      promises.push(this.makeRequest('GET', url));
      
      if (promises.length >= TEST_CONFIG.concurrentRequests) {
        const results = await Promise.all(promises);
        this.results.get.push(...results);
        promises.length = 0;
        await this.delay(TEST_CONFIG.delayBetweenRequests);
      }
    }

    // Handle remaining requests
    if (promises.length > 0) {
      const results = await Promise.all(promises);
      this.results.get.push(...results);
    }
  }

  async testPostEndpoint() {
    console.log('\n📝 Testing POST /cap-table-session endpoint...');
    
    const url = `${API_BASE_URL}/companies/${COMPANY_ID}/cap-table-session`;
    
    // Test different actions
    const actions = ['start', 'complete', 'cancel'];
    
    for (const action of actions) {
      console.log(`Testing ${action} action...`);
      
      const body = { action };
      
      // Warmup
      for (let i = 0; i < 2; i++) {
        await this.makeRequest('POST', url, body);
        await this.delay(TEST_CONFIG.delayBetweenRequests);
      }

      // Test requests
      for (let i = 0; i < 5; i++) {
        const result = await this.makeRequest('POST', url, body);
        this.results.post.push({ ...result, action });
        await this.delay(TEST_CONFIG.delayBetweenRequests);
      }
    }
  }

  calculateStats(results) {
    if (results.length === 0) return null;

    const durations = results.map(r => r.duration);
    const successfulRequests = results.filter(r => r.success);
    
    durations.sort((a, b) => a - b);
    
    return {
      totalRequests: results.length,
      successfulRequests: successfulRequests.length,
      successRate: (successfulRequests.length / results.length * 100).toFixed(2),
      avgDuration: (durations.reduce((a, b) => a + b, 0) / durations.length).toFixed(2),
      minDuration: durations[0],
      maxDuration: durations[durations.length - 1],
      p50: durations[Math.floor(durations.length * 0.5)],
      p90: durations[Math.floor(durations.length * 0.9)],
      p95: durations[Math.floor(durations.length * 0.95)],
      p99: durations[Math.floor(durations.length * 0.99)]
    };
  }

  printResults() {
    console.log('\n📊 PERFORMANCE TEST RESULTS');
    console.log('=' .repeat(50));

    // GET endpoint results
    const getStats = this.calculateStats(this.results.get);
    if (getStats) {
      console.log('\n🔍 GET /cap-table-session:');
      console.log(`  Total Requests: ${getStats.totalRequests}`);
      console.log(`  Success Rate: ${getStats.successRate}%`);
      console.log(`  Average Duration: ${getStats.avgDuration}ms`);
      console.log(`  Min Duration: ${getStats.minDuration}ms`);
      console.log(`  Max Duration: ${getStats.maxDuration}ms`);
      console.log(`  P50 (Median): ${getStats.p50}ms`);
      console.log(`  P90: ${getStats.p90}ms`);
      console.log(`  P95: ${getStats.p95}ms`);
      console.log(`  P99: ${getStats.p99}ms`);
    }

    // POST endpoint results
    const postStats = this.calculateStats(this.results.post);
    if (postStats) {
      console.log('\n📝 POST /cap-table-session:');
      console.log(`  Total Requests: ${postStats.totalRequests}`);
      console.log(`  Success Rate: ${postStats.successRate}%`);
      console.log(`  Average Duration: ${postStats.avgDuration}ms`);
      console.log(`  Min Duration: ${postStats.minDuration}ms`);
      console.log(`  Max Duration: ${postStats.maxDuration}ms`);
      console.log(`  P50 (Median): ${postStats.p50}ms`);
      console.log(`  P90: ${postStats.p90}ms`);
      console.log(`  P95: ${postStats.p95}ms`);
      console.log(`  P99: ${postStats.p99}ms`);
    }

    // Performance analysis
    console.log('\n🎯 PERFORMANCE ANALYSIS:');
    if (getStats && getStats.avgDuration < 500) {
      console.log('  ✅ GET requests are performing well (< 500ms average)');
    } else if (getStats) {
      console.log('  ⚠️  GET requests may need further optimization (> 500ms average)');
    }

    if (postStats && postStats.avgDuration < 1500) {
      console.log('  ✅ POST requests are performing well (< 1.5s average)');
    } else if (postStats) {
      console.log('  ⚠️  POST requests may need further optimization (> 1.5s average)');
    }

    // Cache effectiveness (estimated)
    if (getStats && getStats.p50 < getStats.avgDuration * 0.8) {
      console.log('  ✅ Caching appears to be effective (consistent response times)');
    } else if (getStats) {
      console.log('  ⚠️  Cache hit rate may be low (high variance in response times)');
    }
  }

  async delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async run() {
    console.log('🚀 Starting Cap Table Session Performance Tests');
    console.log(`Target: ${API_BASE_URL}/companies/${COMPANY_ID}/cap-table-session`);
    console.log(`Configuration: ${TEST_CONFIG.testRequests} requests, ${TEST_CONFIG.concurrentRequests} concurrent`);

    try {
      await this.testGetEndpoint();
      await this.testPostEndpoint();
      this.printResults();
    } catch (error) {
      console.error('❌ Test failed:', error.message);
    }
  }
}

// Run the test
if (require.main === module) {
  const test = new PerformanceTest();
  test.run().catch(console.error);
}

module.exports = PerformanceTest;
