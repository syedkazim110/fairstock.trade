'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import BrandedNavigation from '@/components/BrandedNavigation'
import CreateAuctionModal from '@/components/CreateAuctionModal'

interface Auction {
  id: string
  title: string
  description: string
  status: string
  auction_type: string
  shares_count: number
  max_price: number
  min_price: number
  current_price: number
  duration_hours: number
  decreasing_minutes: number
  start_time: string
  end_time: string
  created_at: string
  company: {
    name: string
  }
}

interface Company {
  id: string
  name: string
  created_by: string
}

export default function AuctionPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  console.log('AuctionPage render - showCreateModal:', showCreateModal)
  console.log('AuctionPage render - companies:', companies.length)

  useEffect(() => {
    const getUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        
        if (!user) {
          router.push('/auth/login')
          return
        }

        setUser(user)

        // Get user profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single()

        setProfile(profile)

        // Load user's companies
        const { data: companiesData } = await supabase
          .from('companies')
          .select('*')
          .eq('created_by', user.id)

        setCompanies(companiesData || [])

        // Load auctions for user's companies
        if (companiesData && companiesData.length > 0) {
          const companyIds = companiesData.map(c => c.id)
          const { data: auctionsData } = await supabase
            .from('company_auctions')
            .select(`
              *,
              company:companies(name)
            `)
            .in('company_id', companyIds)
            .order('created_at', { ascending: false })

          setAuctions(auctionsData || [])
        }

        setLoading(false)
      } catch (error) {
        console.error('Error loading auction page:', error)
        setLoading(false)
      }
    }

    getUser()
  }, [router, supabase])

  const handleLogout = async () => {
    setLoggingOut(true)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Error logging out:', error)
        alert('Error logging out. Please try again.')
      } else {
        router.push('/auth/login')
      }
    } catch (err) {
      console.error('Unexpected error:', err)
      alert('An unexpected error occurred. Please try again.')
    } finally {
      setLoggingOut(false)
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
      case 'completed':
        return 'bg-blue-100 text-blue-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      case 'expired':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-yellow-100 text-yellow-800'
    }
  }

  const handleAuctionSuccess = async () => {
    // Refresh auctions list after successful creation
    if (companies.length > 0) {
      const companyIds = companies.map(c => c.id)
      const { data: auctionsData } = await supabase
        .from('company_auctions')
        .select(`
          *,
          company:companies(name)
        `)
        .in('company_id', companyIds)
        .order('created_at', { ascending: false })

      setAuctions(auctionsData || [])
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <BrandedNavigation 
        rightContent={
          <div className="flex items-center space-x-4">
            <span className="text-sm font-medium bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Welcome, {profile?.full_name || user.email}
            </span>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 rounded-md text-sm font-medium text-white flex items-center space-x-2 transition-all duration-300 shadow-md hover:shadow-lg"
            >
              {loggingOut && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
              <span>{loggingOut ? 'Signing out...' : 'Sign out'}</span>
            </button>
          </div>
        }
      />

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white shadow-lg min-h-screen">
          <div className="p-6">
            <nav className="space-y-2">
              <div className="pb-4">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Navigation</h2>
              </div>
              
              {/* Dashboard Link */}
              <a
                href="/dashboard"
                className="flex items-center px-4 py-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 group"
              >
                <svg className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5a2 2 0 012-2h4a2 2 0 012 2v6H8V5z" />
                </svg>
                Dashboard
              </a>

              {/* My Companies Link */}
              <a
                href="/dashboard/companies"
                className="flex items-center px-4 py-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 group"
              >
                <svg className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H9m0 0H5m0 0h2M7 7h10M7 11h10M7 15h10" />
                </svg>
                My Companies
              </a>

              {/* Auction Link - Active */}
              <a
                href="/dashboard/auction"
                className="flex items-center px-4 py-3 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg group"
              >
                <svg className="mr-3 h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 00-2-2z" />
                </svg>
                Auction
              </a>
            </nav>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 py-6 px-6">
          <div className="px-4 py-6 sm:px-0">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Auction Management</h1>
                <p className="text-gray-600 mt-2">Create and manage Dutch auctions for your company shares</p>
              </div>
              <button
                onClick={() => {
                  console.log('New Auction button clicked, companies:', companies.length)
                  setShowCreateModal(true)
                }}
                disabled={companies.length === 0}
                className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-6 py-3 rounded-lg font-medium flex items-center space-x-2 shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                <span>New Auction</span>
              </button>
            </div>

            {/* No companies warning */}
            {companies.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 mb-8">
                <div className="flex items-center">
                  <svg className="w-6 h-6 text-yellow-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div>
                    <h3 className="text-lg font-medium text-yellow-800">No Companies Found</h3>
                    <p className="text-yellow-700 mt-1">You need to create a company before you can start an auction.</p>
                    <a href="/dashboard/create-company" className="text-yellow-800 underline font-medium mt-2 inline-block">
                      Create your first company →
                    </a>
                  </div>
                </div>
              </div>
            )}

            {/* Auctions List */}
            {auctions.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-lg shadow">
                <div className="text-gray-400 mb-4">
                  <svg className="w-16 h-16 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <h3 className="text-xl font-medium text-gray-900 mb-2">No Auctions Yet</h3>
                  <p className="text-gray-600 mb-6">Create your first Dutch auction to start trading company shares.</p>
                  {companies.length > 0 && (
                    <button
                      onClick={() => {
                        console.log('Create First Auction button clicked')
                        setShowCreateModal(true)
                      }}
                      className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white px-6 py-3 rounded-lg font-medium"
                    >
                      Create First Auction
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {auctions.map((auction) => (
                  <div key={auction.id} className="bg-white shadow-lg rounded-lg p-6 border border-gray-200">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-xl font-semibold text-gray-900">{auction.title}</h3>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(auction.status)}`}>
                            {auction.status.charAt(0).toUpperCase() + auction.status.slice(1)}
                          </span>
                        </div>
                        
                        <p className="text-gray-600 mb-4">{auction.description}</p>
                        
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Company:</span>
                            <p className="font-medium">{auction.company?.name}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Shares:</span>
                            <p className="font-medium">{auction.shares_count?.toLocaleString()}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Price Range:</span>
                            <p className="font-medium">${auction.min_price} - ${auction.max_price}</p>
                          </div>
                          <div>
                            <span className="text-gray-500">Current Price:</span>
                            <p className="font-medium text-green-600">${auction.max_price?.toFixed(2) || '0.00'}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-6 text-sm text-gray-500 mt-4">
                          <span>Created: {formatDate(auction.created_at)}</span>
                          {auction.start_time && (
                            <span>Starts: {formatDate(auction.start_time)}</span>
                          )}
                          {auction.end_time && (
                            <span>Ends: {formatDate(auction.end_time)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="mt-6 flex justify-end space-x-3">
                      <button className="text-indigo-600 hover:text-indigo-800 text-sm font-medium px-3 py-1 rounded border border-indigo-200 hover:bg-indigo-50">
                        View Details
                      </button>
                      <button className="text-gray-600 hover:text-gray-800 text-sm font-medium px-3 py-1 rounded border border-gray-200 hover:bg-gray-50">
                        Edit
                      </button>
                      {auction.status === 'draft' && (
                        <button className="text-green-600 hover:text-green-800 text-sm font-medium px-3 py-1 rounded border border-green-200 hover:bg-green-50">
                          Start Auction
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Create Auction Modal */}
      {showCreateModal && (
        <CreateAuctionModal
          companies={companies}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleAuctionSuccess}
        />
      )}
    </div>
  )
}
