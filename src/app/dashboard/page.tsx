'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [loggingOut, setLoggingOut] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const getUser = async () => {
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
      setLoading(false)
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
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">FairStock</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                Welcome, {profile?.full_name || user.email}
              </span>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="bg-gray-200 hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed px-3 py-2 rounded-md text-sm font-medium text-gray-700 flex items-center space-x-2"
              >
                {loggingOut && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
                )}
                <span>{loggingOut ? 'Signing out...' : 'Sign out'}</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

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
                className="flex items-center px-4 py-3 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg group"
              >
                <svg className="mr-3 h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

              {/* Auction Link */}
              <a
                href="/dashboard/auction"
                className="flex items-center px-4 py-3 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-100 group"
              >
                <svg className="mr-3 h-5 w-5 text-gray-400 group-hover:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v4a2 2 0 01-2 2h-2a2 2 0 00-2-2z" />
                </svg>
                Auction
              </a>

              <div className="pt-6 pb-4">
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Quick Actions</h2>
              </div>

              {/* Create Company Quick Action */}
              <a href="/dashboard/create-company" className="w-full flex items-center px-4 py-3 text-sm font-medium text-green-700 rounded-lg hover:bg-green-50 group">
                <svg className="mr-3 h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                Create Company
              </a>

              {/* Start Auction Quick Action */}
              <button className="w-full flex items-center px-4 py-3 text-sm font-medium text-blue-700 rounded-lg hover:bg-blue-50 group">
                <svg className="mr-3 h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Start Auction
              </button>
            </nav>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 py-6 px-6">
          <div className="px-4 py-6 sm:px-0">
          {/* Welcome Hero Section */}
          <div className="bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-700 rounded-2xl shadow-2xl p-12 mb-8 text-white text-center relative overflow-hidden">
            {/* Background Pattern */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent transform -skew-y-6"></div>
            </div>
            
            <div className="relative z-10">
              <h1 className="text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-blue-100">
                Welcome to FairStock Trading
              </h1>
              <p className="text-2xl mb-6 opacity-90 font-light">
                The premier Dutch auction platform for fair and transparent trading
              </p>
              <p className="text-lg opacity-80 mb-8">
                Hello {profile?.full_name || user.email?.split('@')[0]}! Ready to revolutionize your trading experience?
              </p>
              
              <div className="flex justify-center space-x-4">
                <div className="bg-black bg-opacity-20 rounded-lg px-4 py-2">
                  <span className="text-sm font-semibold">🚀 Fast Trading</span>
                </div>
                <div className="bg-black bg-opacity-20 rounded-lg px-4 py-2">
                  <span className="text-sm font-semibold">🔒 Secure Platform</span>
                </div>
                <div className="bg-black bg-opacity-20 rounded-lg px-4 py-2">
                  <span className="text-sm font-semibold">📈 Real-time Auctions</span>
                </div>
              </div>
            </div>
          </div>

          {/* Company Onboarding Options */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="bg-white rounded-lg shadow-lg p-8 border-2 border-transparent hover:border-indigo-500 transition-colors">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 mb-6">
                  <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Create New Company</h3>
                <p className="text-gray-600 mb-6">
                  Start fresh by creating a new company profile to begin their auction journey with FairStock.
                </p>
                <a href="/dashboard/create-company" className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg transition-colors inline-block text-center">
                  Create New Company
                </a>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-8 border-2 border-transparent hover:border-indigo-500 transition-colors">
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-6">
                  <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H9m0 0H5m0 0h2M7 7h10M7 11h10M7 15h10" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-4">Onboard Existing Company</h3>
                <p className="text-gray-600 mb-6">
                  Onboard companies to kickstart their auction journey on the platform.
                </p>
                <button className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-lg transition-colors">
                  Onboard Existing Company
                </button>
              </div>
            </div>
          </div>

          {/* Profile Summary */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Your Profile Summary</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <p className="mt-1 text-sm text-gray-900">{user.email}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Full Name</label>
                <p className="mt-1 text-sm text-gray-900">{profile?.full_name || 'Not provided'}</p>
              </div>
              {profile?.company && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Company</label>
                  <p className="mt-1 text-sm text-gray-900">{profile.company}</p>
                </div>
              )}
            </div>
          </div>
          </div>
        </main>
      </div>
    </div>
  )
}
