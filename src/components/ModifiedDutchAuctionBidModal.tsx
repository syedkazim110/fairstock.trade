'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { calculateClearingPrice, generateAuctionSummary, formatCurrency, formatNumber, type Bid } from '@/lib/modified-dutch-auction'

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
}

interface ModifiedDutchAuctionBidModalProps {
  auction: Auction
  onClose: () => void
  onSuccess: () => void
}

interface BidFormData {
  quantity: number
  maxPrice: number
}

export default function ModifiedDutchAuctionBidModal({ 
  auction, 
  onClose, 
  onSuccess 
}: ModifiedDutchAuctionBidModalProps) {
  const [formData, setFormData] = useState<BidFormData>({
    quantity: 0,
    maxPrice: auction.max_price
  })
  const [loading, setLoading] = useState(false)
  const [existingBids, setExistingBids] = useState<any[]>([])
  const [currentUserBid, setCurrentUserBid] = useState<any>(null)
  const [demandAnalysis, setDemandAnalysis] = useState<any>(null)
  const supabase = createClient()

  useEffect(() => {
    loadExistingBids()
  }, [auction.id])

  const loadExistingBids = async () => {
    try {
      // Load all bids for demand analysis (anonymized)
      const { data: allBids, error: bidsError } = await supabase
        .from('auction_bids')
        .select('quantity_requested, max_price, bid_time')
        .eq('auction_id', auction.id)
        .eq('bid_status', 'active')
        .order('max_price', { ascending: false })

      if (bidsError) {
        console.error('Error loading bids:', bidsError)
        return
      }

      setExistingBids(allBids || [])

      // Load current user's bid
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: userBid, error: userBidError } = await supabase
          .from('auction_bids')
          .select('*')
          .eq('auction_id', auction.id)
          .eq('bidder_id', user.id)
          .eq('bid_status', 'active')
          .single()

        if (!userBidError && userBid) {
          setCurrentUserBid(userBid)
          setFormData({
            quantity: userBid.quantity_requested,
            maxPrice: userBid.max_price
          })
        }
      }

      // Calculate demand analysis
      if (allBids && allBids.length > 0) {
        const bidsForAnalysis: Bid[] = allBids.map((bid, index) => ({
          id: `bid-${index}`,
          bidder_id: `bidder-${index}`,
          bidder_email: `bidder${index}@example.com`,
          quantity: bid.quantity_requested,
          max_price: bid.max_price,
          bid_time: new Date(bid.bid_time)
        }))

        const clearingResult = calculateClearingPrice(bidsForAnalysis, auction.shares_count)
        setDemandAnalysis(clearingResult)
      }
    } catch (error) {
      console.error('Error loading auction data:', error)
    }
  }

  const updateFormData = (updates: Partial<BidFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }))
  }

  const calculateEstimatedTotal = () => {
    if (!formData.quantity || !formData.maxPrice) return 0
    return formData.quantity * formData.maxPrice
  }

  const handleSubmit = async () => {
    if (formData.quantity <= 0 || formData.maxPrice <= 0) {
      alert('Please enter valid quantity and maximum price')
      return
    }

    if (formData.maxPrice < auction.min_price) {
      alert(`Maximum price must be at least $${auction.min_price} (auction minimum)`)
      return
    }

    if (formData.maxPrice > auction.max_price) {
      alert(`Maximum price cannot exceed $${auction.max_price} (auction maximum)`)
      return
    }

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('User not authenticated')
      }

      const bidData = {
        auction_id: auction.id,
        bidder_id: user.id,
        bidder_email: user.email,
        quantity_requested: formData.quantity,
        max_price: formData.maxPrice,
        bid_amount: formData.maxPrice, // For compatibility
        bid_status: 'active'
      }

      let result
      if (currentUserBid) {
        // Update existing bid
        result = await supabase
          .from('auction_bids')
          .update(bidData)
          .eq('id', currentUserBid.id)
          .select()
      } else {
        // Create new bid
        result = await supabase
          .from('auction_bids')
          .insert(bidData)
          .select()
      }

      if (result.error) {
        throw result.error
      }

      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error submitting bid:', error)
      alert(`Failed to submit bid: ${error instanceof Error ? error.message : 'Please try again.'}`)
    } finally {
      setLoading(false)
    }
  }

  const getCompetitiveAnalysis = () => {
    if (!demandAnalysis || existingBids.length === 0) return null

    const totalDemand = existingBids.reduce((sum, bid) => sum + bid.quantity_requested, 0)
    const demandRatio = (totalDemand / auction.shares_count) * 100
    const clearingPrice = demandAnalysis.clearing_price

    return {
      totalBids: existingBids.length,
      totalDemand,
      demandRatio,
      clearingPrice,
      isOversubscribed: totalDemand > auction.shares_count,
      userPosition: formData.maxPrice >= clearingPrice ? 'likely_winner' : 'below_clearing'
    }
  }

  const analysis = getCompetitiveAnalysis()

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {currentUserBid ? 'Update Your Bid' : 'Place Your Bid'}
              </h2>
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
        <div className="px-6 py-6 max-h-[60vh] overflow-y-auto space-y-6">
          {/* Auction Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-medium text-blue-900 mb-2">Modified Dutch Auction</h3>
            <div className="text-sm text-blue-800 space-y-1">
              <p>• Submit your <strong>quantity desired</strong> and <strong>maximum price per share</strong></p>
              <p>• All bids are collected during the auction period</p>
              <p>• A uniform clearing price is calculated where supply meets demand</p>
              <p>• All winners pay the same clearing price (potentially less than your max bid)</p>
              <p>• Pro-rata allocation if oversubscribed at clearing price</p>
            </div>
          </div>

          {/* Auction Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Auction Details</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Shares:</span>
                  <span className="font-medium">{formatNumber(auction.shares_count)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Price Range:</span>
                  <span className="font-medium">{formatCurrency(auction.min_price)} - {formatCurrency(auction.max_price)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <span className="font-medium capitalize">{auction.status}</span>
                </div>
              </div>
            </div>

            {analysis && (
              <div className="bg-gray-50 rounded-lg p-4">
                <h4 className="font-medium text-gray-900 mb-2">Current Demand</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Bids:</span>
                    <span className="font-medium">{analysis.totalBids}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Total Demand:</span>
                    <span className="font-medium">{formatNumber(analysis.totalDemand)} shares</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Demand Ratio:</span>
                    <span className={`font-medium ${analysis.demandRatio > 100 ? 'text-red-600' : 'text-green-600'}`}>
                      {analysis.demandRatio.toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Est. Clearing Price:</span>
                    <span className="font-medium">{formatCurrency(analysis.clearingPrice)}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Bid Form */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Your Bid</h3>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Quantity (shares)
                </label>
                <input
                  type="number"
                  min="1"
                  value={formData.quantity || ''}
                  onChange={(e) => updateFormData({ quantity: parseInt(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g., 100"
                />
                <p className="text-xs text-gray-500 mt-1">Number of shares you want to purchase</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Maximum Price per Share ($)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={auction.min_price}
                  max={auction.max_price}
                  value={formData.maxPrice || ''}
                  onChange={(e) => updateFormData({ maxPrice: parseFloat(e.target.value) || 0 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g., 120.00"
                />
                <p className="text-xs text-gray-500 mt-1">Maximum you're willing to pay per share</p>
              </div>
            </div>

            {/* Bid Summary */}
            {formData.quantity > 0 && formData.maxPrice > 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h4 className="font-medium text-green-900 mb-2">Bid Summary</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-green-700">Quantity:</span>
                    <span className="font-medium">{formatNumber(formData.quantity)} shares</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">Max Price per Share:</span>
                    <span className="font-medium">{formatCurrency(formData.maxPrice)}</span>
                  </div>
                  <div className="flex justify-between border-t border-green-200 pt-2">
                    <span className="text-green-700 font-medium">Maximum Total Cost:</span>
                    <span className="font-bold">{formatCurrency(calculateEstimatedTotal())}</span>
                  </div>
                  <p className="text-xs text-green-600 mt-2">
                    <strong>Note:</strong> You may pay less than this if the clearing price is below your maximum price.
                  </p>
                </div>
              </div>
            )}

            {/* Competitive Position */}
            {analysis && formData.maxPrice > 0 && (
              <div className={`border rounded-lg p-4 ${
                analysis.userPosition === 'likely_winner' 
                  ? 'bg-green-50 border-green-200' 
                  : 'bg-yellow-50 border-yellow-200'
              }`}>
                <h4 className={`font-medium mb-2 ${
                  analysis.userPosition === 'likely_winner' 
                    ? 'text-green-900' 
                    : 'text-yellow-900'
                }`}>
                  Competitive Position
                </h4>
                <p className={`text-sm ${
                  analysis.userPosition === 'likely_winner' 
                    ? 'text-green-700' 
                    : 'text-yellow-700'
                }`}>
                  {analysis.userPosition === 'likely_winner' 
                    ? `✅ Your bid of ${formatCurrency(formData.maxPrice)} is above the estimated clearing price of ${formatCurrency(analysis.clearingPrice)}. You're likely to win shares.`
                    : `⚠️ Your bid of ${formatCurrency(formData.maxPrice)} is below the estimated clearing price of ${formatCurrency(analysis.clearingPrice)}. Consider increasing your maximum price.`
                  }
                </p>
                {analysis.isOversubscribed && (
                  <p className="text-xs text-gray-600 mt-2">
                    The auction is currently oversubscribed. Pro-rata allocation may apply at the clearing price.
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Cancel
          </button>
          
          <button
            onClick={handleSubmit}
            disabled={loading || formData.quantity <= 0 || formData.maxPrice <= 0}
            className="px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {loading && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            )}
            <span>
              {loading 
                ? 'Submitting...' 
                : currentUserBid 
                  ? 'Update Bid' 
                  : 'Place Bid'
              }
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}
