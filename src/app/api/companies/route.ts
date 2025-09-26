import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cache, cacheKeys, cacheTTL, withCache } from '@/lib/cache'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Use cache to avoid repeated database calls
    const companies = await withCache(
      cacheKeys.userCompanies(user.id),
      async () => {
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
          throw new Error('Failed to fetch companies')
        }

        // Get member counts for all companies in a single query
        const companyIds = companiesData?.map((c: any) => c.id) || []
        
        if (companyIds.length === 0) {
          return []
        }

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
        const companiesWithMembers = companiesData?.map((company: any) => ({
          ...company,
          member_count: memberCountMap.get(company.id) || 0
        })) || []

        return companiesWithMembers
      },
      cacheTTL.companyData // 10 minutes cache
    )

    // Also cache country and state data for the frontend
    const countryStateData = await withCache(
      'countries-states-data',
      async () => {
        const [countriesRes, statesRes] = await Promise.all([
          supabase.from('countries').select('code, name').order('name'),
          supabase.from('states').select('code, name, country_code').order('name')
        ])
        
        return {
          countries: countriesRes.data || [],
          states: statesRes.data || []
        }
      },
      cacheTTL.long // 30 minutes cache for rarely changing data
    )

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

// Helper function to invalidate companies cache when needed
export async function invalidateCompaniesCache(userId: string) {
  cache.delete(cacheKeys.userCompanies(userId))
  cache.delete('countries-states-data')
}
