import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PUT /api/companies/[id]/members/[memberId] - Update a member
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  const resolvedParams = await params
  const companyId = resolvedParams.id
  const memberId = resolvedParams.memberId
  
  try {
    const supabase = await createClient()
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      console.error('Authentication error:', userError)
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized',
        code: 'AUTH_FAILED'
      }, { status: 401 })
    }

    // Parse and validate request body
    let body
    try {
      body = await request.json()
    } catch (parseError) {
      console.error('JSON parse error:', parseError)
      return NextResponse.json({ 
        success: false, 
        error: 'Invalid JSON in request body',
        code: 'INVALID_JSON'
      }, { status: 400 })
    }

    const { name, position, shares, creditBalance } = body

    console.log(`Updating member ${memberId} for company ${companyId}:`, {
      name: name ? '[REDACTED]' : undefined,
      position,
      shares,
      creditBalance,
      userId: user.id
    })

    // Input validation
    if (name !== undefined && (!name || typeof name !== 'string' || name.trim().length === 0)) {
      return NextResponse.json({ 
        success: false, 
        error: 'Name must be a non-empty string',
        code: 'INVALID_NAME'
      }, { status: 400 })
    }

    if (position !== undefined) {
      const validPositions = ['CEO', 'CTO', 'COO', 'Secretary']
      if (!validPositions.includes(position)) {
        return NextResponse.json({ 
          success: false, 
          error: `Invalid position. Must be one of: ${validPositions.join(', ')}`,
          code: 'INVALID_POSITION'
        }, { status: 400 })
      }
    }

    if (shares !== undefined) {
      if (!Number.isInteger(shares) || shares < 0) {
        return NextResponse.json({ 
          success: false, 
          error: 'Shares must be a non-negative integer',
          code: 'INVALID_SHARES'
        }, { status: 400 })
      }
    }

    if (creditBalance !== undefined) {
      if (typeof creditBalance !== 'number' || creditBalance < 0 || !isFinite(creditBalance)) {
        return NextResponse.json({ 
          success: false, 
          error: 'Credit balance must be a non-negative number',
          code: 'INVALID_CREDIT_BALANCE'
        }, { status: 400 })
      }
    }

    // Verify user owns this company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, created_by, total_shares, issued_shares')
      .eq('id', companyId)
      .eq('created_by', user.id)
      .single()

    if (companyError) {
      console.error('Company lookup error:', companyError)
      return NextResponse.json({ 
        success: false, 
        error: 'Company not found or access denied',
        code: 'COMPANY_NOT_FOUND'
      }, { status: 404 })
    }

    if (!company) {
      return NextResponse.json({ 
        success: false, 
        error: 'Company not found or access denied',
        code: 'COMPANY_ACCESS_DENIED'
      }, { status: 404 })
    }

    // Validate company has required configuration for share updates
    if (shares !== undefined && !company.total_shares) {
      return NextResponse.json({ 
        success: false, 
        error: 'Company must have total shares configured before updating member shares',
        code: 'COMPANY_SHARES_NOT_CONFIGURED'
      }, { status: 400 })
    }

    // Get current member data
    const { data: currentMember, error: memberError } = await supabase
      .from('company_members')
      .select('*')
      .eq('id', memberId)
      .eq('company_id', companyId)
      .single()

    if (memberError) {
      console.error('Member lookup error:', memberError)
      return NextResponse.json({ 
        success: false, 
        error: 'Member not found',
        code: 'MEMBER_NOT_FOUND'
      }, { status: 404 })
    }

    if (!currentMember) {
      return NextResponse.json({ 
        success: false, 
        error: 'Member not found',
        code: 'MEMBER_NOT_FOUND'
      }, { status: 404 })
    }

    // Validate member email
    if (!currentMember.email || !currentMember.email.includes('@')) {
      console.error('Invalid member email:', currentMember.email)
      return NextResponse.json({ 
        success: false, 
        error: 'Member has invalid email address',
        code: 'INVALID_MEMBER_EMAIL'
      }, { status: 400 })
    }

    // Get current shareholding
    const { data: currentShareholding, error: shareholdingError } = await supabase
      .from('member_shareholdings')
      .select('shares_owned')
      .eq('company_id', companyId)
      .eq('member_email', currentMember.email)
      .single()

    if (shareholdingError && shareholdingError.code !== 'PGRST116') { // PGRST116 is "not found"
      console.error('Shareholding lookup error:', shareholdingError)
      return NextResponse.json({ 
        success: false, 
        error: 'Failed to retrieve current shareholding',
        code: 'SHAREHOLDING_LOOKUP_FAILED'
      }, { status: 500 })
    }

    const currentShares = currentShareholding?.shares_owned || 0

    // Validate share allocation if shares are being updated
    if (shares !== undefined) {
      const sharesDifference = shares - currentShares
      const currentIssuedShares = company.issued_shares || 0
      
      if (sharesDifference > 0 && company.total_shares && 
          (currentIssuedShares + sharesDifference > company.total_shares)) {
        return NextResponse.json({ 
          success: false,
          error: `Cannot allocate ${shares} shares. Would exceed total authorized shares (${company.total_shares}). Currently issued: ${currentIssuedShares}, Available: ${company.total_shares - currentIssuedShares}`,
          code: 'SHARES_EXCEED_TOTAL'
        }, { status: 400 })
      }
    }

    // Prepare update operations
    const operations = []
    const updatedFields = []

    // 1. Update member basic info
    const memberUpdateData: any = {}
    if (name && name.trim() !== currentMember.name) {
      memberUpdateData.name = name.trim()
      updatedFields.push('name')
    }
    if (position && position !== currentMember.position) {
      memberUpdateData.position = position
      updatedFields.push('position')
    }

    if (Object.keys(memberUpdateData).length > 0) {
      operations.push(async () => {
        const { error } = await supabase
          .from('company_members')
          .update(memberUpdateData)
          .eq('id', memberId)

        if (error) {
          throw new Error(`Failed to update member info: ${error.message}`)
        }
      })
    }

    // 2. Update shareholding if shares provided
    if (shares !== undefined && shares !== currentShares) {
      const sharePercentage = company.total_shares ? (shares / company.total_shares) * 100 : 0
      
      operations.push(async () => {
        if (shares > 0) {
          const { error } = await supabase
            .from('member_shareholdings')
            .upsert({
              company_id: companyId,
              member_email: currentMember.email,
              shares_owned: shares,
              share_percentage: sharePercentage
            }, {
              onConflict: 'company_id,member_email'
            })

          if (error) {
            throw new Error(`Failed to update shareholding: ${error.message}`)
          }
        } else {
          // Remove shareholding record if shares = 0
          const { error } = await supabase
            .from('member_shareholdings')
            .delete()
            .eq('company_id', companyId)
            .eq('member_email', currentMember.email)

          if (error) {
            throw new Error(`Failed to remove shareholding: ${error.message}`)
          }
        }
      })

      // 3. Update company issued shares
      operations.push(async () => {
        const sharesDifference = shares - currentShares
        const newIssuedShares = Math.max(0, (company.issued_shares || 0) + sharesDifference)
        
        const { error } = await supabase
          .from('companies')
          .update({ issued_shares: newIssuedShares })
          .eq('id', companyId)

        if (error) {
          throw new Error(`Failed to update company issued shares: ${error.message}`)
        }
      })

      updatedFields.push('shares')
    }

    // 4. Update credit balance if provided
    if (creditBalance !== undefined) {
      operations.push(async () => {
        console.log(`Updating credit balance for member: ${currentMember.email} to ${creditBalance}`)
        
        // Store credit balance directly in the company_members table
        // This allows admins to manage member credit balances without requiring user accounts
        const { error: memberBalanceError } = await supabase
          .from('company_members')
          .update({ credit_balance: creditBalance })
          .eq('id', memberId)

        if (memberBalanceError) {
          console.error('Member credit balance update error:', memberBalanceError)
          throw new Error(`Failed to update member credit balance: ${memberBalanceError.message}`)
        }

        console.log(`Successfully updated member credit balance to ${creditBalance}`)

        // Also update user wallet if the member has a user account (optional)
        const { data: userProfile } = await supabase
          .from('profiles')
          .select('id')
          .ilike('email', currentMember.email)
          .single()

        if (userProfile?.id) {
          console.log(`Also updating user wallet for profile ID: ${userProfile.id}`)
          
          const { error: walletError } = await supabase
            .from('user_wallets')
            .upsert({
              user_id: userProfile.id,
              balance: creditBalance
            }, {
              onConflict: 'user_id'
            })

          if (walletError) {
            console.warn('User wallet update failed (non-critical):', walletError)
            // Don't throw error here - member balance update is the primary operation
          } else {
            console.log('User wallet also updated successfully')
          }
        }
      })

      updatedFields.push('creditBalance')
    }

    // Execute all operations
    if (operations.length === 0) {
      return NextResponse.json({ 
        success: true,
        message: 'No changes detected',
        data: { memberId, updatedFields: [] }
      })
    }

    // Execute operations sequentially to maintain data consistency
    for (let i = 0; i < operations.length; i++) {
      try {
        await operations[i]()
      } catch (operationError) {
        console.error(`Operation ${i + 1} failed:`, operationError)
        throw operationError
      }
    }

    console.log(`Successfully updated member ${memberId}:`, { updatedFields })

    return NextResponse.json({ 
      success: true,
      message: 'Member updated successfully',
      data: {
        memberId,
        updatedFields,
        newShares: shares,
        newBalance: creditBalance
      }
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    const errorStack = error instanceof Error ? error.stack : undefined
    
    console.error('Error updating company member:', {
      error: errorMessage,
      stack: errorStack,
      memberId,
      companyId,
      userId: (await createClient()).auth.getUser().then(r => r.data?.user?.id).catch(() => 'unknown')
    })
    
    return NextResponse.json({ 
      success: false,
      error: 'Failed to update member',
      code: 'MEMBER_UPDATE_FAILED',
      details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
    }, { status: 500 })
  }
}

// DELETE /api/companies/[id]/members/[memberId] - Delete a member
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
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
    const memberId = resolvedParams.memberId

    // Verify user owns this company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, created_by, issued_shares')
      .eq('id', companyId)
      .eq('created_by', user.id)
      .single()

    if (companyError || !company) {
      return NextResponse.json({ error: 'Company not found or access denied' }, { status: 404 })
    }

    // Get member data before deletion
    const { data: member, error: memberError } = await supabase
      .from('company_members')
      .select('email')
      .eq('id', memberId)
      .eq('company_id', companyId)
      .single()

    if (memberError || !member) {
      return NextResponse.json({ error: 'Member not found' }, { status: 404 })
    }

    // Get current shareholding to adjust company issued shares
    const { data: shareholding } = await supabase
      .from('member_shareholdings')
      .select('shares_owned')
      .eq('company_id', companyId)
      .eq('member_email', member.email)
      .single()

    const memberShares = shareholding?.shares_owned || 0

    // Delete member (this will cascade to related records due to foreign key constraints)
    const { error: deleteMemberError } = await supabase
      .from('company_members')
      .delete()
      .eq('id', memberId)

    if (deleteMemberError) {
      return NextResponse.json({ error: 'Failed to delete member' }, { status: 500 })
    }

    // Delete shareholding record
    await supabase
      .from('member_shareholdings')
      .delete()
      .eq('company_id', companyId)
      .eq('member_email', member.email)

    // Update company issued shares
    if (memberShares > 0) {
      const newIssuedShares = Math.max(0, (company.issued_shares || 0) - memberShares)
      
      const { error: updateCompanyError } = await supabase
        .from('companies')
        .update({ issued_shares: newIssuedShares })
        .eq('id', companyId)

      if (updateCompanyError) {
        console.error('Failed to update company issued shares:', updateCompanyError)
      }
    }

    return NextResponse.json({ message: 'Member deleted successfully' })

  } catch (error) {
    console.error('Error deleting company member:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
