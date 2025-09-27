# Implementation Plan

## Overview
Fix the cap table session management system to properly handle money deduction based on whether changes were made during the session.

The current system has conflicting session management logic between `CompanyManageInterface.tsx` and `CapTableTab.tsx`, causing sessions to always be cancelled (with refunds) even when changes were made. This implementation will centralize session management, implement change-aware termination logic, and ensure proper money handling based on actual user actions.

## Types
Define enhanced interfaces for session state management and change tracking.

```typescript
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

// Enhanced session management props
interface SessionManagerProps {
  companyId: string
  onSessionStateChange?: (state: SessionState) => void
  onSessionTerminated?: (context: SessionTerminationContext) => void
}

// API request/response types
interface SmartSessionTerminationRequest {
  action: 'smart-terminate'
  context: SessionTerminationContext
}

interface SmartSessionTerminationResponse {
  action_taken: 'completed' | 'cancelled'
  message: string
  refunded_amount?: number
  charged_amount?: number
  new_balance: number
}
```

## Files
Modify existing session management files and create new centralized session manager.

**Modified Files:**
- `src/components/CapTableTab.tsx` - Remove duplicate session management, delegate to centralized manager
- `src/components/CompanyManageInterface.tsx` - Remove conflicting session logic, use centralized manager
- `src/app/api/companies/[id]/cap-table-data/route.ts` - Add smart termination endpoint logic

**New Files:**
- `src/hooks/useSessionManager.ts` - Centralized session management hook
- `src/components/SessionManager.tsx` - Session management component wrapper

**Configuration Updates:**
- No configuration file changes required

## Functions
Implement centralized session management with change-aware termination logic.

**New Functions:**
- `useSessionManager(companyId: string)` - Custom hook for session state management in `src/hooks/useSessionManager.ts`
- `handleSmartTermination(context: SessionTerminationContext)` - Centralized termination logic in session manager
- `determineSessionAction(hasChanges: boolean)` - Logic to determine complete vs cancel action
- `syncSessionState()` - Function to synchronize session state across components

**Modified Functions:**
- `handleSmartSessionTermination()` in `CapTableTab.tsx` - Simplified to delegate to centralized manager
- `handleSessionCancellation()` in `CompanyManageInterface.tsx` - Replaced with smart termination call
- `POST /api/companies/[id]/cap-table-data` - Enhanced to handle smart termination requests

**Removed Functions:**
- Duplicate session management functions in `CompanyManageInterface.tsx`
- Redundant session state tracking in individual components

## Classes
No new classes required - using functional components and hooks pattern.

**Enhanced Components:**
- `SessionManager` - Wrapper component that provides centralized session management
- Enhanced `CapTableTab` - Simplified session logic, focuses on change tracking
- Enhanced `CompanyManageInterface` - Simplified to use centralized session management

## Dependencies
No new external dependencies required.

**Existing Dependencies Used:**
- React hooks (`useState`, `useEffect`, `useRef`, `useCallback`)
- Next.js API routes
- Supabase client for database operations

**Internal Dependencies:**
- Existing cache management system
- Current notification system
- Existing API endpoint structure

## Testing
Comprehensive testing strategy for session management scenarios.

**Test Scenarios:**
1. **No Changes Made:**
   - Start session → Switch tabs → Verify cancellation and full refund
   - Start session → Close browser → Verify cancellation and full refund
   - Start session → Navigate away → Verify cancellation and full refund

2. **Changes Made:**
   - Start session → Add member → Switch tabs → Verify completion and charge
   - Start session → Edit member → Close browser → Verify completion and charge
   - Start session → Delete member → Navigate away → Verify completion and charge

3. **Edge Cases:**
   - Multiple rapid tab switches → Verify no duplicate terminations
   - Session termination race conditions → Verify proper state management
   - Network failures during termination → Verify proper error handling

**Test Files:**
- Update existing component tests to cover new session management
- Add integration tests for session termination scenarios
- Add API endpoint tests for smart termination logic

## Implementation Order
Sequential implementation steps to minimize conflicts and ensure successful integration.

1. **Create Centralized Session Manager Hook** (`src/hooks/useSessionManager.ts`)
   - Implement core session state management
   - Add change tracking logic
   - Implement smart termination decision making

2. **Enhance API Endpoint** (`src/app/api/companies/[id]/cap-table-data/route.ts`)
   - Add smart termination action handling
   - Implement change-aware completion/cancellation logic
   - Add proper error handling and logging

3. **Create Session Manager Component** (`src/components/SessionManager.tsx`)
   - Wrapper component for centralized session management
   - Handle all browser events (visibility, beforeunload, etc.)
   - Provide session state to child components

4. **Update CapTableTab Component** (`src/components/CapTableTab.tsx`)
   - Remove duplicate session management logic
   - Integrate with centralized session manager
   - Focus on change tracking and UI updates

5. **Update CompanyManageInterface Component** (`src/components/CompanyManageInterface.tsx`)
   - Remove conflicting session management
   - Integrate with centralized session manager
   - Simplify tab switching logic

6. **Integration Testing**
   - Test all session termination scenarios
   - Verify proper money handling
   - Test cross-component communication

7. **Performance Optimization**
   - Optimize session state synchronization
   - Add proper cleanup and memory management
   - Implement efficient change detection

8. **Final Validation**
   - End-to-end testing of complete user flows
   - Verify logging and error handling
   - Performance testing under various conditions
