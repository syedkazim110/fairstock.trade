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

// Cache TTL constants (in milliseconds)
export const cacheTTL = {
  short: 30000,    // 30 seconds - for frequently changing data
  medium: 300000,  // 5 minutes - for moderately changing data
  long: 1800000,   // 30 minutes - for rarely changing data
  profile: 600000, // 10 minutes - for user profiles
  capTableSession: 300000, // 5 minutes - for cap table sessions (optimized)
  companyData: 600000, // 10 minutes - for company data that changes less frequently
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
