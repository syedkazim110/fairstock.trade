// Dutch Auction Price Calculation Utilities

export interface DutchAuctionParams {
  maxPrice: number
  minPrice: number
  durationHours: number
  decreasingMinutes: number
  startTime: Date
}

export interface PriceCalculationResult {
  currentPrice: number
  elapsedMinutes: number
  totalSteps: number
  currentStep: number
  stepSize: number
  timeToNextDecrease: number
  isExpired: boolean
  hasReachedMinimum: boolean
}

/**
 * Calculate the current price of a Dutch auction
 */
export function calculateCurrentPrice(params: DutchAuctionParams, currentTime: Date = new Date()): PriceCalculationResult {
  const { maxPrice, minPrice, durationHours, decreasingMinutes, startTime } = params
  
  // Calculate elapsed time in minutes
  const elapsedMinutes = Math.floor((currentTime.getTime() - startTime.getTime()) / (1000 * 60))
  
  // If auction hasn't started yet, return max price
  if (elapsedMinutes <= 0) {
    return {
      currentPrice: maxPrice,
      elapsedMinutes: 0,
      totalSteps: Math.floor((durationHours * 60) / decreasingMinutes),
      currentStep: 0,
      stepSize: (maxPrice - minPrice) / Math.floor((durationHours * 60) / decreasingMinutes),
      timeToNextDecrease: decreasingMinutes,
      isExpired: false,
      hasReachedMinimum: false
    }
  }
  
  // Calculate total steps and step size
  const totalSteps = Math.floor((durationHours * 60) / decreasingMinutes)
  const stepSize = (maxPrice - minPrice) / totalSteps
  
  // Calculate current step
  const currentStep = Math.floor(elapsedMinutes / decreasingMinutes)
  
  // Check if auction has expired
  const totalDurationMinutes = durationHours * 60
  const isExpired = elapsedMinutes >= totalDurationMinutes
  
  // Calculate current price
  let currentPrice = maxPrice - (currentStep * stepSize)
  
  // Ensure price doesn't go below minimum
  currentPrice = Math.max(currentPrice, minPrice)
  const hasReachedMinimum = currentPrice <= minPrice
  
  // Calculate time to next price decrease
  const minutesIntoCurrentStep = elapsedMinutes % decreasingMinutes
  const timeToNextDecrease = decreasingMinutes - minutesIntoCurrentStep
  
  return {
    currentPrice: Math.round(currentPrice * 100) / 100, // Round to 2 decimal places
    elapsedMinutes,
    totalSteps,
    currentStep,
    stepSize: Math.round(stepSize * 100) / 100,
    timeToNextDecrease: hasReachedMinimum || isExpired ? 0 : timeToNextDecrease,
    isExpired,
    hasReachedMinimum
  }
}

/**
 * Get the price at a specific step
 */
export function getPriceAtStep(params: DutchAuctionParams, step: number): number {
  const { maxPrice, minPrice, durationHours, decreasingMinutes } = params
  
  const totalSteps = Math.floor((durationHours * 60) / decreasingMinutes)
  const stepSize = (maxPrice - minPrice) / totalSteps
  
  const price = maxPrice - (step * stepSize)
  return Math.max(Math.round(price * 100) / 100, minPrice)
}

/**
 * Generate price schedule for the entire auction
 */
export function generatePriceSchedule(params: DutchAuctionParams): Array<{
  step: number
  price: number
  timeFromStart: number
  timestamp: Date
}> {
  const { durationHours, decreasingMinutes, startTime } = params
  
  const totalSteps = Math.floor((durationHours * 60) / decreasingMinutes)
  const schedule = []
  
  for (let step = 0; step <= totalSteps; step++) {
    const timeFromStart = step * decreasingMinutes
    const timestamp = new Date(startTime.getTime() + (timeFromStart * 60 * 1000))
    const price = getPriceAtStep(params, step)
    
    schedule.push({
      step,
      price,
      timeFromStart,
      timestamp
    })
  }
  
  return schedule
}

/**
 * Check if auction should be automatically ended
 */
export function shouldEndAuction(params: DutchAuctionParams, currentTime: Date = new Date()): {
  shouldEnd: boolean
  reason: 'expired' | 'minimum_reached' | null
} {
  const result = calculateCurrentPrice(params, currentTime)
  
  if (result.isExpired) {
    return { shouldEnd: true, reason: 'expired' }
  }
  
  if (result.hasReachedMinimum) {
    return { shouldEnd: true, reason: 'minimum_reached' }
  }
  
  return { shouldEnd: false, reason: null }
}

/**
 * Format time remaining in auction
 */
export function formatTimeRemaining(params: DutchAuctionParams, currentTime: Date = new Date()): string {
  const { durationHours, startTime } = params
  
  const endTime = new Date(startTime.getTime() + (durationHours * 60 * 60 * 1000))
  const remainingMs = endTime.getTime() - currentTime.getTime()
  
  if (remainingMs <= 0) {
    return 'Expired'
  }
  
  const remainingMinutes = Math.floor(remainingMs / (1000 * 60))
  const hours = Math.floor(remainingMinutes / 60)
  const minutes = remainingMinutes % 60
  
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else {
    return `${minutes}m`
  }
}

/**
 * Format time until next price decrease
 */
export function formatTimeToNextDecrease(timeToNextDecrease: number): string {
  if (timeToNextDecrease <= 0) {
    return 'Price at minimum'
  }
  
  const minutes = Math.floor(timeToNextDecrease)
  const seconds = Math.floor((timeToNextDecrease - minutes) * 60)
  
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`
  } else {
    return `${seconds}s`
  }
}

/**
 * Validate Dutch auction parameters
 */
export function validateAuctionParams(params: Partial<DutchAuctionParams>): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  if (!params.maxPrice || params.maxPrice <= 0) {
    errors.push('Maximum price must be greater than 0')
  }
  
  if (!params.minPrice || params.minPrice <= 0) {
    errors.push('Minimum price must be greater than 0')
  }
  
  if (params.maxPrice && params.minPrice && params.maxPrice <= params.minPrice) {
    errors.push('Maximum price must be greater than minimum price')
  }
  
  if (!params.durationHours || params.durationHours <= 0) {
    errors.push('Duration must be greater than 0 hours')
  }
  
  if (!params.decreasingMinutes || params.decreasingMinutes <= 0) {
    errors.push('Price decrease interval must be greater than 0 minutes')
  }
  
  if (params.durationHours && params.decreasingMinutes) {
    const totalMinutes = params.durationHours * 60
    if (params.decreasingMinutes >= totalMinutes) {
      errors.push('Price decrease interval must be less than total auction duration')
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}
