'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import CreateAuctionModal from './CreateAuctionModal'

interface Auction {
  id: string
  title: string
  description: string
  status: string
  created_at: string
  articles_document_id?: string
  shares_count?: number
  max_price?: number
  min_price?: number
}

interface Company {
  id: string
  name: string
}

interface AuctionsTabProps {
  companyId: string
}

export default function AuctionsTab({ companyId }: AuctionsTabProps) {
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null)
  const [auctionDocument, setAuctionDocument] = useState<any>(null)

  useEffect(() => {
    if (companyId) {
      loadAuctions()
      loadCompanies()
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

  const loadCompanies = async () => {
    const supabase = createClient()
    
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name')
        .order('name')

      if (error) {
        console.error('Error fetching companies:', error)
      } else {
        setCompanies(data || [])
      }
    } catch (error) {
      console.error('Error loading companies:', error)
    }
  }

  const handleCreateAuctionSuccess = () => {
    loadAuctions() // Reload auctions after successful creation
  }

  const handleViewAuctionDetails = async (auction: Auction) => {
    const supabase = createClient()
    
    try {
      // Get full auction details including articles_document_id
      const { data: auctionData, error: auctionError } = await supabase
        .from('company_auctions')
        .select('*')
        .eq('id', auction.id)
        .single()

      if (auctionError) {
        console.error('Error fetching auction details:', auctionError)
        return
      }

      setSelectedAuction(auctionData)

      // If there's an articles document, load it
      if (auctionData.articles_document_id) {
        const { data: documentData, error: documentError } = await supabase
          .from('company_documents')
          .select('*')
          .eq('id', auctionData.articles_document_id)
          .single()

        if (documentError) {
          console.error('Error fetching document:', documentError)
        } else {
          // Get the public URL for the document
          const { data: { publicUrl } } = supabase.storage
            .from('company-documents')
            .getPublicUrl(documentData.file_path)

          setAuctionDocument({ ...documentData, url: publicUrl })
        }
      } else {
        setAuctionDocument(null)
      }
    } catch (error) {
      console.error('Error loading auction details:', error)
    }
  }

  const closeAuctionDetails = () => {
    setSelectedAuction(null)
    setAuctionDocument(null)
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
        <button 
          onClick={() => setShowCreateModal(true)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
        >
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
          <button 
            onClick={() => setShowCreateModal(true)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-md text-sm font-medium"
          >
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
                <button 
                  onClick={() => handleViewAuctionDetails(auction)}
                  className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                >
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

      {/* Create Auction Modal */}
      {showCreateModal && (
        <CreateAuctionModal
          companies={companies}
          onClose={() => setShowCreateModal(false)}
          onSuccess={handleCreateAuctionSuccess}
          preselectedCompanyId={companyId}
        />
      )}

      {/* Auction Details Modal */}
      {selectedAuction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">{selectedAuction.title}</h2>
                  <p className="text-sm text-gray-600">Auction Details</p>
                </div>
                <button
                  onClick={closeAuctionDetails}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-6 max-h-[70vh] overflow-y-auto">
              <div className="space-y-6">
                {/* Auction Information */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-medium text-gray-900 mb-4">Auction Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-gray-500">Status:</span>
                      <p className="font-medium">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedAuction.status)}`}>
                          {selectedAuction.status.charAt(0).toUpperCase() + selectedAuction.status.slice(1)}
                        </span>
                      </p>
                    </div>
                    <div>
                      <span className="text-sm text-gray-500">Created:</span>
                      <p className="font-medium">{formatDate(selectedAuction.created_at)}</p>
                    </div>
                    {selectedAuction.shares_count && (
                      <div>
                        <span className="text-sm text-gray-500">Shares:</span>
                        <p className="font-medium">{selectedAuction.shares_count.toLocaleString()}</p>
                      </div>
                    )}
                    {selectedAuction.max_price && selectedAuction.min_price && (
                      <div>
                        <span className="text-sm text-gray-500">Price Range:</span>
                        <p className="font-medium">${selectedAuction.min_price} - ${selectedAuction.max_price}</p>
                      </div>
                    )}
                  </div>
                  {selectedAuction.description && (
                    <div className="mt-4">
                      <span className="text-sm text-gray-500">Description:</span>
                      <p className="font-medium mt-1">{selectedAuction.description}</p>
                    </div>
                  )}
                </div>

                {/* Documents Section */}
                {auctionDocument && (
                  <div className="bg-blue-50 rounded-lg p-6">
                    <h3 className="text-lg font-medium text-gray-900 mb-4">Documents</h3>
                    <div className="border border-gray-300 rounded-lg p-4 bg-white">
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
                    <p className="text-sm text-blue-800 mt-3">
                      <strong>Note:</strong> This document is available to all invited members of this auction.
                    </p>
                  </div>
                )}

                {!auctionDocument && (
                  <div className="bg-gray-50 rounded-lg p-6 text-center">
                    <svg className="w-12 h-12 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-gray-600">No documents attached to this auction</p>
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end">
              <button
                onClick={closeAuctionDetails}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
