import nodemailer from 'nodemailer'

export interface EmailOptions {
  to: string | string[]
  subject: string
  html: string
  from?: string
}

class EmailService {
  private transporter: nodemailer.Transporter

  constructor() {
    // Configure for MailDev (default runs on localhost:1025)
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'localhost',
      port: parseInt(process.env.SMTP_PORT || '1025'),
      secure: false, // SMTP4Dev doesn't use SSL
      auth: process.env.NODE_ENV === 'production' ? {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      } : undefined, // No auth needed for SMTP4Dev
      tls: {
        rejectUnauthorized: false // Allow self-signed certificates for development
      }
    })
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    try {
      const mailOptions = {
        from: options.from || process.env.FROM_EMAIL || 'noreply@fairstock.trade',
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        html: options.html
      }

      const result = await this.transporter.sendMail(mailOptions)
      console.log('Email sent successfully:', result.messageId)
      return true
    } catch (error) {
      console.error('Failed to send email:', error)
      return false
    }
  }

  async sendBulkEmail(recipients: string[], subject: string, html: string): Promise<void> {
    const promises = recipients.map(email => 
      this.sendEmail({ to: email, subject, html })
    )
    
    try {
      await Promise.allSettled(promises)
    } catch (error) {
      console.error('Error in bulk email sending:', error)
    }
  }

  // Test connection to SMTP server
  async testConnection(): Promise<boolean> {
    try {
      await this.transporter.verify()
      console.log('SMTP connection verified successfully')
      return true
    } catch (error) {
      console.error('SMTP connection failed:', error)
      return false
    }
  }
}

export const emailService = new EmailService()
