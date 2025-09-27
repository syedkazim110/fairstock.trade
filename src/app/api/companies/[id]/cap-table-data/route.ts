import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withCache, cacheKeys, cacheTTL, getSessionCache } from '@/lib/cache'

// Type definitions
interface CompanyMember {
  id: string
  name: string
  email: string
  position: string
  credit_balance: number
}

interface Shareholding {
  member_email: string
  shares_owned: number
  share_percentage: number
}

interface TransformedMember {
  id: string
  name: string
  email: string
  position: string
  balance: number
  shares_owned: number
  share_percentage: number
}

// GET /api/companies/[id]/cap-table-data - Get complete cap table data in one optimized call
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const companyId = resolvedParams.id

    // Get user profile for email
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json({ error: 'Failed to load user profile' }, { status: 500 })
    }

    // Use optimized cache key for complete cap table data
    const cacheKey = `${cacheKeys.company(companyId)}:complete-data`
    
    // Fetch cap table data directly without caching to avoid cross-user issues
    // Use the optimized database function to get all data in one call
    const { data, error } = await supabase.rpc(
      'get_complete_cap_table_data',
      {
        p_company_id: companyId,
        p_user_id: user.id,
        p_user_email: profile.email
      }
    )

    let capTableData
    if (error) {
      console.error('Database function error:', error)
      
      // Fallback to original method if the optimized function doesn't exist
      if (error.code === '42883') { // Function does not exist
        capTableData = await getFallbackCapTableData(supabase, companyId, user.id, profile.email)
      } else {
        throw new Error(error.message)
      }
    } else {
      capTableData = data
    }

    // Add performance metadata
    const responseData = {
      ...capTableData,
      _metadata: {
        cached: false, // No caching to prevent cross-user issues
        timestamp: new Date().toISOString(),
        optimized: true
      }
    }

    return NextResponse.json(responseData)

  } catch (error) {
    console.error('Error getting complete cap table data:', error)
    
    // Handle specific error messages
    if (error instanceof Error) {
      if (error.message === 'Company not found or access denied') {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
      if (error.message === 'Admin member not found in cap table') {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Fallback function for when the optimized database function doesn't exist
async function getFallbackCapTableData(supabase: any, companyId: string, userId: string, userEmail: string) {
  console.log('Using fallback method for cap table data')
  
  // Parallel queries for better performance
  const [companyResult, membersResult, sessionResult] = await Promise.all([
    // Get company data
    supabase
      .from('companies')
      .select('id, name, total_shares, issued_shares, created_by')
      .eq('id', companyId)
      .eq('created_by', userId)
      .single(),
    
    // Get members with credit balance
    supabase
      .from('company_members')
      .select('id, name, email, position, credit_balance')
      .eq('company_id', companyId)
      .order('name'),
    
    // Get active session
    supabase
      .from('cap_table_sessions')
      .select('id, session_fee, paid_at, is_active, created_at')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .maybeSingle()
  ])

  if (companyResult.error || !companyResult.data) {
    throw new Error('Company not found or access denied')
  }

  if (membersResult.error) {
    throw new Error('Failed to load company members')
  }

  const company = companyResult.data
  const members = membersResult.data || []
  const activeSession = sessionResult.data

  // Find admin member
  const adminMember = members.find((member: CompanyMember) => member.email === userEmail) || members[0]
  
  if (!adminMember) {
    throw new Error('Admin member not found in cap table')
  }

  // Get shareholding data for all members
  let shareholdingsData: Shareholding[] = []
  if (members.length > 0) {
    const memberEmails = members.map((member: CompanyMember) => member.email)
    const { data: shareholdings, error: shareholdingsError } = await supabase
      .from('member_shareholdings')
      .select('member_email, shares_owned, share_percentage')
      .eq('company_id', companyId)
      .in('member_email', memberEmails)

    if (!shareholdingsError) {
      shareholdingsData = shareholdings || []
    }
  }

  // Transform members data
  const transformedMembers: TransformedMember[] = members.map((member: CompanyMember) => {
    const shareholding = shareholdingsData.find((sh: Shareholding) => sh.member_email === member.email)
    return {
      id: member.id,
      name: member.name,
      email: member.email,
      position: member.position,
      balance: member.credit_balance || 0,
      shares_owned: shareholding?.shares_owned || 0,
      share_percentage: shareholding?.share_percentage || 0
    }
  })

  // Calculate summary data
  const totalMembers = transformedMembers.length
  const totalAllocatedShares = transformedMembers.reduce((sum: number, member: TransformedMember) => sum + member.shares_owned, 0)
  const totalCreditBalance = transformedMembers.reduce((sum: number, member: TransformedMember) => sum + member.balance, 0)

  return {
    company: {
      id: company.id,
      name: company.name,
      total_shares: company.total_shares,
      issued_shares: company.issued_shares,
      owner_credit_balance: adminMember.credit_balance || 0
    },
    session: activeSession ? {
      id: activeSession.id,
      session_fee: activeSession.session_fee,
      paid_at: activeSession.paid_at,
      is_active: activeSession.is_active,
      created_at: activeSession.created_at
    } : null,
    has_active_session: !!activeSession,
    admin_member: {
      id: adminMember.id,
      name: adminMember.name,
      credit_balance: adminMember.credit_balance || 0
    },
    members: transformedMembers,
    summary: {
      total_members: totalMembers,
      total_allocated_shares: totalAllocatedShares,
      total_credit_balance: totalCreditBalance
    }
  }
}

// Session termination context interface
interface SessionTerminationContext {
  reason: string
  hasChanges: boolean
  isUnloading: boolean
  source: 'tab-switch' | 'visibility-change' | 'navigation' | 'manual'
}

// Smart session termination request interface
interface SmartSessionTerminationRequest {
  action: 'smart-terminate'
  context: SessionTerminationContext
}

// POST /api/companies/[id]/cap-table-data - Enhanced session management with smart termination
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const resolvedParams = await params
    const companyId = resolvedParams.id
    const body = await request.json()
    const { action, context } = body

    // No cache to clear since we're not using caching for user-specific data

    if (action === 'start') {
      return await startOptimizedSession(supabase, companyId, user.id)
    } else if (action === 'complete') {
      return await completeOptimizedSession(supabase, companyId, user.id)
    } else if (action === 'cancel') {
      return await cancelOptimizedSession(supabase, companyId, user.id)
    } else if (action === 'smart-terminate') {
      return await handleSmartSessionTermination(supabase, companyId, user.id, context)
    } else if (action === 'cleanup-orphaned') {
      return await cleanupOrphanedSession(supabase, companyId, user.id)
    } else {
      return NextResponse.json({ error: 'Invalid action. Use "start", "complete", "cancel", "smart-terminate", or "cleanup-orphaned"' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error managing cap table session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function startOptimizedSession(supabase: any, companyId: string, userId: string) {
  const sessionFee = 20.00
  console.log('Starting session for company:', companyId, 'user:', userId, 'fee:', sessionFee)

  // Get user profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .single()

  if (profileError || !profile) {
    console.error('Failed to get user profile:', profileError)
    return NextResponse.json({ error: 'Failed to identify user' }, { status: 500 })
  }

  console.log('User profile found:', profile.email)

  // Find admin member
  const { data: adminMember, error: memberError } = await supabase
    .from('company_members')
    .select('id, credit_balance')
    .eq('company_id', companyId)
    .eq('email', profile.email)
    .single()

  if (memberError || !adminMember) {
    console.error('Admin member not found:', memberError)
    return NextResponse.json({ error: 'Admin member not found in cap table' }, { status: 404 })
  }

  const currentBalance = adminMember.credit_balance || 0
  console.log('Admin member found:', { id: adminMember.id, currentBalance })

  // Check if user has sufficient balance
  if (currentBalance < sessionFee) {
    console.log('Insufficient balance:', currentBalance, 'required:', sessionFee)
    return NextResponse.json({ 
      error: `Insufficient credit balance. You need $${sessionFee.toFixed(2)} but only have $${currentBalance.toFixed(2)}.` 
    }, { status: 400 })
  }

  // Skip optimized function and go directly to fallback for now to ensure it works
  console.log('Using fallback method directly to ensure proper balance deduction')
  return await startSessionFallback(supabase, companyId, userId, adminMember, sessionFee, currentBalance)
}

async function completeOptimizedSession(supabase: any, companyId: string, userId: string) {
  console.log('Attempting to complete session for company:', companyId, 'user:', userId)
  
  // First check if there's an active session to complete
  const { data: activeSession, error: sessionError } = await supabase
    .from('cap_table_sessions')
    .select('id, session_fee, is_active, cancelled_at, completed_at')
    .eq('company_id', companyId)
    .eq('owner_id', userId)
    .eq('is_active', true)
    .single()

  if (sessionError) {
    if (sessionError.code === 'PGRST116') {
      console.log('No active session found - may have already been processed')
      return NextResponse.json({ error: 'No active cap table session found' }, { status: 404 })
    }
    console.error('Error finding session:', sessionError)
    return NextResponse.json({ error: 'Failed to find active session' }, { status: 500 })
  }

  console.log('Found active session:', { 
    id: activeSession.id, 
    fee: activeSession.session_fee,
    isActive: activeSession.is_active,
    cancelledAt: activeSession.cancelled_at,
    completedAt: activeSession.completed_at
  })

  // Double-check that this session hasn't already been cancelled or completed
  if (!activeSession.is_active || activeSession.cancelled_at || activeSession.completed_at) {
    console.log('Session already processed, skipping completion')
    return NextResponse.json({ error: 'Session has already been processed' }, { status: 400 })
  }

  // Try optimized function first
  const { data: result, error } = await supabase.rpc(
    'complete_cap_table_session_optimized',
    {
      p_company_id: companyId,
      p_owner_id: userId
    }
  )

  if (error) {
    console.error('Error in optimized session completion:', error)
    
    // Fallback to original method
    if (error.code === '42883') {
      const { data: updatedSession, error: updateError } = await supabase
        .from('cap_table_sessions')
        .update({
          is_active: false,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', activeSession.id)
        .eq('is_active', true) // Only update if still active to prevent double processing
        .select('id')
        .single()

      if (updateError) {
        console.error('Error updating session:', updateError)
        return NextResponse.json({ error: 'Failed to complete cap table session' }, { status: 500 })
      }

      console.log('Session completed successfully:', { sessionId: updatedSession.id })

      return NextResponse.json({
        message: 'Cap table session completed successfully',
        session_id: updatedSession.id
      })
    }
    
    return NextResponse.json({ error: 'Failed to complete cap table session' }, { status: 500 })
  }

  console.log('Session completed via optimized function')
  return NextResponse.json(result)
}

async function cancelOptimizedSession(supabase: any, companyId: string, userId: string) {
  console.log('Attempting to cancel session for company:', companyId, 'user:', userId)
  
  // Get session and admin member data
  const [sessionResult, profileResult] = await Promise.all([
    supabase
      .from('cap_table_sessions')
      .select('id, session_fee, is_active, cancelled_at, completed_at')
      .eq('company_id', companyId)
      .eq('owner_id', userId)
      .eq('is_active', true)
      .single(),
    supabase
      .from('profiles')
      .select('email')
      .eq('id', userId)
      .single()
  ])

  if (sessionResult.error) {
    if (sessionResult.error.code === 'PGRST116') {
      console.log('No active session found - may have already been processed')
      return NextResponse.json({ error: 'No active cap table session found' }, { status: 404 })
    }
    console.error('Error finding session:', sessionResult.error)
    return NextResponse.json({ error: 'Failed to find active session' }, { status: 500 })
  }

  if (profileResult.error) {
    console.error('Error finding profile:', profileResult.error)
    return NextResponse.json({ error: 'Failed to identify user' }, { status: 500 })
  }

  const activeSession = sessionResult.data
  const userEmail = profileResult.data.email

  console.log('Found active session:', { 
    id: activeSession.id, 
    fee: activeSession.session_fee,
    isActive: activeSession.is_active,
    cancelledAt: activeSession.cancelled_at,
    completedAt: activeSession.completed_at
  })

  // Double-check that this session hasn't already been cancelled or completed
  if (!activeSession.is_active || activeSession.cancelled_at || activeSession.completed_at) {
    console.log('Session already processed, skipping cancellation')
    return NextResponse.json({ error: 'Session has already been processed' }, { status: 400 })
  }

  // Find admin member
  const { data: adminMember, error: memberError } = await supabase
    .from('company_members')
    .select('id, credit_balance')
    .eq('company_id', companyId)
    .eq('email', userEmail)
    .single()

  if (memberError || !adminMember) {
    console.error('Admin member not found:', memberError)
    return NextResponse.json({ error: 'Admin member not found in cap table' }, { status: 404 })
  }

  const currentBalance = adminMember.credit_balance || 0
  const refundedBalance = currentBalance + activeSession.session_fee

  console.log('Processing refund:', { 
    currentBalance, 
    sessionFee: activeSession.session_fee, 
    refundedBalance 
  })

  // Refund and cancel in parallel - but only if session is still active
  const [refundResult, cancelResult] = await Promise.all([
    supabase
      .from('company_members')
      .update({ credit_balance: refundedBalance })
      .eq('id', adminMember.id),
    supabase
      .from('cap_table_sessions')
      .update({
        is_active: false,
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', activeSession.id)
      .eq('is_active', true) // Only update if still active to prevent double processing
  ])

  if (refundResult.error || cancelResult.error) {
    console.error('Error in cancellation:', { refundResult: refundResult.error, cancelResult: cancelResult.error })
    return NextResponse.json({ error: 'Failed to cancel cap table session' }, { status: 500 })
  }

  console.log('Session cancelled successfully:', { 
    sessionId: activeSession.id, 
    refundAmount: activeSession.session_fee,
    newBalance: refundedBalance 
  })

  return NextResponse.json({
    message: 'Cap table session cancelled successfully',
    session_id: activeSession.id,
    refunded_amount: activeSession.session_fee,
    new_balance: refundedBalance
  })
}

// Smart session termination function - determines whether to complete or cancel based on changes
async function handleSmartSessionTermination(supabase: any, companyId: string, userId: string, context: SessionTerminationContext) {
  console.log('Smart session termination:', { companyId, userId, context })
  
  // First check if there's an active session
  const { data: activeSession, error: sessionError } = await supabase
    .from('cap_table_sessions')
    .select('id, session_fee, is_active, cancelled_at, completed_at')
    .eq('company_id', companyId)
    .eq('owner_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  if (sessionError) {
    console.error('Error finding session for smart termination:', sessionError)
    return NextResponse.json({ 
      error: 'Failed to find session',
      context: context
    }, { status: 500 })
  }

  if (!activeSession) {
    console.log('No active session found for smart termination')
    return NextResponse.json({
      action_taken: 'no_action',
      message: 'No active session found to terminate',
      context: context
    })
  }

  // Determine action based on whether changes were made
  const action = context.hasChanges ? 'complete' : 'cancel'
  
  console.log(`Smart termination decision: ${action} (hasChanges: ${context.hasChanges})`)
  
  try {
    if (action === 'complete') {
      // Complete the session - charge the user (just mark as completed, don't refund)
      const { data: updatedSession, error: updateError } = await supabase
        .from('cap_table_sessions')
        .update({
          is_active: false,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', activeSession.id)
        .eq('is_active', true) // Only update if still active
        .select('id')
        .single()

      if (updateError) {
        console.error('Error completing session in smart termination:', updateError)
        throw new Error('Failed to complete session')
      }

      return NextResponse.json({
        action_taken: 'completed',
        message: `Session completed: ${context.reason}. Changes were saved.`,
        charged_amount: activeSession.session_fee,
        new_balance: 0, // We don't track balance here
        context: context
      })
    } else {
      // Cancel the session - refund the user
      const [profileResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('email')
          .eq('id', userId)
          .single()
      ])

      if (profileResult.error) {
        console.error('Error finding profile for smart termination:', profileResult.error)
        throw new Error('Failed to identify user')
      }

      const userEmail = profileResult.data.email

      // Find admin member
      const { data: adminMember, error: memberError } = await supabase
        .from('company_members')
        .select('id, credit_balance')
        .eq('company_id', companyId)
        .eq('email', userEmail)
        .single()

      if (memberError || !adminMember) {
        console.error('Admin member not found for smart termination:', memberError)
        throw new Error('Admin member not found')
      }

      const currentBalance = adminMember.credit_balance || 0
      const refundedBalance = currentBalance + activeSession.session_fee

      // Refund and cancel in parallel
      const [refundResult, cancelResult] = await Promise.all([
        supabase
          .from('company_members')
          .update({ credit_balance: refundedBalance })
          .eq('id', adminMember.id),
        supabase
          .from('cap_table_sessions')
          .update({
            is_active: false,
            cancelled_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', activeSession.id)
          .eq('is_active', true) // Only update if still active
      ])

      if (refundResult.error || cancelResult.error) {
        console.error('Error in smart termination cancellation:', { 
          refundError: refundResult.error, 
          cancelError: cancelResult.error 
        })
        throw new Error('Failed to cancel session')
      }

      return NextResponse.json({
        action_taken: 'cancelled',
        message: `Session cancelled: ${context.reason}. No changes were made.`,
        refunded_amount: activeSession.session_fee,
        new_balance: refundedBalance,
        context: context
      })
    }
  } catch (error) {
    console.error('Error in smart session termination:', error)
    return NextResponse.json({ 
      error: 'Failed to terminate session',
      context: context
    }, { status: 500 })
  }
}

// Clean up orphaned sessions - cancel and refund any active sessions
async function cleanupOrphanedSession(supabase: any, companyId: string, userId: string) {
  console.log('Cleaning up orphaned session for company:', companyId, 'user:', userId)
  
  // Find any active sessions for this company and user
  const { data: activeSession, error: sessionError } = await supabase
    .from('cap_table_sessions')
    .select('id, session_fee, is_active, cancelled_at, completed_at')
    .eq('company_id', companyId)
    .eq('owner_id', userId)
    .eq('is_active', true)
    .maybeSingle()

  if (sessionError) {
    console.error('Error finding session for cleanup:', sessionError)
    return NextResponse.json({ 
      error: 'Failed to find session for cleanup'
    }, { status: 500 })
  }

  if (!activeSession) {
    console.log('No active session found to cleanup')
    return NextResponse.json({
      message: 'No active session found to cleanup',
      cleaned_up: false
    })
  }

  // Get user profile for email
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .single()

  if (profileError || !profile) {
    console.error('Error finding profile for cleanup:', profileError)
    return NextResponse.json({ error: 'Failed to identify user' }, { status: 500 })
  }

  // Find admin member
  const { data: adminMember, error: memberError } = await supabase
    .from('company_members')
    .select('id, credit_balance')
    .eq('company_id', companyId)
    .eq('email', profile.email)
    .single()

  if (memberError || !adminMember) {
    console.error('Admin member not found for cleanup:', memberError)
    return NextResponse.json({ error: 'Admin member not found in cap table' }, { status: 404 })
  }

  const currentBalance = adminMember.credit_balance || 0
  const refundedBalance = currentBalance + activeSession.session_fee

  console.log('Processing cleanup refund:', { 
    currentBalance, 
    sessionFee: activeSession.session_fee, 
    refundedBalance 
  })

  // Refund and cancel the orphaned session
  const [refundResult, cancelResult] = await Promise.all([
    supabase
      .from('company_members')
      .update({ credit_balance: refundedBalance })
      .eq('id', adminMember.id),
    supabase
      .from('cap_table_sessions')
      .update({
        is_active: false,
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', activeSession.id)
      .eq('is_active', true) // Only update if still active
  ])

  if (refundResult.error || cancelResult.error) {
    console.error('Error in cleanup:', { 
      refundError: refundResult.error, 
      cancelError: cancelResult.error 
    })
    return NextResponse.json({ error: 'Failed to cleanup orphaned session' }, { status: 500 })
  }

  console.log('Orphaned session cleaned up successfully:', { 
    sessionId: activeSession.id, 
    refundAmount: activeSession.session_fee,
    newBalance: refundedBalance 
  })

  return NextResponse.json({
    message: 'Orphaned session cleaned up successfully',
    cleaned_up: true,
    session_id: activeSession.id,
    refunded_amount: activeSession.session_fee,
    new_balance: refundedBalance
  })
}

// Fallback session start function
async function startSessionFallback(supabase: any, companyId: string, userId: string, adminMember: any, sessionFee: number, currentBalance: number) {
  console.log('Using fallback method for session start')
  
  // Auto-assign $1000 if insufficient balance
  if (currentBalance < sessionFee) {
    currentBalance = 1000.00
    
    const { error: creditAssignError } = await supabase
      .from('company_members')
      .update({ credit_balance: currentBalance })
      .eq('id', adminMember.id)

    if (creditAssignError) {
      return NextResponse.json({ error: 'Failed to assign credit balance' }, { status: 500 })
    }
  }

  // Deduct balance and create session
  const newBalance = currentBalance - sessionFee
  
  const [balanceResult, sessionResult] = await Promise.all([
    supabase
      .from('company_members')
      .update({ credit_balance: newBalance })
      .eq('id', adminMember.id),
    supabase
      .from('cap_table_sessions')
      .insert({
        company_id: companyId,
        owner_id: userId,
        session_fee: sessionFee,
        is_active: true
      })
      .select()
      .single()
  ])

  if (balanceResult.error || sessionResult.error) {
    // Rollback on error
    if (!balanceResult.error && sessionResult.error) {
      await supabase
        .from('company_members')
        .update({ credit_balance: currentBalance })
        .eq('id', adminMember.id)
    }
    
    return NextResponse.json({ error: 'Failed to start cap table session' }, { status: 500 })
  }

  return NextResponse.json({
    message: 'Cap table session started successfully',
    session: sessionResult.data,
    admin_member_new_balance: newBalance,
    session_fee: sessionFee,
    optimized: false
  }, { status: 201 })
}
