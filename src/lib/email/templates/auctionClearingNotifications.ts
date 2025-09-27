/**
 * Email templates for auction clearing notifications
 * These templates are used to notify participants about clearing results
 */

export interface ClearingNotificationData {
  auction: {
    id: string
    title: string
    company_name: string
    clearing_price: number
    total_demand: number
    shares_count: number
  }
  allocation?: {
    original_quantity: number
    allocated_quantity: number
    total_amount: number
    allocation_type: 'full' | 'pro_rata' | 'rejected'
    pro_rata_percentage?: number
  }
  recipient: {
    email: string
    name?: string
  }
}

/**
 * Email template for successful bid allocation
 */
export function generateSuccessfulAllocationEmail(data: ClearingNotificationData): {
  subject: string
  html: string
  text: string
} {
  const { auction, allocation, recipient } = data
  
  if (!allocation || allocation.allocated_quantity === 0) {
    throw new Error('This template is for successful allocations only')
  }

  const subject = `🎉 Auction Results: You've been allocated ${allocation.allocated_quantity.toLocaleString()} shares`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Auction Results - Successful Allocation</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
    .success-badge { background: #28a745; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; font-weight: bold; margin-bottom: 20px; }
    .allocation-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #28a745; }
    .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
    .detail-label { font-weight: bold; color: #666; }
    .detail-value { color: #333; }
    .highlight { color: #28a745; font-weight: bold; font-size: 1.1em; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 0.9em; }
    .pro-rata-note { background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 6px; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎉 Congratulations!</h1>
    <p>Your bid was successful in the modified Dutch auction</p>
  </div>
  
  <div class="content">
    <div class="success-badge">✅ SUCCESSFUL ALLOCATION</div>
    
    <h2>Auction: ${auction.title}</h2>
    <p><strong>Company:</strong> ${auction.company_name}</p>
    
    <div class="allocation-details">
      <h3>Your Allocation Details</h3>
      
      <div class="detail-row">
        <span class="detail-label">Shares Requested:</span>
        <span class="detail-value">${allocation.original_quantity.toLocaleString()}</span>
      </div>
      
      <div class="detail-row">
        <span class="detail-label">Shares Allocated:</span>
        <span class="detail-value highlight">${allocation.allocated_quantity.toLocaleString()}</span>
      </div>
      
      <div class="detail-row">
        <span class="detail-label">Clearing Price:</span>
        <span class="detail-value highlight">$${auction.clearing_price.toFixed(2)}</span>
      </div>
      
      <div class="detail-row">
        <span class="detail-label">Total Amount:</span>
        <span class="detail-value highlight">$${allocation.total_amount.toLocaleString()}</span>
      </div>
      
      <div class="detail-row">
        <span class="detail-label">Allocation Type:</span>
        <span class="detail-value">${allocation.allocation_type === 'full' ? 'Full Allocation' : 'Pro-rata Allocation'}</span>
      </div>
    </div>
    
    ${allocation.allocation_type === 'pro_rata' && allocation.pro_rata_percentage ? `
    <div class="pro-rata-note">
      <strong>Pro-rata Allocation:</strong> Due to high demand at the clearing price, shares were allocated proportionally. 
      You received ${(allocation.pro_rata_percentage * 100).toFixed(2)}% of your requested quantity.
    </div>
    ` : ''}
    
    <h3>Auction Summary</h3>
    <div class="allocation-details">
      <div class="detail-row">
        <span class="detail-label">Total Shares Available:</span>
        <span class="detail-value">${auction.shares_count.toLocaleString()}</span>
      </div>
      
      <div class="detail-row">
        <span class="detail-label">Total Demand:</span>
        <span class="detail-value">${auction.total_demand.toLocaleString()}</span>
      </div>
      
      <div class="detail-row">
        <span class="detail-label">Demand Ratio:</span>
        <span class="detail-value">${((auction.total_demand / auction.shares_count) * 100).toFixed(1)}%</span>
      </div>
    </div>
    
    <p><strong>What happens next?</strong></p>
    <ul>
      <li>You will receive further instructions about payment and share transfer</li>
      <li>All winning bidders pay the same uniform clearing price of $${auction.clearing_price.toFixed(2)}</li>
      <li>The company will contact you regarding the next steps</li>
    </ul>
  </div>
  
  <div class="footer">
    <p>This is an automated notification from FairStock.</p>
    <p>If you have any questions, please contact the company directly.</p>
  </div>
</body>
</html>
  `

  const text = `
🎉 CONGRATULATIONS! Your bid was successful!

Auction: ${auction.title}
Company: ${auction.company_name}

YOUR ALLOCATION:
- Shares Requested: ${allocation.original_quantity.toLocaleString()}
- Shares Allocated: ${allocation.allocated_quantity.toLocaleString()}
- Clearing Price: $${auction.clearing_price.toFixed(2)}
- Total Amount: $${allocation.total_amount.toLocaleString()}
- Allocation Type: ${allocation.allocation_type === 'full' ? 'Full Allocation' : 'Pro-rata Allocation'}

${allocation.allocation_type === 'pro_rata' && allocation.pro_rata_percentage ? 
`Pro-rata Allocation: Due to high demand, you received ${(allocation.pro_rata_percentage * 100).toFixed(2)}% of your requested quantity.` : ''}

AUCTION SUMMARY:
- Total Shares Available: ${auction.shares_count.toLocaleString()}
- Total Demand: ${auction.total_demand.toLocaleString()}
- Demand Ratio: ${((auction.total_demand / auction.shares_count) * 100).toFixed(1)}%

What happens next?
- You will receive further instructions about payment and share transfer
- All winning bidders pay the same uniform clearing price of $${auction.clearing_price.toFixed(2)}
- The company will contact you regarding the next steps

This is an automated notification from FairStock.
  `

  return { subject, html, text }
}

/**
 * Email template for rejected bid
 */
export function generateRejectedBidEmail(data: ClearingNotificationData): {
  subject: string
  html: string
  text: string
} {
  const { auction, allocation, recipient } = data
  
  if (!allocation || allocation.allocated_quantity > 0) {
    throw new Error('This template is for rejected bids only')
  }

  const subject = `Auction Results: ${auction.title} - Bid Not Successful`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Auction Results - Bid Not Successful</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
    .rejected-badge { background: #dc3545; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; font-weight: bold; margin-bottom: 20px; }
    .allocation-details { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #dc3545; }
    .detail-row { display: flex; justify-content: space-between; margin: 10px 0; padding: 8px 0; border-bottom: 1px solid #eee; }
    .detail-label { font-weight: bold; color: #666; }
    .detail-value { color: #333; }
    .highlight { color: #dc3545; font-weight: bold; font-size: 1.1em; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 0.9em; }
    .info-note { background: #d1ecf1; border: 1px solid #bee5eb; padding: 15px; border-radius: 6px; margin: 15px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Auction Results</h1>
    <p>Thank you for participating in the modified Dutch auction</p>
  </div>
  
  <div class="content">
    <div class="rejected-badge">❌ BID NOT SUCCESSFUL</div>
    
    <h2>Auction: ${auction.title}</h2>
    <p><strong>Company:</strong> ${auction.company_name}</p>
    
    <div class="allocation-details">
      <h3>Your Bid Details</h3>
      
      <div class="detail-row">
        <span class="detail-label">Shares Requested:</span>
        <span class="detail-value">${allocation.original_quantity.toLocaleString()}</span>
      </div>
      
      <div class="detail-row">
        <span class="detail-label">Shares Allocated:</span>
        <span class="detail-value highlight">0</span>
      </div>
      
      <div class="detail-row">
        <span class="detail-label">Clearing Price:</span>
        <span class="detail-value">$${auction.clearing_price.toFixed(2)}</span>
      </div>
    </div>
    
    <div class="info-note">
      <strong>Why wasn't my bid successful?</strong><br>
      Your bid was below the clearing price of $${auction.clearing_price.toFixed(2)}. In a modified Dutch auction, 
      only bids at or above the clearing price are successful. The clearing price is determined by the point 
      where supply meets demand.
    </div>
    
    <h3>Auction Summary</h3>
    <div class="allocation-details">
      <div class="detail-row">
        <span class="detail-label">Total Shares Available:</span>
        <span class="detail-value">${auction.shares_count.toLocaleString()}</span>
      </div>
      
      <div class="detail-row">
        <span class="detail-label">Total Demand:</span>
        <span class="detail-value">${auction.total_demand.toLocaleString()}</span>
      </div>
      
      <div class="detail-row">
        <span class="detail-label">Demand Ratio:</span>
        <span class="detail-value">${((auction.total_demand / auction.shares_count) * 100).toFixed(1)}%</span>
      </div>
    </div>
    
    <p><strong>Thank you for participating!</strong></p>
    <p>We appreciate your interest in ${auction.company_name}. Keep an eye out for future opportunities to invest in exciting companies through FairStock.</p>
  </div>
  
  <div class="footer">
    <p>This is an automated notification from FairStock.</p>
    <p>If you have any questions, please contact support.</p>
  </div>
</body>
</html>
  `

  const text = `
AUCTION RESULTS - Bid Not Successful

Auction: ${auction.title}
Company: ${auction.company_name}

YOUR BID:
- Shares Requested: ${allocation.original_quantity.toLocaleString()}
- Shares Allocated: 0
- Clearing Price: $${auction.clearing_price.toFixed(2)}

Why wasn't my bid successful?
Your bid was below the clearing price of $${auction.clearing_price.toFixed(2)}. In a modified Dutch auction, only bids at or above the clearing price are successful.

AUCTION SUMMARY:
- Total Shares Available: ${auction.shares_count.toLocaleString()}
- Total Demand: ${auction.total_demand.toLocaleString()}
- Demand Ratio: ${((auction.total_demand / auction.shares_count) * 100).toFixed(1)}%

Thank you for participating! We appreciate your interest in ${auction.company_name}.

This is an automated notification from FairStock.
  `

  return { subject, html, text }
}

/**
 * Email template for company owners about clearing completion
 */
export function generateCompanyClearingNotificationEmail(data: {
  auction: ClearingNotificationData['auction']
  results: {
    successful_bidders: number
    rejected_bidders: number
    total_revenue: number
    shares_allocated: number
    pro_rata_applied: boolean
  }
  recipient: {
    email: string
    name?: string
  }
}): {
  subject: string
  html: string
  text: string
} {
  const { auction, results, recipient } = data

  const subject = `Auction Completed: ${auction.title} - Clearing Results Available`

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Auction Clearing Complete</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }
    .success-badge { background: #28a745; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; font-weight: bold; margin-bottom: 20px; }
    .results-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
    .result-card { background: white; padding: 20px; border-radius: 8px; text-align: center; border-left: 4px solid #28a745; }
    .result-number { font-size: 2em; font-weight: bold; color: #28a745; }
    .result-label { color: #666; font-size: 0.9em; }
    .footer { text-align: center; margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 0.9em; }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎉 Auction Completed!</h1>
    <p>Your modified Dutch auction has been successfully cleared</p>
  </div>
  
  <div class="content">
    <div class="success-badge">✅ CLEARING COMPLETE</div>
    
    <h2>${auction.title}</h2>
    <p><strong>Company:</strong> ${auction.company_name}</p>
    
    <div class="results-grid">
      <div class="result-card">
        <div class="result-number">$${auction.clearing_price.toFixed(2)}</div>
        <div class="result-label">Clearing Price</div>
      </div>
      
      <div class="result-card">
        <div class="result-number">$${results.total_revenue.toLocaleString()}</div>
        <div class="result-label">Total Revenue</div>
      </div>
      
      <div class="result-card">
        <div class="result-number">${results.successful_bidders}</div>
        <div class="result-label">Successful Bidders</div>
      </div>
      
      <div class="result-card">
        <div class="result-number">${results.shares_allocated.toLocaleString()}</div>
        <div class="result-label">Shares Allocated</div>
      </div>
    </div>
    
    <h3>Summary</h3>
    <ul>
      <li><strong>Total Bidders:</strong> ${results.successful_bidders + results.rejected_bidders}</li>
      <li><strong>Successful Bidders:</strong> ${results.successful_bidders}</li>
      <li><strong>Rejected Bidders:</strong> ${results.rejected_bidders}</li>
      <li><strong>Shares Allocated:</strong> ${results.shares_allocated.toLocaleString()} of ${auction.shares_count.toLocaleString()}</li>
      <li><strong>Pro-rata Applied:</strong> ${results.pro_rata_applied ? 'Yes' : 'No'}</li>
      <li><strong>Demand Ratio:</strong> ${((auction.total_demand / auction.shares_count) * 100).toFixed(1)}%</li>
    </ul>
    
    <p><strong>Next Steps:</strong></p>
    <ul>
      <li>All participants have been notified of their results</li>
      <li>Successful bidders will receive payment and transfer instructions</li>
      <li>You can view detailed results in your FairStock dashboard</li>
    </ul>
  </div>
  
  <div class="footer">
    <p>This is an automated notification from FairStock.</p>
    <p>Log in to your dashboard to view detailed results and manage next steps.</p>
  </div>
</body>
</html>
  `

  const text = `
🎉 AUCTION COMPLETED!

Your modified Dutch auction has been successfully cleared.

Auction: ${auction.title}
Company: ${auction.company_name}

RESULTS SUMMARY:
- Clearing Price: $${auction.clearing_price.toFixed(2)}
- Total Revenue: $${results.total_revenue.toLocaleString()}
- Successful Bidders: ${results.successful_bidders}
- Shares Allocated: ${results.shares_allocated.toLocaleString()} of ${auction.shares_count.toLocaleString()}
- Pro-rata Applied: ${results.pro_rata_applied ? 'Yes' : 'No'}
- Demand Ratio: ${((auction.total_demand / auction.shares_count) * 100).toFixed(1)}%

Next Steps:
- All participants have been notified of their results
- Successful bidders will receive payment and transfer instructions
- You can view detailed results in your FairStock dashboard

This is an automated notification from FairStock.
  `

  return { subject, html, text }
}
