/**
 * Configuration options for auction clearing notifications
 * This allows for customization of notification behavior per auction or company
 */

export interface NotificationConfig {
  // Enable/disable notifications
  enabled: boolean
  
  // Notification types to send
  sendBidderNotifications: boolean
  sendCompanyNotifications: boolean
  
  // Email customization
  customFromEmail?: string
  customFromName?: string
  
  // Retry configuration
  retryFailedEmails: boolean
  maxRetries: number
  retryDelayMs: number
  
  // Logging and debugging
  enableDetailedLogging: boolean
  logEmailContent: boolean
}

export const DEFAULT_NOTIFICATION_CONFIG: NotificationConfig = {
  enabled: true,
  sendBidderNotifications: true,
  sendCompanyNotifications: true,
  retryFailedEmails: true,
  maxRetries: 3,
  retryDelayMs: 5000, // 5 seconds
  enableDetailedLogging: true,
  logEmailContent: false // Set to true for debugging email templates
}

/**
 * Get notification configuration for a specific auction
 * In the future, this could be extended to fetch from database
 */
export async function getNotificationConfig(auctionId: string): Promise<NotificationConfig> {
  // For now, return default config
  // TODO: In the future, fetch from database based on auction/company preferences
  return { ...DEFAULT_NOTIFICATION_CONFIG }
}

/**
 * Get notification configuration for a specific company
 * This could be used for company-wide notification preferences
 */
export async function getCompanyNotificationConfig(companyId: string): Promise<NotificationConfig> {
  // For now, return default config
  // TODO: In the future, fetch from database based on company preferences
  return { ...DEFAULT_NOTIFICATION_CONFIG }
}

/**
 * Validate notification configuration
 */
export function validateNotificationConfig(config: Partial<NotificationConfig>): {
  isValid: boolean
  errors: string[]
} {
  const errors: string[] = []
  
  if (config.maxRetries !== undefined && (config.maxRetries < 0 || config.maxRetries > 10)) {
    errors.push('maxRetries must be between 0 and 10')
  }
  
  if (config.retryDelayMs !== undefined && (config.retryDelayMs < 1000 || config.retryDelayMs > 60000)) {
    errors.push('retryDelayMs must be between 1000ms and 60000ms')
  }
  
  if (config.customFromEmail && !isValidEmail(config.customFromEmail)) {
    errors.push('customFromEmail must be a valid email address')
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

/**
 * Simple email validation
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Merge configuration with defaults
 */
export function mergeWithDefaults(config: Partial<NotificationConfig>): NotificationConfig {
  return {
    ...DEFAULT_NOTIFICATION_CONFIG,
    ...config
  }
}

/**
 * Check if notifications should be sent based on configuration
 */
export function shouldSendNotifications(config: NotificationConfig): boolean {
  return config.enabled && (config.sendBidderNotifications || config.sendCompanyNotifications)
}

/**
 * Get retry configuration for failed email attempts
 */
export function getRetryConfig(config: NotificationConfig): {
  shouldRetry: boolean
  maxRetries: number
  delayMs: number
} {
  return {
    shouldRetry: config.retryFailedEmails,
    maxRetries: config.maxRetries,
    delayMs: config.retryDelayMs
  }
}
