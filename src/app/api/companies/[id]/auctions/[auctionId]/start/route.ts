import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { emailService } from '@/lib/email/emailService'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; auctionId: string } }
) {
  try {
    const supabase = await createClient()
    
    // Get the authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user owns the company
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', params.id)
      .eq('created_by', user.id)
      .single()

    if (companyError || !company) {
      return NextResponse.json({ error: 'Company not found or access denied' }, { status: 404 })
    }

    // Get the auction
    const { data: auction, error: auctionError } = await supabase
      .from('company_auctions')
      .select('*')
      .eq('id', params.auctionId)
      .eq('company_id', params.id)
      .single()

    if (auctionError || !auction) {
      return NextResponse.json({ error: 'Auction not found' }, { status: 404 })
    }

    // Check if auction is in draft status
    if (auction.status !== 'draft') {
      return NextResponse.json({ error: 'Auction can only be started from draft status' }, { status: 400 })
    }

    // Calculate start and end times
    const startTime = new Date()
    const endTime = new Date(startTime.getTime() + (auction.duration_hours * 60 * 60 * 1000))

    // Update auction status and times
    const { data: updatedAuction, error: updateError } = await supabase
      .from('company_auctions')
      .update({
        status: 'active',
        start_time: startTime.toISOString(),
        end_time: endTime.toISOString(),
        current_price: auction.max_price
      })
      .eq('id', params.auctionId)
      .select()
      .single()

    if (updateError) {
      console.error('Error starting auction:', updateError)
      return NextResponse.json({ error: 'Failed to start auction' }, { status: 500 })
    }

    // Send invitation emails to invited members
    if (auction.invited_members && auction.invited_members.length > 0) {
      try {
        await sendAuctionInvitations(auction, company.name, auction.invited_members)
      } catch (emailError) {
        console.error('Error sending invitation emails:', emailError)
        // Don't fail the auction start if emails fail
      }
    }

    return NextResponse.json({ auction: updatedAuction })
  } catch (error) {
    console.error('Error in POST /api/companies/[id]/auctions/[auctionId]/start:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

async function sendAuctionInvitations(auction: any, companyName: string, invitedEmails: string[]) {
  const subject = `Invitation: ${auction.title} - Dutch Auction`
  
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4F46E5;">You're Invited to Participate in a Dutch Auction</h2>
      
      <div style="background-color: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #1F2937;">${auction.title}</h3>
        <p><strong>Company:</strong> ${companyName}</p>
        <p><strong>Shares Available:</strong> ${auction.shares_count.toLocaleString()}</p>
        <p><strong>Starting Price:</strong> $${auction.max_price}</p>
        <p><strong>Minimum Price:</strong> $${auction.min_price}</p>
        <p><strong>Price Decreases:</strong> Every ${auction.decreasing_minutes} minutes</p>
        <p><strong>Duration:</strong> ${auction.duration_hours} hours</p>
      </div>
      
      <div style="background-color: #FEF3C7; border: 1px solid #F59E0B; padding: 15px; border-radius: 8px; margin: 20px 0;">
        <h4 style="margin-top: 0; color: #92400E;">Important Notice</h4>
        <p style="margin-bottom: 0; color: #92400E;">
          This is a private offering under SEC Rule 506(b). By participating, you confirm that you are an accredited investor 
          and have a pre-existing relationship with the company. This auction is not a public offering.
        </p>
      </div>
      
      <div style="margin: 30px 0;">
        <h4>How Dutch Auctions Work:</h4>
        <ol>
          <li>The auction starts at the maximum price of $${auction.max_price}</li>
          <li>Every ${auction.decreasing_minutes} minutes, the price decreases</li>
          <li>The first person to accept the current price wins the shares</li>
          <li>The auction ends when someone accepts or the minimum price is reached</li>
        </ol>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.NEXT_PUBLIC_APP_URL}/auction/${auction.id}" 
           style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
          View Auction Details
        </a>
      </div>
      
      <div style="border-top: 1px solid #E5E7EB; padding-top: 20px; margin-top: 30px; color: #6B7280; font-size: 14px;">
        <p>This email was sent because you were invited to participate in this private auction. 
           If you believe you received this email in error, please contact the company directly.</p>
        <p>FairStock Trading Platform</p>
      </div>
    </div>
  `

  // Send emails to all invited members
  for (const email of invitedEmails) {
    await emailService.sendEmail({
      to: email,
      subject,
      html
    })
  }
}
