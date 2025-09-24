'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Member {
  id: string
  name: string
  email: string
  credit_balance: number
}

interface Shareholding {
  member_email: string
  shares_owned: number
}

interface CreateTransactionModalProps {
  isOpen: boolean
  onClose: () => void
  companyId: string
  onTransactionCreated: () => void
}

const TRANSACTION_TYPES = {
  EQUITY: {
    share_purchase: 'Share Purchase',
    share_sale: 'Share Sale', 
    share_transfer: 'Share Transfer',
    share_issuance: 'Share Issuance'
  },
  FINANCIAL: {
    credit_transfer: 'Credit Transfer',
    credit_payment: 'Credit Payment'
  }
}

export default function CreateTransactionModal({ 
  isOpen, 
  onClose, 
  companyId, 
  onTransactionCreated 
}: CreateTransactionModalProps) {
  const [members, setMembers] = useState<Member[]>([])
  const [shareholdings, setShareholdings] = useState<Shareholding[]>([])
  const [loading, setLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  
  // Form state
  const [transactionType, setTransactionType] = useState('')
  const [amount, setAmount] = useState('')
  const [shareQuantity, setShareQuantity] = useState('')
  const [fromMember, setFromMember] = useState('')
  const [toMember, setToMember] = useState('')
  const [description, setDescription] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (isOpen && companyId) {
      loadMembers()
      loadShareholdings()
    }
  }, [isOpen, companyId])

  const loadMembers = async () => {
    setLoading(true)
    const supabase = createClient()
    
    try {
      const { data, error } = await supabase
        .from('company_members')
        .select('id, name, email, credit_balance')
        .eq('company_id', companyId)

      if (error) {
        console.error('Error fetching members:', error)
      } else {
        setMembers(data || [])
      }
    } catch (error) {
      console.error('Error loading members:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadShareholdings = async () => {
    const supabase = createClient()
    
    try {
      const { data, error } = await supabase
        .from('member_shareholdings')
        .select('member_email, shares_owned')
        .eq('company_id', companyId)

      if (error) {
        console.error('Error fetching shareholdings:', error)
      } else {
        setShareholdings(data || [])
      }
    } catch (error) {
      console.error('Error loading shareholdings:', error)
    }
  }

  const resetForm = () => {
    setTransactionType('')
    setAmount('')
    setShareQuantity('')
    setFromMember('')
    setToMember('')
    setDescription('')
    setErrors({})
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const isEquityTransaction = () => {
    return Object.keys(TRANSACTION_TYPES.EQUITY).includes(transactionType)
  }

  const isFinancialTransaction = () => {
    return Object.keys(TRANSACTION_TYPES.FINANCIAL).includes(transactionType)
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!transactionType) {
      newErrors.transactionType = 'Transaction type is required'
    }

    if (isEquityTransaction()) {
      if (!shareQuantity || parseFloat(shareQuantity) <= 0) {
        newErrors.shareQuantity = 'Valid share quantity is required'
      }
      
      // Check if from member has enough shares for sale/transfer
      if (['share_sale', 'share_transfer'].includes(transactionType) && fromMember) {
        const fromMemberData = members.find(m => m.email === fromMember)
        const shareholding = shareholdings.find(s => s.member_email === fromMember)
        const availableShares = shareholding?.shares_owned || 0
        
        if (parseFloat(shareQuantity) > availableShares) {
          newErrors.shareQuantity = `Insufficient shares. Available: ${availableShares}`
        }
      }
    }

    if (isFinancialTransaction()) {
      if (!amount || parseFloat(amount) <= 0) {
        newErrors.amount = 'Valid amount is required'
      }
      
      // Check if from member has enough credit balance
      if (fromMember) {
        const fromMemberData = members.find(m => m.email === fromMember)
        const availableBalance = fromMemberData?.credit_balance || 0
        
        if (parseFloat(amount) > availableBalance) {
          newErrors.amount = `Insufficient balance. Available: $${availableBalance.toFixed(2)}`
        }
      }
    }

    // Validate member selections based on transaction type
    if (transactionType === 'share_issuance') {
      if (!toMember) {
        newErrors.toMember = 'Recipient member is required'
      }
    } else if (transactionType !== 'share_issuance') {
      if (!fromMember) {
        newErrors.fromMember = 'Source member is required'
      }
      if (!toMember) {
        newErrors.toMember = 'Recipient member is required'
      }
      if (fromMember === toMember) {
        newErrors.toMember = 'Source and recipient must be different'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!validateForm()) {
      return
    }

    setSubmitting(true)

    try {
      const response = await fetch(`/api/companies/${companyId}/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transaction_type: transactionType,
          amount: isFinancialTransaction() ? parseFloat(amount) : null,
          share_quantity: isEquityTransaction() ? parseInt(shareQuantity) : null,
          from_member_email: fromMember || null,
          to_member_email: toMember,
          description: description.trim() || null,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create transaction')
      }

      // Success
      onTransactionCreated()
      handleClose()
      
      // Show success notification (you can integrate with your notification system)
      console.log('Transaction created successfully')
      
    } catch (error) {
      console.error('Error creating transaction:', error)
      setErrors({ submit: error instanceof Error ? error.message : 'Failed to create transaction' })
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-medium text-gray-900">Create New Transaction</h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Transaction Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Transaction Type *
              </label>
              <select
                value={transactionType}
                onChange={(e) => {
                  setTransactionType(e.target.value)
                  setErrors({ ...errors, transactionType: '' })
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Select transaction type</option>
                <optgroup label="Equity Transactions">
                  {Object.entries(TRANSACTION_TYPES.EQUITY).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </optgroup>
                <optgroup label="Financial Transactions">
                  {Object.entries(TRANSACTION_TYPES.FINANCIAL).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </optgroup>
              </select>
              {errors.transactionType && (
                <p className="mt-1 text-sm text-red-600">{errors.transactionType}</p>
              )}
            </div>

            {/* Amount Field (for financial transactions) */}
            {isFinancialTransaction() && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount ($) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value)
                    setErrors({ ...errors, amount: '' })
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="0.00"
                />
                {errors.amount && (
                  <p className="mt-1 text-sm text-red-600">{errors.amount}</p>
                )}
              </div>
            )}

            {/* Share Quantity Field (for equity transactions) */}
            {isEquityTransaction() && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Share Quantity *
                </label>
                <input
                  type="number"
                  min="1"
                  value={shareQuantity}
                  onChange={(e) => {
                    setShareQuantity(e.target.value)
                    setErrors({ ...errors, shareQuantity: '' })
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Number of shares"
                />
                {errors.shareQuantity && (
                  <p className="mt-1 text-sm text-red-600">{errors.shareQuantity}</p>
                )}
              </div>
            )}

            {/* From Member (not shown for share issuance) */}
            {transactionType && transactionType !== 'share_issuance' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  From Member *
                </label>
                <select
                  value={fromMember}
                  onChange={(e) => {
                    setFromMember(e.target.value)
                    setErrors({ ...errors, fromMember: '' })
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select source member</option>
                  {members.map((member) => {
                    const shareholding = shareholdings.find(s => s.member_email === member.email)
                    const shares = shareholding?.shares_owned || 0
                    const balance = member.credit_balance || 0
                    
                    return (
                      <option key={member.id} value={member.email}>
                        {member.name} ({member.email})
                        {isEquityTransaction() && ` - ${shares} shares`}
                        {isFinancialTransaction() && ` - $${balance.toFixed(2)}`}
                      </option>
                    )
                  })}
                </select>
                {errors.fromMember && (
                  <p className="mt-1 text-sm text-red-600">{errors.fromMember}</p>
                )}
              </div>
            )}

            {/* To Member */}
            {transactionType && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {transactionType === 'share_issuance' ? 'To Member *' : 'To Member *'}
                </label>
                <select
                  value={toMember}
                  onChange={(e) => {
                    setToMember(e.target.value)
                    setErrors({ ...errors, toMember: '' })
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select recipient member</option>
                  {members.map((member) => (
                    <option key={member.id} value={member.email}>
                      {member.name} ({member.email})
                    </option>
                  ))}
                </select>
                {errors.toMember && (
                  <p className="mt-1 text-sm text-red-600">{errors.toMember}</p>
                )}
              </div>
            )}

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description (Optional)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Add a note about this transaction..."
              />
            </div>

            {/* Submit Error */}
            {errors.submit && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <p className="text-sm text-red-600">{errors.submit}</p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-6">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Creating...' : 'Create Transaction'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
