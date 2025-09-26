'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatNumber } from '@/lib/modified-dutch-auction'

interface Auction {
  id: string
  title: string
  description: string
  shares_count: number
  max_price: number
  min_price: number
  auction_mode: string
  status: string
  clearing_price?: number
  total_demand?: number
  clearing_calculated_at?: string
}

interface AuctionResultsModalProps {
  auction: Auction
  onClose: () => void
}

interface BidAllocation {
  id: string
  bidder_email: string
  original_quantity: number
  allocated_quantity: number
  clearing_price: number
  total_amount: number
  allocation_type: string
  pro_rata_percentage?: number
}

interface ClearingResults {
  id: string
  clearing_price: number
  total_bids_count: number
  total_demand: number
  shares_allocated: number
  shares_remaining: number
  pro_rata_applied: boolean
  calculation_details: any
}

export default function AuctionResultsModal({ 
  auction, 
  onClose 
}: AuctionResultsModalProps) {
  const [loading, setLoading] = useState(true)
  const [clearingResults, setClearingResults] = useState<ClearingResults | null>(null)
  const [bidAllocations, setBidAllocations] = useState<BidAllocation[]>([])
  const [userAllocation, setUserAllocation] = useState<BidAllocation | null>(null)
  const [isCompanyOwner, setIsCompanyOwner] = useState(false)
  const supabase = createClient()

  useEffect(() => {
    loadAuctionResults()
  }, [auction.id])

  const loadAuctionResults = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      // Check if user is company owner
      const { data: company } = await supabase
        .from('companies')
        .select('created_by')
        .eq('id', (await supabase
          .from('company_auctions')
          .select('company_id')
          .eq('id', auction.id)
          .single()
        ).data?.company_id)
        .single()

      const isOwner = company?.created_by === user.id
      setIsCompanyOwner(isOwner)

      // Load clearing results
      const { data: results, error: resultsError } = await supabase
        .from('auction_clearing_results')
        .select('*')
        .eq('auction_id', auction.id)
        .single()

      if (resultsError) {
        console.error('Error loading clearing results:', resultsError)
      } else {
        setClearingResults(results)
      }

      // Load bid allocations
      if (isOwner) {
        // Company owners can see all allocations
        const { data: allocations, error: allocationsError } = await supabase
          .from('bid_allocations')
          .select('*')
          .eq('auction_id', auction.id)
          .order('allocated_quantity', { ascending: false })

        if (allocationsError) {
          console.error('Error loading allocations:', allocationsError)
        } else {
          setBidAllocations(allocations || [])
        }
      } else {
        // Regular users can only see their own allocation
        const { data: userAlloc, error: userAllocError } = await supabase
          .from('bid_allocations')
          .select('*')
          .eq('auction_id', auction.id)
          .eq('bidder_id', user.id)
          .single()

        if (!userAllocError && userAlloc) {
          setUserAllocation(userAlloc)
        }
      }
    } catch (error) {
      console.error('Error loading auction results:', error)
    } finally {
      setLoading(false)
    }
  }

  const getSuccessfulBidders = () => {
    return bidAllocations.filter(allocation => allocation.allocated_quantity > 0)
  }

  const getRejectedBidders = () => {
    return bidAllocations.filter(allocation => allocation.allocated_quantity === 0)
  }

  const getTotalRevenue = () => {
    return getSuccessfulBidders().reduce((sum, allocation) => sum + allocation.total_amount, 0)
  }

  const getAllocationStatusText = (allocation: BidAllocation) => {
    if (allocation.allocated_quantity === 0) return 'Rejected'
    if (allocation.allocation_type === 'pro_rata') return 'Pro-rata'
    if (allocation.allocated_quantity === allocation.original_quantity) return 'Full'
    return 'Partial'
  }

  const getAllocationStatusColor = (allocation: BidAllocation) => {
    if (allocation.allocated_quantity === 0) return 'text-red-600 bg-red-50'
    if (allocation.allocation_type === 'pro_rata') return 'text-yellow-600 bg-yellow-50'
    if (allocation.allocated_quantity === allocation.original_quantity) return 'text-green-600 bg-green-50'
    return 'text-blue-600 bg-blue-50'
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Auction Results</h2>
              <p className="text-sm text-gray-600">{auction.title}</p>
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
        <div className="px-6 py-6 max-h-[70vh] overflow-y-auto space-y-6">
          {/* Clearing Results Summary */}
          {clearingResults && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-blue-900 mb-4">Clearing Price Results</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-900">{formatCurrency(clearingResults.clearing_price)}</p>
                  <p className="text-sm text-blue-700">Clearing Price</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-900">{formatNumber(clearingResults.shares_allocated)}</p>
                  <p className="text-sm text-blue-700">Shares Allocated</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-900">{clearingResults.total_bids_count}</p>
                  <p className="text-sm text-blue-700">Total Bids</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-900">{formatNumber(clearingResults.total_demand)}</p>
                  <p className="text-sm text-blue-700">Total Demand</p>
                </div>
              </div>
              
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white rounded-lg p-3">
                  <p className="text-sm text-gray-600">Demand Ratio</p>
                  <p className="text-lg font-semibold">
                    {((clearingResults.total_demand / auction.shares_count) * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="bg-white rounded-lg p-3">
                  <p className="text-sm text-gray-600">Allocation Rate</p>
                  <p className="text-lg font-semibold">
                    {((clearingResults.shares_allocated / auction.shares_count) * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="bg-white rounded-lg p-3">
                  <p className="text-sm text-gray-600">Pro-rata Applied</p>
                  <p className="text-lg font-semibold">
                    {clearingResults.pro_rata_applied ? 'Yes' : 'No'}
                  </p>
                </div>
              </div>

              {isCompanyOwner && (
                <div className="mt-4 bg-white rounded-lg p-3">
                  <p className="text-sm text-gray-600">Total Revenue</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(getTotalRevenue())}</p>
                </div>
              )}
            </div>
          )}

          {/* User's Personal Results */}
          {userAllocation && !isCompanyOwner && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
              <h3 className="text-lg font-medium text-gray-900 mb-4">Your Allocation</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Requested</p>
                  <p className="text-lg font-semibold">{formatNumber(userAllocation.original_quantity)} shares</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Allocated</p>
                  <p className="text-lg font-semibold">{formatNumber(userAllocation.allocated_quantity)} shares</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Price Paid</p>
                  <p className="text-lg font-semibold">{formatCurrency(userAllocation.clearing_price)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Total Amount</p>
                  <p className="text-lg font-semibold">{formatCurrency(userAllocation.total_amount)}</p>
                </div>
              </div>
              
              <div className="mt-4">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getAllocationStatusColor(userAllocation)}`}>
                  {getAllocationStatusText(userAllocation)}
                  {userAllocation.pro_rata_percentage && (
                    <span className="ml-1">({(userAllocation.pro_rata_percentage * 100).toFixed(1)}%)</span>
                  )}
                </span>
              </div>

              {userAllocation.allocated_quantity > 0 && (
                <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-green-800">
                    <strong>Congratulations!</strong> You have been allocated {formatNumber(userAllocation.allocated_quantity)} shares 
                    at {formatCurrency(userAllocation.clearing_price)} per share. 
                    {userAllocation.allocation_type === 'pro_rata' && (
                      <span> Your allocation was determined through pro-rata distribution due to oversubscription at the clearing price.</span>
                    )}
                  </p>
                </div>
              )}

              {userAllocation.allocated_quantity === 0 && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-sm text-red-800">
                    Unfortunately, your bid was below the clearing price of {formatCurrency(clearingResults?.clearing_price || 0)} 
                    and was not successful in this auction.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* All Allocations (Company Owner View) */}
          {isCompanyOwner && bidAllocations.length > 0 && (
            <div className="space-y-6">
              {/* Successful Bidders */}
              {getSuccessfulBidders().length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Successful Bidders ({getSuccessfulBidders().length})
                  </h3>
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Bidder
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Requested
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Allocated
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Price
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Total
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {getSuccessfulBidders().map((allocation) => (
                            <tr key={allocation.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {allocation.bidder_email}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatNumber(allocation.original_quantity)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatNumber(allocation.allocated_quantity)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatCurrency(allocation.clearing_price)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {formatCurrency(allocation.total_amount)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getAllocationStatusColor(allocation)}`}>
                                  {getAllocationStatusText(allocation)}
                                  {allocation.pro_rata_percentage && (
                                    <span className="ml-1">({(allocation.pro_rata_percentage * 100).toFixed(1)}%)</span>
                                  )}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Rejected Bidders */}
              {getRejectedBidders().length > 0 && (
                <div>
                  <h3 className="text-lg font-medium text-gray-900 mb-4">
                    Unsuccessful Bidders ({getRejectedBidders().length})
                  </h3>
                  <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Bidder
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Requested
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {getRejectedBidders().map((allocation) => (
                            <tr key={allocation.id}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {allocation.bidder_email}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {formatNumber(allocation.original_quantity)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getAllocationStatusColor(allocation)}`}>
                                  Below clearing price
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* No Results Message */}
          {!clearingResults && !loading && (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-lg font-medium text-gray-900">No Results Available</p>
                <p className="text-sm text-gray-600 mt-2">
                  Auction results will be available once the clearing process is completed.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
