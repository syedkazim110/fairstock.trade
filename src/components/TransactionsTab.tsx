'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import CreateTransactionModal from './CreateTransactionModal'

interface Transaction {
  id: string
  transaction_type: string
  amount: number | null
  share_quantity: number | null
  from_member_email: string | null
  to_member_email: string
  description: string | null
  created_at: string
}

interface TransactionsTabProps {
  companyId: string
}

export default function TransactionsTab({ companyId }: TransactionsTabProps) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    if (companyId) {
      loadTransactions()
    }
  }, [companyId])

  const loadTransactions = async () => {
    setLoading(true)
    const supabase = createClient()
    
    try {
      const { data, error } = await supabase
        .from('company_transactions')
        .select('id, transaction_type, amount, share_quantity, from_member_email, to_member_email, description, created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching transactions:', error)
      } else {
        setTransactions(data || [])
      }
    } catch (error) {
      console.error('Error loading transactions:', error)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount)
  }

  const getTransactionTypeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'deposit':
      case 'credit':
        return 'bg-green-100 text-green-800'
      case 'withdrawal':
      case 'debit':
        return 'bg-red-100 text-red-800'
      case 'transfer':
        return 'bg-blue-100 text-blue-800'
      case 'share_purchase':
        return 'bg-purple-100 text-purple-800'
      case 'share_sale':
        return 'bg-orange-100 text-orange-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getTransactionIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'deposit':
      case 'credit':
        return (
          <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
        )
      case 'withdrawal':
      case 'debit':
        return (
          <svg className="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
          </svg>
        )
      case 'transfer':
        return (
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        )
      default:
        return (
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        )
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900">Transactions</h3>
        <button 
          onClick={() => setShowCreateModal(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
        >
          New Transaction
        </button>
      </div>

      {transactions.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
            </svg>
            <p className="text-lg font-medium text-gray-900">No Transactions Yet</p>
            <p className="text-sm text-gray-600 mt-2">All company financial transactions will appear here.</p>
          </div>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-md text-sm font-medium"
          >
            Record First Transaction
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Desktop Table */}
          <div className="hidden md:block">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount/Shares
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Between
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Description
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {transactions.map((transaction) => (
                    <tr key={transaction.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 mr-3">
                            {getTransactionIcon(transaction.transaction_type)}
                          </div>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTransactionTypeColor(transaction.transaction_type)}`}>
                            {transaction.transaction_type.replace('_', ' ').toUpperCase()}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {transaction.amount ? formatCurrency(transaction.amount) : 
                           transaction.share_quantity ? `${transaction.share_quantity} shares` : 
                           'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {transaction.from_member_email ? (
                            <div className="space-y-1">
                              <div className="flex items-center text-xs text-gray-500">
                                <span className="mr-1">From:</span>
                                <span className="font-medium">{transaction.from_member_email}</span>
                              </div>
                              <div className="flex items-center text-xs text-gray-500">
                                <span className="mr-1">To:</span>
                                <span className="font-medium">{transaction.to_member_email}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="text-xs text-gray-500">
                              <span className="mr-1">To:</span>
                              <span className="font-medium">{transaction.to_member_email}</span>
                              <div className="text-xs text-gray-400 mt-1">(Company Issuance)</div>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {transaction.description || 'No description'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-500">
                          {formatDate(transaction.created_at)}
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
            {transactions.map((transaction) => (
              <div key={transaction.id} className="bg-white shadow rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 mr-3">
                      {getTransactionIcon(transaction.transaction_type)}
                    </div>
                    <div>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTransactionTypeColor(transaction.transaction_type)}`}>
                        {transaction.transaction_type.replace('_', ' ').toUpperCase()}
                      </span>
                    </div>
                  </div>
                  <div className="text-lg font-medium text-gray-900">
                    {transaction.amount ? formatCurrency(transaction.amount) : 
                     transaction.share_quantity ? `${transaction.share_quantity} shares` : 
                     'N/A'}
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div>
                    <span className="text-sm text-gray-500">Between:</span>
                    <div className="text-sm text-gray-900">
                      {transaction.from_member_email ? (
                        <div className="space-y-1">
                          <div className="flex items-center">
                            <span className="text-xs text-gray-500 mr-1">From:</span>
                            <span className="font-medium">{transaction.from_member_email}</span>
                          </div>
                          <div className="flex items-center">
                            <span className="text-xs text-gray-500 mr-1">To:</span>
                            <span className="font-medium">{transaction.to_member_email}</span>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center">
                            <span className="text-xs text-gray-500 mr-1">To:</span>
                            <span className="font-medium">{transaction.to_member_email}</span>
                          </div>
                          <div className="text-xs text-gray-400 mt-1">(Company Issuance)</div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Description:</span>
                    <p className="text-sm text-gray-900">{transaction.description || 'No description'}</p>
                  </div>
                  <div className="text-sm text-gray-500">
                    {formatDate(transaction.created_at)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create Transaction Modal */}
      <CreateTransactionModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        companyId={companyId}
        onTransactionCreated={loadTransactions}
      />
    </div>
  )
}
