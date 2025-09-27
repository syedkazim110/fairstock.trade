'use client'

import { useState } from 'react'
import { useSessionManager } from '@/hooks/useSessionManager'
import CapTableTab from './CapTableTab'
import AuctionsTab from './AuctionsTab'
import TransactionsTab from './TransactionsTab'

interface CompanyManageInterfaceProps {
  companyId: string
  companyName: string
  onBack: () => void
}

type TabType = 'cap-table' | 'auctions' | 'transactions'

export default function CompanyManageInterface({ 
  companyId, 
  companyName, 
  onBack 
}: CompanyManageInterfaceProps) {
  const [activeTab, setActiveTab] = useState<TabType>('cap-table')

  const tabs = [
    { id: 'cap-table' as TabType, name: 'Cap Table', icon: '📊' },
    { id: 'auctions' as TabType, name: 'Auctions', icon: '🔨' },
    { id: 'transactions' as TabType, name: 'Transactions', icon: '💰' }
  ]

  // Use centralized session manager
  const sessionManager = useSessionManager({
    companyId,
    onNotification: (type, message) => {
      console.log(`Session notification: ${type} - ${message}`)
    }
  })

  const { sessionState, terminateSession } = sessionManager
  const { isActive: hasActiveSession } = sessionState

  const handleTabChange = async (newTab: TabType) => {
    // If switching away from cap-table tab and there's an active session, terminate it
    if (activeTab === 'cap-table' && newTab !== 'cap-table' && hasActiveSession) {
      await terminateSession('Switched away from Cap Table tab', 'tab-switch')
    }
    setActiveTab(newTab)
  }

  const handleBack = async () => {
    // If there's an active session, terminate it before going back
    if (hasActiveSession) {
      await terminateSession('Left company management interface', 'navigation')
    }
    onBack()
  }

  const handleSessionStateChange = (isActive: boolean) => {
    // This is handled by the centralized session manager now
    console.log(`Session state changed: ${isActive}`)
  }

  const renderTabContent = () => {
    switch (activeTab) {
      case 'cap-table':
        return <CapTableTab companyId={companyId} onSessionStateChange={handleSessionStateChange} />
      case 'auctions':
        return <AuctionsTab companyId={companyId} />
      case 'transactions':
        return <TransactionsTab companyId={companyId} />
      default:
        return <CapTableTab companyId={companyId} onSessionStateChange={handleSessionStateChange} />
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <button
                onClick={handleBack}
                className="mr-4 text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div>
                <h1 className="text-xl font-semibold text-gray-900">Manage Company</h1>
                <p className="text-sm text-gray-600">{companyName}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="-mb-px flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-indigo-500 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="flex items-center space-x-2">
                  <span>{tab.icon}</span>
                  <span>{tab.name}</span>
                </span>
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          {renderTabContent()}
        </div>
      </div>
    </div>
  )
}
