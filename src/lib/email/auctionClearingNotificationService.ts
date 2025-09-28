import { createClient } from '@/lib/supabase/server'
import { emailService } from './emailService'
import { 
  generateSuccessfulAllocationEmail,
  generateRejectedBidEmail,
  generateCompanyClearingNotificationEmail,
  type ClearingNotificationData
} from './templates/auctionClearingNotifications'
import { 
  getNotificationConfig,
  shouldSendNotifications,
  getRetryConfig,
  type NotificationConfig
} from './notificationConfig'

export interface AuctionData {
  id: string
  title: string
  company_id: string
  company_name: string
  clearing_price: number
  total_demand: number
  shares_count: number
  shares_allocated: number
  pro_rata_applied: boolean
}

export interface AllocationData {
  id: string
  bidder_id: string
  bidder_email: string
  original_quantity: number
  allocated_quantity: number
  clearing_price: number
  total_amount: number
  allocation_type: 'full' | 'pro_rata' | 'rejected'
  pro_rata_percentage?: number
}

export interface ClearingResults {
  successful_bidders: number
  rejected_bidders: number
  total_revenue: number
  shares_allocated: number
  pro_rata_applied: boolean
}

export class AuctionClearingNotificationService {
  
  /**
   * Main method to send all clearing notifications for an auction
   */
  async sendClearingNotifications(auctionId: string, customConfig?: Partial<NotificationConfig>): Promise<{
    success: boolean
    bidder_notifications_sent: number
    company_notifications_sent: number
    errors: string[]
    config_used: NotificationConfig
  }> {
    const errors: string[] = []
    let bidderNotificationsSent = 0
    let companyNotificationsSent = 0

    try {
      // Get notification configuration
      const baseConfig = await getNotificationConfig(auctionId)
      const config = customConfig ? { ...baseConfig, ...customConfig } : baseConfig

      if (config.enableDetailedLogging) {
        console.log(`🔔 Starting clearing notifications for auction ${auctionId}`)
        console.log(`📋 Configuration:`, {
          enabled: config.enabled,
          sendBidderNotifications: config.sendBidderNotifications,
          sendCompanyNotifications: config.sendCompanyNotifications,
          retryFailedEmails: config.retryFailedEmails,
          maxRetries: config.maxRetries
        })
      }

      // Check if notifications are enabled
      if (!shouldSendNotifications(config)) {
        console.log('⏭️  Notifications disabled by configuration')
        return {
          success: true,
          bidder_notifications_sent: 0,
          company_notifications_sent: 0,
          errors: ['Notifications disabled by configuration'],
          config_used: config
        }
      }

      // Get auction data
      const auctionData = await this.getAuctionData(auctionId)
      if (!auctionData) {
        const errorMsg = 'Failed to fetch auction data'
        errors.push(errorMsg)
        if (config.enableDetailedLogging) {
          console.error('❌', errorMsg)
        }
        return { 
          success: false, 
          bidder_notifications_sent: 0, 
          company_notifications_sent: 0, 
          errors,
          config_used: config
        }
      }

      if (config.enableDetailedLogging) {
        console.log(`📊 Auction data loaded: ${auctionData.title} (${auctionData.company_name})`)
      }

      // Get all allocations
      const allocations = await this.getAllocations(auctionId)
      if (allocations.length === 0) {
        const msg = 'No allocations found for auction - this might be valid if no bids were placed'
        if (config.enableDetailedLogging) {
          console.log('⚠️ ', msg)
        }
      } else if (config.enableDetailedLogging) {
        console.log(`📋 Found ${allocations.length} allocations to process`)
      }

      // Send notifications to all bidders
      if (config.sendBidderNotifications && allocations.length > 0) {
        try {
          bidderNotificationsSent = await this.sendBidderNotifications(auctionData, allocations, config)
          if (config.enableDetailedLogging) {
            console.log(`✅ Sent ${bidderNotificationsSent} bidder notifications`)
          }
        } catch (error) {
          const errorMsg = `Failed to send bidder notifications: ${error instanceof Error ? error.message : 'Unknown error'}`
          console.error('❌', errorMsg)
          errors.push(errorMsg)
        }
      } else if (config.enableDetailedLogging) {
        console.log('⏭️  Bidder notifications skipped by configuration')
      }

      // Send notification to company owners
      if (config.sendCompanyNotifications) {
        try {
          const results = this.calculateResults(allocations)
          companyNotificationsSent = await this.sendCompanyNotification(auctionData, results, config)
          if (config.enableDetailedLogging) {
            console.log(`✅ Sent ${companyNotificationsSent} company notifications`)
          }
        } catch (error) {
          const errorMsg = `Failed to send company notifications: ${error instanceof Error ? error.message : 'Unknown error'}`
          console.error('❌', errorMsg)
          errors.push(errorMsg)
        }
      } else if (config.enableDetailedLogging) {
        console.log('⏭️  Company notifications skipped by configuration')
      }

      const success = errors.length === 0
      if (config.enableDetailedLogging) {
        console.log(`🎉 Clearing notifications completed. Success: ${success}`)
        if (errors.length > 0) {
          console.log(`⚠️  Errors encountered: ${errors.length}`)
          errors.forEach(error => console.log(`   - ${error}`))
        }
      }

      return {
        success,
        bidder_notifications_sent: bidderNotificationsSent,
        company_notifications_sent: companyNotificationsSent,
        errors,
        config_used: config
      }

    } catch (error) {
      const errorMsg = `Fatal error in sendClearingNotifications: ${error instanceof Error ? error.message : 'Unknown error'}`
      console.error('💥', errorMsg)
      console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace available')
      errors.push(errorMsg)
      
      return {
        success: false,
        bidder_notifications_sent: bidderNotificationsSent,
        company_notifications_sent: companyNotificationsSent,
        errors,
        config_used: customConfig ? { ...await getNotificationConfig(auctionId), ...customConfig } : await getNotificationConfig(auctionId)
      }
    }
  }

  /**
   * Get auction data with company information
   */
  private async getAuctionData(auctionId: string): Promise<AuctionData | null> {
    try {
      const supabase = await createClient()
      
      const { data: auction, error } = await supabase
        .from('company_auctions')
        .select(`
          id,
          title,
          company_id,
          clearing_price,
          total_demand,
          shares_count,
          companies!inner(id, name)
        `)
        .eq('id', auctionId)
        .single()

      if (error || !auction) {
        console.error('Error fetching auction data:', error)
        return null
      }

      // Get clearing results for additional data
      const { data: clearingResults } = await supabase
        .from('auction_clearing_results')
        .select('shares_allocated, pro_rata_applied')
        .eq('auction_id', auctionId)
        .single()

      return {
        id: auction.id,
        title: auction.title,
        company_id: auction.company_id,
        company_name: (auction.companies as any).name,
        clearing_price: auction.clearing_price || 0,
        total_demand: auction.total_demand || 0,
        shares_count: auction.shares_count,
        shares_allocated: clearingResults?.shares_allocated || 0,
        pro_rata_applied: clearingResults?.pro_rata_applied || false
      }
    } catch (error) {
      console.error('Error in getAuctionData:', error)
      return null
    }
  }

  /**
   * Get all bid allocations for the auction
   */
  private async getAllocations(auctionId: string): Promise<AllocationData[]> {
    try {
      const supabase = await createClient()
      
      const { data: allocations, error } = await supabase
        .from('bid_allocations')
        .select('*')
        .eq('auction_id', auctionId)
        .order('allocated_quantity', { ascending: false })

      if (error) {
        console.error('Error fetching allocations:', error)
        return []
      }

      return allocations || []
    } catch (error) {
      console.error('Error in getAllocations:', error)
      return []
    }
  }

  /**
   * Get company owners' email addresses
   */
  private async getCompanyOwners(companyId: string): Promise<string[]> {
    try {
      const supabase = await createClient()
      
      // Get company creator
      const { data: company, error: companyError } = await supabase
        .from('companies')
        .select(`
          created_by,
          profiles!inner(email)
        `)
        .eq('id', companyId)
        .single()

      if (companyError || !company) {
        console.error('Error fetching company owner:', companyError)
        return []
      }

      const ownerEmails = [(company.profiles as any).email]

      // TODO: In the future, we might want to include other company admins
      // For now, just notify the company creator

      return ownerEmails.filter(email => email) // Remove any null/undefined emails
    } catch (error) {
      console.error('Error in getCompanyOwners:', error)
      return []
    }
  }

  /**
   * Send notifications to all bidders (successful and rejected)
   */
  private async sendBidderNotifications(auctionData: AuctionData, allocations: AllocationData[], config: NotificationConfig): Promise<number> {
    let sentCount = 0

    for (const allocation of allocations) {
      try {
        const notificationData: ClearingNotificationData = {
          auction: {
            id: auctionData.id,
            title: auctionData.title,
            company_name: auctionData.company_name,
            clearing_price: auctionData.clearing_price,
            total_demand: auctionData.total_demand,
            shares_count: auctionData.shares_count
          },
          allocation: {
            original_quantity: allocation.original_quantity,
            allocated_quantity: allocation.allocated_quantity,
            total_amount: allocation.total_amount,
            allocation_type: allocation.allocation_type,
            pro_rata_percentage: allocation.pro_rata_percentage
          },
          recipient: {
            email: allocation.bidder_email
          }
        }

        let emailContent
        if (allocation.allocated_quantity > 0) {
          // Successful allocation
          emailContent = generateSuccessfulAllocationEmail(notificationData)
        } else {
          // Rejected bid
          emailContent = generateRejectedBidEmail(notificationData)
        }

        const success = await emailService.sendEmail({
          to: allocation.bidder_email,
          subject: emailContent.subject,
          html: emailContent.html
        })

        if (success) {
          sentCount++
          console.log(`📧 Sent notification to ${allocation.bidder_email} (${allocation.allocation_type})`)
        } else {
          console.error(`❌ Failed to send notification to ${allocation.bidder_email}`)
        }

      } catch (error) {
        console.error(`❌ Error sending notification to ${allocation.bidder_email}:`, error)
      }
    }

    return sentCount
  }

  /**
   * Send summary notification to company owners
   */
  private async sendCompanyNotification(auctionData: AuctionData, results: ClearingResults, config: NotificationConfig): Promise<number> {
    try {
      const ownerEmails = await this.getCompanyOwners(auctionData.company_id)
      
      if (ownerEmails.length === 0) {
        console.log('⚠️  No company owner emails found')
        return 0
      }

      let sentCount = 0

      for (const ownerEmail of ownerEmails) {
        try {
          const emailContent = generateCompanyClearingNotificationEmail({
            auction: {
              id: auctionData.id,
              title: auctionData.title,
              company_name: auctionData.company_name,
              clearing_price: auctionData.clearing_price,
              total_demand: auctionData.total_demand,
              shares_count: auctionData.shares_count
            },
            results,
            recipient: {
              email: ownerEmail
            }
          })

          const success = await emailService.sendEmail({
            to: ownerEmail,
            subject: emailContent.subject,
            html: emailContent.html
          })

          if (success) {
            sentCount++
            console.log(`📧 Sent company notification to ${ownerEmail}`)
          } else {
            console.error(`❌ Failed to send company notification to ${ownerEmail}`)
          }

        } catch (error) {
          console.error(`❌ Error sending company notification to ${ownerEmail}:`, error)
        }
      }

      return sentCount

    } catch (error) {
      console.error('Error in sendCompanyNotification:', error)
      return 0
    }
  }

  /**
   * Calculate summary results from allocations
   */
  private calculateResults(allocations: AllocationData[]): ClearingResults {
    const successful = allocations.filter(a => a.allocated_quantity > 0)
    const rejected = allocations.filter(a => a.allocated_quantity === 0)
    
    const totalRevenue = successful.reduce((sum, a) => sum + a.total_amount, 0)
    const sharesAllocated = successful.reduce((sum, a) => sum + a.allocated_quantity, 0)
    const proRataApplied = allocations.some(a => a.allocation_type === 'pro_rata')

    return {
      successful_bidders: successful.length,
      rejected_bidders: rejected.length,
      total_revenue: totalRevenue,
      shares_allocated: sharesAllocated,
      pro_rata_applied: proRataApplied
    }
  }
}

export const auctionClearingNotificationService = new AuctionClearingNotificationService()
