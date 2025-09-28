// Settlement notification email templates
// These templates handle the post-clearing settlement workflow communications

export interface SettlementNotificationData {
  // Auction details
  auctionTitle: string
  companyName: string
  clearingPrice: number
  
  // Allocation details
  allocatedQuantity: number
  totalAmount: number
  allocationId: string
  
  // Settlement details
  settlementStatus: 'pending_payment' | 'payment_received' | 'shares_transferred' | 'completed'
  paymentReference?: string
  settlementDate?: string
  paymentConfirmationDate?: string
  shareTransferDate?: string
  
  // Recipient details
  bidderEmail: string
  bidderName?: string
  
  // Company details
  companyOwnerEmail: string
  companyOwnerName?: string
  
  // Wire transfer details (for payment instructions)
  wireAccountName?: string
  wireAccountNumber?: string
  wireRoutingNumber?: string
  wireBankName?: string
  wireBankAddress?: string
}

export interface SettlementSummaryData {
  auctionTitle: string
  companyName: string
  totalAllocations: number
  totalSettlementAmount: number
  pendingPaymentCount: number
  paymentReceivedCount: number
  sharesTransferredCount: number
  completedCount: number
  settlementCompletionPercentage: number
  paymentCollectionPercentage: number
}

// Payment instruction email for successful bidders
export const generatePaymentInstructionEmail = (data: SettlementNotificationData): { subject: string; html: string; text: string } => {
  const subject = `Payment Instructions - ${data.auctionTitle} Allocation`
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
        .allocation-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745; }
        .payment-instructions { background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .wire-details { background: white; padding: 20px; border-radius: 8px; margin: 15px 0; border: 1px solid #dee2e6; }
        .important-note { background: #f8d7da; border: 1px solid #f5c6cb; color: #721c24; padding: 15px; border-radius: 8px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #6c757d; font-size: 14px; }
        .amount { font-size: 24px; font-weight: bold; color: #28a745; }
        .reference-id { font-family: monospace; background: #e9ecef; padding: 5px 10px; border-radius: 4px; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        td { padding: 8px 12px; border-bottom: 1px solid #dee2e6; }
        .label { font-weight: bold; width: 40%; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🎉 Congratulations! Payment Instructions</h1>
        <p>Your bid was successful in the ${data.auctionTitle} auction</p>
      </div>
      
      <div class="content">
        <div class="allocation-details">
          <h2>Your Allocation Details</h2>
          <table>
            <tr>
              <td class="label">Company:</td>
              <td>${data.companyName}</td>
            </tr>
            <tr>
              <td class="label">Auction:</td>
              <td>${data.auctionTitle}</td>
            </tr>
            <tr>
              <td class="label">Shares Allocated:</td>
              <td><strong>${data.allocatedQuantity.toLocaleString()}</strong></td>
            </tr>
            <tr>
              <td class="label">Clearing Price:</td>
              <td><strong>$${data.clearingPrice.toFixed(2)}</strong> per share</td>
            </tr>
            <tr>
              <td class="label">Total Amount Due:</td>
              <td class="amount">$${data.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td class="label">Reference ID:</td>
              <td><span class="reference-id">${data.allocationId}</span></td>
            </tr>
          </table>
        </div>

        <div class="payment-instructions">
          <h2>💳 Payment Instructions</h2>
          <p><strong>Please complete your payment within 5 business days to secure your shares.</strong></p>
          
          ${data.wireAccountName ? `
          <div class="wire-details">
            <h3>Wire Transfer Details</h3>
            <table>
              <tr>
                <td class="label">Account Name:</td>
                <td>${data.wireAccountName}</td>
              </tr>
              <tr>
                <td class="label">Account Number:</td>
                <td><span class="reference-id">${data.wireAccountNumber}</span></td>
              </tr>
              <tr>
                <td class="label">Routing Number:</td>
                <td><span class="reference-id">${data.wireRoutingNumber}</span></td>
              </tr>
              <tr>
                <td class="label">Bank Name:</td>
                <td>${data.wireBankName}</td>
              </tr>
              ${data.wireBankAddress ? `
              <tr>
                <td class="label">Bank Address:</td>
                <td>${data.wireBankAddress}</td>
              </tr>
              ` : ''}
            </table>
          </div>
          ` : `
          <p>Wire transfer details will be provided separately by the company. Please contact ${data.companyOwnerEmail} for payment instructions.</p>
          `}
          
          <div class="important-note">
            <h4>⚠️ Important Payment Notes:</h4>
            <ul>
              <li><strong>Include Reference ID:</strong> Always include your allocation reference ID (${data.allocationId}) in the wire transfer memo/reference field</li>
              <li><strong>Exact Amount:</strong> Please send exactly $${data.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</li>
              <li><strong>Timeline:</strong> Payment must be received within 5 business days</li>
              <li><strong>Confirmation:</strong> You will receive a confirmation email once payment is received</li>
            </ul>
          </div>
        </div>

        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2>📋 Next Steps</h2>
          <ol>
            <li><strong>Complete Payment:</strong> Send wire transfer with the exact amount and reference ID</li>
            <li><strong>Payment Confirmation:</strong> Company will confirm receipt of payment</li>
            <li><strong>Share Transfer:</strong> Shares will be transferred to your cap table account</li>
            <li><strong>Settlement Complete:</strong> You'll receive final confirmation and documentation</li>
          </ol>
        </div>

        <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>📞 Questions or Issues?</h3>
          <p>If you have any questions about your allocation or payment process, please contact:</p>
          <p><strong>${data.companyOwnerEmail}</strong></p>
          <p>Please include your allocation reference ID: <span class="reference-id">${data.allocationId}</span></p>
        </div>
      </div>

      <div class="footer">
        <p>This is an automated notification from the FairStock auction platform.</p>
        <p>Settlement initiated on ${data.settlementDate ? new Date(data.settlementDate).toLocaleDateString() : 'N/A'}</p>
      </div>
    </body>
    </html>
  `

  const text = `
PAYMENT INSTRUCTIONS - ${data.auctionTitle}

Congratulations! Your bid was successful.

ALLOCATION DETAILS:
- Company: ${data.companyName}
- Auction: ${data.auctionTitle}
- Shares Allocated: ${data.allocatedQuantity.toLocaleString()}
- Clearing Price: $${data.clearingPrice.toFixed(2)} per share
- Total Amount Due: $${data.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
- Reference ID: ${data.allocationId}

PAYMENT INSTRUCTIONS:
Please complete payment within 5 business days.

${data.wireAccountName ? `
WIRE TRANSFER DETAILS:
- Account Name: ${data.wireAccountName}
- Account Number: ${data.wireAccountNumber}
- Routing Number: ${data.wireRoutingNumber}
- Bank Name: ${data.wireBankName}
${data.wireBankAddress ? `- Bank Address: ${data.wireBankAddress}` : ''}
` : `Wire transfer details will be provided by ${data.companyOwnerEmail}`}

IMPORTANT:
- Include Reference ID (${data.allocationId}) in wire transfer memo
- Send exactly $${data.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
- Payment must be received within 5 business days

NEXT STEPS:
1. Complete payment via wire transfer
2. Company confirms payment receipt
3. Shares transferred to your account
4. Settlement completion confirmation

Questions? Contact: ${data.companyOwnerEmail}
Reference ID: ${data.allocationId}
  `

  return { subject, html, text }
}

// Payment confirmation email for bidders
export const generatePaymentConfirmationEmail = (data: SettlementNotificationData): { subject: string; html: string; text: string } => {
  const subject = `Payment Confirmed - ${data.auctionTitle} Settlement`
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
        .confirmation-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745; }
        .next-steps { background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #6c757d; font-size: 14px; }
        .amount { font-size: 20px; font-weight: bold; color: #28a745; }
        .reference-id { font-family: monospace; background: #e9ecef; padding: 5px 10px; border-radius: 4px; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        td { padding: 8px 12px; border-bottom: 1px solid #dee2e6; }
        .label { font-weight: bold; width: 40%; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>✅ Payment Confirmed!</h1>
        <p>Your payment for ${data.auctionTitle} has been received</p>
      </div>
      
      <div class="content">
        <div class="confirmation-details">
          <h2>Payment Confirmation Details</h2>
          <table>
            <tr>
              <td class="label">Company:</td>
              <td>${data.companyName}</td>
            </tr>
            <tr>
              <td class="label">Auction:</td>
              <td>${data.auctionTitle}</td>
            </tr>
            <tr>
              <td class="label">Shares Allocated:</td>
              <td><strong>${data.allocatedQuantity.toLocaleString()}</strong></td>
            </tr>
            <tr>
              <td class="label">Amount Paid:</td>
              <td class="amount">$${data.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td class="label">Payment Confirmed:</td>
              <td><strong>${data.paymentConfirmationDate ? new Date(data.paymentConfirmationDate).toLocaleDateString() : 'Today'}</strong></td>
            </tr>
            ${data.paymentReference ? `
            <tr>
              <td class="label">Payment Reference:</td>
              <td><span class="reference-id">${data.paymentReference}</span></td>
            </tr>
            ` : ''}
            <tr>
              <td class="label">Allocation ID:</td>
              <td><span class="reference-id">${data.allocationId}</span></td>
            </tr>
          </table>
        </div>

        <div class="next-steps">
          <h2>🔄 Next Steps</h2>
          <p><strong>Your shares are now being processed for transfer to the cap table.</strong></p>
          <ol>
            <li>✅ <strong>Payment Received</strong> - Completed</li>
            <li>🔄 <strong>Share Transfer</strong> - In Progress</li>
            <li>⏳ <strong>Cap Table Update</strong> - Pending</li>
            <li>⏳ <strong>Final Confirmation</strong> - Pending</li>
          </ol>
          <p>You will receive another confirmation email once your shares have been transferred to the cap table.</p>
        </div>

        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>📄 What Happens Next?</h3>
          <ul>
            <li><strong>Automatic Processing:</strong> Your shares will be automatically transferred to the company's cap table</li>
            <li><strong>Ownership Update:</strong> Your shareholding percentage will be updated</li>
            <li><strong>Documentation:</strong> Transaction records will be created for audit purposes</li>
            <li><strong>Final Confirmation:</strong> You'll receive a final settlement completion email</li>
          </ul>
        </div>

        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #dee2e6;">
          <h3>📞 Questions?</h3>
          <p>If you have any questions about your settlement, please contact:</p>
          <p><strong>${data.companyOwnerEmail}</strong></p>
          <p>Reference your allocation ID: <span class="reference-id">${data.allocationId}</span></p>
        </div>
      </div>

      <div class="footer">
        <p>This is an automated notification from the FairStock auction platform.</p>
        <p>Payment confirmed on ${data.paymentConfirmationDate ? new Date(data.paymentConfirmationDate).toLocaleDateString() : new Date().toLocaleDateString()}</p>
      </div>
    </body>
    </html>
  `

  const text = `
PAYMENT CONFIRMED - ${data.auctionTitle}

Your payment has been received and confirmed.

CONFIRMATION DETAILS:
- Company: ${data.companyName}
- Auction: ${data.auctionTitle}
- Shares Allocated: ${data.allocatedQuantity.toLocaleString()}
- Amount Paid: $${data.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
- Payment Confirmed: ${data.paymentConfirmationDate ? new Date(data.paymentConfirmationDate).toLocaleDateString() : 'Today'}
${data.paymentReference ? `- Payment Reference: ${data.paymentReference}` : ''}
- Allocation ID: ${data.allocationId}

NEXT STEPS:
1. ✅ Payment Received - Completed
2. 🔄 Share Transfer - In Progress
3. ⏳ Cap Table Update - Pending
4. ⏳ Final Confirmation - Pending

Your shares are being processed for transfer to the cap table. You will receive another confirmation email once complete.

Questions? Contact: ${data.companyOwnerEmail}
Reference ID: ${data.allocationId}
  `

  return { subject, html, text }
}

// Settlement completion email for bidders
export const generateSettlementCompletionEmail = (data: SettlementNotificationData): { subject: string; html: string; text: string } => {
  const subject = `Settlement Complete - ${data.auctionTitle} Shares Transferred`
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #6f42c1 0%, #e83e8c 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
        .completion-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6f42c1; }
        .success-message { background: #d4edda; border: 1px solid #c3e6cb; color: #155724; padding: 20px; border-radius: 8px; margin: 20px 0; text-align: center; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #6c757d; font-size: 14px; }
        .amount { font-size: 20px; font-weight: bold; color: #6f42c1; }
        .reference-id { font-family: monospace; background: #e9ecef; padding: 5px 10px; border-radius: 4px; }
        table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        td { padding: 8px 12px; border-bottom: 1px solid #dee2e6; }
        .label { font-weight: bold; width: 40%; }
        .timeline { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
        .timeline-item { display: flex; align-items: center; margin: 10px 0; }
        .timeline-icon { width: 20px; height: 20px; border-radius: 50%; background: #28a745; color: white; text-align: center; line-height: 20px; margin-right: 15px; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🎊 Settlement Complete!</h1>
        <p>Your ${data.auctionTitle} shares have been successfully transferred</p>
      </div>
      
      <div class="content">
        <div class="success-message">
          <h2>🎉 Congratulations!</h2>
          <p><strong>Your auction settlement is now complete. You are officially a shareholder!</strong></p>
        </div>

        <div class="completion-details">
          <h2>Final Settlement Details</h2>
          <table>
            <tr>
              <td class="label">Company:</td>
              <td>${data.companyName}</td>
            </tr>
            <tr>
              <td class="label">Auction:</td>
              <td>${data.auctionTitle}</td>
            </tr>
            <tr>
              <td class="label">Shares Owned:</td>
              <td class="amount">${data.allocatedQuantity.toLocaleString()} shares</td>
            </tr>
            <tr>
              <td class="label">Purchase Price:</td>
              <td><strong>$${data.clearingPrice.toFixed(2)}</strong> per share</td>
            </tr>
            <tr>
              <td class="label">Total Investment:</td>
              <td class="amount">$${data.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
            </tr>
            <tr>
              <td class="label">Settlement Completed:</td>
              <td><strong>${data.shareTransferDate ? new Date(data.shareTransferDate).toLocaleDateString() : 'Today'}</strong></td>
            </tr>
            <tr>
              <td class="label">Transaction ID:</td>
              <td><span class="reference-id">${data.allocationId}</span></td>
            </tr>
          </table>
        </div>

        <div class="timeline">
          <h2>📅 Settlement Timeline</h2>
          <div class="timeline-item">
            <div class="timeline-icon">✓</div>
            <div>
              <strong>Settlement Initiated:</strong> ${data.settlementDate ? new Date(data.settlementDate).toLocaleDateString() : 'N/A'}
            </div>
          </div>
          <div class="timeline-item">
            <div class="timeline-icon">✓</div>
            <div>
              <strong>Payment Confirmed:</strong> ${data.paymentConfirmationDate ? new Date(data.paymentConfirmationDate).toLocaleDateString() : 'N/A'}
            </div>
          </div>
          <div class="timeline-item">
            <div class="timeline-icon">✓</div>
            <div>
              <strong>Shares Transferred:</strong> ${data.shareTransferDate ? new Date(data.shareTransferDate).toLocaleDateString() : 'Today'}
            </div>
          </div>
          <div class="timeline-item">
            <div class="timeline-icon">✓</div>
            <div>
              <strong>Settlement Complete:</strong> Today
            </div>
          </div>
        </div>

        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2>📋 What This Means</h2>
          <ul>
            <li><strong>Official Shareholder:</strong> You are now an official shareholder of ${data.companyName}</li>
            <li><strong>Cap Table Updated:</strong> Your ownership has been recorded in the company's cap table</li>
            <li><strong>Voting Rights:</strong> You may be entitled to voting rights (check company bylaws)</li>
            <li><strong>Future Communications:</strong> You'll receive shareholder updates and notices</li>
            <li><strong>Transaction Records:</strong> All transaction details have been recorded for tax purposes</li>
          </ul>
        </div>

        <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>📄 Important Notes</h3>
          <ul>
            <li><strong>Tax Implications:</strong> Please consult your tax advisor regarding this investment</li>
            <li><strong>Documentation:</strong> Keep this email for your records</li>
            <li><strong>Shareholder Rights:</strong> Review the company's articles of incorporation and bylaws</li>
            <li><strong>Future Transactions:</strong> Any future share transfers will require company approval</li>
          </ul>
        </div>

        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0; border: 1px solid #dee2e6;">
          <h3>📞 Ongoing Support</h3>
          <p>For any questions about your shareholding or company matters, please contact:</p>
          <p><strong>${data.companyOwnerEmail}</strong></p>
          <p>Transaction Reference: <span class="reference-id">${data.allocationId}</span></p>
        </div>
      </div>

      <div class="footer">
        <p>This is an automated notification from the FairStock auction platform.</p>
        <p>Settlement completed on ${data.shareTransferDate ? new Date(data.shareTransferDate).toLocaleDateString() : new Date().toLocaleDateString()}</p>
        <p>Welcome to ${data.companyName}! 🎉</p>
      </div>
    </body>
    </html>
  `

  const text = `
SETTLEMENT COMPLETE - ${data.auctionTitle}

Congratulations! Your auction settlement is complete and you are now an official shareholder.

FINAL SETTLEMENT DETAILS:
- Company: ${data.companyName}
- Auction: ${data.auctionTitle}
- Shares Owned: ${data.allocatedQuantity.toLocaleString()} shares
- Purchase Price: $${data.clearingPrice.toFixed(2)} per share
- Total Investment: $${data.totalAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
- Settlement Completed: ${data.shareTransferDate ? new Date(data.shareTransferDate).toLocaleDateString() : 'Today'}
- Transaction ID: ${data.allocationId}

SETTLEMENT TIMELINE:
✓ Settlement Initiated: ${data.settlementDate ? new Date(data.settlementDate).toLocaleDateString() : 'N/A'}
✓ Payment Confirmed: ${data.paymentConfirmationDate ? new Date(data.paymentConfirmationDate).toLocaleDateString() : 'N/A'}
✓ Shares Transferred: ${data.shareTransferDate ? new Date(data.shareTransferDate).toLocaleDateString() : 'Today'}
✓ Settlement Complete: Today

WHAT THIS MEANS:
- You are now an official shareholder of ${data.companyName}
- Your ownership has been recorded in the company's cap table
- You may be entitled to voting rights (check company bylaws)
- You'll receive shareholder updates and notices
- All transaction details have been recorded for tax purposes

IMPORTANT NOTES:
- Consult your tax advisor regarding this investment
- Keep this email for your records
- Review the company's articles of incorporation and bylaws
- Future share transfers will require company approval

Questions? Contact: ${data.companyOwnerEmail}
Transaction Reference: ${data.allocationId}

Welcome to ${data.companyName}! 🎉
  `

  return { subject, html, text }
}

// Settlement summary email for company owners
export const generateSettlementSummaryEmail = (data: SettlementSummaryData): { subject: string; html: string; text: string } => {
  const subject = `Settlement Summary - ${data.auctionTitle}`
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${subject}</title>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #495057 0%, #6c757d 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
        .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
        .summary-card { background: white; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #007bff; }
        .summary-card.completed { border-left-color: #28a745; }
        .summary-card.pending { border-left-color: #ffc107; }
        .summary-card.revenue { border-left-color: #17a2b8; }
        .metric-value { font-size: 24px; font-weight: bold; color: #495057; }
        .metric-label { font-size: 14px; color: #6c757d; margin-top: 5px; }
        .progress-bar { background: #e9ecef; height: 20px; border-radius: 10px; margin: 10px 0; overflow: hidden; }
        .progress-fill { height: 100%; background: linear-gradient(90deg, #28a745, #20c997); transition: width 0.3s ease; }
        .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #dee2e6; color: #6c757d; font-size: 14px; }
        @media (max-width: 600px) { .summary-grid { grid-template-columns: 1fr; } }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>📊 Settlement Summary</h1>
        <p>Settlement progress for ${data.auctionTitle}</p>
      </div>
      
      <div class="content">
        <div class="summary-grid">
          <div class="summary-card completed">
            <div class="metric-value">${data.completedCount}</div>
            <div class="metric-label">Completed Settlements</div>
          </div>
          <div class="summary-card pending">
            <div class="metric-value">${data.pendingPaymentCount}</div>
            <div class="metric-label">Pending Payments</div>
          </div>
          <div class="summary-card revenue">
            <div class="metric-value">$${data.totalSettlementAmount.toLocaleString()}</div>
            <div class="metric-label">Total Settlement Amount</div>
          </div>
          <div class="summary-card">
            <div class="metric-value">${data.totalAllocations}</div>
            <div class="metric-label">Total Allocations</div>
          </div>
        </div>

        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2>Settlement Progress</h2>
          <div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
              <span>Overall Completion</span>
              <span><strong>${data.settlementCompletionPercentage}%</strong></span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${data.settlementCompletionPercentage}%;"></div>
            </div>
          </div>
          <div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
              <span>Payment Collection</span>
              <span><strong>${data.paymentCollectionPercentage}%</strong></span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${data.paymentCollectionPercentage}%;"></div>
            </div>
          </div>
        </div>

        <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h2>Settlement Breakdown</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <tr style="border-bottom: 2px solid #dee2e6;">
              <td style="padding: 10px; font-weight: bold;">Status</td>
              <td style="padding: 10px; font-weight: bold; text-align: center;">Count</td>
              <td style="padding: 10px; font-weight: bold; text-align: right;">Percentage</td>
            </tr>
            <tr>
              <td style="padding: 8px;">✅ Completed</td>
              <td style="padding: 8px; text-align: center;">${data.completedCount}</td>
              <td style="padding: 8px; text-align: right;">${Math.round((data.completedCount / data.totalAllocations) * 100)}%</td>
            </tr>
            <tr>
              <td style="padding: 8px;">🔄 Shares Transferred</td>
              <td style="padding: 8px; text-align: center;">${data.sharesTransferredCount}</td>
              <td style="padding: 8px; text-align: right;">${Math.round((data.sharesTransferredCount / data.totalAllocations) * 100)}%</td>
            </tr>
            <tr>
              <td style="padding: 8px;">💰 Payment Received</td>
              <td style="padding: 8px; text-align: center;">${data.paymentReceivedCount}</td>
              <td style="padding: 8px; text-align: right;">${Math.round((data.paymentReceivedCount / data.totalAllocations) * 100)}%</td>
            </tr>
            <tr>
              <td style="padding: 8px;">⏳ Pending Payment</td>
              <td style="padding: 8px; text-align: center;">${data.pendingPaymentCount}</td>
              <td style="padding: 8px; text-align: right;">${Math.round((data.pendingPaymentCount / data.totalAllocations) * 100)}%</td>
            </tr>
          </table>
        </div>

        <div style="background: #e3f2fd; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3>📋 Next Actions</h3>
          ${data.pendingPaymentCount > 0 ? `
          <p><strong>Pending Payments (${data.pendingPaymentCount}):</strong> Follow up with bidders who haven't completed payment yet.</p>
          ` : ''}
          ${data.paymentReceivedCount > 0 ? `
          <p><strong>Ready for Share Transfer (${data.paymentReceivedCount}):</strong> Process share transfers to cap table.</p>
          ` : ''}
          ${data.sharesTransferredCount > 0 ? `
          <p><strong>Ready for Completion (${data.sharesTransferredCount}):</strong> Mark settlements as completed.</p>
          ` : ''}
          ${data.completedCount === data.totalAllocations ? `
          <p><strong>🎉 All settlements completed!</strong> Your auction settlement process is finished.</p>
          ` : ''}
        </div>
      </div>

      <div class="footer">
        <p>This is an automated settlement summary from the FairStock auction platform.</p>
        <p>Company: ${data.companyName}</p>
      </div>
    </body>
    </html>
  `

  const text = `
SETTLEMENT SUMMARY - ${data.auctionTitle}

Company: ${data.companyName}

SETTLEMENT OVERVIEW:
- Total Allocations: ${data.totalAllocations}
- Total Settlement Amount: $${data.totalSettlementAmount.toLocaleString()}
- Overall Completion: ${data.settlementCompletionPercentage}%
- Payment Collection: ${data.paymentCollectionPercentage}%

SETTLEMENT BREAKDOWN:
- ✅ Completed: ${data.completedCount} (${Math.round((data.completedCount / data.totalAllocations) * 100)}%)
- 🔄 Shares Transferred: ${data.sharesTransferredCount} (${Math.round((data.sharesTransferredCount / data.totalAllocations) * 100)}%)
- 💰 Payment Received: ${data.paymentReceivedCount} (${Math.round((data.paymentReceivedCount / data.totalAllocations) * 100)}%)
- ⏳ Pending Payment: ${data.pendingPaymentCount} (${Math.round((data.pendingPaymentCount / data.totalAllocations) * 100)}%)

NEXT ACTIONS:
${data.pendingPaymentCount > 0 ? `- Follow up with ${data.pendingPaymentCount} bidders for pending payments` : ''}
${data.paymentReceivedCount > 0 ? `- Process ${data.paymentReceivedCount} share transfers to cap table` : ''}
${data.sharesTransferredCount > 0 ? `- Complete ${data.sharesTransferredCount} final settlements` : ''}
${data.completedCount === data.totalAllocations ? '- 🎉 All settlements completed!' : ''}

This is an automated settlement summary from FairStock.
  `

  return { subject, html, text }
}
