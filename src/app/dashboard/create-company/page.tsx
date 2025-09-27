'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import BrandedNavigation from '@/components/BrandedNavigation'

// Types
interface Country {
  code: string
  name: string
}

interface State {
  code: string
  name: string
  country_code: string
}

interface CompanyFormData {
  name: string
  address: string
  country_code: string
  state_code: string
  business_structure: string
}

interface TreasuryFormData {
  total_shares: number
  par_value: number
  issued_shares: number
}

interface Member {
  name: string
  email: string
  position: string
  credit_balance: string
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

const POSITIONS = ['CEO', 'CTO', 'COO', 'Secretary']

// Utility functions for number formatting
const formatNumberWithCommas = (value: number | string): string => {
  if (!value && value !== 0) return ''
  const numValue = typeof value === 'string' ? parseInt(value.replace(/,/g, '')) : value
  if (isNaN(numValue)) return ''
  return numValue.toLocaleString()
}

const parseFormattedNumber = (value: string): number => {
  if (!value) return 0
  const cleanValue = value.replace(/,/g, '')
  const numValue = parseInt(cleanValue)
  return isNaN(numValue) ? 0 : numValue
}

// Utility function to format credit balance with commas (supports decimals)
const formatCreditBalance = (value: string): string => {
  // Remove all non-digit characters except decimal point
  const cleanValue = value.replace(/[^\d.]/g, '')
  
  // Handle decimal numbers for credit balance
  if (cleanValue.includes('.')) {
    const [integerPart, decimalPart] = cleanValue.split('.')
    const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
    return decimalPart !== undefined ? `${formattedInteger}.${decimalPart}` : formattedInteger
  }
  
  // Format integer part with commas
  return cleanValue.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

// Utility function to remove commas for API submission
const removeCommas = (value: string): string => {
  return value.replace(/,/g, '')
}

export default function CreateCompanyPage() {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [user, setUser] = useState<any>(null)
  
  // Form data
  const [companyData, setCompanyData] = useState<CompanyFormData>({
    name: '',
    address: '',
    country_code: '',
    state_code: '',
    business_structure: ''
  })
  
  const [members, setMembers] = useState<Member[]>([
    { name: '', email: '', position: 'CEO', credit_balance: '' }
  ])
  
  const [treasuryData, setTreasuryData] = useState<TreasuryFormData>({
    total_shares: 0,
    par_value: 0.01,
    issued_shares: 0
  })
  
  // Separate state for par value input display
  const [parValueInput, setParValueInput] = useState('0.01')
  
  // Dropdown data
  const [countries, setCountries] = useState<Country[]>([])
  const [states, setStates] = useState<State[]>([])
  const [filteredStates, setFilteredStates] = useState<State[]>([])
  
  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    loadInitialData()
  }, [])

  useEffect(() => {
    // Filter states based on selected country
    if (companyData.country_code) {
      const filtered = states.filter(state => state.country_code === companyData.country_code)
      setFilteredStates(filtered)
      // Reset state selection if country changes
      if (companyData.state_code && !filtered.find(s => s.code === companyData.state_code)) {
        setCompanyData(prev => ({ ...prev, state_code: '' }))
      }
    } else {
      setFilteredStates([])
    }
  }, [companyData.country_code, states])

  const loadInitialData = async () => {
    const supabase = createClient()
    
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        router.push('/auth/login')
        return
      }
      setUser(user)
      
      // Auto-fill first member email
      setMembers(prev => [
        { ...prev[0], email: user.email || '' }
      ])
      
      // Load countries and states
      const [countriesRes, statesRes] = await Promise.all([
        supabase.from('countries').select('code, name').order('name'),
        supabase.from('states').select('code, name, country_code').order('name')
      ])
      
      if (countriesRes.data) setCountries(countriesRes.data)
      if (statesRes.data) setStates(statesRes.data)
      
    } catch (error) {
      console.error('Error loading initial data:', error)
    }
  }

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {}
    
    if (step === 1) {
      if (!companyData.name.trim()) newErrors.name = 'Company name is required'
      if (!companyData.address.trim()) newErrors.address = 'Address is required'
      if (!companyData.country_code) newErrors.country_code = 'Country is required'
      if (!companyData.state_code) newErrors.state_code = 'State/Province is required'
      if (!companyData.business_structure) newErrors.business_structure = 'Business structure is required'
      
      // Validate country exists
      if (companyData.country_code && !countries.find(c => c.code === companyData.country_code)) {
        newErrors.country_code = 'Invalid country selected'
      }
      
      // Validate state exists and belongs to selected country
      if (companyData.state_code && companyData.country_code) {
        const validState = states.find(s => 
          s.code === companyData.state_code && s.country_code === companyData.country_code
        )
        if (!validState) {
          newErrors.state_code = 'Invalid state/province for selected country'
        }
      }
      
      // Validate business structure
      if (companyData.business_structure && !BUSINESS_STRUCTURES.find(bs => bs.value === companyData.business_structure)) {
        newErrors.business_structure = 'Invalid business structure selected'
      }
    }
    
    if (step === 2) {
      members.forEach((member, index) => {
        if (!member.name.trim()) newErrors[`member_${index}_name`] = 'Name is required'
        if (!member.email.trim()) newErrors[`member_${index}_email`] = 'Email is required'
        if (!member.position) newErrors[`member_${index}_position`] = 'Position is required'
        if (member.email && !/\S+@\S+\.\S+/.test(member.email)) {
          newErrors[`member_${index}_email`] = 'Valid email is required'
        }
        
        // Validate position
        if (member.position && !POSITIONS.includes(member.position)) {
          newErrors[`member_${index}_position`] = 'Invalid position selected'
        }
        
        // Validate credit balance (optional but must be non-negative if provided)
        if (member.credit_balance && member.credit_balance.trim()) {
          const creditValue = parseFloat(removeCommas(member.credit_balance))
          if (isNaN(creditValue) || creditValue < 0) {
            newErrors[`member_${index}_credit_balance`] = 'Credit balance must be a non-negative number'
          }
        }
      })
      
      // Check for duplicate emails
      const emailCounts = members.reduce((acc, member) => {
        if (member.email.trim()) {
          acc[member.email.toLowerCase()] = (acc[member.email.toLowerCase()] || 0) + 1
        }
        return acc
      }, {} as Record<string, number>)
      
      Object.entries(emailCounts).forEach(([email, count]) => {
        if (count > 1) {
          members.forEach((member, index) => {
            if (member.email.toLowerCase() === email) {
              newErrors[`member_${index}_email`] = 'Duplicate email address'
            }
          })
        }
      })
    }
    
    if (step === 3) {
      if (!treasuryData.total_shares || treasuryData.total_shares <= 0) {
        newErrors.total_shares = 'Total shares must be greater than 0'
      }
      if (!treasuryData.par_value || treasuryData.par_value <= 0) {
        newErrors.par_value = 'Par value must be greater than 0'
      }
      if (treasuryData.issued_shares < 0) {
        newErrors.issued_shares = 'Issued shares cannot be negative'
      }
      if (treasuryData.issued_shares > treasuryData.total_shares) {
        newErrors.issued_shares = 'Issued shares cannot exceed total shares'
      }
    }
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, 4))
    }
  }

  const prevStep = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1))
  }

  const addMember = () => {
    setMembers(prev => [...prev, { name: '', email: '', position: 'CEO', credit_balance: '' }])
  }

  const removeMember = (index: number) => {
    if (members.length > 1) {
      setMembers(prev => prev.filter((_, i) => i !== index))
    }
  }

  const updateMember = (index: number, field: keyof Member, value: string) => {
    setMembers(prev => prev.map((member, i) => 
      i === index ? { ...member, [field]: value } : member
    ))
  }

  const submitForm = async () => {
    if (!validateStep(3)) return
    
    setLoading(true)
    
    try {
      // Prepare data for API call
      const payload = {
        companyData,
        treasuryData,
        members: members.map(member => ({
          name: member.name,
          email: member.email,
          position: member.position,
          credit_balance: member.credit_balance && member.credit_balance.trim() 
            ? removeCommas(member.credit_balance) 
            : ''
        }))
      }
      
      console.log('Creating company with payload:', payload)
      
      // Call the API endpoint
      const response = await fetch('/api/companies', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload)
      })
      
      const result = await response.json()
      
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create company')
      }
      
      console.log('Company created successfully:', result)
      
      // Success - redirect to companies page
      router.push(result.redirect || '/dashboard/companies?success=company-created')
      
    } catch (error: any) {
      console.error('Error creating company:', error)
      
      // Extract error message
      let errorMessage = 'Failed to create company. Please try again.'
      
      if (error?.message) {
        errorMessage = error.message
      }
      
      setErrors({ submit: errorMessage })
    } finally {
      setLoading(false)
    }
  }

  const getProgressPercentage = () => {
    return Math.round((currentStep / 4) * 100)
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <BrandedNavigation 
        title="Create New Company"
        showBackButton={true}
        rightContent={
          <div className="text-sm text-gray-500">
            Step {currentStep} of 4 • {getProgressPercentage()}% Complete
          </div>
        }
      />

      {/* Progress Bar */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4">
            <div className="flex items-center">
              {[1, 2, 3, 4].map((step) => (
                <div key={step} className="flex items-center">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full border-2 ${
                    step <= currentStep 
                      ? 'bg-indigo-600 border-indigo-600 text-white' 
                      : 'border-gray-300 text-gray-500'
                  }`}>
                    {step < currentStep ? (
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      step
                    )}
                  </div>
                  <div className="ml-3">
                    <div className={`text-sm font-medium ${
                      step <= currentStep ? 'text-indigo-600' : 'text-gray-500'
                    }`}>
                      {step === 1 && 'Company Details'}
                      {step === 2 && 'Add Members'}
                      {step === 3 && 'Treasury & Shares'}
                      {step === 4 && 'Review & Submit'}
                    </div>
                  </div>
                  {step < 4 && (
                    <div className={`flex-1 mx-4 h-0.5 ${
                      step < currentStep ? 'bg-indigo-600' : 'bg-gray-300'
                    }`} />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow p-6">
          {/* Step 1: Company Details */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">Company Information</h2>
                
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Company Name *
                    </label>
                    <input
                      type="text"
                      value={companyData.name}
                      onChange={(e) => setCompanyData(prev => ({ ...prev, name: e.target.value }))}
                      className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${
                        errors.name ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Enter company name"
                    />
                    {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Address *
                    </label>
                    <textarea
                      value={companyData.address}
                      onChange={(e) => setCompanyData(prev => ({ ...prev, address: e.target.value }))}
                      rows={3}
                      className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${
                        errors.address ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Enter company address"
                    />
                    {errors.address && <p className="mt-1 text-sm text-red-600">{errors.address}</p>}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Country *
                      </label>
                      <select
                        value={companyData.country_code}
                        onChange={(e) => setCompanyData(prev => ({ ...prev, country_code: e.target.value }))}
                        className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${
                          errors.country_code ? 'border-red-300' : 'border-gray-300'
                        }`}
                      >
                        <option value="">Select a country</option>
                        {countries.map(country => (
                          <option key={country.code} value={country.code}>
                            {country.name}
                          </option>
                        ))}
                      </select>
                      {errors.country_code && <p className="mt-1 text-sm text-red-600">{errors.country_code}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        State/Province *
                      </label>
                      <select
                        value={companyData.state_code}
                        onChange={(e) => setCompanyData(prev => ({ ...prev, state_code: e.target.value }))}
                        disabled={!companyData.country_code}
                        className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:cursor-not-allowed ${
                          errors.state_code ? 'border-red-300' : 'border-gray-300'
                        }`}
                      >
                        <option value="">Select a state/province</option>
                        {filteredStates.map(state => (
                          <option key={state.code} value={state.code}>
                            {state.name}
                          </option>
                        ))}
                      </select>
                      {errors.state_code && <p className="mt-1 text-sm text-red-600">{errors.state_code}</p>}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Business Structure *
                    </label>
                    <select
                      value={companyData.business_structure}
                      onChange={(e) => setCompanyData(prev => ({ ...prev, business_structure: e.target.value }))}
                      className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${
                        errors.business_structure ? 'border-red-300' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select business structure</option>
                      {BUSINESS_STRUCTURES.map(structure => (
                        <option key={structure.value} value={structure.value}>
                          {structure.label}
                        </option>
                      ))}
                    </select>
                    {errors.business_structure && <p className="mt-1 text-sm text-red-600">{errors.business_structure}</p>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Add Members */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">Company Members</h2>
                
                {members.map((member, index) => (
                  <div key={index} className="border rounded-lg p-4 mb-4">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-md font-medium text-gray-700">
                        Member {index + 1} {index === 0 && '(You)'}
                      </h3>
                      {members.length > 1 && (
                        <button
                          onClick={() => removeMember(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Name *
                        </label>
                        <input
                          type="text"
                          value={member.name}
                          onChange={(e) => updateMember(index, 'name', e.target.value)}
                          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${
                            errors[`member_${index}_name`] ? 'border-red-300' : 'border-gray-300'
                          }`}
                          placeholder="Enter full name"
                        />
                        {errors[`member_${index}_name`] && (
                          <p className="mt-1 text-sm text-red-600">{errors[`member_${index}_name`]}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Email *
                        </label>
                        <input
                          type="email"
                          value={member.email}
                          onChange={(e) => updateMember(index, 'email', e.target.value)}
                          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${
                            errors[`member_${index}_email`] ? 'border-red-300' : 'border-gray-300'
                          }`}
                          placeholder="Enter email address"
                          disabled={index === 0} // First member email is auto-filled and disabled
                        />
                        {errors[`member_${index}_email`] && (
                          <p className="mt-1 text-sm text-red-600">{errors[`member_${index}_email`]}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Position *
                        </label>
                        <select
                          value={member.position}
                          onChange={(e) => updateMember(index, 'position', e.target.value)}
                          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${
                            errors[`member_${index}_position`] ? 'border-red-300' : 'border-gray-300'
                          }`}
                        >
                          {POSITIONS.map(position => (
                            <option key={position} value={position}>
                              {position}
                            </option>
                          ))}
                        </select>
                        {errors[`member_${index}_position`] && (
                          <p className="mt-1 text-sm text-red-600">{errors[`member_${index}_position`]}</p>
                        )}
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Credit Balance (Optional)
                        </label>
                        <input
                          type="text"
                          value={member.credit_balance}
                          onChange={(e) => {
                            const formatted = formatCreditBalance(e.target.value)
                            updateMember(index, 'credit_balance', formatted)
                          }}
                          className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${
                            errors[`member_${index}_credit_balance`] ? 'border-red-300' : 'border-gray-300'
                          }`}
                          placeholder="0.00"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          Initial credit balance in USD
                        </p>
                        {errors[`member_${index}_credit_balance`] && (
                          <p className="mt-1 text-sm text-red-600">{errors[`member_${index}_credit_balance`]}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                
                <button
                  onClick={addMember}
                  className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-gray-600 hover:border-gray-400 hover:text-gray-700 transition-colors"
                >
                  <svg className="w-6 h-6 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add Another Member
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Treasury & Shares */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-4">Treasury & Shares</h2>
                
                <div className="grid grid-cols-1 gap-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Total Shares *
                      </label>
                      <input
                        type="text"
                        value={formatNumberWithCommas(treasuryData.total_shares)}
                        onChange={(e) => {
                          const numValue = parseFormattedNumber(e.target.value)
                          setTreasuryData(prev => ({ ...prev, total_shares: numValue }))
                        }}
                        className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${
                          errors.total_shares ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="Enter total authorized shares"
                      />
                      {treasuryData.total_shares > 0 && treasuryData.par_value > 0 && (
                        <p className="mt-1 text-sm text-gray-600">
                          Total Value: ${(treasuryData.total_shares * treasuryData.par_value).toLocaleString()}
                        </p>
                      )}
                      {errors.total_shares && <p className="mt-1 text-sm text-red-600">{errors.total_shares}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Par Value *
                      </label>
                      <input
                        type="text"
                        value={parValueInput}
                        onChange={(e) => {
                          const value = e.target.value
                          // Allow empty string, digits, and decimal point
                          if (value === '' || /^\d*\.?\d*$/.test(value)) {
                            setParValueInput(value)
                            const numValue = value === '' ? 0 : parseFloat(value) || 0
                            setTreasuryData(prev => ({ ...prev, par_value: numValue }))
                          }
                        }}
                        className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${
                          errors.par_value ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="0.01"
                      />
                      {treasuryData.total_shares > 0 && treasuryData.par_value > 0 && (
                        <p className="mt-1 text-sm text-gray-600">
                          Total Value: ${(treasuryData.total_shares * treasuryData.par_value).toLocaleString()}
                        </p>
                      )}
                      {errors.par_value && <p className="mt-1 text-sm text-red-600">{errors.par_value}</p>}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Issued Shares *
                    </label>
                    <input
                      type="text"
                      value={formatNumberWithCommas(treasuryData.issued_shares)}
                      onChange={(e) => {
                        const numValue = parseFormattedNumber(e.target.value)
                        setTreasuryData(prev => ({ ...prev, issued_shares: numValue }))
                      }}
                      className={`w-full px-3 py-2 border rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${
                        errors.issued_shares ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Enter shares to be issued to owner"
                    />
                    {treasuryData.issued_shares > 0 && treasuryData.par_value > 0 && (
                      <p className="mt-1 text-sm text-gray-600">
                        Value: ${(treasuryData.issued_shares * treasuryData.par_value).toLocaleString()}
                      </p>
                    )}
                    {errors.issued_shares && <p className="mt-1 text-sm text-red-600">{errors.issued_shares}</p>}
                  </div>

                  {/* Unissued Shares (Calculated) */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-md font-medium text-gray-700 mb-2">Unissued Shares</h3>
                    <div className="text-sm text-gray-600">
                      {(() => {
                        const unissuedShares = treasuryData.total_shares - treasuryData.issued_shares;
                        return (
                          <div>
                            <p className="font-medium">Shares: {unissuedShares.toLocaleString()}</p>
                            {treasuryData.par_value > 0 && (
                              <p>Value: ${(unissuedShares * treasuryData.par_value).toLocaleString()}</p>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Review & Submit */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-medium text-gray-900 mb-6">Review Your Information</h2>
                
                {/* Company Details Summary */}
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-md font-medium text-gray-700">Company Details</h3>
                    <button
                      onClick={() => setCurrentStep(1)}
                      className="text-indigo-600 hover:text-indigo-800 text-sm"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-600">Name:</span> {companyData.name}
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Business Structure:</span>{' '}
                      {BUSINESS_STRUCTURES.find(s => s.value === companyData.business_structure)?.label}
                    </div>
                    <div className="md:col-span-2">
                      <span className="font-medium text-gray-600">Address:</span> {companyData.address}
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Country:</span>{' '}
                      {countries.find(c => c.code === companyData.country_code)?.name}
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">State/Province:</span>{' '}
                      {states.find(s => s.code === companyData.state_code)?.name}
                    </div>
                  </div>
                </div>

                {/* Members Summary */}
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-md font-medium text-gray-700">Company Members ({members.length})</h3>
                    <button
                      onClick={() => setCurrentStep(2)}
                      className="text-indigo-600 hover:text-indigo-800 text-sm"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="space-y-3">
                    {members.map((member, index) => (
                      <div key={index} className="border-l-2 border-indigo-200 pl-3">
                        <div className="flex justify-between items-start text-sm">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-medium">{member.name}</span>
                              <span className="bg-indigo-100 text-indigo-800 px-2 py-1 rounded text-xs">
                                {member.position}
                              </span>
                            </div>
                            <div className="text-gray-600 text-xs">
                              <span>{member.email}</span>
                              {member.credit_balance && member.credit_balance.trim() && (
                                <span className="ml-3">
                                  Credit Balance: ${parseFloat(removeCommas(member.credit_balance)).toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                  })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Treasury & Shares Summary */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-md font-medium text-gray-700">Treasury & Shares</h3>
                    <button
                      onClick={() => setCurrentStep(3)}
                      className="text-indigo-600 hover:text-indigo-800 text-sm"
                    >
                      Edit
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-600">Total Shares:</span> {treasuryData.total_shares.toLocaleString()}
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Par Value:</span> ${treasuryData.par_value}
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Issued Shares:</span> {treasuryData.issued_shares.toLocaleString()}
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Unissued Shares:</span> {(treasuryData.total_shares - treasuryData.issued_shares).toLocaleString()}
                    </div>
                    <div>
                      <span className="font-medium text-gray-600">Total Value:</span> ${(treasuryData.total_shares * treasuryData.par_value).toLocaleString()}
                    </div>
                  </div>
                </div>

                {errors.submit && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-4">
                    <p className="text-sm text-red-600">{errors.submit}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-6 border-t">
            <button
              onClick={prevStep}
              disabled={currentStep === 1}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            
            {currentStep < 4 ? (
              <button
                onClick={nextStep}
                className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700"
              >
                Next
              </button>
            ) : (
              <button
                onClick={submitForm}
                disabled={loading}
                className="px-6 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating Company...' : 'Create Company'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
