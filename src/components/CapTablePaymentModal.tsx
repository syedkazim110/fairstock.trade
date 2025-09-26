'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface CapTablePaymentModalProps {
  isOpen: boolean
  onClose: () => void
  companyId: string
  companyName: string
  currentBalance: number
  onPaymentSuccess: () => void
  onError: (message: string) => void
}

export default function CapTablePaymentModal({
  isOpen,
  onClose,
  companyId,
  companyName,
  currentBalance,
  onPaymentSuccess,
  onError
}: CapTablePaymentModalProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const sessionFee = 20.00

  if (!isOpen) return null

  const handlePayment = async () => {
    if (currentBalance < sessionFee) {
      onError(`Insufficient credit balance. You need $${sessionFee.toFixed(2)} but only have $${currentBalance.toFixed(2)}.`)
      return
    }

    setIsProcessing(true)
    const supabase = createClient()

    try {
      const response = await fetch(`/api/companies/${companyId}/cap-table-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'start'
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to start cap table session')
      }

      onPaymentSuccess()
      onClose()
    } catch (error) {
      console.error('Payment error:', error)
      onError(error instanceof Error ? error.message : 'Failed to process payment')
    } finally {
      setIsProcessing(false)
    }
  }

  const canAfford = currentBalance >= sessionFee
  const remainingBalance = currentBalance - sessionFee

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              Enable Cap Table Changes
            </h3>
            <button
              onClick={onClose}
              disabled={isProcessing}
              className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-blue-800">
                    Cap Table Change Session
                  </h4>
                  <div className="mt-2 text-sm text-blue-700">
                    <p>To make changes to <strong>{companyName}</strong>'s cap table, you need to start a change session.</p>
                    <p className="mt-1">Once paid, you can make unlimited changes until you click "Complete Changes".</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Details */}
            <div className="bg-gray-50 rounded-md p-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Session Fee:</span>
                  <span className="font-medium text-gray-900">${sessionFee.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Current Balance:</span>
                  <span className={`font-medium ${canAfford ? 'text-green-600' : 'text-red-600'}`}>
                    ${currentBalance.toFixed(2)}
                  </span>
                </div>
                {canAfford && (
                  <div className="flex justify-between text-sm border-t pt-2">
                    <span className="text-gray-600">Balance After Payment:</span>
                    <span className="font-medium text-gray-900">${remainingBalance.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Insufficient Balance Warning */}
            {!canAfford && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h4 className="text-sm font-medium text-red-800">
                      Insufficient Credit Balance
                    </h4>
                    <div className="mt-1 text-sm text-red-700">
                      <p>You need ${(sessionFee - currentBalance).toFixed(2)} more to start a cap table session.</p>
                      <p className="mt-1">Please contact support to add credits to your account.</p>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              disabled={isProcessing}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePayment}
              disabled={isProcessing || !canAfford}
              className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isProcessing && (
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              <span>
                {isProcessing ? 'Processing...' : `Pay $${sessionFee.toFixed(2)}`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
