'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Auction {
  id: string
  title: string
  description: string
  status: string
  created_at: string
}

interface AuctionsTabProps {
  companyId: string
}

export default function AuctionsTab({ companyId }: AuctionsTabProps) {
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (companyId) {
      loadAuctions()
    }
  }, [companyId])

  const loadAuctions = async () => {
    setLoading(true)
    const supabase = createClient()
    
    try {
      const { data, error } = await supabase
        .from('company_auctions')
        .select('id, title, description, status, created_at')
        .eq('company_id', companyId)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching auctions:', error)
      } else {
        setAuctions(data || [])
      }
    } catch (error) {
      console.error('Error loading auctions:', error)
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800'
      case 'completed':
        return 'bg-blue-100 text-blue-800'
      case 'cancelled':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
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
        <h3 className="text-lg font-medium text-gray-900">Auctions</h3>
        <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium">
          Create Auction
        </button>
      </div>

      {auctions.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 mb-4">
            <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p className="text-lg font-medium text-gray-900">No Auctions Yet</p>
            <p className="text-sm text-gray-600 mt-2">Create your first auction to start trading company shares.</p>
          </div>
          <button className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-md text-sm font-medium">
            Create First Auction
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {auctions.map((auction) => (
            <div key={auction.id} className="bg-white shadow rounded-lg p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="text-lg font-medium text-gray-900 mb-2">{auction.title}</h4>
                  {auction.description && (
                    <p className="text-gray-600 mb-3">{auction.description}</p>
                  )}
                  <div className="flex items-center space-x-4 text-sm text-gray-500">
                    <span>Created: {formatDate(auction.created_at)}</span>
                  </div>
                </div>
                <div className="flex-shrink-0 ml-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(auction.status)}`}>
                    {auction.status.charAt(0).toUpperCase() + auction.status.slice(1)}
                  </span>
                </div>
              </div>
              
              <div className="mt-4 flex justify-end space-x-2">
                <button className="text-indigo-600 hover:text-indigo-800 text-sm font-medium">
                  View Details
                </button>
                <button className="text-gray-600 hover:text-gray-800 text-sm font-medium">
                  Edit
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
