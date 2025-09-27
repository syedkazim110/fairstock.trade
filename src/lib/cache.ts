// Session-scoped in-memory cache for API responses
// This prevents cross-user data leakage by isolating cache per request/session

interface CacheItem<T> {
  data: T
  timestamp: number
  ttl: number
  userId: string // Add user ID for additional security
}

class SessionScopedCache {
  private cache = new Map<string, CacheItem<any>>()
  private readonly defaultTTL = 60000 // 1 minute default
  private readonly sessionId: string
  private readonly userId: string

  constructor(sessionId: string, userId: string) {
    this.sessionId = sessionId
    this.userId = userId
  }

  private getSecureKey(key: string): string {
    // Create a secure key that includes session and user context
    return `${this.sessionId}:${this.userId}:${key}`
  }

  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    const secureKey = this.getSecureKey(key)
    this.cache.set(secureKey, {
      data,
      timestamp: Date.now(),
      ttl,
      userId: this.userId
    })
  }

  get<T>(key: string): T | null {
    const secureKey = this.getSecureKey(key)
    const item = this.cache.get(secureKey)
    
    if (!item) {
      return null
    }

    // Additional security check - ensure user ID matches
    if (item.userId !== this.userId) {
      this.cache.delete(secureKey)
      return null
    }

    // Check if item has expired
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(secureKey)
      return null
    }

    return item.data as T
  }

  delete(key: string): boolean {
    const secureKey = this.getSecureKey(key)
    return this.cache.delete(secureKey)
  }

  clear(): void {
    // Only clear items for this session/user
    const sessionPrefix = `${this.sessionId}:${this.userId}:`
    for (const key of this.cache.keys()) {
      if (key.startsWith(sessionPrefix)) {
        this.cache.delete(key)
      }
    }
  }

  // Clean up expired items for this session
  cleanup(): void {
    const now = Date.now()
    const sessionPrefix = `${this.sessionId}:${this.userId}:`
    
    for (const [key, item] of this.cache.entries()) {
      if (key.startsWith(sessionPrefix) && (now - item.timestamp > item.ttl)) {
        this.cache.delete(key)
      }
    }
  }

  // Get cache stats for this session
  getStats(): { size: number; keys: string[] } {
    const sessionPrefix = `${this.sessionId}:${this.userId}:`
    const sessionKeys = Array.from(this.cache.keys()).filter(key => key.startsWith(sessionPrefix))
    
    return {
      size: sessionKeys.length,
      keys: sessionKeys
    }
  }
}

// Global cache store for managing multiple sessions
class GlobalCacheManager {
  private caches = new Map<string, SessionScopedCache>()

  getCache(sessionId: string, userId: string): SessionScopedCache {
    const cacheKey = `${sessionId}:${userId}`
    
    if (!this.caches.has(cacheKey)) {
      this.caches.set(cacheKey, new SessionScopedCache(sessionId, userId))
    }
    
    return this.caches.get(cacheKey)!
  }

  clearUserCache(userId: string): void {
    // Clear all caches for a specific user (useful for logout)
    for (const [key, cache] of this.caches.entries()) {
      if (key.includes(`:${userId}`)) {
        cache.clear()
        this.caches.delete(key)
      }
    }
  }

  cleanup(): void {
    // Clean up expired items across all caches
    for (const cache of this.caches.values()) {
      cache.cleanup()
    }
  }
}

// Create global cache manager
const globalCacheManager = new GlobalCacheManager()

// Helper function to get session-scoped cache
export function getSessionCache(userId: string, sessionId?: string): SessionScopedCache {
  // Use a stable session ID based on user ID to avoid cache misses on page reloads
  const effectiveSessionId = sessionId || `session_${userId}`
  return globalCacheManager.getCache(effectiveSessionId, userId)
}

// Legacy cache export for backward compatibility (will be deprecated)
export const cache = {
  set: () => { throw new Error('Use getSessionCache() instead of global cache') },
  get: () => { throw new Error('Use getSessionCache() instead of global cache') },
  delete: () => { throw new Error('Use getSessionCache() instead of global cache') },
  clear: () => { throw new Error('Use getSessionCache() instead of global cache') },
  cleanup: () => globalCacheManager.cleanup(),
  getStats: () => ({ size: 0, keys: [] })
}

// Cache key generators for consistent naming
export const cacheKeys = {
  company: (id: string) => `company:${id}`,
  companyMembers: (id: string) => `company:${id}:members`,
  companyAuctions: (id: string) => `company:${id}:auctions`,
  companyTransactions: (id: string) => `company:${id}:transactions`,
  userCompanies: (userId: string) => `user:${userId}:companies`,
  capTableSession: (companyId: string) => `company:${companyId}:cap-table-session`,
  userProfile: (userId: string) => `user:${userId}:profile`,
}

// Cache TTL constants (in milliseconds) - Optimized for cap table performance
export const cacheTTL = {
  short: 15000,    // 15 seconds - for real-time data like active sessions
  medium: 120000,  // 2 minutes - for moderately changing data
  long: 900000,    // 15 minutes - for rarely changing data
  profile: 300000, // 5 minutes - for user profiles
  capTableSession: 30000, // 30 seconds - for cap table sessions (real-time)
  capTableData: 60000, // 1 minute - for complete cap table data
  companyData: 300000, // 5 minutes - for company data
  memberData: 120000, // 2 minutes - for member data
  shareholdings: 300000, // 5 minutes - for shareholding data
}

// Utility function to wrap API calls with session-scoped caching
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  userId: string,
  ttl: number = cacheTTL.medium,
  sessionId?: string
): Promise<T> {
  // Get session-scoped cache for this user
  const sessionCache = getSessionCache(userId, sessionId)
  
  // Try to get from cache first
  const cached = sessionCache.get<T>(key)
  if (cached !== null) {
    return cached
  }

  // If not in cache, fetch the data
  const data = await fetcher()
  
  // Store in cache
  sessionCache.set(key, data, ttl)
  
  return data
}

// Helper function to clear user cache (useful for logout)
export function clearUserCache(userId: string): void {
  globalCacheManager.clearUserCache(userId)
}

// Cleanup expired cache items every 5 minutes
if (typeof window === 'undefined') { // Only run on server
  setInterval(() => {
    globalCacheManager.cleanup()
  }, 300000) // 5 minutes
}
