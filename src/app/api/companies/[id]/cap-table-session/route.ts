import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withCache, cacheKeys, cacheTTL, cache } from '@/lib/cache'

// POST /api/companies/[id]/cap-table-session - Start or complete a cap table session
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

    // OPTIMIZED: Parallel verification of company ownership and user profile
    const [companyResult, profileResult] = await Promise.all([
      supabase
        .from('companies')
        .select('id, created_by, name, owner_credit_balance')
        .eq('id', companyId)
        .eq('created_by', user.id)
        .single(),
      supabase
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .single()
    ])

    if (companyResult.error || !companyResult.data) {
      return NextResponse.json({ error: 'Company not found or access denied' }, { status: 404 })
    }

    if (profileResult.error || !profileResult.data) {
      return NextResponse.json({ error: 'Failed to identify company owner' }, { status: 500 })
    }

    const company = companyResult.data
    const userEmail = profileResult.data.email

    // Clear relevant cache keys when session state changes
    const sessionCacheKey = cacheKeys.capTableSession(companyId)
    const companyCacheKey = cacheKeys.company(companyId)
    cache.delete(sessionCacheKey)
    cache.delete(companyCacheKey)

    if (action === 'start') {
      return await startCapTableSession(supabase, company, user.id, userEmail)
    } else if (action === 'complete') {
      return await completeCapTableSession(supabase, companyId, user.id)
    } else if (action === 'cancel') {
      return await cancelCapTableSession(supabase, companyId, user.id, userEmail)
    } else {
      return NextResponse.json({ error: 'Invalid action. Use "start", "complete", or "cancel"' }, { status: 400 })
    }

  } catch (error) {
    console.error('Error managing cap table session:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/companies/[id]/cap-table-session - Get current session status
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

    // OPTIMIZED: Use longer cache TTL for session data
    const cacheKey = cacheKeys.capTableSession(companyId)
    
    const sessionData = await withCache(
      cacheKey,
      async () => {
        // OPTIMIZED: Parallel queries with proper admin member lookup
        const [companyResult, profileResult, sessionResult] = await Promise.all([
          // Verify company ownership
          supabase
            .from('companies')
            .select('id, name, created_by')
            .eq('id', companyId)
            .eq('created_by', user.id)
            .single(),
          
          // Get creator profile
          supabase
            .from('profiles')
            .select('email')
            .eq('id', user.id)
            .single(),
          
          // Check for active session
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

        if (profileResult.error || !profileResult.data) {
          throw new Error('Failed to identify company owner')
        }

        // Try to find admin member using different approaches
        let adminMember = null
        let memberError = null

        // First try: Find by email
        const { data: memberByEmail, error: emailError } = await supabase
          .from('company_members')
          .select('id, credit_balance, name, email')
          .eq('company_id', companyId)
          .eq('email', profileResult.data.email)
          .maybeSingle()

        if (memberByEmail) {
          adminMember = memberByEmail
        } else {
          // Second try: Find any admin member for this company
          const { data: adminMembers, error: adminError } = await supabase
            .from('company_members')
            .select('id, credit_balance, name, email, is_admin')
            .eq('company_id', companyId)
            .eq('is_admin', true)
            .limit(1)

          if (adminMembers && adminMembers.length > 0) {
            adminMember = adminMembers[0]
          } else {
            // Third try: Find the first member (assuming it's the owner)
            const { data: firstMember, error: firstError } = await supabase
              .from('company_members')
              .select('id, credit_balance, name, email')
              .eq('company_id', companyId)
              .limit(1)
              .single()

            if (firstMember) {
              adminMember = firstMember
            } else {
              memberError = firstError || emailError || adminError
            }
          }
        }

        if (!adminMember) {
          console.error('No admin member found for company:', companyId, 'User email:', profileResult.data.email)
          console.error('Member lookup errors:', { emailError, memberError })
          throw new Error('Admin member not found in cap table')
        }

        const activeSession = sessionResult.data

        return {
          company: {
            id: companyResult.data.id,
            name: companyResult.data.name,
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
          }
        }
      },
      cacheTTL.capTableSession // Use optimized cache TTL
    )

    return NextResponse.json(sessionData)

  } catch (error) {
    console.error('Error getting cap table session status:', error)
    
    // Handle specific error messages from cache function
    if (error instanceof Error) {
      if (error.message === 'Company not found or access denied') {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
      if (error.message === 'Failed to identify company owner') {
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      if (error.message === 'Admin member not found in cap table') {
        return NextResponse.json({ error: error.message }, { status: 404 })
      }
    }
    
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function startCapTableSession(supabase: any, company: any, userId: string, userEmail: string) {
  const sessionFee = 20.00

  // Use the same flexible admin member lookup as in GET
  let adminMember = null

  // First try: Find by email
  const { data: memberByEmail, error: emailError } = await supabase
    .from('company_members')
    .select('id, credit_balance, name, email')
    .eq('company_id', company.id)
    .eq('email', userEmail)
    .maybeSingle()

  if (memberByEmail) {
    adminMember = memberByEmail
  } else {
    // Second try: Find any admin member for this company
    const { data: adminMembers, error: adminError } = await supabase
      .from('company_members')
      .select('id, credit_balance, name, email, is_admin')
      .eq('company_id', company.id)
      .eq('is_admin', true)
      .limit(1)

    if (adminMembers && adminMembers.length > 0) {
      adminMember = adminMembers[0]
    } else {
      // Third try: Find the first member (assuming it's the owner)
      const { data: firstMember, error: firstError } = await supabase
        .from('company_members')
        .select('id, credit_balance, name, email')
        .eq('company_id', company.id)
        .limit(1)
        .single()

      if (firstMember) {
        adminMember = firstMember
      }
    }
  }

  if (!adminMember) {
    console.error('No admin member found for company:', company.id, 'User email:', userEmail)
    return NextResponse.json({ error: 'Admin member not found in cap table' }, { status: 404 })
  }

  let currentBalance = adminMember.credit_balance || 0

  // OPTIMIZED: Use database transaction for atomic operations
  const { data: transactionResult, error: transactionError } = await supabase.rpc(
    'start_cap_table_session_transaction',
    {
      p_company_id: company.id,
      p_owner_id: userId,
      p_admin_member_id: adminMember.id,
      p_session_fee: sessionFee,
      p_current_balance: currentBalance
    }
  )

  // If the stored procedure doesn't exist, fall back to manual transaction
  if (transactionError?.code === '42883') { // Function does not exist
    return await startCapTableSessionManual(supabase, company, userId, adminMember, sessionFee, currentBalance)
  }

  if (transactionError) {
    console.error('Error in cap table session transaction:', transactionError)
    return NextResponse.json({ error: 'Failed to start cap table session' }, { status: 500 })
  }

  return NextResponse.json({
    message: 'Cap table session started successfully',
    session: transactionResult.session,
    admin_member_new_balance: transactionResult.new_balance,
    session_fee: sessionFee
  }, { status: 201 })
}

// Fallback manual transaction method
async function startCapTableSessionManual(supabase: any, company: any, userId: string, adminMember: any, sessionFee: number, currentBalance: number) {
  // If admin has insufficient balance, automatically assign $1000
  if (currentBalance < sessionFee) {
    currentBalance = 1000.00
    
    // Update the admin member's balance to $1000
    const { error: creditAssignError } = await supabase
      .from('company_members')
      .update({ credit_balance: currentBalance })
      .eq('id', adminMember.id)

    if (creditAssignError) {
      console.error('Error assigning credit to admin member:', creditAssignError)
      return NextResponse.json({ error: 'Failed to assign credit balance' }, { status: 500 })
    }
  }

  // Start a transaction by deducting the balance from admin member
  const newBalance = currentBalance - sessionFee
  const { error: balanceError } = await supabase
    .from('company_members')
    .update({ credit_balance: newBalance })
    .eq('id', adminMember.id)

  if (balanceError) {
    console.error('Error updating admin member credit balance:', balanceError)
    return NextResponse.json({ error: 'Failed to process payment' }, { status: 500 })
  }

  // Create new session (this will automatically deactivate old sessions via trigger)
  const { data: newSession, error: sessionError } = await supabase
    .from('cap_table_sessions')
    .insert({
      company_id: company.id,
      owner_id: userId,
      session_fee: sessionFee,
      is_active: true
    })
    .select()
    .single()

  if (sessionError) {
    console.error('Error creating session:', sessionError)
    
    // Rollback balance update
    await supabase
      .from('company_members')
      .update({ credit_balance: currentBalance })
      .eq('id', adminMember.id)
    
    return NextResponse.json({ error: 'Failed to create cap table session' }, { status: 500 })
  }

  return NextResponse.json({
    message: 'Cap table session started successfully',
    session: newSession,
    admin_member_new_balance: newBalance,
    session_fee: sessionFee
  }, { status: 201 })
}

async function completeCapTableSession(supabase: any, companyId: string, userId: string) {
  // OPTIMIZED: Single query to find and update session
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
    if (updateError.code === 'PGRST116') { // No rows returned
      return NextResponse.json({ error: 'No active cap table session found' }, { status: 404 })
    }
    console.error('Error completing session:', updateError)
    return NextResponse.json({ error: 'Failed to complete cap table session' }, { status: 500 })
  }

  return NextResponse.json({
    message: 'Cap table session completed successfully',
    session_id: updatedSession.id
  })
}

async function cancelCapTableSession(supabase: any, companyId: string, userId: string, userEmail: string) {
  // Get session data first
  const { data: activeSession, error: sessionError } = await supabase
    .from('cap_table_sessions')
    .select('id, session_fee')
    .eq('company_id', companyId)
    .eq('owner_id', userId)
    .eq('is_active', true)
    .single()

  if (sessionError) {
    if (sessionError.code === 'PGRST116') { // No rows returned
      return NextResponse.json({ error: 'No active cap table session found' }, { status: 404 })
    }
    console.error('Error finding active session:', sessionError)
    return NextResponse.json({ error: 'Failed to find active session' }, { status: 500 })
  }

  // Use flexible admin member lookup
  let adminMember = null

  // First try: Find by email
  const { data: memberByEmail, error: emailError } = await supabase
    .from('company_members')
    .select('id, credit_balance')
    .eq('company_id', companyId)
    .eq('email', userEmail)
    .maybeSingle()

  if (memberByEmail) {
    adminMember = memberByEmail
  } else {
    // Second try: Find any admin member for this company
    const { data: adminMembers, error: adminError } = await supabase
      .from('company_members')
      .select('id, credit_balance, is_admin')
      .eq('company_id', companyId)
      .eq('is_admin', true)
      .limit(1)

    if (adminMembers && adminMembers.length > 0) {
      adminMember = adminMembers[0]
    } else {
      // Third try: Find the first member (assuming it's the owner)
      const { data: firstMember, error: firstError } = await supabase
        .from('company_members')
        .select('id, credit_balance')
        .eq('company_id', companyId)
        .limit(1)
        .single()

      if (firstMember) {
        adminMember = firstMember
      }
    }
  }

  if (!adminMember) {
    console.error('No admin member found for company:', companyId, 'User email:', userEmail)
    return NextResponse.json({ error: 'Admin member not found in cap table' }, { status: 404 })
  }

  // OPTIMIZED: Parallel refund and session cancellation
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
    
    // Attempt rollback if refund succeeded but cancellation failed
    if (!refundResult.error && cancelResult.error) {
      await supabase
        .from('company_members')
        .update({ credit_balance: currentBalance })
        .eq('id', adminMember.id)
    }
    
    return NextResponse.json({ error: 'Failed to cancel cap table session' }, { status: 500 })
  }

  return NextResponse.json({
    message: 'Cap table session cancelled successfully',
    session_id: activeSession.id,
    refunded_amount: activeSession.session_fee,
    new_balance: refundedBalance
  })
}
