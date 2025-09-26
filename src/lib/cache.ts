// Simple in-memory cache for API responses
// This will significantly improve performance for frequently accessed data

interface CacheItem<T> {
  data: T
  timestamp: number
  ttl: number
}

class MemoryCache {
  private cache = new Map<string, CacheItem<any>>()
  private readonly defaultTTL = 60000 // 1 minute default

  set<T>(key: string, data: T, ttl: number = this.defaultTTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    })
  }

  get<T>(key: string): T | null {
    const item = this.cache.get(key)
    
    if (!item) {
      return null
    }

    // Check if item has expired
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key)
      return null
    }

    return item.data as T
  }

  delete(key: string): boolean {
    return this.cache.delete(key)
  }

  clear(): void {
    this.cache.clear()
  }

  // Clean up expired items
  cleanup(): void {
    const now = Date.now()
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key)
      }
    }
  }

  // Get cache stats
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    }
  }
}

// Create singleton instance
export const cache = new MemoryCache()

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

// Utility function to wrap API calls with caching
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl: number = cacheTTL.medium
): Promise<T> {
  // Try to get from cache first
  const cached = cache.get<T>(key)
  if (cached !== null) {
    return cached
  }

  // If not in cache, fetch the data
  const data = await fetcher()
  
  // Store in cache
  cache.set(key, data, ttl)
  
  return data
}

// Cleanup expired cache items every 5 minutes
if (typeof window === 'undefined') { // Only run on server
  setInterval(() => {
    cache.cleanup()
  }, 300000) // 5 minutes
}
