'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import AddMemberModal from './AddMemberModal'
import EditMemberModal from './EditMemberModal'
import DeleteConfirmationDialog from './DeleteConfirmationDialog'
import CapTablePaymentModal from './CapTablePaymentModal'
import Notification from './Notification'

interface CapTableMember {
  id: string
  name: string
  email: string
  position: string
  balance: number
  shares_owned: number
  share_percentage: number
}

interface CompanyData {
  total_shares: number | null
  issued_shares: number | null
  name?: string
}

interface SessionData {
  id: string
  session_fee: number
  paid_at: string
  is_active: boolean
}

interface CapTableTabProps {
  companyId: string
}

export default function CapTableTab({ companyId }: CapTableTabProps) {
  const [members, setMembers] = useState<CapTableMember[]>([])
  const [companyData, setCompanyData] = useState<CompanyData | null>(null)
  const [ownerCreditBalance, setOwnerCreditBalance] = useState<number>(0)
  const [sessionData, setSessionData] = useState<SessionData | null>(null)
  const [hasActiveSession, setHasActiveSession] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [selectedMember, setSelectedMember] = useState<CapTableMember | null>(null)
  
  // Notification state
  const [notification, setNotification] = useState<{
    type: 'success' | 'error' | 'info'
    message: string
    isVisible: boolean
  }>({
    type: 'success',
    message: '',
    isVisible: false
  })

  useEffect(() => {
    if (companyId) {
      loadCapTableData()
      loadSessionData()
    }
  }, [companyId])

  const loadCapTableData = async () => {
    setLoading(true)
    setError(null)
    const supabase = createClient()
    
    try {
      // Get the current user to identify the owner
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        setError('Failed to identify user')
        return
      }

      // Get user profile to get their email
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .single()

      if (profileError || !profile) {
        setError('Failed to load user profile')
        return
      }

      // First, get company data including share information
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select('name, total_shares, issued_shares')
        .eq('id', companyId)
        .single()

      if (companyError) {
        console.error('Error fetching company data:', companyError)
        setError('Failed to load company data')
        return
      }

      setCompanyData(company)

      // Get company members with credit balance
      const { data: membersData, error: membersError } = await supabase
        .from('company_members')
        .select('id, name, email, position, credit_balance')
        .eq('company_id', companyId)
        .order('name')

      if (membersError) {
        console.error('Error fetching company members:', membersError)
        setError('Failed to load company members')
        return
      }

      if (!membersData || membersData.length === 0) {
        setMembers([])
        setOwnerCreditBalance(0)
        return
      }

      // Find the owner member by matching email
      const ownerMember = membersData.find(member => member.email === profile.email)
      if (ownerMember) {
        setOwnerCreditBalance(ownerMember.credit_balance || 0)
      } else {
        setOwnerCreditBalance(0)
      }

      // Get shareholding data
      const memberEmails = membersData.map(member => member.email)
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
        // Find shareholding for this member
        const shareholding = shareholdingsData?.find(sh => sh.member_email === member.email)

        return {
          id: member.id,
          name: member.name,
          email: member.email,
          position: member.position,
          balance: member.credit_balance || 0, // Use credit_balance from company_members table
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

  const loadSessionData = async () => {
    try {
      const response = await fetch(`/api/companies/${companyId}/cap-table-session`)
      if (response.ok) {
        const data = await response.json()
        setSessionData(data.session)
        setHasActiveSession(data.has_active_session)
        
        // Update owner credit balance from the API response
        if (data.company && data.company.owner_credit_balance !== undefined) {
          setOwnerCreditBalance(data.company.owner_credit_balance)
        }
        
        // Update company data
        if (data.company && companyData) {
          setCompanyData(prev => prev ? {
            ...prev,
            name: data.company.name
          } : null)
        }
      }
    } catch (error) {
      console.error('Error loading session data:', error)
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

  // Handler functions with retry mechanism
  const handleMemberAdded = async () => {
    await loadCapTableDataWithRetry()
    showNotification('success', 'Member added successfully!')
  }

  const handleMemberUpdated = async () => {
    await loadCapTableDataWithRetry()
    showNotification('success', 'Member updated successfully!')
  }

  const handleMemberDeleted = async () => {
    await loadCapTableDataWithRetry()
    showNotification('success', 'Member deleted successfully!')
  }

  const handlePaymentSuccess = async () => {
    await loadCapTableDataWithRetry()
    await loadSessionData()
    showNotification('success', 'Cap table session started! You can now make changes.')
  }

  const handleCompleteSession = async () => {
    try {
      const response = await fetch(`/api/companies/${companyId}/cap-table-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'complete' })
      })

      if (response.ok) {
        await loadSessionData()
        showNotification('success', 'Cap table session completed!')
      } else {
        const error = await response.json()
        showNotification('error', error.error || 'Failed to complete session')
      }
    } catch (error) {
      console.error('Error completing session:', error)
      showNotification('error', 'Failed to complete session')
    }
  }

  const handleCapTableAction = (action: () => void) => {
    if (hasActiveSession) {
      action()
    } else {
      setShowPaymentModal(true)
    }
  }

  // Load data with retry mechanism to handle potential timing issues
  const loadCapTableDataWithRetry = async (retries = 2) => {
    for (let i = 0; i <= retries; i++) {
      try {
        await loadCapTableData()
        break // Success, exit retry loop
      } catch (error) {
        console.warn(`Data load attempt ${i + 1} failed:`, error)
        if (i < retries) {
          // Wait a bit before retrying
          await new Promise(resolve => setTimeout(resolve, 500))
        } else {
          console.error('All data load attempts failed')
        }
      }
    }
  }

  const handleError = (message: string) => {
    showNotification('error', message)
  }

  const handleEditMember = (member: CapTableMember) => {
    handleCapTableAction(() => {
      setSelectedMember(member)
      setShowEditModal(true)
    })
  }

  const handleDeleteMember = (member: CapTableMember) => {
    handleCapTableAction(() => {
      setSelectedMember(member)
      setShowDeleteDialog(true)
    })
  }

  const handleAddMember = () => {
    handleCapTableAction(() => {
      setShowAddModal(true)
    })
  }

  const showNotification = (type: 'success' | 'error' | 'info', message: string) => {
    setNotification({ type, message, isVisible: true })
  }

  const hideNotification = () => {
    setNotification(prev => ({ ...prev, isVisible: false }))
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
          <div className="flex items-center space-x-4">
            <h3 className="text-lg font-medium text-gray-900">Cap Table</h3>
            {hasActiveSession && (
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-green-600 font-medium">Session Active</span>
              </div>
            )}
          </div>
          <div className="flex items-center space-x-4">
            <div className="text-sm text-gray-600">
              Owner Credit: <span className="font-medium">${ownerCreditBalance.toFixed(2)}</span>
            </div>
            <div className="text-sm text-gray-600">
              {members.length} member{members.length !== 1 ? 's' : ''}
            </div>
            {hasActiveSession && (
              <button
                onClick={handleCompleteSession}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Complete Changes</span>
              </button>
            )}
            <button
              onClick={handleAddMember}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              <span>Add Member</span>
            </button>
          </div>
        </div>

        {/* Share Summary */}
        {companyData && companyData.total_shares && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">Share Summary</h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-500">Total Authorized</div>
                <div className="text-lg font-semibold text-gray-900">
                  {formatShares(companyData.total_shares)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Issued</div>
                <div className="text-lg font-semibold text-gray-900">
                  {formatShares(companyData.issued_shares || 0)}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Available</div>
                <div className="text-lg font-semibold text-green-600">
                  {formatShares(companyData.total_shares - (companyData.issued_shares || 0))}
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Issued %</div>
                <div className="text-lg font-semibold text-gray-900">
                  {formatPercentage(((companyData.issued_shares || 0) / companyData.total_shares) * 100)}
                </div>
              </div>
            </div>
          </div>
        )}

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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditMember(member)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDeleteMember(member)}
                        className="text-red-600 hover:text-red-900"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
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
              <div className="ml-3 flex-1">
                <div className="text-sm font-medium text-gray-900">{member.name}</div>
                <div className="text-sm text-gray-500">{member.position}</div>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => handleEditMember(member)}
                  className="text-indigo-600 hover:text-indigo-900"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button
                  onClick={() => handleDeleteMember(member)}
                  className="text-red-600 hover:text-red-900"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
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

      {/* Modals and Notifications */}
      <AddMemberModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        companyId={companyId}
        companyData={companyData}
        onMemberAdded={handleMemberAdded}
        onError={handleError}
      />

      <EditMemberModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        companyId={companyId}
        companyData={companyData}
        member={selectedMember}
        onMemberUpdated={handleMemberUpdated}
        onError={handleError}
      />

      <DeleteConfirmationDialog
        isOpen={showDeleteDialog}
        onClose={() => setShowDeleteDialog(false)}
        companyId={companyId}
        member={selectedMember}
        onMemberDeleted={handleMemberDeleted}
      />

      <CapTablePaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        companyId={companyId}
        companyName={companyData?.name || 'Company'}
        currentBalance={ownerCreditBalance}
        onPaymentSuccess={handlePaymentSuccess}
        onError={handleError}
      />

      <Notification
        type={notification.type}
        message={notification.message}
        isVisible={notification.isVisible}
        onClose={hideNotification}
      />
    </div>
  )
}
