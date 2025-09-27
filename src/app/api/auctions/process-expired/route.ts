import { NextRequest, NextResponse } from 'next/server'
import { processExpiredAuctions } from '@/lib/auction-clearing-scheduler'

/**
 * API endpoint to process expired auctions and trigger clearing
 * This can be called by cron jobs, webhooks, or other scheduling mechanisms
 * 
 * POST /api/auctions/process-expired
 */
export async function POST(request: NextRequest) {
  try {
    console.log('🚀 Starting automatic auction clearing process...')
    
    // Optional: Add authentication/authorization for production
    // You might want to check for an API key or specific authorization
    const authHeader = request.headers.get('authorization')
    const expectedToken = process.env.CLEARING_SCHEDULER_TOKEN
    
    if (expectedToken && authHeader !== `Bearer ${expectedToken}`) {
      console.log('❌ Unauthorized clearing request')
      return NextResponse.json({ 
        error: 'Unauthorized' 
      }, { status: 401 })
    }

    // Process expired auctions
    const result = await processExpiredAuctions()
    
    if (!result.success) {
      console.error('❌ Clearing process failed:', result.error)
      return NextResponse.json({
        success: false,
        error: result.error
      }, { status: 500 })
    }

    console.log('✅ Clearing process completed successfully')
    
    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      summary: {
        processed: result.processed,
        successful: result.successful,
        errors: result.errors,
        skipped: result.skipped
      },
      results: result.results
    })

  } catch (error) {
    console.error('❌ Fatal error in clearing endpoint:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

/**
 * GET endpoint to check the status of the clearing service
 * Useful for health checks and monitoring
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const includeStats = searchParams.get('stats') === 'true'
    
    const response: any = {
      service: 'auction-clearing-scheduler',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    }

    if (includeStats) {
      // You could add statistics here, like:
      // - Number of auctions processed in the last 24 hours
      // - Average processing time
      // - Error rates
      // - etc.
      response.stats = {
        note: 'Statistics not implemented yet'
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ Error in clearing service health check:', error)
    return NextResponse.json({
      service: 'auction-clearing-scheduler',
      status: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
