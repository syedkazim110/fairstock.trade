export interface MemberData {
  name: string
  email: string
  position: string
  shares_owned?: number
  share_percentage?: number
}

export interface CompanyData {
  name: string
  id: string
}

export const generateMemberAddedEmail = (
  member: MemberData,
  company: CompanyData,
  addedBy: string
): string => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>New Member Added - ${company.name}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4f46e5; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9fafb; }
        .member-info { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Cap Table Update</h1>
          <p>New Member Added</p>
        </div>
        <div class="content">
          <h2>Hello,</h2>
          <p>A new member has been added to the cap table for <strong>${company.name}</strong>.</p>
          
          <div class="member-info">
            <h3>New Member Details:</h3>
            <p><strong>Name:</strong> ${member.name}</p>
            <p><strong>Email:</strong> ${member.email}</p>
            <p><strong>Position:</strong> ${member.position}</p>
            ${member.shares_owned ? `<p><strong>Shares Owned:</strong> ${member.shares_owned.toLocaleString()}</p>` : ''}
            ${member.share_percentage ? `<p><strong>Share Percentage:</strong> ${member.share_percentage.toFixed(2)}%</p>` : ''}
          </div>
          
          <p><em>Added by: ${addedBy}</em></p>
          <p>This notification was sent to all company members.</p>
        </div>
        <div class="footer">
          <p>FairStock Cap Table Management System</p>
          <p>This is an automated notification. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `
}

export const generateMemberUpdatedEmail = (
  member: MemberData,
  company: CompanyData,
  updatedBy: string,
  changes: string[]
): string => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Member Updated - ${company.name}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #059669; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9fafb; }
        .member-info { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .changes { background-color: #fef3c7; padding: 10px; border-radius: 5px; margin: 10px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Cap Table Update</h1>
          <p>Member Information Updated</p>
        </div>
        <div class="content">
          <h2>Hello,</h2>
          <p>A member's information has been updated in the cap table for <strong>${company.name}</strong>.</p>
          
          <div class="member-info">
            <h3>Updated Member:</h3>
            <p><strong>Name:</strong> ${member.name}</p>
            <p><strong>Email:</strong> ${member.email}</p>
            <p><strong>Position:</strong> ${member.position}</p>
            ${member.shares_owned ? `<p><strong>Shares Owned:</strong> ${member.shares_owned.toLocaleString()}</p>` : ''}
            ${member.share_percentage ? `<p><strong>Share Percentage:</strong> ${member.share_percentage.toFixed(2)}%</p>` : ''}
          </div>
          
          ${changes.length > 0 ? `
          <div class="changes">
            <h4>Changes Made:</h4>
            <ul>
              ${changes.map(change => `<li>${change}</li>`).join('')}
            </ul>
          </div>
          ` : ''}
          
          <p><em>Updated by: ${updatedBy}</em></p>
          <p>This notification was sent to all company members.</p>
        </div>
        <div class="footer">
          <p>FairStock Cap Table Management System</p>
          <p>This is an automated notification. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `
}

export const generateMemberRemovedEmail = (
  memberName: string,
  memberEmail: string,
  company: CompanyData,
  removedBy: string
): string => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Member Removed - ${company.name}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #dc2626; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9fafb; }
        .member-info { background-color: white; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Cap Table Update</h1>
          <p>Member Removed</p>
        </div>
        <div class="content">
          <h2>Hello,</h2>
          <p>A member has been removed from the cap table for <strong>${company.name}</strong>.</p>
          
          <div class="member-info">
            <h3>Removed Member:</h3>
            <p><strong>Name:</strong> ${memberName}</p>
            <p><strong>Email:</strong> ${memberEmail}</p>
          </div>
          
          <p><em>Removed by: ${removedBy}</em></p>
          <p>This notification was sent to all remaining company members.</p>
        </div>
        <div class="footer">
          <p>FairStock Cap Table Management System</p>
          <p>This is an automated notification. Please do not reply to this email.</p>
        </div>
      </div>
    </body>
    </html>
  `
}
