'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import FileUpload, { UploadedFile } from './FileUpload'

interface Company {
  id: string
  name: string
}

interface CreateAuctionModalProps {
  companies: Company[]
  onClose: () => void
  onSuccess: () => void
  preselectedCompanyId?: string
}

interface AuctionFormData {
  companyId: string
  title: string
  description: string
  sharesCount: number
  maxPrice: number
  minPrice: number
  decreasingMinutes: number
  durationHours: number
  auctionMode: 'traditional' | 'modified_dutch'
  bidCollectionHours: number
  invitedMembers: string[]
  wireAccountName: string
  wireAccountNumber: string
  wireRoutingNumber: string
  wireBankName: string
  wireBankAddress: string
  articlesDocumentId: string
  marketingComplianceAccepted: boolean
  accreditedInvestorComplianceAccepted: boolean
}

const initialFormData: AuctionFormData = {
  companyId: '',
  title: '',
  description: '',
  sharesCount: 0,
  maxPrice: 0,
  minPrice: 0,
  decreasingMinutes: 15,
  durationHours: 24,
  auctionMode: 'modified_dutch',
  bidCollectionHours: 24,
  invitedMembers: [],
  wireAccountName: '',
  wireAccountNumber: '',
  wireRoutingNumber: '',
  wireBankName: '',
  wireBankAddress: '',
  articlesDocumentId: '',
  marketingComplianceAccepted: false,
  accreditedInvestorComplianceAccepted: false
}

export default function CreateAuctionModal({ companies, onClose, onSuccess, preselectedCompanyId }: CreateAuctionModalProps) {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<AuctionFormData>({
    ...initialFormData,
    companyId: preselectedCompanyId || ''
  })
  const [loading, setLoading] = useState(false)
  const [companyMembers, setCompanyMembers] = useState<any[]>([])
  const [companyDocuments, setCompanyDocuments] = useState<any[]>([])
  const [uploadedDocument, setUploadedDocument] = useState<UploadedFile | null>(null)
  const supabase = createClient()

  const totalSteps = 5

  useEffect(() => {
    if (formData.companyId) {
      loadCompanyData()
    }
  }, [formData.companyId])

  const loadCompanyData = async () => {
    // Load company members
    const { data: members } = await supabase
      .from('company_members')
      .select('*')
      .eq('company_id', formData.companyId)

    setCompanyMembers(members || [])

    // Load company documents (articles of incorporation)
    const { data: documents } = await supabase
      .from('company_documents')
      .select('*')
      .eq('company_id', formData.companyId)
      .eq('document_type', 'articles_of_incorporation')

    setCompanyDocuments(documents || [])
  }

  const updateFormData = (updates: Partial<AuctionFormData>) => {
    setFormData(prev => {
      const newData = { ...prev, ...updates }
      
      // If switching to modified_dutch, set decreasingMinutes to 0 since it's not used
      if (updates.auctionMode === 'modified_dutch') {
        newData.decreasingMinutes = 0
      }
      // If switching to traditional, set a default value if it's 0
      else if (updates.auctionMode === 'traditional' && newData.decreasingMinutes === 0) {
        newData.decreasingMinutes = 15
      }
      
      return newData
    })
  }

  const handleFileUploaded = async (file: UploadedFile) => {
    try {
      // Save the document to the database
      const { data: document, error } = await supabase
        .from('company_documents')
        .insert({
          company_id: formData.companyId,
          document_type: 'articles_of_incorporation',
          file_name: file.file_name,
          file_path: file.file_path,
          file_size: file.file_size,
          mime_type: file.mime_type,
          uploaded_by: (await supabase.auth.getUser()).data.user?.id
        })
        .select()
        .single()

      if (error) {
        console.error('Error saving document:', error)
        return
      }

      // Update the uploaded document state and form data
      setUploadedDocument(file)
      updateFormData({ articlesDocumentId: document.id })
      
      // Reload company documents to show the new document
      loadCompanyData()
    } catch (error) {
      console.error('Error handling file upload:', error)
    }
  }

  const handleFileRemoved = () => {
    setUploadedDocument(null)
    updateFormData({ articlesDocumentId: '' })
  }

  const calculatePricePreview = () => {
    if (!formData.maxPrice || !formData.minPrice || !formData.durationHours || !formData.decreasingMinutes) {
      return null
    }

    const totalSteps = Math.floor((formData.durationHours * 60) / formData.decreasingMinutes)
    const stepSize = (formData.maxPrice - formData.minPrice) / totalSteps

    return {
      totalSteps,
      stepSize: stepSize.toFixed(2),
      totalDecreases: totalSteps
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/companies/${formData.companyId}/auctions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title,
          description: formData.description,
          shares_count: formData.sharesCount,
          max_price: formData.maxPrice,
          min_price: formData.minPrice,
          decreasing_minutes: formData.decreasingMinutes,
          duration_hours: formData.durationHours,
          auction_mode: formData.auctionMode,
          bid_collection_hours: formData.bidCollectionHours,
          invited_members: formData.invitedMembers,
          wire_account_name: formData.wireAccountName,
          wire_account_number: formData.wireAccountNumber,
          wire_routing_number: formData.wireRoutingNumber,
          wire_bank_name: formData.wireBankName,
          wire_bank_address: formData.wireBankAddress,
          articles_document_id: formData.articlesDocumentId || null,
          marketing_compliance_accepted: formData.marketingComplianceAccepted,
          accredited_investor_compliance_accepted: formData.accreditedInvestorComplianceAccepted,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create auction')
      }

      onSuccess()
      onClose()
    } catch (error) {
      console.error('Error creating auction:', error)
      alert(`Failed to create auction: ${error instanceof Error ? error.message : 'Please try again.'}`)
    } finally {
      setLoading(false)
    }
  }

  const canProceedToNextStep = () => {
    switch (currentStep) {
      case 1:
        return formData.marketingComplianceAccepted
      case 2:
        return formData.companyId
      case 3:
        // For traditional auctions, require decreasingMinutes; for modified dutch, it's not needed
        const priceDropValid = formData.auctionMode === 'modified_dutch' || (formData.auctionMode === 'traditional' && formData.decreasingMinutes > 0)
        return formData.title && formData.sharesCount > 0 && formData.maxPrice > 0 && formData.minPrice > 0 && formData.maxPrice > formData.minPrice && formData.durationHours > 0 && priceDropValid
      case 4:
        return formData.wireAccountName && formData.wireAccountNumber && formData.wireRoutingNumber && formData.wireBankName && formData.accreditedInvestorComplianceAccepted
      case 5:
        return true
      default:
        return false
    }
  }

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">SEC Rule 506(b) Compliance</h3>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
                <div className="text-sm text-gray-700 space-y-3">
                  <p className="font-medium">Important Marketing Restrictions:</p>
                  <p>Under SEC Rule 506(b), you are prohibited from engaging in general solicitation or general advertising to market this offering. This means:</p>
                  <ul className="list-disc list-inside space-y-1 ml-4">
                    <li>You cannot advertise this auction publicly</li>
                    <li>You can only invite people with whom you have a pre-existing relationship</li>
                    <li>All participants must be accredited investors or sophisticated investors</li>
                    <li>You must reasonably believe each investor is accredited</li>
                  </ul>
                  <p className="font-medium text-red-600">Violation of these rules can result in serious legal consequences.</p>
                </div>
              </div>
              <label className="flex items-start space-x-3">
                <input
                  type="checkbox"
                  checked={formData.marketingComplianceAccepted}
                  onChange={(e) => updateFormData({ marketingComplianceAccepted: e.target.checked })}
                  className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <span className="text-sm text-gray-700">
                  I have read the above guidelines and will abide by them. I understand the legal requirements and restrictions.
                </span>
              </label>
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Company & Documents</h3>
              
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Company</label>
                <select
                  value={formData.companyId}
                  onChange={(e) => updateFormData({ companyId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Choose a company...</option>
                  {companies.map(company => (
                    <option key={company.id} value={company.id}>{company.name}</option>
                  ))}
                </select>
              </div>

              {formData.companyId && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Articles of Incorporation</label>
                  {companyDocuments.length > 0 ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        {companyDocuments.map(doc => (
                          <label key={doc.id} className="flex items-center space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                            <input
                              type="radio"
                              name="articlesDocument"
                              value={doc.id}
                              checked={formData.articlesDocumentId === doc.id}
                              onChange={(e) => updateFormData({ articlesDocumentId: e.target.value })}
                              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                            />
                            <div>
                              <p className="text-sm font-medium text-gray-900">{doc.file_name}</p>
                              <p className="text-xs text-gray-500">Uploaded {new Date(doc.created_at).toLocaleDateString()}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                      <div className="border-t border-gray-200 pt-4">
                        <p className="text-sm text-gray-600 mb-3">Or upload a new document:</p>
                        <FileUpload
                          onFileUploaded={handleFileUploaded}
                          onFileRemoved={handleFileRemoved}
                          documentType="articles_of_incorporation"
                          label=""
                          existingFile={uploadedDocument}
                        />
                      </div>
                    </div>
                  ) : (
                    <FileUpload
                      onFileUploaded={handleFileUploaded}
                      onFileRemoved={handleFileRemoved}
                      documentType="articles_of_incorporation"
                      label=""
                      existingFile={uploadedDocument}
                    />
                  )}
                </div>
              )}
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Auction Configuration</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Auction Title</label>
                  <input
                    type="text"
                    value={formData.title}
                    onChange={(e) => updateFormData({ title: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g., Series A Preferred Shares"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Number of Shares</label>
                  <input
                    type="number"
                    value={formData.sharesCount || ''}
                    onChange={(e) => updateFormData({ sharesCount: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="1000"
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => updateFormData({ description: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Describe the shares being auctioned..."
                />
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Auction Type</label>
                <div className="space-y-3">
                  <label className="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <input
                      type="radio"
                      name="auctionMode"
                      value="traditional"
                      checked={formData.auctionMode === 'traditional'}
                      onChange={(e) => updateFormData({ auctionMode: e.target.value as 'traditional' | 'modified_dutch' })}
                      className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Traditional Dutch Auction</p>
                      <p className="text-xs text-gray-500">Price decreases over time. First bidder wins at current price.</p>
                    </div>
                  </label>
                  <label className="flex items-start space-x-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
                    <input
                      type="radio"
                      name="auctionMode"
                      value="modified_dutch"
                      checked={formData.auctionMode === 'modified_dutch'}
                      onChange={(e) => updateFormData({ auctionMode: e.target.value as 'traditional' | 'modified_dutch' })}
                      className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900">Modified Dutch Auction (Uniform Clearing Price)</p>
                      <p className="text-xs text-gray-500">Collect all bids, then calculate uniform clearing price. All winners pay the same price.</p>
                    </div>
                  </label>
                </div>
              </div>

              <div className={`grid gap-4 mb-6 ${formData.auctionMode === 'modified_dutch' ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-2 md:grid-cols-4'}`}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Maximum Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.maxPrice || ''}
                    onChange={(e) => updateFormData({ maxPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Minimum Price ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.minPrice || ''}
                    onChange={(e) => updateFormData({ minPrice: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {formData.auctionMode === 'modified_dutch' ? 'Bid Collection Period (hours)' : 'Duration (hours)'}
                  </label>
                  <input
                    type="number"
                    value={formData.durationHours || ''}
                    onChange={(e) => updateFormData({ durationHours: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                
                {formData.auctionMode === 'traditional' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Price Drop Interval (min)</label>
                    <input
                      type="number"
                      value={formData.decreasingMinutes || ''}
                      onChange={(e) => updateFormData({ decreasingMinutes: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                )}
              </div>

              {formData.auctionMode === 'traditional' && calculatePricePreview() && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">Price Preview</h4>
                  <p className="text-sm text-blue-800">
                    Price will decrease by <strong>${calculatePricePreview()?.stepSize}</strong> every <strong>{formData.decreasingMinutes} minutes</strong>
                  </p>
                  <p className="text-sm text-blue-800">
                    Total of <strong>{calculatePricePreview()?.totalSteps} price decreases</strong> over {formData.durationHours} hours
                  </p>
                </div>
              )}

              <div className="mt-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Invite Members</label>
                {companyMembers.length === 0 ? (
                  <div className="border border-gray-200 rounded-md p-4 text-center">
                    <p className="text-sm text-gray-500">
                      {formData.companyId ? 'No members found for this company. Add members to the company first.' : 'Please select a company to see available members.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-40 overflow-y-auto border border-gray-200 rounded-md p-3">
                    {companyMembers.map(member => (
                      <label key={member.id} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                        <input
                          type="checkbox"
                          checked={formData.invitedMembers.includes(member.email)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              updateFormData({ invitedMembers: [...formData.invitedMembers, member.email] })
                            } else {
                              updateFormData({ invitedMembers: formData.invitedMembers.filter(email => email !== member.email) })
                            }
                          }}
                          className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                        />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{member.name}</p>
                          <p className="text-xs text-gray-500">{member.email} • {member.position}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
                {formData.invitedMembers.length > 0 && (
                  <p className="text-xs text-gray-600 mt-2">
                    {formData.invitedMembers.length} member{formData.invitedMembers.length !== 1 ? 's' : ''} selected
                  </p>
                )}
              </div>
            </div>
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Wire Transfer Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Account Name</label>
                  <input
                    type="text"
                    value={formData.wireAccountName}
                    onChange={(e) => updateFormData({ wireAccountName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Account Number</label>
                  <input
                    type="text"
                    value={formData.wireAccountNumber}
                    onChange={(e) => updateFormData({ wireAccountNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Routing Number</label>
                  <input
                    type="text"
                    value={formData.wireRoutingNumber}
                    onChange={(e) => updateFormData({ wireRoutingNumber: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Bank Name</label>
                  <input
                    type="text"
                    value={formData.wireBankName}
                    onChange={(e) => updateFormData({ wireBankName: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Bank Address</label>
                <textarea
                  value={formData.wireBankAddress}
                  onChange={(e) => updateFormData({ wireBankAddress: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Full bank address including city, state, and ZIP code"
                />
              </div>

              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <label className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    checked={formData.accreditedInvestorComplianceAccepted}
                    onChange={(e) => updateFormData({ accreditedInvestorComplianceAccepted: e.target.checked })}
                    className="mt-1 h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                  />
                  <span className="text-sm text-gray-700">
                    <strong>Required:</strong> Based on my relationship with the people I am inviting to participate in this auction, I believe that they are accredited investors as defined by SEC regulations.
                  </span>
                </label>
              </div>
            </div>
          </div>
        )

      case 5:
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-medium text-gray-900 mb-4">Review & Confirm</h3>
              
              <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-sm text-gray-500">Company:</span>
                    <p className="font-medium">{companies.find(c => c.id === formData.companyId)?.name}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Auction Title:</span>
                    <p className="font-medium">{formData.title}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Shares:</span>
                    <p className="font-medium">{formData.sharesCount.toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">Price Range:</span>
                    <p className="font-medium">${formData.minPrice} - ${formData.maxPrice}</p>
                  </div>
                  <div>
                    <span className="text-sm text-gray-500">
                      {formData.auctionMode === 'modified_dutch' ? 'Bid Collection Period:' : 'Duration:'}
                    </span>
                    <p className="font-medium">{formData.durationHours} hours</p>
                  </div>
                  {formData.auctionMode === 'traditional' && (
                    <div>
                      <span className="text-sm text-gray-500">Price Decreases:</span>
                      <p className="font-medium">Every {formData.decreasingMinutes} minutes</p>
                    </div>
                  )}
                </div>
                
                <div>
                  <span className="text-sm text-gray-500">Invited Members:</span>
                  <p className="font-medium">{formData.invitedMembers.length} members selected</p>
                </div>
                
                <div>
                  <span className="text-sm text-gray-500">Wire Account:</span>
                  <p className="font-medium">{formData.wireAccountName} - {formData.wireBankName}</p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Next Steps:</strong> After creating this auction, it will be saved as a draft. You can review all details and start the auction when ready. Invited members will receive email notifications once the auction begins.
                </p>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Create Dutch Auction</h2>
              <p className="text-sm text-gray-600">Step {currentStep} of {totalSteps}</p>
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
          
          {/* Progress bar */}
          <div className="mt-4">
            <div className="bg-gray-200 rounded-full h-2">
              <div 
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(currentStep / totalSteps) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-6 max-h-[60vh] overflow-y-auto">
          {renderStep()}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-between">
          <button
            onClick={() => setCurrentStep(prev => Math.max(1, prev - 1))}
            disabled={currentStep === 1}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          
          <div className="flex space-x-3">
            {currentStep < totalSteps ? (
              <button
                onClick={() => setCurrentStep(prev => prev + 1)}
                disabled={!canProceedToNextStep()}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading || !canProceedToNextStep()}
                className="px-6 py-2 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {loading && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                <span>{loading ? 'Creating...' : 'Create Auction'}</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
