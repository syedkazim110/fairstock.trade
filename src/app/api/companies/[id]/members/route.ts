import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { capTableNotificationService } from '@/lib/email/notificationService'

// GET /api/companies/[id]/members - Get all members for a company
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
      .select('id, created_by')
      .eq('id', companyId)
      .eq('created_by', user.id)
      .single()

    if (companyError || !company) {
      return NextResponse.json({ error: 'Company not found or access denied' }, { status: 404 })
    }

    // Get company members
    const { data: members, error: membersError } = await supabase
      .from('company_members')
      .select('*')
      .eq('company_id', companyId)
      .order('name')

    if (membersError) {
      return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 })
    }

    return NextResponse.json({ members })
  } catch (error) {
    console.error('Error fetching company members:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/companies/[id]/members - Add a new member
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
    const { name, email, position, initialShares = 0, initialCreditBalance = 0 } = body

    // Validate required fields
    if (!name || !email || !position) {
      return NextResponse.json({ error: 'Name, email, and position are required' }, { status: 400 })
    }

    // Validate position
    const validPositions = ['CEO', 'CTO', 'COO', 'Secretary']
    if (!validPositions.includes(position)) {
      return NextResponse.json({ error: 'Invalid position' }, { status: 400 })
    }

    // Validate numbers
    if (initialShares < 0 || initialCreditBalance < 0) {
      return NextResponse.json({ error: 'Shares and credit balance must be non-negative' }, { status: 400 })
    }

    // Verify user owns this company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, created_by, total_shares, issued_shares')
      .eq('id', companyId)
      .eq('created_by', user.id)
      .single()

    if (companyError || !company) {
      return NextResponse.json({ error: 'Company not found or access denied' }, { status: 404 })
    }

    // Check for active cap table session
    const { data: activeSession, error: sessionError } = await supabase
      .from('cap_table_sessions')
      .select('id, is_active')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .single()

    if (sessionError && sessionError.code !== 'PGRST116') { // PGRST116 = no rows returned
      console.error('Error checking session:', sessionError)
      return NextResponse.json({ error: 'Failed to check session status' }, { status: 500 })
    }

    if (!activeSession) {
      return NextResponse.json({ 
        error: 'No active cap table session. Please start a session to make changes.',
        code: 'NO_ACTIVE_SESSION'
      }, { status: 403 })
    }

    // Check if adding shares would exceed total shares
    const currentIssuedShares = company.issued_shares || 0
    if (initialShares > 0 && company.total_shares && (currentIssuedShares + initialShares > company.total_shares)) {
      return NextResponse.json({ 
        error: `Cannot issue ${initialShares} shares. Would exceed total authorized shares (${company.total_shares})` 
      }, { status: 400 })
    }

    // Check if member already exists
    const { data: existingMember } = await supabase
      .from('company_members')
      .select('id')
      .eq('company_id', companyId)
      .eq('email', email)
      .single()

    if (existingMember) {
      return NextResponse.json({ error: 'Member with this email already exists' }, { status: 409 })
    }

    // Start transaction by creating member
    const { data: newMember, error: memberError } = await supabase
      .from('company_members')
      .insert({
        company_id: companyId,
        name,
        email,
        position
      })
      .select()
      .single()

    if (memberError) {
      return NextResponse.json({ error: 'Failed to create member' }, { status: 500 })
    }

    // Create shareholding record if initial shares > 0
    if (initialShares > 0) {
      const sharePercentage = company.total_shares ? (initialShares / company.total_shares) * 100 : 0
      
      const { error: shareholdingError } = await supabase
        .from('member_shareholdings')
        .insert({
          company_id: companyId,
          member_email: email,
          shares_owned: initialShares,
          share_percentage: sharePercentage
        })

      if (shareholdingError) {
        // Rollback member creation
        await supabase.from('company_members').delete().eq('id', newMember.id)
        return NextResponse.json({ error: 'Failed to create shareholding record' }, { status: 500 })
      }

      // Update company issued shares
      const { error: updateCompanyError } = await supabase
        .from('companies')
        .update({ issued_shares: currentIssuedShares + initialShares })
        .eq('id', companyId)

      if (updateCompanyError) {
        console.error('Failed to update company issued shares:', updateCompanyError)
      }
    }

    // Store initial credit balance in company_members table if provided
    if (initialCreditBalance > 0) {
      const { error: creditError } = await supabase
        .from('company_members')
        .update({ credit_balance: initialCreditBalance })
        .eq('id', newMember.id)

      if (creditError) {
        console.error('Failed to set initial credit balance:', creditError)
        // Don't fail the entire operation, just log the error
      }

      // Also try to update user wallet if user profile exists (optional)
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', email)
        .single()

      if (userProfile) {
        // First try to update existing wallet
        const { data: updateData, error: updateError } = await supabase
          .from('user_wallets')
          .update({ balance: initialCreditBalance })
          .eq('user_id', userProfile.id)
          .select()

        // If no rows were updated (empty array), insert a new wallet
        if (!updateError && (!updateData || updateData.length === 0)) {
          const { error: insertError } = await supabase
            .from('user_wallets')
            .insert({
              user_id: userProfile.id,
              balance: initialCreditBalance
            })

          if (insertError) {
            console.error('Failed to create wallet:', insertError)
          }
        } else if (updateError) {
          console.error('Failed to update wallet:', updateError)
        }
      }
    }

    // Send email notification to all company members (async, don't wait for it)
    capTableNotificationService.notifyMemberAdded(
      companyId,
      { name, email, position },
      user.id
    ).catch(error => {
      console.error('Failed to send member added notification:', error)
    })

    return NextResponse.json({ 
      message: 'Member added successfully', 
      member: newMember 
    }, { status: 201 })

  } catch (error) {
    console.error('Error adding company member:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
