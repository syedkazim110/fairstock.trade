'use client'

import { ReactNode } from 'react'
import { useSessionManager } from '@/hooks/useSessionManager'

// Enhanced session management props
interface SessionManagerProps {
  companyId: string
  children: ReactNode
  onSessionStateChange?: (state: {
    isActive: boolean
    hasUnsavedChanges: boolean
    sessionId: string | null
    sessionFee: number
    startTime: Date | null
  }) => void
  onSessionTerminated?: (context: {
    reason: string
    hasChanges: boolean
    isUnloading: boolean
    source: 'tab-switch' | 'visibility-change' | 'navigation' | 'manual'
  }) => void
  onNotification?: (type: 'success' | 'error' | 'info', message: string) => void
}

export default function SessionManager({
  companyId,
  children,
  onSessionStateChange,
  onSessionTerminated,
  onNotification
}: SessionManagerProps) {
  // Use the centralized session manager hook
  const sessionManager = useSessionManager({
    companyId,
    onSessionStateChange,
    onSessionTerminated,
    onNotification
  })

  // Simply render children - session manager is available via hook
  return (
    <>
      {children}
    </>
  )
}

// Export session manager context for components that need direct access
export { useSessionManager }
