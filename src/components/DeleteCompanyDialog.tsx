'use client'

import { useState } from 'react'

interface Company {
  id: string
  name: string
  address: string
  country_code: string
  state_code: string
  business_structure: string
  created_at: string
  user_role: string
}

interface DeleteCompanyDialogProps {
  isOpen: boolean
  onClose: () => void
  company: Company | null
  onCompanyDeleted: () => void
}

export default function DeleteCompanyDialog({ 
  isOpen, 
  onClose, 
  company,
  onCompanyDeleted 
}: DeleteCompanyDialogProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmationText, setConfirmationText] = useState('')
  const [step, setStep] = useState<'warning' | 'confirmation'>('warning')

  const handleDelete = async () => {
    if (!company) return
    
    setLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/companies/${company.id}`, {
        method: 'DELETE',
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to delete company')
      }

      onCompanyDeleted()
      onClose()
      resetDialog()

    } catch (error) {
      console.error('Error deleting company:', error)
      setError(error instanceof Error ? error.message : 'Failed to delete company')
    } finally {
      setLoading(false)
    }
  }

  const resetDialog = () => {
    setStep('warning')
    setConfirmationText('')
    setError(null)
    setLoading(false)
  }

  const handleClose = () => {
    if (!loading) {
      resetDialog()
      onClose()
    }
  }

  const canProceedToConfirmation = step === 'warning'
  const canDelete = step === 'confirmation' && confirmationText === company?.name && !loading

  if (!isOpen || !company) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
        <div className="mt-3">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="ml-3 text-xl font-medium text-gray-900">Delete Company</h3>
            </div>
            <button
              onClick={handleClose}
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

          {step === 'warning' && (
            <>
              {/* Company Info */}
              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-4">
                  You are about to permanently delete this company. This action cannot be undone.
                </p>
                
                <div className="bg-gray-50 rounded-md p-4 space-y-3">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 h-12 w-12">
                      <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center">
                        <span className="text-lg font-medium text-indigo-600">
                          {company.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="ml-4">
                      <div className="text-lg font-medium text-gray-900">{company.name}</div>
                      <div className="text-sm text-gray-500">{company.business_structure}</div>
                    </div>
                  </div>
                  
                  <div className="mt-3 text-sm text-gray-600 space-y-1">
                    <p><span className="font-medium">Address:</span> {company.address}</p>
                    <p><span className="font-medium">Created:</span> {new Date(company.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              {/* Critical Warning */}
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">
                      Critical Warning - Data Loss
                    </h3>
                    <div className="mt-2 text-sm text-red-700">
                      <p className="mb-2">Deleting this company will permanently remove:</p>
                      <ul className="list-disc list-inside space-y-1">
                        <li>All company members and their roles</li>
                        <li>Complete cap table and share ownership records</li>
                        <li>All auction history (completed and cancelled)</li>
                        <li>All transaction records and payment history</li>
                        <li>Company documents and uploaded files</li>
                        <li>All related financial data and reports</li>
                      </ul>
                      <p className="mt-3 font-medium">This action is irreversible and cannot be undone.</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setStep('confirmation')}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                >
                  I Understand, Continue
                </button>
              </div>
            </>
          )}

          {step === 'confirmation' && (
            <>
              {/* Final Confirmation */}
              <div className="mb-6">
                <p className="text-sm text-gray-600 mb-4">
                  To confirm deletion, please type the company name exactly as shown below:
                </p>
                
                <div className="bg-gray-100 rounded-md p-3 mb-4">
                  <p className="text-sm font-mono text-gray-900">{company.name}</p>
                </div>

                <input
                  type="text"
                  value={confirmationText}
                  onChange={(e) => setConfirmationText(e.target.value)}
                  placeholder="Type company name here"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  disabled={loading}
                />

                {confirmationText && confirmationText !== company.name && (
                  <p className="mt-2 text-sm text-red-600">Company name does not match</p>
                )}
              </div>

              {/* Final Warning */}
              <div className="mb-6 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="w-5 h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-yellow-700">
                      <strong>Last chance:</strong> Once you click "Delete Company", all data will be permanently lost and cannot be recovered.
                    </p>
                  </div>
                </div>
              </div>

              {/* Buttons */}
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setStep('warning')}
                  disabled={loading}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={!canDelete}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center">
                      <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Deleting Company...
                    </span>
                  ) : (
                    'Delete Company'
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
