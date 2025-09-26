'use client'

import { useState, useEffect, useRef } from 'react'
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
  onSessionStateChange?: (isActive: boolean) => void
}

export default function CapTableTab({ companyId, onSessionStateChange }: CapTableTabProps) {
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

  // Ref to track if session cancellation is in progress
  const sessionCancellationInProgress = useRef(false)
  
  // Track changes made during the session
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [sessionStartTime, setSessionStartTime] = useState<Date | null>(null)

  useEffect(() => {
    if (companyId) {
      loadCapTableData()
      loadSessionData()
    }
  }, [companyId])

  // Enhanced Page Visibility API and session management
  useEffect(() => {
    if (!hasActiveSession) {
      // Reset change tracking when session ends
      setHasUnsavedChanges(false)
      setSessionStartTime(null)
      return
    }

    // Set session start time when session becomes active
    if (hasActiveSession && !sessionStartTime) {
      setSessionStartTime(new Date())
    }

    console.log('Setting up session event listeners', { hasActiveSession, hasUnsavedChanges })

    const handleVisibilityChange = () => {
      console.log('Visibility change detected:', { 
        hidden: document.hidden, 
        hasActiveSession, 
        hasUnsavedChanges,
        cancellationInProgress: sessionCancellationInProgress.current 
      })
      
      if (document.hidden && hasActiveSession && !sessionCancellationInProgress.current) {
        // User switched away from tab or minimized browser
        handleSmartSessionTermination('Tab switched or browser minimized')
      }
    }

    const handleFocusChange = () => {
      console.log('Focus change detected:', { 
        hasFocus: document.hasFocus(), 
        hasActiveSession, 
        hasUnsavedChanges 
      })
      
      if (!document.hasFocus() && hasActiveSession && !sessionCancellationInProgress.current) {
        // Additional check for when window loses focus
        setTimeout(() => {
          if (!document.hasFocus() && hasActiveSession && !sessionCancellationInProgress.current) {
            handleSmartSessionTermination('Window lost focus')
          }
        }, 1000) // Small delay to avoid false positives
      }
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (hasActiveSession && !sessionCancellationInProgress.current) {
        // User is closing browser/tab
        handleSmartSessionTermination('Browser/tab closed', true)
        
        // Show confirmation dialog if there are unsaved changes
        if (hasUnsavedChanges) {
          event.preventDefault()
          event.returnValue = 'You have unsaved changes in your cap table session. Are you sure you want to leave?'
          return event.returnValue
        } else {
          event.preventDefault()
          event.returnValue = 'You have an active cap table session. Are you sure you want to leave?'
          return event.returnValue
        }
      }
    }

    const handleUnload = () => {
      if (hasActiveSession && !sessionCancellationInProgress.current) {
        // Final attempt to terminate session when page unloads
        handleSmartSessionTermination('Page unloaded', true)
      }
    }

    // Add multiple event listeners for better coverage
    document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('blur', handleFocusChange)
    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener('unload', handleUnload)

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('blur', handleFocusChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener('unload', handleUnload)
    }
  }, [hasActiveSession, hasUnsavedChanges, companyId, sessionStartTime])

  // Smart session termination based on whether changes were made
  const handleSmartSessionTermination = async (reason: string, isUnloading = false) => {
    if (sessionCancellationInProgress.current) return
    
    sessionCancellationInProgress.current = true
    
    console.log('Smart session termination triggered:', { 
      reason, 
      hasUnsavedChanges, 
      isUnloading,
      sessionStartTime 
    })
    
    try {
      // Decide whether to complete or cancel based on changes
      const action = hasUnsavedChanges ? 'complete' : 'cancel'
      
      const response = await fetch(`/api/companies/${companyId}/cap-table-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
        keepalive: isUnloading // Use keepalive for unload events
      })

      if (response.ok) {
        const result = await response.json()
        
        // Optimistic update
        setHasActiveSession(false)
        setSessionData(null)
        setHasUnsavedChanges(false)
        setSessionStartTime(null)
        
        if (action === 'cancel') {
          setOwnerCreditBalance(result.new_balance || ownerCreditBalance + 20)
          if (!isUnloading) {
            showNotification('info', `Session cancelled: ${reason}. No changes made - refunded $${result.refunded_amount?.toFixed(2) || '20.00'}`)
          }
        } else {
          if (!isUnloading) {
            showNotification('success', `Session completed: ${reason}. Changes saved and charged $20.00`)
          }
        }
        
        // Notify parent component
        if (onSessionStateChange) {
          onSessionStateChange(false)
        }
        
        if (!isUnloading) {
          // Reload data to get the latest state
          await loadCapTableData()
        }
      } else {
        console.error('Failed to terminate session:', await response.text())
        if (!isUnloading) {
          showNotification('error', 'Failed to terminate session automatically')
        }
      }
    } catch (error) {
      console.error('Error terminating session:', error)
      if (!isUnloading) {
        showNotification('error', 'Failed to terminate session automatically')
      }
    } finally {
      sessionCancellationInProgress.current = false
    }
  }

  // Legacy function for backward compatibility
  const handleSessionCancellation = async (reason: string, isUnloading = false) => {
    return handleSmartSessionTermination(reason, isUnloading)
  }

  const loadCapTableData = async () => {
    setLoading(true)
    setError(null)
    
    try {
      // Use the new optimized endpoint that gets all data in one call
      const response = await fetch(`/api/companies/${companyId}/cap-table-data`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to load cap table data')
      }

      const data = await response.json()
      
      // Update all state from the single API response
      setCompanyData({
        name: data.company.name,
        total_shares: data.company.total_shares,
        issued_shares: data.company.issued_shares
      })
      
      setMembers(data.members || [])
      setOwnerCreditBalance(data.company.owner_credit_balance || 0)
      setSessionData(data.session)
      setHasActiveSession(data.has_active_session)
      
      // Notify parent component of session state change
      if (onSessionStateChange) {
        onSessionStateChange(data.has_active_session)
      }

      // Log performance metadata if available
      if (data._metadata) {
        console.log('Cap table data loaded:', {
          cached: data._metadata.cached,
          optimized: data._metadata.optimized,
          timestamp: data._metadata.timestamp
        })
      }

    } catch (error) {
      console.error('Error loading cap table data:', error)
      setError(error instanceof Error ? error.message : 'Failed to load cap table data')
    } finally {
      setLoading(false)
    }
  }

  const loadSessionData = async () => {
    // Session data is now loaded as part of loadCapTableData
    // This function is kept for backward compatibility but does nothing
    return
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

  // Handler functions with retry mechanism and change tracking
  const handleMemberAdded = async () => {
    // Mark that changes have been made
    setHasUnsavedChanges(true)
    console.log('Member added - marking changes as unsaved')
    
    await loadCapTableDataWithRetry()
    showNotification('success', 'Member added successfully!')
  }

  const handleMemberUpdated = async () => {
    // Mark that changes have been made
    setHasUnsavedChanges(true)
    console.log('Member updated - marking changes as unsaved')
    
    await loadCapTableDataWithRetry()
    showNotification('success', 'Member updated successfully!')
  }

  const handleMemberDeleted = async () => {
    // Mark that changes have been made
    setHasUnsavedChanges(true)
    console.log('Member deleted - marking changes as unsaved')
    
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
      // Use the new optimized endpoint
      const response = await fetch(`/api/companies/${companyId}/cap-table-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'complete' })
      })

      if (response.ok) {
        // Optimistic update
        setHasActiveSession(false)
        setSessionData(null)
        
        // Notify parent component
        if (onSessionStateChange) {
          onSessionStateChange(false)
        }
        
        showNotification('success', 'Cap table session completed!')
        
        // Reload data to get the latest state
        await loadCapTableData()
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
        {/* Session Information Banner */}
        {hasActiveSession && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3 flex-1">
                <h3 className="text-sm font-medium text-blue-800">
                  Cap Table Session Active
                </h3>
                <div className="mt-2 text-sm text-blue-700">
                  <p>
                    Your session will automatically terminate if you switch tabs or close the browser. 
                    {hasUnsavedChanges 
                      ? " You have unsaved changes - you'll be charged $20.00 when the session ends."
                      : " No changes made yet - you'll receive a full refund if the session ends without changes."
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <h3 className="text-lg font-medium text-gray-900">Cap Table</h3>
            {hasActiveSession && (
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-sm text-green-600 font-medium">Session Active</span>
                {hasUnsavedChanges && (
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
                    <span className="text-sm text-orange-600 font-medium">Unsaved Changes</span>
                  </div>
                )}
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
