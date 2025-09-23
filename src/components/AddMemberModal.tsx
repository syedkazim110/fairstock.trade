'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface CompanyData {
  total_shares: number | null
  issued_shares: number | null
}

interface AddMemberModalProps {
  isOpen: boolean
  onClose: () => void
  companyId: string
  companyData: CompanyData | null
  onMemberAdded: () => void
  onError?: (message: string) => void
}

export default function AddMemberModal({ 
  isOpen, 
  onClose, 
  companyId, 
  companyData,
  onMemberAdded,
  onError
}: AddMemberModalProps) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    position: 'Secretary',
    initialShares: '',
    initialCreditBalance: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Calculate available shares
  const availableShares = companyData?.total_shares 
    ? companyData.total_shares - (companyData.issued_shares || 0)
    : null

  const positions = [
    { value: 'CEO', label: 'Chief Executive Officer (CEO)' },
    { value: 'CTO', label: 'Chief Technology Officer (CTO)' },
    { value: 'COO', label: 'Chief Operating Officer (COO)' },
    { value: 'Secretary', label: 'Secretary' }
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = createClient()
      
      // Prepare the data
      const submitData = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        position: formData.position,
        initialShares: formData.initialShares ? parseInt(formData.initialShares) : 0,
        initialCreditBalance: formData.initialCreditBalance ? parseFloat(formData.initialCreditBalance) : 0
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(submitData.email)) {
        setError('Please enter a valid email address')
        return
      }

      // Validate numbers
      if (submitData.initialShares < 0) {
        setError('Initial shares must be non-negative')
        return
      }

      // Check if shares would exceed available shares
      if (submitData.initialShares > 0 && availableShares !== null && submitData.initialShares > availableShares) {
        setError(`Cannot allocate ${submitData.initialShares} shares. Only ${availableShares} shares available.`)
        return
      }

      if (submitData.initialCreditBalance < 0) {
        setError('Initial credit balance must be non-negative')
        return
      }

      const response = await fetch(`/api/companies/${companyId}/members`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(submitData)
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to add member')
      }

      // Reset form and close modal
      setFormData({
        name: '',
        email: '',
        position: 'Secretary',
        initialShares: '',
        initialCreditBalance: ''
      })
      
      onMemberAdded()
      onClose()

    } catch (error) {
      console.error('Error adding member:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to add member'
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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-md shadow-lg rounded-md bg-white">
        <div className="mt-3">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">Add New Member</h3>
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
                Full Name *
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

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address *
              </label>
              <input
                type="email"
                id="email"
                required
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Enter email address"
                disabled={loading}
              />
            </div>

            {/* Position */}
            <div>
              <label htmlFor="position" className="block text-sm font-medium text-gray-700 mb-1">
                Position *
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

            {/* Initial Shares */}
            <div>
              <label htmlFor="initialShares" className="block text-sm font-medium text-gray-700 mb-1">
                Initial Shares (Optional)
              </label>
              <input
                type="number"
                id="initialShares"
                min="0"
                max={availableShares || undefined}
                value={formData.initialShares}
                onChange={(e) => handleInputChange('initialShares', e.target.value)}
                className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${
                  formData.initialShares && availableShares !== null && parseInt(formData.initialShares) > availableShares
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-300'
                }`}
                placeholder="0"
                disabled={loading}
              />
              <div className="mt-1 text-xs space-y-1">
                <p className="text-gray-500">
                  Number of shares to allocate to this member
                </p>
                {availableShares !== null && (
                  <p className="text-green-600">
                    Available: {new Intl.NumberFormat('en-US').format(availableShares)} shares
                  </p>
                )}
                {formData.initialShares && availableShares !== null && parseInt(formData.initialShares) > availableShares && (
                  <p className="text-red-600">
                    Exceeds available shares by {new Intl.NumberFormat('en-US').format(parseInt(formData.initialShares) - availableShares)}
                  </p>
                )}
              </div>
            </div>

            {/* Initial Credit Balance */}
            <div>
              <label htmlFor="initialCreditBalance" className="block text-sm font-medium text-gray-700 mb-1">
                Initial Credit Balance (Optional)
              </label>
              <input
                type="number"
                id="initialCreditBalance"
                min="0"
                step="0.01"
                value={formData.initialCreditBalance}
                onChange={(e) => handleInputChange('initialCreditBalance', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="0.00"
                disabled={loading}
              />
              <p className="mt-1 text-xs text-gray-500">
                Initial credit balance in USD
              </p>
            </div>

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
                    Adding...
                  </span>
                ) : (
                  'Add Member'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
