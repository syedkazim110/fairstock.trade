import { createClient } from '@/lib/supabase/server'
import { emailService } from './emailService'
import { 
  generateMemberAddedEmail, 
  generateMemberUpdatedEmail, 
  generateMemberRemovedEmail,
  type MemberData,
  type CompanyData
} from './templates/capTableNotifications'

export class CapTableNotificationService {
  
  /**
   * Get all company members' emails for notifications
   */
  private async getCompanyMemberEmails(companyId: string): Promise<string[]> {
    try {
      const supabase = await createClient()
      
      const { data: members, error } = await supabase
        .from('company_members')
        .select('email')
        .eq('company_id', companyId)
      
      if (error) {
        console.error('Error fetching company members for notifications:', error)
        return []
      }
      
      return members?.map(member => member.email) || []
    } catch (error) {
      console.error('Error in getCompanyMemberEmails:', error)
      return []
    }
  }

  /**
   * Get company information
   */
  private async getCompanyInfo(companyId: string): Promise<CompanyData | null> {
    try {
      const supabase = await createClient()
      
      const { data: company, error } = await supabase
        .from('companies')
        .select('id, name')
        .eq('id', companyId)
        .single()
      
      if (error) {
        console.error('Error fetching company info:', error)
        return null
      }
      
      return company
    } catch (error) {
      console.error('Error in getCompanyInfo:', error)
      return null
    }
  }

  /**
   * Get user's full name from profile
   */
  private async getUserName(userId: string): Promise<string> {
    try {
      const supabase = await createClient()
      
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', userId)
        .single()
      
      if (error || !profile) {
        console.error('Error fetching user profile:', error)
        return 'Unknown User'
      }
      
      return profile.full_name || profile.email || 'Unknown User'
    } catch (error) {
      console.error('Error in getUserName:', error)
      return 'Unknown User'
    }
  }

  /**
   * Get member shareholding information
   */
  private async getMemberShareholding(companyId: string, memberEmail: string): Promise<{shares_owned?: number, share_percentage?: number}> {
    try {
      const supabase = await createClient()
      
      const { data: shareholding, error } = await supabase
        .from('member_shareholdings')
        .select('shares_owned, share_percentage')
        .eq('company_id', companyId)
        .eq('member_email', memberEmail)
        .single()
      
      if (error || !shareholding) {
        return {}
      }
      
      return {
        shares_owned: shareholding.shares_owned,
        share_percentage: shareholding.share_percentage
      }
    } catch (error) {
      console.error('Error fetching member shareholding:', error)
      return {}
    }
  }

  /**
   * Send notification when a new member is added
   */
  async notifyMemberAdded(
    companyId: string, 
    newMember: { name: string; email: string; position: string },
    addedByUserId: string
  ): Promise<void> {
    try {
      // Get company info
      const company = await this.getCompanyInfo(companyId)
      if (!company) {
        console.error('Could not fetch company info for notifications')
        return
      }

      // Get all member emails (including the new member)
      const memberEmails = await this.getCompanyMemberEmails(companyId)
      if (memberEmails.length === 0) {
        console.log('No members found to notify')
        return
      }

      // Get who added the member
      const addedBy = await this.getUserName(addedByUserId)

      // Get shareholding info for the new member
      const shareholding = await this.getMemberShareholding(companyId, newMember.email)

      // Prepare member data with shareholding
      const memberData: MemberData = {
        ...newMember,
        ...shareholding
      }

      // Generate email content
      const emailHtml = generateMemberAddedEmail(memberData, company, addedBy)
      const subject = `New Member Added to ${company.name} Cap Table`

      // Send emails to all members
      await emailService.sendBulkEmail(memberEmails, subject, emailHtml)
      
      console.log(`Sent member added notifications to ${memberEmails.length} recipients`)
    } catch (error) {
      console.error('Error sending member added notifications:', error)
    }
  }

  /**
   * Send notification when a member is updated
   */
  async notifyMemberUpdated(
    companyId: string,
    updatedMember: { name: string; email: string; position: string },
    updatedByUserId: string,
    changes: string[] = []
  ): Promise<void> {
    try {
      // Get company info
      const company = await this.getCompanyInfo(companyId)
      if (!company) {
        console.error('Could not fetch company info for notifications')
        return
      }

      // Get all member emails
      const memberEmails = await this.getCompanyMemberEmails(companyId)
      if (memberEmails.length === 0) {
        console.log('No members found to notify')
        return
      }

      // Get who updated the member
      const updatedBy = await this.getUserName(updatedByUserId)

      // Get shareholding info for the updated member
      const shareholding = await this.getMemberShareholding(companyId, updatedMember.email)

      // Prepare member data with shareholding
      const memberData: MemberData = {
        ...updatedMember,
        ...shareholding
      }

      // Generate email content
      const emailHtml = generateMemberUpdatedEmail(memberData, company, updatedBy, changes)
      const subject = `Member Updated in ${company.name} Cap Table`

      // Send emails to all members
      await emailService.sendBulkEmail(memberEmails, subject, emailHtml)
      
      console.log(`Sent member updated notifications to ${memberEmails.length} recipients`)
    } catch (error) {
      console.error('Error sending member updated notifications:', error)
    }
  }

  /**
   * Send notification when a member is removed
   */
  async notifyMemberRemoved(
    companyId: string,
    removedMember: { name: string; email: string },
    removedByUserId: string
  ): Promise<void> {
    try {
      // Get company info
      const company = await this.getCompanyInfo(companyId)
      if (!company) {
        console.error('Could not fetch company info for notifications')
        return
      }

      // Get remaining member emails (excluding the removed member)
      const allMemberEmails = await this.getCompanyMemberEmails(companyId)
      const memberEmails = allMemberEmails.filter(email => email !== removedMember.email)
      
      if (memberEmails.length === 0) {
        console.log('No remaining members found to notify')
        return
      }

      // Get who removed the member
      const removedBy = await this.getUserName(removedByUserId)

      // Generate email content
      const emailHtml = generateMemberRemovedEmail(
        removedMember.name, 
        removedMember.email, 
        company, 
        removedBy
      )
      const subject = `Member Removed from ${company.name} Cap Table`

      // Send emails to remaining members
      await emailService.sendBulkEmail(memberEmails, subject, emailHtml)
      
      console.log(`Sent member removed notifications to ${memberEmails.length} recipients`)
    } catch (error) {
      console.error('Error sending member removed notifications:', error)
    }
  }
}

export const capTableNotificationService = new CapTableNotificationService()
