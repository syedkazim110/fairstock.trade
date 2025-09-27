import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cacheKeys, cacheTTL, withCache, clearUserCache } from '@/lib/cache'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Fetch companies data directly without caching to avoid cross-user issues
    // Single optimized query that gets all company data including member counts
    // This replaces multiple sequential queries with one efficient JOIN
    const { data: companiesData, error: companiesError } = await supabase
      .from('user_accessible_companies')
      .select(`
        id,
        name,
        address,
        country_code,
        state_code,
        business_structure,
        created_at,
        created_by,
        user_role
      `)
      .order('created_at', { ascending: false })

    if (companiesError) {
      console.error('Error fetching companies:', companiesError)
      return NextResponse.json({ error: 'Failed to fetch companies' }, { status: 500 })
    }

    // Get member counts for all companies in a single query
    const companyIds = companiesData?.map((c: any) => c.id) || []
    
    let companies = []
    if (companyIds.length === 0) {
      companies = []
    } else {
      const { data: memberCounts, error: memberError } = await supabase
        .from('company_members')
        .select('company_id, id')
        .in('company_id', companyIds)

      if (memberError) {
        console.error('Error fetching member counts:', memberError)
        // Continue without member counts rather than failing
      }

      // Create a map of company_id to member count
      const memberCountMap = new Map<string, number>()
      memberCounts?.forEach((member: any) => {
        const currentCount = memberCountMap.get(member.company_id) || 0
        memberCountMap.set(member.company_id, currentCount + 1)
      })

      // Combine companies with their member counts
      companies = companiesData?.map((company: any) => ({
        ...company,
        member_count: memberCountMap.get(company.id) || 0
      })) || []
    }

    // Get country and state data (can be cached globally as it's not user-specific)
    const [countriesRes, statesRes] = await Promise.all([
      supabase.from('countries').select('code, name').order('name'),
      supabase.from('states').select('code, name, country_code').order('name')
    ])
    
    const countryStateData = {
      countries: countriesRes.data || [],
      states: statesRes.data || []
    }

    return NextResponse.json({
      companies,
      countryStateData,
      cached: true // Indicate this response may be cached
    })

  } catch (error) {
    console.error('Error in GET /api/companies:', error)
    return NextResponse.json(
      { error: 'Internal server error' }, 
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse request body
    const body = await request.json()
    const { companyData, treasuryData, members } = body

    // Validate required fields
    if (!companyData?.name || !companyData?.address || !companyData?.country_code || 
        !companyData?.state_code || !companyData?.business_structure) {
      return NextResponse.json({ error: 'Missing required company fields' }, { status: 400 })
    }

    if (!treasuryData?.total_shares || !treasuryData?.par_value || treasuryData.issued_shares === undefined) {
      return NextResponse.json({ error: 'Missing required treasury fields' }, { status: 400 })
    }

    if (!members || !Array.isArray(members) || members.length === 0) {
      return NextResponse.json({ error: 'At least one member is required' }, { status: 400 })
    }

    // Validate members
    for (const member of members) {
      if (!member.name || !member.email || !member.position) {
        return NextResponse.json({ error: 'Missing required member fields' }, { status: 400 })
      }
    }

    // Create company with treasury data
    const companyPayload = {
      ...companyData,
      ...treasuryData,
      created_by: user.id
    }

    console.log('Creating company with data:', companyPayload)
    
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .insert(companyPayload)
      .select()
      .single()
    
    if (companyError) {
      console.error('Company creation error:', companyError)
      throw companyError
    }
    
    console.log('Company created successfully:', company)
    
    // Create members with proper credit balance conversion
    const membersData = members.map((member: any) => ({
      name: member.name,
      email: member.email,
      position: member.position,
      credit_balance: member.credit_balance && member.credit_balance.trim() 
        ? parseFloat(member.credit_balance.toString().replace(/,/g, '')) 
        : 0,
      company_id: company.id
    }))
    
    console.log('Creating members with data:', membersData)
    
    const { error: membersError } = await supabase
      .from('company_members')
      .insert(membersData)
    
    if (membersError) {
      console.error('Members creation error:', membersError)
      throw membersError
    }
    
    console.log('Members created successfully')
    
    // Invalidate the companies cache for this user
    await invalidateCompaniesCache(user.id)
    
    return NextResponse.json({
      message: 'Company created successfully',
      company: company,
      redirect: '/dashboard/companies?success=company-created'
    })
    
  } catch (error: any) {
    console.error('Error creating company:', error)
    
    // Extract more detailed error information
    let errorMessage = 'Failed to create company. Please try again.'
    
    if (error?.message) {
      console.error('Error message:', error.message)
      
      // Handle specific error types
      if (error.message.includes('violates check constraint')) {
        errorMessage = 'Invalid business structure or position selected.'
      } else if (error.message.includes('violates foreign key constraint')) {
        errorMessage = 'Invalid country or state selection.'
      } else if (error.message.includes('duplicate key')) {
        errorMessage = 'A company with this information already exists.'
      } else if (error.message.includes('not-null constraint')) {
        errorMessage = 'Please fill in all required fields.'
      } else {
        errorMessage = `Error: ${error.message}`
      }
    }
    
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
}

// Helper function to invalidate companies cache when needed
export async function invalidateCompaniesCache(userId: string) {
  clearUserCache(userId)
}
