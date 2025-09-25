'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface BrandedNavigationProps {
  title?: string
  showBackButton?: boolean
  backUrl?: string
  rightContent?: React.ReactNode
}

export default function BrandedNavigation({ 
  title, 
  showBackButton = false, 
  backUrl = '/dashboard',
  rightContent 
}: BrandedNavigationProps) {
  const router = useRouter()

  return (
    <nav className="bg-white shadow-lg border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            {showBackButton && (
              <button
                onClick={() => router.push(backUrl)}
                className="mr-4 text-gray-400 hover:text-gray-600 transition-colors duration-200"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            
            {/* Branded FairStock Button */}
            <Link 
              href="/dashboard"
              className="group flex items-center space-x-2 px-4 py-2 rounded-lg transition-all duration-300 hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 hover:shadow-md"
            >
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 rounded-lg flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow duration-300">
                  <span className="text-white font-bold text-sm">F</span>
                </div>
                <span className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 bg-clip-text text-transparent group-hover:from-blue-700 group-hover:via-indigo-700 group-hover:to-purple-700 transition-all duration-300">
                  FairStock
                </span>
              </div>
            </Link>

            {/* Page Title */}
            {title && (
              <div className="ml-6 pl-6 border-l border-gray-200">
                <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
              </div>
            )}
          </div>

          {/* Right Content */}
          {rightContent && (
            <div className="flex items-center">
              {rightContent}
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
