'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter, useSearchParams } from 'next/navigation'
import CompanyDetailsModal from '@/components/CompanyDetailsModal'
import CompanyManageInterface from '@/components/CompanyManageInterface'
import DeleteCompanyDialog from '@/components/DeleteCompanyDialog'
import BrandedNavigation from '@/components/BrandedNavigation'

interface Company {
  id: string
  name: string
  address: string
  country_code: string
  state_code: string
  business_structure: string
  created_at: string
  created_by: string
  user_role: string
}

interface CompanyMember {
  id: string
  name: string
  email: string
  position: string
  company_id: string
}

interface CountryState {
  countries: { code: string; name: string }[]
  states: { code: string; name: string; country_code: string }[]
}

const BUSINESS_STRUCTURES = [
  { value: 'sole_proprietorship', label: 'Sole Proprietorship' },
  { value: 'gp', label: 'GP (General Partnership)' },
  { value: 'lp', label: 'LP (Limited Partnership)' },
  { value: 'llp', label: 'LLP (Limited Liability Partnership)' },
  { value: 'llc', label: 'LLC (Limited Liability Company)' },
  { value: 'c_corp', label: 'C-Corp (C Corporation)' },
  { value: 's_corp', label: 'S-Corp (S Corporation)' },
  { value: 'nonprofit', label: 'Nonprofit' },
  { value: 'other', label: 'Other'}
]

export default function CompaniesPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [countryStateData, setCountryStateData] = useState<CountryState>({
    countries: [],
    states: []
  })
  
  // Modal and interface states
  const [detailsModal, setDetailsModal] = useState<{
    isOpen: boolean
    companyId: string
    companyName: string
  }>({
    isOpen: false,
    companyId: '',
    companyName: ''
  })
  
  const [manageInterface, setManageInterface] = useState<{
    isOpen: boolean
    companyId: string
    companyName: string
  }>({
    isOpen: false,
    companyId: '',
    companyName: ''
  })

  const [deleteDialog, setDeleteDialog] = useState<{
    isOpen: boolean
    company: Company | null
  }>({
    isOpen: false,
    company: null
  })

  const [openDropdown, setOpenDropdown] = useState<string | null>(null)

  useEffect(() => {
    loadData()
    
    // Check for success parameter
    if (searchParams.get('success') === 'company-created') {
      setShowSuccess(true)
      // Clear the URL parameter after showing success
      const url = new URL(window.location.href)
      url.searchParams.delete('success')
      window.history.replaceState({}, '', url.toString())
      
      // Hide success message after 5 seconds
      setTimeout(() => setShowSuccess(false), 5000)
    }
  }, [searchParams])

  const loadData = async () => {
    const supabase = createClient()
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }
      setUser(user)

      // Load countries and states for display
      const [countriesRes, statesRes] = await Promise.all([
        supabase.from('countries').select('code, name').order('name'),
        supabase.from('states').select('code, name, country_code').order('name')
      ])
      
      if (countriesRes.data && statesRes.data) {
        setCountryStateData({
          countries: countriesRes.data,
          states: statesRes.data
        })
      }

      // Use the new view that handles both owned and member companies
      const { data: companiesData, error } = await supabase
        .from('user_accessible_companies')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching companies:', error)
      } else {
        // For each company, get the member count
        const companiesWithMembers = await Promise.all(
          (companiesData || []).map(async (company) => {
            const { data: members } = await supabase
              .from('company_members')
              .select('id')
              .eq('company_id', company.id)
            
            return {
              ...company,
              company_members: members || []
            }
          })
        )
        setCompanies(companiesWithMembers)
      }
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const getCountryName = (countryCode: string) => {
    return countryStateData.countries.find(c => c.code === countryCode)?.name || countryCode
  }

  const getStateName = (stateCode: string) => {
    return countryStateData.states.find(s => s.code === stateCode)?.name || stateCode
  }

  const getBusinessStructureLabel = (value: string) => {
    return BUSINESS_STRUCTURES.find(bs => bs.value === value)?.label || value
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })
  }

  const handleCompanyDeleted = () => {
    // Reload the companies list after deletion
    loadData()
    setDeleteDialog({ isOpen: false, company: null })
  }

  const handleDeleteCompany = (company: Company) => {
    setDeleteDialog({ isOpen: true, company })
    setOpenDropdown(null)
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setOpenDropdown(null)
    }
    
    if (openDropdown) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [openDropdown])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        {/* Navigation */}
        <BrandedNavigation 
          title="My Companies"
          showBackButton={true}
        />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <BrandedNavigation 
        title="My Companies"
        showBackButton={true}
        rightContent={
          <button
            onClick={() => router.push('/dashboard/create-company')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-md text-sm font-medium"
          >
            Create New Company
          </button>
        }
      />

      {/* Success Message */}
      {showSuccess && (
        <div className="bg-green-50 border-l-4 border-green-400 p-4 mx-4 mt-4 rounded-md">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-green-700">
                Company created successfully! You can now manage your company and start auctions.
              </p>
            </div>
            <div className="ml-auto pl-3">
              <div className="-mx-1.5 -my-1.5">
                <button
                  onClick={() => setShowSuccess(false)}
                  className="inline-flex bg-green-50 rounded-md p-1.5 text-green-500 hover:bg-green-100"
                >
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {companies.length === 0 ? (
          // Empty state
          <div className="text-center py-12">
            <div className="mx-auto flex items-center justify-center h-24 w-24 rounded-full bg-gray-100 mb-6">
              <svg className="h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-4m-5 0H9m0 0H5m0 0h2M7 7h10M7 11h10M7 15h10" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No companies yet</h3>
            <p className="text-gray-600 mb-6">
              Get started by creating your first company to begin trading on FairStock.
            </p>
            <button
              onClick={() => router.push('/dashboard/create-company')}
              className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-md text-sm font-medium"
            >
              Create Your First Company
            </button>
          </div>
        ) : (
          // Companies list
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-900">Your Companies ({companies.length})</h2>
              <p className="text-gray-600 mt-1">Manage your companies and track their auction activities.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {companies.map((company) => (
                <div key={company.id} className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">{company.name}</h3>
                      <p className="text-sm text-gray-600">{getBusinessStructureLabel(company.business_structure)}</p>
                    </div>
                    <div className="flex-shrink-0">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        company.user_role === 'owner'
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {company.user_role === 'owner' ? 'Owner' : 'Member'}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2 mb-4">
                    <div className="text-sm">
                      <span className="font-medium text-gray-700">Location:</span>
                      <span className="text-gray-600 ml-1">
                        {getStateName(company.state_code)}, {getCountryName(company.country_code)}
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium text-gray-700">Created:</span>
                      <span className="text-gray-600 ml-1">{formatDate(company.created_at)}</span>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center">
                      <div className="text-sm text-gray-600">
                        {(company as any).company_members?.length || 0} member(s)
                      </div>
                      <div className="flex items-center space-x-2">
                        <button 
                          onClick={() => setDetailsModal({
                            isOpen: true,
                            companyId: company.id,
                            companyName: company.name
                          })}
                          className="text-indigo-600 hover:text-indigo-800 text-sm font-medium"
                        >
                          View Details
                        </button>
                        {company.user_role === 'owner' && (
                          <>
                            <button 
                              onClick={() => setManageInterface({
                                isOpen: true,
                                companyId: company.id,
                                companyName: company.name
                              })}
                              className="text-gray-600 hover:text-gray-800 text-sm font-medium"
                            >
                              Manage
                            </button>
                            
                            {/* Actions Dropdown */}
                            <div className="relative">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setOpenDropdown(openDropdown === company.id ? null : company.id)
                                }}
                                className="text-gray-400 hover:text-gray-600 p-1"
                              >
                                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                                </svg>
                              </button>
                              
                              {openDropdown === company.id && (
                                <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-10 border border-gray-200">
                                  <div className="py-1">
                                    <button
                                      onClick={() => handleDeleteCompany(company)}
                                      className="flex items-center w-full px-4 py-2 text-sm text-red-700 hover:bg-red-50 hover:text-red-900"
                                    >
                                      <svg className="w-4 h-4 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                      </svg>
                                      Delete Company
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Company Details Modal */}
      <CompanyDetailsModal
        companyId={detailsModal.companyId}
        companyName={detailsModal.companyName}
        isOpen={detailsModal.isOpen}
        onClose={() => setDetailsModal({ isOpen: false, companyId: '', companyName: '' })}
      />

      {/* Company Management Interface */}
      {manageInterface.isOpen && (
        <div className="fixed inset-0 z-50 bg-white">
          <CompanyManageInterface
            companyId={manageInterface.companyId}
            companyName={manageInterface.companyName}
            onBack={() => setManageInterface({ isOpen: false, companyId: '', companyName: '' })}
          />
        </div>
      )}

      {/* Delete Company Dialog */}
      <DeleteCompanyDialog
        isOpen={deleteDialog.isOpen}
        company={deleteDialog.company}
        onClose={() => setDeleteDialog({ isOpen: false, company: null })}
        onCompanyDeleted={handleCompanyDeleted}
      />
    </div>
  )
}
