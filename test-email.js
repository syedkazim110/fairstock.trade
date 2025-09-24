// Simple test script to verify email notifications work
// Run this with: node test-email.js

const nodemailer = require('nodemailer');

async function testEmailService() {
  console.log('Testing email service with SMTP4Dev...');
  
  // Configure for MailDev (runs on localhost:1025)
  const transporter = nodemailer.createTransport({
    host: 'localhost',
    port: 1025,
    secure: false, // MailDev doesn't use SSL
    tls: {
      rejectUnauthorized: false // Allow self-signed certificates for development
    }
  });

  try {
    // Test connection
    console.log('Testing SMTP connection...');
    await transporter.verify();
    console.log('✅ SMTP connection successful!');

    // Send test email
    console.log('Sending test email...');
    const result = await transporter.sendMail({
      from: 'noreply@fairstock.trade',
      to: 'test@example.com',
      subject: 'Test Email - FairStock Cap Table Notification',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <title>Test Email</title>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #4f46e5; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9fafb; }
            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Test Email</h1>
              <p>FairStock Cap Table Notification System</p>
            </div>
            <div class="content">
              <h2>Hello!</h2>
              <p>This is a test email to verify that the FairStock cap table notification system is working correctly.</p>
              <p>If you can see this email in SMTP4Dev, then the email service is configured properly!</p>
              <p><strong>Test Details:</strong></p>
              <ul>
                <li>Email Service: SMTP4Dev</li>
                <li>Host: localhost:25</li>
                <li>Time: ${new Date().toISOString()}</li>
              </ul>
            </div>
            <div class="footer">
              <p>FairStock Cap Table Management System</p>
              <p>This is a test email. Please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `
    });

    console.log('✅ Test email sent successfully!');
    console.log('Message ID:', result.messageId);
    console.log('\n📧 Check MailDev web interface at http://localhost:1080 to see the email');
    console.log('\nTo start MailDev if not running:');
    console.log('  npx maildev');
    
  } catch (error) {
    console.error('❌ Email test failed:', error.message);
    console.log('\n🔧 Troubleshooting:');
    console.log('1. Make sure SMTP4Dev is running: smtp4dev');
    console.log('2. Check that port 25 is available');
    console.log('3. SMTP4Dev web interface should be at http://localhost:5000');
  }
}

testEmailService();
