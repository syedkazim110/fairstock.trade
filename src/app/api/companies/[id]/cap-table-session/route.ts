import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

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

    // Verify user owns this company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, created_by, name, owner_credit_balance')
      .eq('id', companyId)
      .eq('created_by', user.id)
      .single()

    if (companyError || !company) {
      return NextResponse.json({ error: 'Company not found or access denied' }, { status: 404 })
    }

    if (action === 'start') {
      return await startCapTableSession(supabase, company, user.id)
    } else if (action === 'complete') {
      return await completeCapTableSession(supabase, companyId, user.id)
    } else {
      return NextResponse.json({ error: 'Invalid action. Use "start" or "complete"' }, { status: 400 })
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

    // Verify user owns this company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, created_by, name')
      .eq('id', companyId)
      .eq('created_by', user.id)
      .single()

    if (companyError || !company) {
      return NextResponse.json({ error: 'Company not found or access denied' }, { status: 404 })
    }

    // Get the company creator's email to identify the admin member
    const { data: creatorProfile, error: profileError } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', user.id)
      .single()

    if (profileError || !creatorProfile) {
      console.error('Error getting creator profile:', profileError)
      return NextResponse.json({ error: 'Failed to identify company owner' }, { status: 500 })
    }

    // Find the admin member by matching email with company creator
    const { data: adminMember, error: memberError } = await supabase
      .from('company_members')
      .select('id, credit_balance, name')
      .eq('company_id', companyId)
      .eq('email', creatorProfile.email)
      .single()

    if (memberError || !adminMember) {
      console.error('Error finding admin member:', memberError)
      return NextResponse.json({ error: 'Admin member not found in cap table' }, { status: 404 })
    }

    // Check for active session
    const { data: activeSession, error: sessionError } = await supabase
      .from('cap_table_sessions')
      .select('id, session_fee, paid_at, is_active')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .single()

    if (sessionError && sessionError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error checking session:', sessionError)
      return NextResponse.json({ error: 'Failed to check session status' }, { status: 500 })
    }

    return NextResponse.json({
      company: {
        id: company.id,
        name: company.name,
        owner_credit_balance: adminMember.credit_balance || 0 // Use admin member's balance
      },
      session: activeSession ? {
        id: activeSession.id,
        session_fee: activeSession.session_fee,
        paid_at: activeSession.paid_at,
        is_active: activeSession.is_active
      } : null,
      has_active_session: !!activeSession
    })

  } catch (error) {
    console.error('Error getting cap table session status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function startCapTableSession(supabase: any, company: any, userId: string) {
  const sessionFee = 20.00

  // Get the company creator's email to identify the admin member
  const { data: creatorProfile, error: profileError } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .single()

  if (profileError || !creatorProfile) {
    console.error('Error getting creator profile:', profileError)
    return NextResponse.json({ error: 'Failed to identify company owner' }, { status: 500 })
  }

  // Find the admin member by matching email with company creator
  const { data: adminMember, error: memberError } = await supabase
    .from('company_members')
    .select('id, credit_balance, name')
    .eq('company_id', company.id)
    .eq('email', creatorProfile.email)
    .single()

  if (memberError || !adminMember) {
    console.error('Error finding admin member:', memberError)
    return NextResponse.json({ error: 'Admin member not found in cap table' }, { status: 404 })
  }

  let currentBalance = adminMember.credit_balance || 0

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
  // Find and complete the active session
  const { data: activeSession, error: findError } = await supabase
    .from('cap_table_sessions')
    .select('id')
    .eq('company_id', companyId)
    .eq('owner_id', userId)
    .eq('is_active', true)
    .single()

  if (findError) {
    if (findError.code === 'PGRST116') { // No rows returned
      return NextResponse.json({ error: 'No active cap table session found' }, { status: 404 })
    }
    console.error('Error finding active session:', findError)
    return NextResponse.json({ error: 'Failed to find active session' }, { status: 500 })
  }

  // Complete the session
  const { error: completeError } = await supabase
    .from('cap_table_sessions')
    .update({
      is_active: false,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq('id', activeSession.id)

  if (completeError) {
    console.error('Error completing session:', completeError)
    return NextResponse.json({ error: 'Failed to complete cap table session' }, { status: 500 })
  }

  return NextResponse.json({
    message: 'Cap table session completed successfully',
    session_id: activeSession.id
  })
}
