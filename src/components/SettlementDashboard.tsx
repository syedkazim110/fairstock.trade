'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface SettlementAllocation {
  allocation_id: string
  bidder_email: string
  bidder_name?: string
  allocated_quantity: number
  total_amount: number
  settlement_status: 'pending_payment' | 'payment_received' | 'shares_transferred' | 'completed'
  payment_reference?: string
  settlement_updated_at?: string
  payment_confirmed_at?: string
  shares_transferred_at?: string
  completed_at?: string
}

interface SettlementSummary {
  total_successful_allocations: number
  pending_payment_count: number
  payment_received_count: number
  shares_transferred_count: number
  completed_count: number
  total_settlement_amount: number
  confirmed_payment_amount: number
  pending_payment_amount: number
  settlement_completion_percentage: number
  payment_collection_percentage: number
  all_settlements_completed: boolean
  has_pending_payments: boolean
}

interface SettlementDashboardProps {
  companyId: string
  auctionId: string
  auctionTitle: string
  onClose: () => void
}

export default function SettlementDashboard({
  companyId,
  auctionId,
  auctionTitle,
  onClose
}: SettlementDashboardProps) {
  const [loading, setLoading] = useState(true)
  const [settlementData, setSettlementData] = useState<{
    summary: SettlementSummary
    allocations: {
      pending_payment: SettlementAllocation[]
      payment_received: SettlementAllocation[]
      shares_transferred: SettlementAllocation[]
      completed: SettlementAllocation[]
    }
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selectedAllocations, setSelectedAllocations] = useState<string[]>([])
  const [processingAction, setProcessingAction] = useState<string | null>(null)
  const [showActionModal, setShowActionModal] = useState(false)
  const [actionType, setActionType] = useState<'confirm_payment' | 'transfer_shares' | 'complete_settlement' | null>(null)

  useEffect(() => {
    loadSettlementData()
  }, [companyId, auctionId])

  const loadSettlementData = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/companies/${companyId}/auctions/${auctionId}/settlement`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to load settlement data')
      }

      const data = await response.json()
      setSettlementData({
        summary: data.settlement_summary,
        allocations: data.allocations.by_status
      })

    } catch (error) {
      console.error('Error loading settlement data:', error)
      setError(error instanceof Error ? error.message : 'Failed to load settlement data')
    } finally {
      setLoading(false)
    }
  }

  const handleBulkAction = async (action: string, allocationIds: string[], paymentReference?: string, notes?: string) => {
    try {
      setProcessingAction(action)

      const response = await fetch(`/api/companies/${companyId}/auctions/${auctionId}/settlement`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action,
          allocation_ids: allocationIds,
          payment_reference: paymentReference,
          notes: notes
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || `Failed to ${action}`)
      }

      const result = await response.json()
      
      // Show success message
      if (result.success) {
        alert(`Successfully processed ${result.processed_count} settlements`)
      } else if (result.processed_count > 0) {
        alert(`Processed ${result.processed_count} settlements. ${result.error_count} failed.`)
      }

      // Reload data and clear selections
      await loadSettlementData()
      setSelectedAllocations([])
      setShowActionModal(false)
      setActionType(null)

    } catch (error) {
      console.error(`Error performing ${action}:`, error)
      alert(`Failed to ${action}: ${error instanceof Error ? error.message : 'Please try again'}`)
    } finally {
      setProcessingAction(null)
    }
  }

  const handleSelectAllocation = (allocationId: string, checked: boolean) => {
    if (checked) {
      setSelectedAllocations(prev => [...prev, allocationId])
    } else {
      setSelectedAllocations(prev => prev.filter(id => id !== allocationId))
    }
  }

  const handleSelectAll = (allocations: SettlementAllocation[], checked: boolean) => {
    const allocationIds = allocations.map(a => a.allocation_id)
    if (checked) {
      setSelectedAllocations(prev => [...new Set([...prev, ...allocationIds])])
    } else {
      setSelectedAllocations(prev => prev.filter(id => !allocationIds.includes(id)))
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending_payment':
        return 'bg-yellow-100 text-yellow-800'
      case 'payment_received':
        return 'bg-blue-100 text-blue-800'
      case 'shares_transferred':
        return 'bg-purple-100 text-purple-800'
      case 'completed':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending_payment':
        return 'Pending Payment'
      case 'payment_received':
        return 'Payment Received'
      case 'shares_transferred':
        return 'Shares Transferred'
      case 'completed':
        return 'Completed'
      default:
        return status
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const renderAllocationTable = (
    title: string,
    allocations: SettlementAllocation[],
    actionButton?: React.ReactNode
  ) => {
    if (allocations.length === 0) return null

    const allSelected = allocations.every(a => selectedAllocations.includes(a.allocation_id))
    const someSelected = allocations.some(a => selectedAllocations.includes(a.allocation_id))

    return (
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium text-gray-900">
              {title} ({allocations.length})
            </h3>
            {actionButton}
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={input => {
                      if (input) input.indeterminate = someSelected && !allSelected
                    }}
                    onChange={(e) => handleSelectAll(allocations, e.target.checked)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bidder
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Shares
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Updated
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reference
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {allocations.map((allocation) => (
                <tr key={allocation.allocation_id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <input
                      type="checkbox"
                      checked={selectedAllocations.includes(allocation.allocation_id)}
                      onChange={(e) => handleSelectAllocation(allocation.allocation_id, e.target.checked)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {allocation.bidder_email}
                    </div>
                    {allocation.bidder_name && (
                      <div className="text-sm text-gray-500">
                        {allocation.bidder_name}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {allocation.allocated_quantity.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatCurrency(allocation.total_amount)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(allocation.settlement_status)}`}>
                      {getStatusText(allocation.settlement_status)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(allocation.settlement_updated_at)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {allocation.payment_reference || '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
          <div className="flex justify-center items-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6">
          <div className="text-center py-12">
            <div className="text-red-600 mb-4">
              <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-lg font-medium text-gray-900">Error Loading Settlement Data</p>
              <p className="text-sm text-gray-600 mt-2">{error}</p>
            </div>
            <button
              onClick={onClose}
              className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-md text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-7xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Settlement Management</h2>
              <p className="text-sm text-gray-600">{auctionTitle}</p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6 max-h-[75vh] overflow-y-auto">
          {settlementData && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="text-2xl font-bold text-yellow-900">
                    {settlementData.summary.pending_payment_count}
                  </div>
                  <div className="text-sm text-yellow-700">Pending Payment</div>
                  <div className="text-xs text-yellow-600 mt-1">
                    {formatCurrency(settlementData.summary.pending_payment_amount)}
                  </div>
                </div>
                
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="text-2xl font-bold text-blue-900">
                    {settlementData.summary.payment_received_count}
                  </div>
                  <div className="text-sm text-blue-700">Payment Received</div>
                </div>
                
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="text-2xl font-bold text-purple-900">
                    {settlementData.summary.shares_transferred_count}
                  </div>
                  <div className="text-sm text-purple-700">Shares Transferred</div>
                </div>
                
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="text-2xl font-bold text-green-900">
                    {settlementData.summary.completed_count}
                  </div>
                  <div className="text-sm text-green-700">Completed</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="bg-gray-50 rounded-lg p-4 mb-6">
                <div className="flex justify-between text-sm text-gray-600 mb-2">
                  <span>Settlement Progress</span>
                  <span>{settlementData.summary.settlement_completion_percentage}% Complete</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-green-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${settlementData.summary.settlement_completion_percentage}%` }}
                  ></div>
                </div>
              </div>

              {/* Settlement Tables */}
              {renderAllocationTable(
                "Pending Payments",
                settlementData.allocations.pending_payment,
                settlementData.allocations.pending_payment.length > 0 && (
                  <button
                    onClick={() => {
                      const selectedPending = settlementData.allocations.pending_payment
                        .filter(a => selectedAllocations.includes(a.allocation_id))
                      if (selectedPending.length === 0) {
                        alert('Please select at least one allocation to confirm payment')
                        return
                      }
                      setActionType('confirm_payment')
                      setShowActionModal(true)
                    }}
                    disabled={!selectedAllocations.some(id => 
                      settlementData.allocations.pending_payment.some(a => a.allocation_id === id)
                    )}
                    className="bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md text-sm font-medium"
                  >
                    Confirm Payment ({selectedAllocations.filter(id => 
                      settlementData.allocations.pending_payment.some(a => a.allocation_id === id)
                    ).length})
                  </button>
                )
              )}

              {renderAllocationTable(
                "Ready for Share Transfer",
                settlementData.allocations.payment_received,
                settlementData.allocations.payment_received.length > 0 && (
                  <button
                    onClick={() => {
                      const selectedReceived = settlementData.allocations.payment_received
                        .filter(a => selectedAllocations.includes(a.allocation_id))
                      if (selectedReceived.length === 0) {
                        alert('Please select at least one allocation to transfer shares')
                        return
                      }
                      setActionType('transfer_shares')
                      setShowActionModal(true)
                    }}
                    disabled={!selectedAllocations.some(id => 
                      settlementData.allocations.payment_received.some(a => a.allocation_id === id)
                    )}
                    className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md text-sm font-medium"
                  >
                    Transfer Shares ({selectedAllocations.filter(id => 
                      settlementData.allocations.payment_received.some(a => a.allocation_id === id)
                    ).length})
                  </button>
                )
              )}

              {renderAllocationTable(
                "Ready for Completion",
                settlementData.allocations.shares_transferred,
                settlementData.allocations.shares_transferred.length > 0 && (
                  <button
                    onClick={() => {
                      const selectedTransferred = settlementData.allocations.shares_transferred
                        .filter(a => selectedAllocations.includes(a.allocation_id))
                      if (selectedTransferred.length === 0) {
                        alert('Please select at least one allocation to complete')
                        return
                      }
                      setActionType('complete_settlement')
                      setShowActionModal(true)
                    }}
                    disabled={!selectedAllocations.some(id => 
                      settlementData.allocations.shares_transferred.some(a => a.allocation_id === id)
                    )}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400 text-white px-4 py-2 rounded-md text-sm font-medium"
                  >
                    Complete Settlement ({selectedAllocations.filter(id => 
                      settlementData.allocations.shares_transferred.some(a => a.allocation_id === id)
                    ).length})
                  </button>
                )
              )}

              {renderAllocationTable(
                "Completed Settlements",
                settlementData.allocations.completed
              )}

              {/* Success Message */}
              {settlementData.summary.all_settlements_completed && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <div className="text-green-800">
                    <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-lg font-medium">🎉 All Settlements Completed!</p>
                    <p className="text-sm mt-1">
                      All {settlementData.summary.total_successful_allocations} settlements have been successfully completed.
                    </p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
          <div className="text-sm text-gray-500">
            {settlementData && (
              <>
                Total Revenue: {formatCurrency(settlementData.summary.total_settlement_amount)} • 
                Confirmed: {formatCurrency(settlementData.summary.confirmed_payment_amount)}
              </>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>

      {/* Action Modal */}
      {showActionModal && actionType && (
        <SettlementActionModal
          actionType={actionType}
          selectedCount={selectedAllocations.length}
          selectedAllocations={selectedAllocations}
          onConfirm={handleBulkAction}
          onCancel={() => {
            setShowActionModal(false)
            setActionType(null)
          }}
          processing={processingAction !== null}
        />
      )}
    </div>
  )
}

// Settlement Action Modal Component
interface SettlementActionModalProps {
  actionType: 'confirm_payment' | 'transfer_shares' | 'complete_settlement'
  selectedCount: number
  selectedAllocations: string[]
  onConfirm: (action: string, allocationIds: string[], paymentReference?: string, notes?: string) => void
  onCancel: () => void
  processing: boolean
}

function SettlementActionModal({
  actionType,
  selectedCount,
  selectedAllocations,
  onConfirm,
  onCancel,
  processing
}: SettlementActionModalProps) {
  const [paymentReference, setPaymentReference] = useState('')
  const [notes, setNotes] = useState('')

  const getActionText = () => {
    switch (actionType) {
      case 'confirm_payment':
        return 'Confirm Payment'
      case 'transfer_shares':
        return 'Transfer Shares'
      case 'complete_settlement':
        return 'Complete Settlement'
      default:
        return 'Process'
    }
  }

  const getActionDescription = () => {
    switch (actionType) {
      case 'confirm_payment':
        return 'Mark the selected payments as received and confirmed'
      case 'transfer_shares':
        return 'Transfer shares to the company cap table for the selected allocations'
      case 'complete_settlement':
        return 'Mark the selected settlements as fully completed'
      default:
        return 'Process the selected settlements'
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onConfirm(actionType, selectedAllocations, paymentReference, notes)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">
              {getActionText()} ({selectedCount} selected)
            </h3>
            <p className="text-sm text-gray-600 mt-1">
              {getActionDescription()}
            </p>
          </div>

          <div className="px-6 py-4 space-y-4">
            {actionType === 'confirm_payment' && (
              <div>
                <label htmlFor="paymentReference" className="block text-sm font-medium text-gray-700">
                  Payment Reference (Optional)
                </label>
                <input
                  type="text"
                  id="paymentReference"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="e.g., WIRE-12345, CHECK-67890"
                  className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                />
              </div>
            )}

            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                Notes (Optional)
              </label>
              <textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                placeholder="Add any additional notes..."
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
              />
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 flex justify-end space-x-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={processing}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={processing}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-4 py-2 rounded-md text-sm font-medium flex items-center space-x-2"
            >
              {processing && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
              <span>{processing ? 'Processing...' : getActionText()}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
