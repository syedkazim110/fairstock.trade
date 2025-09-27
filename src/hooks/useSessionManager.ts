'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// Enhanced session state interface
interface SessionState {
  isActive: boolean
  hasUnsavedChanges: boolean
  sessionId: string | null
  sessionFee: number
  startTime: Date | null
}

// Session termination context interface
interface SessionTerminationContext {
  reason: string
  hasChanges: boolean
  isUnloading: boolean
  source: 'tab-switch' | 'visibility-change' | 'navigation' | 'manual'
}

// API response types
interface SmartSessionTerminationResponse {
  action_taken: 'completed' | 'cancelled'
  message: string
  refunded_amount?: number
  charged_amount?: number
  new_balance: number
}

interface UseSessionManagerOptions {
  companyId: string
  onSessionStateChange?: (state: SessionState) => void
  onSessionTerminated?: (context: SessionTerminationContext) => void
  onNotification?: (type: 'success' | 'error' | 'info', message: string) => void
}

export function useSessionManager({
  companyId,
  onSessionStateChange,
  onSessionTerminated,
  onNotification
}: UseSessionManagerOptions) {
  // Session state
  const [sessionState, setSessionState] = useState<SessionState>({
    isActive: false,
    hasUnsavedChanges: false,
    sessionId: null,
    sessionFee: 20.00,
    startTime: null
  })

  // Refs for reliable state access in event handlers
  const sessionStateRef = useRef(sessionState)
  const terminationInProgressRef = useRef(false)

  // Update ref when state changes
  useEffect(() => {
    sessionStateRef.current = sessionState
  }, [sessionState])

  // Notify parent of session state changes
  useEffect(() => {
    if (onSessionStateChange) {
      onSessionStateChange(sessionState)
    }
  }, [sessionState, onSessionStateChange])

  // Smart session termination based on changes
  const handleSmartTermination = useCallback(async (context: SessionTerminationContext) => {
    if (terminationInProgressRef.current) {
      console.log('Session termination already in progress, skipping')
      return
    }
    
    terminationInProgressRef.current = true
    
    console.log('Smart session termination triggered:', context)
    
    try {
      const response = await fetch(`/api/companies/${companyId}/cap-table-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          action: 'smart-terminate',
          context: context
        }),
        keepalive: context.isUnloading
      })

      if (response.ok) {
        const result: SmartSessionTerminationResponse = await response.json()
        
        console.log('Session termination response:', result)
        
        // Update session state
        setSessionState(prev => ({
          ...prev,
          isActive: false,
          hasUnsavedChanges: false,
          sessionId: null,
          startTime: null
        }))
        
        // Clear session storage
        const sessionKey = `cap_table_session_${companyId}`
        sessionStorage.removeItem(sessionKey)
        
        // Notify parent components
        if (onSessionTerminated) {
          onSessionTerminated(context)
        }
        
        // Show notification if not unloading
        if (!context.isUnloading && onNotification) {
          if (result.action_taken === 'cancelled') {
            onNotification('info', 
              `Session cancelled: ${context.reason}. No changes made - refunded $${result.refunded_amount?.toFixed(2) || '20.00'}`
            )
          } else {
            onNotification('success', 
              `Session completed: ${context.reason}. Changes saved and charged $${result.charged_amount?.toFixed(2) || '20.00'}`
            )
          }
        }
        
        return result
      } else {
        console.error('Failed to terminate session:', await response.text())
        if (!context.isUnloading && onNotification) {
          onNotification('error', 'Failed to terminate session automatically')
        }
      }
    } catch (error) {
      console.error('Error terminating session:', error)
      if (!context.isUnloading && onNotification) {
        onNotification('error', 'Failed to terminate session automatically')
      }
    } finally {
      terminationInProgressRef.current = false
    }
  }, [companyId, onSessionTerminated, onNotification])

  // Load session state from API - simplified approach
  const loadSessionState = useCallback(async () => {
    try {
      const response = await fetch(`/api/companies/${companyId}/cap-table-data`)
      if (response.ok) {
        const data = await response.json()
        
        // Check if there's an active session
        if (data.has_active_session) {
          console.log('Found active session on page load')
          
          // Check if we have session data in sessionStorage
          const sessionKey = `cap_table_session_${companyId}`
          const storedSessionData = sessionStorage.getItem(sessionKey)
          
          if (storedSessionData) {
            // Session data exists, restore the session state
            const parsedSessionData = JSON.parse(storedSessionData)
            console.log('Restoring session from sessionStorage:', parsedSessionData)
            
            const newState: SessionState = {
              isActive: true,
              hasUnsavedChanges: parsedSessionData.hasUnsavedChanges || false,
              sessionId: data.session?.id || null,
              sessionFee: data.session?.session_fee || 20.00,
              startTime: parsedSessionData.startTime ? new Date(parsedSessionData.startTime) : new Date()
            }
            setSessionState(newState)
          } else {
            // No session data in sessionStorage - just create fresh session data
            // This handles page refreshes where sessionStorage might be cleared
            console.log('No session data found, creating fresh session state')
            
            const newState: SessionState = {
              isActive: true,
              hasUnsavedChanges: false,
              sessionId: data.session?.id || null,
              sessionFee: data.session?.session_fee || 20.00,
              startTime: new Date()
            }
            setSessionState(newState)
            
            // Store fresh session data
            const sessionData = {
              hasUnsavedChanges: false,
              startTime: newState.startTime?.toISOString(),
              sessionId: newState.sessionId,
              sessionFee: newState.sessionFee
            }
            sessionStorage.setItem(sessionKey, JSON.stringify(sessionData))
          }
        } else {
          // No active session
          const newState: SessionState = {
            isActive: false,
            hasUnsavedChanges: false,
            sessionId: null,
            sessionFee: 20.00,
            startTime: null
          }
          setSessionState(newState)
          
          // Clear any stale session data
          const sessionKey = `cap_table_session_${companyId}`
          sessionStorage.removeItem(sessionKey)
        }
      }
    } catch (error) {
      console.error('Error loading session state:', error)
    }
  }, [companyId])

  // Load initial session state
  useEffect(() => {
    if (companyId) {
      loadSessionState()
    }
  }, [companyId, loadSessionState])

  // Set up browser event listeners for session management - DISABLED to prevent refresh loops
  useEffect(() => {
    if (!sessionState.isActive) {
      return
    }

    console.log('Session is active but automatic termination is disabled to prevent refresh loops')

    // Only handle beforeunload to show warning dialog
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      const currentState = sessionStateRef.current
      if (currentState.isActive) {
        // Show confirmation dialog but don't terminate automatically
        const message = currentState.hasUnsavedChanges 
          ? 'You have unsaved changes in your cap table session. Are you sure you want to leave?'
          : 'You have an active cap table session. Are you sure you want to leave?'
        
        event.preventDefault()
        event.returnValue = message
        return message
      }
    }

    // Add only beforeunload listener
    window.addEventListener('beforeunload', handleBeforeUnload)

    // Cleanup
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [sessionState.isActive])

  // Manual session termination (for tab switches, navigation, etc.)
  const terminateSession = useCallback(async (reason: string, source: SessionTerminationContext['source'] = 'manual') => {
    const currentState = sessionStateRef.current
    return handleSmartTermination({
      reason,
      hasChanges: currentState.hasUnsavedChanges,
      isUnloading: false,
      source
    })
  }, [handleSmartTermination])

  // Start a new session
  const startSession = useCallback(async () => {
    try {
      const response = await fetch(`/api/companies/${companyId}/cap-table-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'start' })
      })

      if (response.ok) {
        const result = await response.json()
        const newSessionState = {
          isActive: true,
          hasUnsavedChanges: false,
          sessionId: result.session?.id || null,
          sessionFee: result.session_fee || 20.00,
          startTime: new Date()
        }
        
        setSessionState(prev => ({
          ...prev,
          ...newSessionState
        }))
        
        // Store session data in sessionStorage to persist across page refreshes
        const sessionKey = `cap_table_session_${companyId}`
        const sessionData = {
          hasUnsavedChanges: false,
          startTime: newSessionState.startTime.toISOString(),
          sessionId: newSessionState.sessionId,
          sessionFee: newSessionState.sessionFee
        }
        sessionStorage.setItem(sessionKey, JSON.stringify(sessionData))
        console.log('Session data stored in sessionStorage:', sessionData)
        
        if (onNotification) {
          onNotification('success', 'Cap table session started! You can now make changes.')
        }
        
        return result
      } else {
        const error = await response.json()
        if (onNotification) {
          onNotification('error', error.error || 'Failed to start session')
        }
        throw new Error(error.error || 'Failed to start session')
      }
    } catch (error) {
      console.error('Error starting session:', error)
      if (onNotification) {
        onNotification('error', 'Failed to start session')
      }
      throw error
    }
  }, [companyId, onNotification])

  // Complete session manually
  const completeSession = useCallback(async () => {
    try {
      const response = await fetch(`/api/companies/${companyId}/cap-table-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'complete' })
      })

      if (response.ok) {
        setSessionState(prev => ({
          ...prev,
          isActive: false,
          hasUnsavedChanges: false,
          sessionId: null,
          startTime: null
        }))
        
        // Clear session storage when session is completed
        const sessionKey = `cap_table_session_${companyId}`
        sessionStorage.removeItem(sessionKey)
        console.log('Session completed and sessionStorage cleared')
        
        if (onNotification) {
          onNotification('success', 'Cap table session completed!')
        }
        
        return await response.json()
      } else {
        const error = await response.json()
        if (onNotification) {
          onNotification('error', error.error || 'Failed to complete session')
        }
        throw new Error(error.error || 'Failed to complete session')
      }
    } catch (error) {
      console.error('Error completing session:', error)
      if (onNotification) {
        onNotification('error', 'Failed to complete session')
      }
      throw error
    }
  }, [companyId, onNotification])

  // Mark that changes have been made
  const markChanges = useCallback(() => {
    console.log('Marking changes as unsaved')
    setSessionState(prev => ({
      ...prev,
      hasUnsavedChanges: true
    }))
    
    // Update sessionStorage to persist the unsaved changes flag
    const sessionKey = `cap_table_session_${companyId}`
    const existingData = sessionStorage.getItem(sessionKey)
    if (existingData) {
      try {
        const parsedData = JSON.parse(existingData)
        parsedData.hasUnsavedChanges = true
        sessionStorage.setItem(sessionKey, JSON.stringify(parsedData))
        console.log('Updated sessionStorage with unsaved changes flag')
      } catch (error) {
        console.error('Error updating sessionStorage:', error)
      }
    }
  }, [companyId])

  // Clean up orphaned sessions
  const cleanupOrphanedSession = useCallback(async () => {
    try {
      const response = await fetch(`/api/companies/${companyId}/cap-table-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'cleanup-orphaned' })
      })

      if (response.ok) {
        const result = await response.json()
        
        // Update session state to inactive
        setSessionState(prev => ({
          ...prev,
          isActive: false,
          hasUnsavedChanges: false,
          sessionId: null,
          startTime: null
        }))
        
        // Clear session storage
        const sessionKey = `cap_table_session_${companyId}`
        sessionStorage.removeItem(sessionKey)
        
        if (onNotification) {
          if (result.cleaned_up) {
            onNotification('success', `Orphaned session cleaned up! Refunded $${result.refunded_amount?.toFixed(2) || '20.00'}`)
          } else {
            onNotification('info', 'No orphaned sessions found to clean up')
          }
        }
        
        return result
      } else {
        const error = await response.json()
        if (onNotification) {
          onNotification('error', error.error || 'Failed to cleanup orphaned session')
        }
        throw new Error(error.error || 'Failed to cleanup orphaned session')
      }
    } catch (error) {
      console.error('Error cleaning up orphaned session:', error)
      if (onNotification) {
        onNotification('error', 'Failed to cleanup orphaned session')
      }
      throw error
    }
  }, [companyId, onNotification])

  // Sync session state (for external updates)
  const syncSessionState = useCallback(async () => {
    await loadSessionState()
  }, [loadSessionState])

  return {
    sessionState,
    startSession,
    completeSession,
    terminateSession,
    markChanges,
    syncSessionState,
    cleanupOrphanedSession,
    isActive: sessionState.isActive,
    hasUnsavedChanges: sessionState.hasUnsavedChanges
  }
}
