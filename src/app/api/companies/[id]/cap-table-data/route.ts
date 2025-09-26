import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withCache, cacheKeys, cacheTTL, cache } from '@/lib/cache'

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
    
    const capTableData = await withCache(
      cacheKey,
      async () => {
        // Use the optimized database function to get all data in one call
        const { data, error } = await supabase.rpc(
          'get_complete_cap_table_data',
          {
            p_company_id: companyId,
            p_user_id: user.id,
            p_user_email: profile.email
          }
        )

        if (error) {
          console.error('Database function error:', error)
          
          // Fallback to original method if the optimized function doesn't exist
          if (error.code === '42883') { // Function does not exist
            return await getFallbackCapTableData(supabase, companyId, user.id, profile.email)
          }
          
          throw new Error(error.message)
        }

        return data
      },
      cacheTTL.capTableData // Use optimized TTL for cap table data
    )

    // Add performance metadata
    const responseData = {
      ...capTableData,
      _metadata: {
        cached: cache.get(cacheKey) !== null,
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

// POST /api/companies/[id]/cap-table-data - Optimized session management
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
    const { action } = body

    // Clear cache for this company
    const cacheKey = `${cacheKeys.company(companyId)}:complete-data`
    cache.delete(cacheKey)
    cache.delete(cacheKeys.capTableSession(companyId))

    if (action === 'start') {
      return await startOptimizedSession(supabase, companyId, user.id)
    } else if (action === 'complete') {
      return await completeOptimizedSession(supabase, companyId, user.id)
    } else if (action === 'cancel') {
      return await cancelOptimizedSession(supabase, companyId, user.id)
    } else {
      return NextResponse.json({ error: 'Invalid action. Use "start", "complete", or "cancel"' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error managing cap table session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function startOptimizedSession(supabase: any, companyId: string, userId: string) {
  const sessionFee = 20.00

  // Get user profile
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .single()

  if (profileError || !profile) {
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
    return NextResponse.json({ error: 'Admin member not found in cap table' }, { status: 404 })
  }

  const currentBalance = adminMember.credit_balance || 0

  // Try to use optimized database function
  const { data: result, error } = await supabase.rpc(
    'start_cap_table_session_optimized',
    {
      p_company_id: companyId,
      p_owner_id: userId,
      p_admin_member_id: adminMember.id,
      p_session_fee: sessionFee,
      p_current_balance: currentBalance
    }
  )

  if (error) {
    console.error('Error in optimized session start:', error)
    
    // Fallback to original method if function doesn't exist
    if (error.code === '42883') {
      return await startSessionFallback(supabase, companyId, userId, adminMember, sessionFee, currentBalance)
    }
    
    return NextResponse.json({ error: 'Failed to start cap table session' }, { status: 500 })
  }

  return NextResponse.json({
    message: 'Cap table session started successfully',
    session: result.session,
    admin_member_new_balance: result.new_balance,
    session_fee: sessionFee,
    optimized: true
  }, { status: 201 })
}

async function completeOptimizedSession(supabase: any, companyId: string, userId: string) {
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
        .eq('company_id', companyId)
        .eq('owner_id', userId)
        .eq('is_active', true)
        .select('id')
        .single()

      if (updateError) {
        if (updateError.code === 'PGRST116') {
          return NextResponse.json({ error: 'No active cap table session found' }, { status: 404 })
        }
        return NextResponse.json({ error: 'Failed to complete cap table session' }, { status: 500 })
      }

      return NextResponse.json({
        message: 'Cap table session completed successfully',
        session_id: updatedSession.id
      })
    }
    
    return NextResponse.json({ error: 'Failed to complete cap table session' }, { status: 500 })
  }

  return NextResponse.json(result)
}

async function cancelOptimizedSession(supabase: any, companyId: string, userId: string) {
  // Get session and admin member data
  const [sessionResult, profileResult] = await Promise.all([
    supabase
      .from('cap_table_sessions')
      .select('id, session_fee')
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
      return NextResponse.json({ error: 'No active cap table session found' }, { status: 404 })
    }
    return NextResponse.json({ error: 'Failed to find active session' }, { status: 500 })
  }

  if (profileResult.error) {
    return NextResponse.json({ error: 'Failed to identify user' }, { status: 500 })
  }

  const activeSession = sessionResult.data
  const userEmail = profileResult.data.email

  // Find admin member
  const { data: adminMember, error: memberError } = await supabase
    .from('company_members')
    .select('id, credit_balance')
    .eq('company_id', companyId)
    .eq('email', userEmail)
    .single()

  if (memberError || !adminMember) {
    return NextResponse.json({ error: 'Admin member not found in cap table' }, { status: 404 })
  }

  // Refund and cancel in parallel
  const currentBalance = adminMember.credit_balance || 0
  const refundedBalance = currentBalance + activeSession.session_fee

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
  ])

  if (refundResult.error || cancelResult.error) {
    console.error('Error in cancellation:', { refundResult: refundResult.error, cancelResult: cancelResult.error })
    return NextResponse.json({ error: 'Failed to cancel cap table session' }, { status: 500 })
  }

  return NextResponse.json({
    message: 'Cap table session cancelled successfully',
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
