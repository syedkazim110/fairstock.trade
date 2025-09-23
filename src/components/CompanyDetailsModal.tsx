'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface CompanyMember {
  id: string
  name: string
  email: string
  position: string
}

interface CompanyDetailsModalProps {
  companyId: string
  companyName: string
  isOpen: boolean
  onClose: () => void
}

export default function CompanyDetailsModal({ 
  companyId, 
  companyName, 
  isOpen, 
  onClose 
}: CompanyDetailsModalProps) {
  const [members, setMembers] = useState<CompanyMember[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (isOpen && companyId) {
      loadMembers()
    }
  }, [isOpen, companyId])

  const loadMembers = async () => {
    setLoading(true)
    const supabase = createClient()
    
    try {
      const { data, error } = await supabase
        .from('company_members')
        .select('id, name, email, position')
        .eq('company_id', companyId)
        .order('name')

      if (error) {
        console.error('Error fetching company members:', error)
      } else {
        setMembers(data || [])
      }
    } catch (error) {
      console.error('Error loading members:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
        <div className="mt-3">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-gray-900">
              {companyName} - Members
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="mb-4">
            {loading ? (
              <div className="flex justify-center items-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            ) : members.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500">No members found in this company.</p>
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 mb-3">
                  Company Members ({members.length}):
                </p>
                {members.map((member) => (
                  <div key={member.id} className="flex items-center p-3 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-indigo-600">
                          {member.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                    </div>
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">{member.name}</p>
                      <p className="text-xs text-gray-500">{member.position}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex justify-end">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
