'use client'

import { useState, useEffect } from 'react'

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
}

interface EditMemberModalProps {
  isOpen: boolean
  onClose: () => void
  companyId: string
  companyData: CompanyData | null
  member: CapTableMember | null
  onMemberUpdated: () => void
  onError?: (message: string) => void
}

export default function EditMemberModal({ 
  isOpen, 
  onClose, 
  companyId, 
  companyData,
  member,
  onMemberUpdated,
  onError
}: EditMemberModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    position: 'Secretary',
    shares: '',
    creditBalance: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Utility function to format number with commas
  const formatNumberWithCommas = (value: string): string => {
    // Remove all non-digit characters except decimal point
    const cleanValue = value.replace(/[^\d.]/g, '')
    
    // Handle decimal numbers for credit balance
    if (cleanValue.includes('.')) {
      const [integerPart, decimalPart] = cleanValue.split('.')
      const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
      return decimalPart !== undefined ? `${formattedInteger}.${decimalPart}` : formattedInteger
    }
    
    // Format integer part with commas
    return cleanValue.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }

  // Utility function to remove commas for API submission
  const removeCommas = (value: string): string => {
    return value.replace(/,/g, '')
  }

  // Calculate available shares (including current member's shares)
  const availableShares = companyData?.total_shares && member
    ? companyData.total_shares - (companyData.issued_shares || 0) + member.shares_owned
    : null

  const positions = [
    { value: 'CEO', label: 'Chief Executive Officer (CEO)' },
    { value: 'CTO', label: 'Chief Technology Officer (CTO)' },
    { value: 'COO', label: 'Chief Operating Officer (COO)' },
    { value: 'Secretary', label: 'Secretary' }
  ]

  // Update form data when member changes
  useEffect(() => {
    if (member) {
      setFormData({
        name: member.name,
        position: member.position,
        shares: member.shares_owned.toString(),
        creditBalance: member.balance.toString()
      })
    }
  }, [member])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!member) return
    
    setLoading(true)
    setError(null)

    try {
      // Prepare the data - only send changed fields
      const submitData: any = {}
      
      if (formData.name.trim() !== member.name) {
        submitData.name = formData.name.trim()
      }
      
      if (formData.position !== member.position) {
        submitData.position = formData.position
      }
      
      const newShares = formData.shares ? parseInt(removeCommas(formData.shares)) : 0
      if (newShares !== member.shares_owned) {
        submitData.shares = newShares
      }
      
      const newCreditBalance = formData.creditBalance ? parseFloat(removeCommas(formData.creditBalance)) : 0
      if (Math.abs(newCreditBalance - member.balance) > 0.01) { // Account for floating point precision
        submitData.creditBalance = newCreditBalance
      }

      // If no changes, just close the modal
      if (Object.keys(submitData).length === 0) {
        onClose()
        return
      }

      // Validate numbers
      if (submitData.shares !== undefined && submitData.shares < 0) {
        setError('Shares must be non-negative')
        return
      }

      // Check if shares would exceed available shares
      if (submitData.shares !== undefined && availableShares !== null && submitData.shares > availableShares) {
        setError(`Cannot allocate ${submitData.shares} shares. Only ${availableShares} shares available (including current allocation).`)
        return
      }

      if (submitData.creditBalance !== undefined && submitData.creditBalance < 0) {
        setError('Credit balance must be non-negative')
        return
      }

      const response = await fetch(`/api/companies/${companyId}/members/${member.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData)
      })

      const result = await response.json()

      if (!response.ok) {
        // Handle specific error codes with user-friendly messages
        let errorMessage = result.error || 'Failed to update member'
        
        switch (result.code) {
          case 'SHARES_EXCEED_TOTAL':
            errorMessage = result.error // This already contains detailed info
            break
          case 'COMPANY_SHARES_NOT_CONFIGURED':
            errorMessage = 'Company shares must be configured before updating member shares'
            break
          case 'INVALID_SHARES':
            errorMessage = 'Please enter a valid number of shares (0 or greater)'
            break
          case 'INVALID_CREDIT_BALANCE':
            errorMessage = 'Please enter a valid credit balance (0 or greater)'
            break
          case 'INVALID_NAME':
            errorMessage = 'Please enter a valid name'
            break
          case 'INVALID_POSITION':
            errorMessage = 'Please select a valid position'
            break
          case 'MEMBER_UPDATE_FAILED':
            if (result.details && result.details.includes('No user account found')) {
              // Show the detailed error message which includes available profiles for debugging
              errorMessage = result.details
            } else if (result.details && result.details.includes('must create an account')) {
              errorMessage = 'Credit balance can only be updated for members who have signed up. Please ask the member to create an account first.'
            } else if (result.details && result.details.includes('profile')) {
              errorMessage = 'Failed to update credit balance. Member profile issue detected.'
            } else if (result.details && result.details.includes('wallet')) {
              errorMessage = 'Failed to update credit balance. Wallet update failed.'
            } else {
              errorMessage = result.details || result.error || 'Failed to update member'
            }
            break
          default:
            if (result.details && process.env.NODE_ENV === 'development') {
              errorMessage = `${errorMessage}: ${result.details}`
            }
        }
        
        throw new Error(errorMessage)
      }

      // Log success for debugging
      console.log('Member updated successfully:', result.data)
      
      onMemberUpdated()
      onClose()

    } catch (error) {
      console.error('Error updating member:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to update member'
      setError(errorMessage)
      if (onError) {
        onError(errorMessage)
      }
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (error) setError(null) // Clear error when user starts typing
  }

  const calculateSharePercentage = (shares: string, totalShares?: number) => {
    const sharesNum = parseInt(shares) || 0
    if (!totalShares || totalShares === 0) return '0.00'
    return ((sharesNum / totalShares) * 100).toFixed(2)
  }

  if (!isOpen || !member) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
        <div className="mt-3">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Edit Member</h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              disabled={loading}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Member Info */}
          <div className="mb-4 p-3 bg-gray-50 rounded-md">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Email:</span> {member.email}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                Full Name
              </label>
              <input
                type="text"
                id="name"
                required
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter member's full name"
                disabled={loading}
              />
            </div>

            {/* Position */}
            <div>
              <label htmlFor="position" className="block text-sm font-medium text-gray-700 mb-1">
                Position
              </label>
              <select
                id="position"
                required
                value={formData.position}
                onChange={(e) => handleInputChange('position', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                disabled={loading}
              >
                {positions.map((pos) => (
                  <option key={pos.value} value={pos.value}>
                    {pos.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Shares */}
            <div>
              <label htmlFor="shares" className="block text-sm font-medium text-gray-700 mb-1">
                Shares Owned
              </label>
              <input
                type="text"
                id="shares"
                value={formData.shares}
                onChange={(e) => {
                  const formatted = formatNumberWithCommas(e.target.value)
                  handleInputChange('shares', formatted)
                }}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${
                  formData.shares && availableShares !== null && parseInt(removeCommas(formData.shares)) > availableShares
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-300'
                }`}
                placeholder="0"
                disabled={loading}
              />
              <div className="mt-1 text-xs space-y-1">
                <p className="text-gray-500">
                  Current: {member.shares_owned.toLocaleString()} shares ({member.share_percentage.toFixed(2)}%)
                </p>
                {availableShares !== null && (
                  <p className="text-green-600">
                    Available: {new Intl.NumberFormat('en-US').format(availableShares)} shares (including current allocation)
                  </p>
                )}
                {formData.shares && availableShares !== null && parseInt(removeCommas(formData.shares)) > availableShares && (
                  <p className="text-red-600">
                    Exceeds available shares by {new Intl.NumberFormat('en-US').format(parseInt(removeCommas(formData.shares)) - availableShares)}
                  </p>
                )}
              </div>
            </div>

            {/* Credit Balance */}
            <div>
              <label htmlFor="creditBalance" className="block text-sm font-medium text-gray-700 mb-1">
                Credit Balance
              </label>
              <input
                type="text"
                id="creditBalance"
                value={formData.creditBalance}
                onChange={(e) => {
                  const formatted = formatNumberWithCommas(e.target.value)
                  handleInputChange('creditBalance', formatted)
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="0.00"
                disabled={loading}
              />
              <p className="mt-1 text-xs text-gray-500">
                Current: ${member.balance.toFixed(2)}
              </p>
            </div>

            {/* Preview Changes */}
            {(removeCommas(formData.shares) !== member.shares_owned.toString() || 
              removeCommas(formData.creditBalance) !== member.balance.toString()) && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
                <h4 className="text-sm font-medium text-blue-900 mb-2">Preview Changes:</h4>
                <div className="text-xs text-blue-700 space-y-1">
                  {removeCommas(formData.shares) !== member.shares_owned.toString() && (
                    <p>
                      Shares: {member.shares_owned.toLocaleString()} → {parseInt(removeCommas(formData.shares) || '0').toLocaleString()}
                    </p>
                  )}
                  {removeCommas(formData.creditBalance) !== member.balance.toString() && (
                    <p>
                      Balance: ${member.balance.toFixed(2)} → ${parseFloat(removeCommas(formData.creditBalance) || '0').toFixed(2)}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Buttons */}
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Updating...
                  </span>
                ) : (
                  'Update Member'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
