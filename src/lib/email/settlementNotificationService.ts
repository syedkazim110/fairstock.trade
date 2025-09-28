// Settlement notification service
// Handles sending settlement-related emails throughout the post-clearing workflow

import { createClient } from '@/lib/supabase/server'
import { emailService } from './emailService'
import { 
  generatePaymentInstructionEmail,
  generatePaymentConfirmationEmail,
  generateSettlementCompletionEmail,
  generateSettlementSummaryEmail,
  type SettlementNotificationData,
  type SettlementSummaryData
} from './templates/settlementNotifications'
import { DEFAULT_NOTIFICATION_CONFIG } from './notificationConfig'

interface SettlementNotificationResult {
  success: boolean
  notifications_sent: number
  errors: string[]
  details: {
    payment_instructions_sent: number
    payment_confirmations_sent: number
    settlement_completions_sent: number
    summary_notifications_sent: number
  }
}

class SettlementNotificationService {
  private supabase = createClient()

  /**
   * Send payment instruction emails to all successful bidders after clearing
   */
  async sendPaymentInstructions(auctionId: string): Promise<SettlementNotificationResult> {
    const result: SettlementNotificationResult = {
      success: true,
      notifications_sent: 0,
      errors: [],
      details: {
        payment_instructions_sent: 0,
        payment_confirmations_sent: 0,
        settlement_completions_sent: 0,
        summary_notifications_sent: 0
      }
    }

    try {
      // Check if notifications are enabled
      if (!DEFAULT_NOTIFICATION_CONFIG.enabled) {
        console.log('Settlement notifications are disabled')
        return result
      }

      // Get auction details
      const { data: auction, error: auctionError } = await (await this.supabase)
        .from('company_auctions')
        .select(`
          id,
          title,
          company_id,
          wire_account_name,
          wire_account_number,
          wire_routing_number,
          wire_bank_name,
          wire_bank_address
        `)
        .eq('id', auctionId)
        .single()

      if (auctionError || !auction) {
        result.errors.push(`Auction not found: ${auctionError?.message}`)
        result.success = false
        return result
      }

      // Get company details
      const { data: company, error: companyError } = await (await this.supabase)
        .from('companies')
        .select('id, name, created_by')
        .eq('id', auction.company_id)
        .single()

      if (companyError || !company) {
        result.errors.push(`Company not found: ${companyError?.message}`)
        result.success = false
        return result
      }

      // Get company owner profile
      const { data: ownerProfile, error: profileError } = await (await this.supabase)
        .from('profiles')
        .select('email, full_name')
        .eq('id', company.created_by)
        .single()

      if (profileError || !ownerProfile) {
        result.errors.push(`Company owner profile not found: ${profileError?.message}`)
        result.success = false
        return result
      }

      // Get successful allocations that need payment instructions
      const { data: allocations, error: allocationsError } = await (await this.supabase)
        .from('auction_settlement_dashboard')
        .select('*')
        .eq('auction_id', auctionId)
        .eq('settlement_status', 'pending_payment')
        .gt('allocated_quantity', 0)

      if (allocationsError) {
        result.errors.push(`Failed to fetch allocations: ${allocationsError.message}`)
        result.success = false
        return result
      }

      if (!allocations || allocations.length === 0) {
        console.log('No pending payment allocations found for payment instructions')
        return result
      }

      // Send payment instruction email to each successful bidder
      for (const allocation of allocations) {
        try {
          const notificationData: SettlementNotificationData = {
            auctionTitle: auction.title,
            companyName: company.name,
            clearingPrice: allocation.clearing_price,
            allocatedQuantity: allocation.allocated_quantity,
            totalAmount: allocation.total_amount,
            allocationId: allocation.allocation_id,
            settlementStatus: 'pending_payment',
            settlementDate: allocation.settlement_date,
            bidderEmail: allocation.bidder_email,
            companyOwnerEmail: ownerProfile.email,
            companyOwnerName: ownerProfile.full_name,
            wireAccountName: auction.wire_account_name,
            wireAccountNumber: auction.wire_account_number,
            wireRoutingNumber: auction.wire_routing_number,
            wireBankName: auction.wire_bank_name,
            wireBankAddress: auction.wire_bank_address
          }

          const emailContent = generatePaymentInstructionEmail(notificationData)
          
          const emailResult = await emailService.sendEmail({
            to: allocation.bidder_email,
            subject: emailContent.subject,
            html: emailContent.html
          })

          if (emailResult) {
            result.notifications_sent++
            result.details.payment_instructions_sent++
            console.log(`✅ Payment instruction sent to ${allocation.bidder_email}`)
          } else {
            result.errors.push(`Failed to send payment instruction to ${allocation.bidder_email}`)
          }

        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error'
          result.errors.push(`Error sending payment instruction to ${allocation.bidder_email}: ${errorMessage}`)
          console.error(`Error sending payment instruction to ${allocation.bidder_email}:`, error)
        }
      }

      // Send summary to company owner
      try {
        const summaryData: SettlementSummaryData = {
          auctionTitle: auction.title,
          companyName: company.name,
          totalAllocations: allocations.length,
          totalSettlementAmount: allocations.reduce((sum, a) => sum + a.total_amount, 0),
          pendingPaymentCount: allocations.length,
          paymentReceivedCount: 0,
          sharesTransferredCount: 0,
          completedCount: 0,
          settlementCompletionPercentage: 0,
          paymentCollectionPercentage: 0
        }

        const summaryEmail = generateSettlementSummaryEmail(summaryData)
        
        const summaryResult = await emailService.sendEmail({
          to: ownerProfile.email,
          subject: summaryEmail.subject,
          html: summaryEmail.html
        })

        if (summaryResult) {
          result.details.summary_notifications_sent++
          console.log(`✅ Settlement summary sent to company owner`)
        } else {
          result.errors.push(`Failed to send settlement summary`)
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        result.errors.push(`Error sending settlement summary: ${errorMessage}`)
        console.error('Error sending settlement summary:', error)
      }

      result.success = result.errors.length === 0

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      result.errors.push(`Settlement notification service error: ${errorMessage}`)
      result.success = false
      console.error('Settlement notification service error:', error)
    }

    return result
  }

  /**
   * Send payment confirmation email to a bidder
   */
  async sendPaymentConfirmation(allocationId: string): Promise<{ success: boolean; error: string | undefined }> {
    try {
      // Check if notifications are enabled
      if (!DEFAULT_NOTIFICATION_CONFIG.enabled) {
        console.log('Settlement notifications are disabled')
        return { success: true, error: undefined }
      }

      // Get allocation details
      const { data: allocation, error: allocationError } = await (await this.supabase)
        .from('auction_settlement_dashboard')
        .select('*')
        .eq('allocation_id', allocationId)
        .single()

      if (allocationError || !allocation) {
        return { success: false, error: `Allocation not found: ${allocationError?.message}` }
      }

      // Get company owner details
      const { data: company, error: companyError } = await (await this.supabase)
        .from('companies')
        .select('created_by')
        .eq('id', allocation.company_id)
        .single()

      if (companyError || !company) {
        return { success: false, error: `Company not found: ${companyError?.message}` }
      }

      // Get company owner profile
      const { data: ownerProfile, error: profileError } = await (await this.supabase)
        .from('profiles')
        .select('email, full_name')
        .eq('id', company.created_by)
        .single()

      if (profileError || !ownerProfile) {
        return { success: false, error: `Company owner profile not found: ${profileError?.message}` }
      }

      const notificationData: SettlementNotificationData = {
        auctionTitle: allocation.auction_title,
        companyName: allocation.company_name,
        clearingPrice: allocation.clearing_price,
        allocatedQuantity: allocation.allocated_quantity,
        totalAmount: allocation.total_amount,
        allocationId: allocation.allocation_id,
        settlementStatus: 'payment_received',
        settlementDate: allocation.settlement_date,
        paymentConfirmationDate: allocation.payment_confirmation_date,
        paymentReference: allocation.payment_reference,
        bidderEmail: allocation.bidder_email,
        companyOwnerEmail: ownerProfile.email,
        companyOwnerName: ownerProfile.full_name
      }

      const emailContent = generatePaymentConfirmationEmail(notificationData)
      
      const emailResult = await emailService.sendEmail({
        to: allocation.bidder_email,
        subject: emailContent.subject,
        html: emailContent.html
      })

      if (emailResult) {
        console.log(`✅ Payment confirmation sent to ${allocation.bidder_email}`)
        return { success: true, error: undefined }
      } else {
        return { success: false, error: 'Failed to send email' }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Error sending payment confirmation:', error)
      return { success: false, error: errorMessage }
    }
  }

  /**
   * Send settlement completion email to a bidder
   */
  async sendSettlementCompletion(allocationId: string): Promise<{ success: boolean; error: string | undefined }> {
    try {
      // Check if notifications are enabled
      if (!DEFAULT_NOTIFICATION_CONFIG.enabled) {
        console.log('Settlement notifications are disabled')
        return { success: true, error: undefined }
      }

      // Get allocation details
      const { data: allocation, error: allocationError } = await (await this.supabase)
        .from('auction_settlement_dashboard')
        .select('*')
        .eq('allocation_id', allocationId)
        .single()

      if (allocationError || !allocation) {
        return { success: false, error: `Allocation not found: ${allocationError?.message}` }
      }

      // Get company owner details
      const { data: company, error: companyError } = await (await this.supabase)
        .from('companies')
        .select('created_by')
        .eq('id', allocation.company_id)
        .single()

      if (companyError || !company) {
        return { success: false, error: `Company not found: ${companyError?.message}` }
      }

      // Get company owner profile
      const { data: ownerProfile, error: profileError } = await (await this.supabase)
        .from('profiles')
        .select('email, full_name')
        .eq('id', company.created_by)
        .single()

      if (profileError || !ownerProfile) {
        return { success: false, error: `Company owner profile not found: ${profileError?.message}` }
      }

      const notificationData: SettlementNotificationData = {
        auctionTitle: allocation.auction_title,
        companyName: allocation.company_name,
        clearingPrice: allocation.clearing_price,
        allocatedQuantity: allocation.allocated_quantity,
        totalAmount: allocation.total_amount,
        allocationId: allocation.allocation_id,
        settlementStatus: 'completed',
        settlementDate: allocation.settlement_date,
        paymentConfirmationDate: allocation.payment_confirmation_date,
        shareTransferDate: allocation.share_transfer_date,
        paymentReference: allocation.payment_reference,
        bidderEmail: allocation.bidder_email,
        companyOwnerEmail: ownerProfile.email,
        companyOwnerName: ownerProfile.full_name
      }

      const emailContent = generateSettlementCompletionEmail(notificationData)
      
      const emailResult = await emailService.sendEmail({
        to: allocation.bidder_email,
        subject: emailContent.subject,
        html: emailContent.html
      })

      if (emailResult) {
        console.log(`✅ Settlement completion sent to ${allocation.bidder_email}`)
        return { success: true, error: undefined }
      } else {
        return { success: false, error: 'Failed to send email' }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Error sending settlement completion:', error)
      return { success: false, error: errorMessage }
    }
  }

  /**
   * Send updated settlement summary to company owner
   */
  async sendSettlementSummary(auctionId: string): Promise<{ success: boolean; error: string | undefined }> {
    try {
      // Check if notifications are enabled
      if (!DEFAULT_NOTIFICATION_CONFIG.enabled) {
        console.log('Settlement notifications are disabled')
        return { success: true, error: undefined }
      }

      // Get settlement summary data
      const { data: summary, error: summaryError } = await (await this.supabase)
        .from('auction_settlement_summary')
        .select('*')
        .eq('auction_id', auctionId)
        .single()

      if (summaryError || !summary) {
        return { success: false, error: `Settlement summary not found: ${summaryError?.message}` }
      }

      // Get company owner details
      const { data: company, error: companyError } = await (await this.supabase)
        .from('companies')
        .select('created_by')
        .eq('id', summary.company_id)
        .single()

      if (companyError || !company) {
        return { success: false, error: `Company not found: ${companyError?.message}` }
      }

      // Get company owner profile
      const { data: ownerProfile, error: profileError } = await (await this.supabase)
        .from('profiles')
        .select('email, full_name')
        .eq('id', company.created_by)
        .single()

      if (profileError || !ownerProfile) {
        return { success: false, error: `Company owner profile not found: ${profileError?.message}` }
      }

      const summaryData: SettlementSummaryData = {
        auctionTitle: summary.auction_title,
        companyName: summary.company_name,
        totalAllocations: summary.total_successful_allocations,
        totalSettlementAmount: summary.total_settlement_amount,
        pendingPaymentCount: summary.pending_payment_count,
        paymentReceivedCount: summary.payment_received_count,
        sharesTransferredCount: summary.shares_transferred_count,
        completedCount: summary.completed_count,
        settlementCompletionPercentage: summary.settlement_completion_percentage,
        paymentCollectionPercentage: summary.payment_collection_percentage
      }

      const emailContent = generateSettlementSummaryEmail(summaryData)
      
      const emailResult = await emailService.sendEmail({
        to: ownerProfile.email,
        subject: emailContent.subject,
        html: emailContent.html
      })

      if (emailResult) {
        console.log(`✅ Settlement summary sent to company owner`)
        return { success: true, error: undefined }
      } else {
        return { success: false, error: 'Failed to send email' }
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Error sending settlement summary:', error)
      return { success: false, error: errorMessage }
    }
  }

  /**
   * Send all appropriate notifications for a settlement status change
   */
  async sendStatusChangeNotifications(allocationId: string, newStatus: string): Promise<{ success: boolean; error: string | undefined }> {
    try {
      let result = { success: true, error: undefined as string | undefined }

      switch (newStatus) {
        case 'payment_received':
          result = await this.sendPaymentConfirmation(allocationId)
          break
        
        case 'completed':
          result = await this.sendSettlementCompletion(allocationId)
          break
        
        default:
          console.log(`No automatic notifications configured for status: ${newStatus}`)
          break
      }

      return result

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      console.error('Error sending status change notifications:', error)
      return { success: false, error: errorMessage }
    }
  }
}

// Export singleton instance
export const settlementNotificationService = new SettlementNotificationService()
