'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface CapTableMember {
  id: string
  name: string
  email: string
  position: string
  balance: number
  shares_owned: number
  share_percentage: number
}

interface CapTableTabProps {
  companyId: string
}

export default function CapTableTab({ companyId }: CapTableTabProps) {
  const [members, setMembers] = useState<CapTableMember[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (companyId) {
      loadCapTableData()
    }
  }, [companyId])

  const loadCapTableData = async () => {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    
    try {
      // First, get company members
      const { data: membersData, error: membersError } = await supabase
        .from('company_members')
        .select('id, name, email, position')
        .eq('company_id', companyId)
        .order('name')

      if (membersError) {
        console.error('Error fetching company members:', membersError)
        setError('Failed to load company members')
        return
      }

      if (!membersData || membersData.length === 0) {
        setMembers([])
        return
      }

      // Get user IDs for the member emails
      const memberEmails = membersData.map(member => member.email)
      const { data: usersData, error: usersError } = await supabase
        .from('profiles')
        .select('id, email')
        .in('email', memberEmails)

      if (usersError) {
        console.error('Error fetching user profiles:', usersError)
      }

      // Get wallet balances for these users
      const userIds = usersData?.map(user => user.id) || []
      const { data: walletsData, error: walletsError } = await supabase
        .from('user_wallets')
        .select('user_id, balance')
        .in('user_id', userIds)

      if (walletsError) {
        console.error('Error fetching wallet data:', walletsError)
      }

      // Get shareholding data
      const { data: shareholdingsData, error: shareholdingsError } = await supabase
        .from('member_shareholdings')
        .select('member_email, shares_owned, share_percentage')
        .eq('company_id', companyId)
        .in('member_email', memberEmails)

      if (shareholdingsError) {
        console.error('Error fetching shareholdings data:', shareholdingsError)
      }

      // Transform and combine the data
      const transformedMembers: CapTableMember[] = membersData.map(member => {
        // Find user profile for this member
        const userProfile = usersData?.find(user => user.email === member.email)
        
        // Find wallet balance for this user
        const wallet = walletsData?.find(wallet => wallet.user_id === userProfile?.id)
        
        // Find shareholding for this member
        const shareholding = shareholdingsData?.find(sh => sh.member_email === member.email)

        return {
          id: member.id,
          name: member.name,
          email: member.email,
          position: member.position,
          balance: wallet?.balance || 0,
          shares_owned: shareholding?.shares_owned || 0,
          share_percentage: shareholding?.share_percentage || 0
        }
      })

      setMembers(transformedMembers)
    } catch (error) {
      console.error('Error loading cap table data:', error)
      setError('Failed to load cap table data')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatPercentage = (percentage: number) => {
    return `${percentage.toFixed(2)}%`
  }

  const formatShares = (shares: number) => {
    return new Intl.NumberFormat('en-US').format(shares)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <div className="text-red-600 mb-4">
          <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-lg font-medium">Error Loading Cap Table</p>
          <p className="text-sm text-gray-600 mt-2">{error}</p>
        </div>
        <button
          onClick={loadCapTableData}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          Try Again
        </button>
      </div>
    )
  }

  if (members.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-400 mb-4">
          <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="text-lg font-medium text-gray-900">No Members Found</p>
          <p className="text-sm text-gray-600 mt-2">This company doesn't have any members yet.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Cap Table</h3>
        <div className="text-sm text-gray-600">
          {members.length} member{members.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Desktop Table */}
      <div className="hidden md:block">
        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Member Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Member ID (Email)
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Credit Balance
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Share in Company
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10">
                        <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                          <span className="text-sm font-medium text-indigo-600">
                            {member.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">{member.name}</div>
                        <div className="text-sm text-gray-500">{member.position}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{member.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {formatCurrency(member.balance)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      <div className="font-medium">{formatShares(member.shares_owned)} shares</div>
                      <div className="text-gray-500">{formatPercentage(member.share_percentage)}</div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobile Cards */}
      <div className="md:hidden space-y-4">
        {members.map((member) => (
          <div key={member.id} className="bg-white shadow rounded-lg p-4">
            <div className="flex items-center mb-3">
              <div className="flex-shrink-0 h-10 w-10">
                <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center">
                  <span className="text-sm font-medium text-indigo-600">
                    {member.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              </div>
              <div className="ml-3">
                <div className="text-sm font-medium text-gray-900">{member.name}</div>
                <div className="text-sm text-gray-500">{member.position}</div>
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Email:</span>
                <span className="text-sm text-gray-900">{member.email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Credit Balance:</span>
                <span className="text-sm font-medium text-gray-900">{formatCurrency(member.balance)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-500">Shares:</span>
                <span className="text-sm text-gray-900">
                  {formatShares(member.shares_owned)} ({formatPercentage(member.share_percentage)})
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
