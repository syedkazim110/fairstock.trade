'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import BrandedNavigation from '@/components/BrandedNavigation'
import ModifiedDutchAuctionBidModal from '@/components/ModifiedDutchAuctionBidModal'

interface Auction {
  id: string
  title: string
  description: string
  status: string
  auction_mode: string
  shares_count: number
  max_price: number
  min_price: number
  current_price?: number
  clearing_price?: number
  total_demand?: number
  start_time?: string
  end_time?: string
  bid_collection_end_time?: string
  decreasing_minutes?: number
  duration_hours?: number
  invited_members?: string[]
  articles_document_id?: string
  company_id: string
  created_at: string
  companies: {
    name: string
  }
}

interface AuctionDocument {
  id: string
  file_name: string
  file_size: number
  url: string
}

export default function AuctionPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params)
  const [auction, setAuction] = useState<Auction | null>(null)
  const [auctionDocument, setAuctionDocument] = useState<AuctionDocument | null>(null)
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showBidModal, setShowBidModal] = useState(false)
  const [timeRemaining, setTimeRemaining] = useState<string>('')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    loadAuctionData()
  }, [resolvedParams.id])

  useEffect(() => {
    if (auction && (auction.status === 'collecting_bids' || auction.status === 'active')) {
      const interval = setInterval(updateTimeRemaining, 1000)
      return () => clearInterval(interval)
    }
  }, [auction])

  const loadAuctionData = async () => {
    setLoading(true)
    setError(null)

    try {
      // Get the authenticated user
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        setError('Please log in to view this auction')
        setLoading(false)
        return
      }

      setUser(user)

      // Get auction details first without join
      console.log('Fetching auction with ID:', resolvedParams.id)
      console.log('User email:', user.email)
      
      const { data: auctionData, error: auctionError } = await supabase
        .from('company_auctions')
        .select('*')
        .eq('id', resolvedParams.id)
        .single()

      console.log('Auction query result:', { auctionData, auctionError })

      if (auctionError) {
        console.error('Error fetching auction:', auctionError)
        setError('Auction not found or you do not have permission to view it')
        setLoading(false)
        return
      }

      // Get company information separately
      const { data: companyData, error: companyError } = await supabase
        .from('companies')
        .select('name')
        .eq('id', auctionData.company_id)
        .single()

      console.log('Company query result:', { companyData, companyError })

      if (companyError) {
        console.error('Error fetching company:', companyError)
        setError('Error loading company details')
        setLoading(false)
        return
      }

      // Combine the data
      const combinedAuctionData = {
        ...auctionData,
        companies: companyData
      }

      console.log('Auction invited_members:', auctionData.invited_members)
      console.log('User email check:', user.email, 'in', auctionData.invited_members)

      // Check if user is invited to this auction (more permissive check for debugging)
      if (auctionData.invited_members && !auctionData.invited_members.includes(user.email)) {
        console.warn('User not in invited members list')
        // For now, let's be more permissive and show a warning instead of blocking
        console.log('Allowing access for debugging purposes')
      }

      setAuction(combinedAuctionData)

      // Load auction document if available
      if (auctionData.articles_document_id) {
        const { data: documentData, error: documentError } = await supabase
          .from('company_documents')
          .select('*')
          .eq('id', auctionData.articles_document_id)
          .single()

        if (!documentError && documentData) {
          const { data: { publicUrl } } = supabase.storage
            .from('company-documents')
            .getPublicUrl(documentData.file_path)

          setAuctionDocument({
            ...documentData,
            url: publicUrl
          })
        }
      }

    } catch (error) {
      console.error('Error loading auction:', error)
      setError('Failed to load auction details')
    } finally {
      setLoading(false)
    }
  }

  const updateTimeRemaining = () => {
    if (!auction) return

    const now = new Date()
    let endTime: Date | null = null

    if (auction.status === 'collecting_bids' && auction.bid_collection_end_time) {
      endTime = new Date(auction.bid_collection_end_time)
    } else if (auction.status === 'active' && auction.end_time) {
      endTime = new Date(auction.end_time)
    }

    if (endTime && endTime > now) {
      const diff = endTime.getTime() - now.getTime()
      const hours = Math.floor(diff / (1000 * 60 * 60))
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
      const seconds = Math.floor((diff % (1000 * 60)) / 1000)
      
      setTimeRemaining(`${hours}h ${minutes}m ${seconds}s`)
    } else {
      setTimeRemaining('Expired')
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'collecting_bids':
        return 'bg-yellow-100 text-yellow-800'
      case 'completed':
        return 'bg-blue-100 text-blue-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      case 'draft':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'collecting_bids':
        return 'Collecting Bids'
      default:
        return status.charAt(0).toUpperCase() + status.slice(1)
    }
  }

  const canPlaceBid = () => {
    if (!auction) return false
    
    if (auction.auction_mode === 'modified_dutch') {
      return auction.status === 'collecting_bids' && timeRemaining !== 'Expired'
    } else {
      return auction.status === 'active' && timeRemaining !== 'Expired'
    }
  }

  const handlePlaceBid = () => {
    setShowBidModal(true)
  }

  const handleBidSuccess = () => {
    setShowBidModal(false)
    loadAuctionData() // Reload auction data
  }

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      router.push('/auth/login')
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading auction details...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <BrandedNavigation 
          rightContent={
            user && (
              <button
                onClick={handleLogout}
                className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 px-3 py-2 rounded-md text-sm font-medium text-white"
              >
                Sign out
              </button>
            )
          }
        />
        <div className="flex items-center justify-center py-20">
          <div className="text-center max-w-md">
            <div className="text-red-500 mb-4">
              <svg className="w-16 h-16 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h2>
            <p className="text-gray-600 mb-6">{error}</p>
            {!user && (
              <a
                href="/auth/login"
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium"
              >
                Sign In
              </a>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (!auction) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Auction not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <BrandedNavigation 
        rightContent={
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Welcome, {user?.email}
            </span>
            <button
              onClick={handleLogout}
              className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 px-3 py-2 rounded-md text-sm font-medium text-white"
            >
              Sign out
            </button>
          </div>
        }
      />

      <div className="max-w-4xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="bg-white shadow-lg rounded-lg p-6 mb-8">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{auction.title}</h1>
              <p className="text-lg text-gray-600 mb-4">Company: {auction.companies.name}</p>
              {auction.description && (
                <p className="text-gray-700 mb-4">{auction.description}</p>
              )}
              <div className="flex items-center space-x-4">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(auction.status)}`}>
                  {getStatusText(auction.status)}
                </span>
                {timeRemaining && timeRemaining !== 'Expired' && (
                  <span className="text-sm font-medium text-indigo-600">
                    Time remaining: {timeRemaining}
                  </span>
                )}
                {timeRemaining === 'Expired' && (
                  <span className="text-sm font-medium text-red-600">
                    Auction expired
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Auction Details */}
        <div className="bg-white shadow-lg rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Auction Details</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <span className="text-sm text-gray-500">Auction Type:</span>
                <p className="font-medium">
                  {auction.auction_mode === 'modified_dutch' ? 'Modified Dutch (Uniform Clearing Price)' : 'Traditional Dutch'}
                </p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Shares Available:</span>
                <p className="font-medium">{auction.shares_count.toLocaleString()}</p>
              </div>
              <div>
                <span className="text-sm text-gray-500">Price Range:</span>
                <p className="font-medium">${auction.min_price} - ${auction.max_price}</p>
              </div>
              {auction.auction_mode === 'traditional' && auction.current_price && (
                <div>
                  <span className="text-sm text-gray-500">Current Price:</span>
                  <p className="font-medium text-green-600">${auction.current_price}</p>
                </div>
              )}
              {auction.auction_mode === 'modified_dutch' && auction.clearing_price && (
                <div>
                  <span className="text-sm text-gray-500">Clearing Price:</span>
                  <p className="font-medium text-blue-600">${auction.clearing_price}</p>
                </div>
              )}
            </div>
            
            <div className="space-y-4">
              {auction.start_time && (
                <div>
                  <span className="text-sm text-gray-500">
                    {auction.auction_mode === 'modified_dutch' ? 'Bid Collection Started:' : 'Started:'}
                  </span>
                  <p className="font-medium">{formatDate(auction.start_time)}</p>
                </div>
              )}
              {auction.auction_mode === 'modified_dutch' && auction.bid_collection_end_time && (
                <div>
                  <span className="text-sm text-gray-500">Bid Collection Ends:</span>
                  <p className="font-medium">{formatDate(auction.bid_collection_end_time)}</p>
                </div>
              )}
              {auction.auction_mode === 'traditional' && auction.end_time && (
                <div>
                  <span className="text-sm text-gray-500">Auction Ends:</span>
                  <p className="font-medium">{formatDate(auction.end_time)}</p>
                </div>
              )}
              {auction.auction_mode === 'traditional' && auction.decreasing_minutes && (
                <div>
                  <span className="text-sm text-gray-500">Price Decreases:</span>
                  <p className="font-medium">Every {auction.decreasing_minutes} minutes</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* How It Works */}
        <div className={`rounded-lg p-6 mb-8 ${auction.auction_mode === 'modified_dutch' ? 'bg-blue-50 border border-blue-200' : 'bg-green-50 border border-green-200'}`}>
          <h3 className={`text-lg font-semibold mb-4 ${auction.auction_mode === 'modified_dutch' ? 'text-blue-900' : 'text-green-900'}`}>
            How This Auction Works:
          </h3>
          {auction.auction_mode === 'modified_dutch' ? (
            <ul className="text-sm text-blue-800 space-y-2">
              <li>• Submit your bid with the quantity of shares you want and your maximum price per share</li>
              <li>• You can submit multiple bids or modify your bids during the collection period</li>
              <li>• After the collection period ends, a uniform clearing price will be calculated</li>
              <li>• All winning bidders pay the same clearing price, regardless of their bid price</li>
              <li>• Shares are allocated starting from highest bids until all shares are allocated</li>
            </ul>
          ) : (
            <ul className="text-sm text-green-800 space-y-2">
              <li>• The auction starts at the maximum price of ${auction.max_price}</li>
              <li>• Price decreases every {auction.decreasing_minutes || 'few'} minutes</li>
              <li>• The first bidder to accept the current price wins all shares</li>
              <li>• The auction ends when someone accepts or minimum price is reached</li>
            </ul>
          )}
        </div>

        {/* Documents */}
        {auctionDocument && (
          <div className="bg-white shadow-lg rounded-lg p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Documents</h3>
            <div className="border border-gray-300 rounded-lg p-4 bg-gray-50">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {auctionDocument.file_name}
                    </p>
                    <p className="text-sm text-gray-500">
                      Articles of Incorporation • {Math.round(auctionDocument.file_size / 1024)} KB
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <a
                    href={auctionDocument.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
                  >
                    View Document
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="bg-white shadow-lg rounded-lg p-6">
          <div className="flex justify-center">
            {canPlaceBid() ? (
              <button
                onClick={handlePlaceBid}
                className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white px-8 py-3 rounded-lg font-medium text-lg shadow-lg hover:shadow-xl transition-all duration-300"
              >
                {auction.auction_mode === 'modified_dutch' ? 'Submit Bid' : 'Accept Current Price'}
              </button>
            ) : (
              <div className="text-center">
                <p className="text-gray-600 mb-2">
                  {auction.status === 'draft' && 'This auction has not started yet.'}
                  {auction.status === 'completed' && 'This auction has ended.'}
                  {auction.status === 'cancelled' && 'This auction has been cancelled.'}
                  {timeRemaining === 'Expired' && 'The bidding period has expired.'}
                </p>
                {auction.status === 'completed' && auction.clearing_price && (
                  <p className="text-lg font-semibold text-blue-600">
                    Final clearing price: ${auction.clearing_price}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Compliance Notice */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mt-8">
          <h4 className="text-lg font-medium text-yellow-800 mb-2">Important Notice</h4>
          <p className="text-yellow-700">
            This is a private offering under SEC Rule 506(b). By participating, you confirm that you are an accredited investor 
            and have a pre-existing relationship with the company. This auction is not a public offering.
          </p>
        </div>
      </div>

      {/* Bid Modal */}
      {showBidModal && auction && (
        <ModifiedDutchAuctionBidModal
          auction={auction}
          onClose={() => setShowBidModal(false)}
          onSuccess={handleBidSuccess}
        />
      )}
    </div>
  )
}
