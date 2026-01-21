const sgMail = require('@sendgrid/mail');

class SendGridWebAPIService {
  constructor() {
    this.isInitialized = false;
    this.initialize();
  }

  initialize() {
    try {
      const apiKey = process.env.SENDGRID_API_KEY;
      
      if (!apiKey || apiKey === 'your_sendgrid_api_key_here') {
        console.log('❌ SendGrid Web API: API key not provided');
        return;
      }

      sgMail.setApiKey(apiKey);
      this.isInitialized = true;
      console.log('✅ SendGrid Web API initialized successfully');
      
      if (!process.env.EMAIL_FROM) {
        console.log('⚠️  EMAIL_FROM not set - emails may fail');
      } else {
        console.log('📧 Sender email:', process.env.EMAIL_FROM);
      }
      
    } catch (error) {
      console.error('❌ SendGrid Web API initialization failed:', error.message);
      this.isInitialized = false;
    }
  }

  async sendEmail({ to, subject, text, html }) {
    try {
      if (!this.isInitialized) {
        return { success: false, error: 'SendGrid Web API not initialized' };
      }

      const msg = {
        to: to,
        from: {
          email: process.env.EMAIL_FROM || 'noreply@bugtracker.com',
          name: 'Bug Tracker'
        },
        subject: subject,
        text: text,
        html: html || text
      };

      console.log(`📧 Sending email via SendGrid Web API to: ${to}`);
      const response = await sgMail.send(msg);
      
      console.log('✅ Email sent successfully via Web API');
      return { success: true, messageId: response[0].headers['x-message-id'] };
      
    } catch (error) {
      console.error('❌ SendGrid Web API send failed:', error.message);
      
      if (error.response) {
        console.error('Response body:', error.response.body);
        
        if (error.response.body.errors) {
          const errors = error.response.body.errors;
          for (const err of errors) {
            if (err.field === 'from.email') {
              console.error('❌ SENDER ERROR: Email address not verified in SendGrid');
              console.error('🔧 Fix: Verify sender email in SendGrid Dashboard');
              return { success: false, error: 'Sender email not verified' };
            }
          }
        }
      }
      
      return { success: false, error: error.message };
    }
  }

  async sendWelcomeEmail(user) {
    const subject = 'Welcome to Bug Tracker System';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome to Bug Tracker!</h2>
        <p>Hi ${user.name},</p>
        <p>Welcome to our Bug Tracking System! Your account has been successfully created.</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Account Details:</strong></p>
          <p>Email: ${user.email}</p>
          <p>Role: ${user.role}</p>
          <p>Created: ${new Date().toLocaleDateString()}</p>
        </div>
        <p>You can now start creating projects and tracking bugs!</p>
        <p>Best regards,<br>The Bug Tracker Team</p>
      </div>
    `;

    return await this.sendEmail({
      to: user.email,
      subject: subject,
      text: `Welcome to Bug Tracker! Your account has been created successfully.`,
      html: html
    });
  }

  async sendPasswordResetEmail(email, resetToken) {
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;
    
    const subject = 'Password Reset Request';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>You requested a password reset for your Bug Tracker account.</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p>Click the button below to reset your password:</p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${resetUrl}" 
               style="background-color: #007bff; color: white; padding: 12px 24px; 
                      text-decoration: none; border-radius: 5px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="font-size: 12px; color: #666;">
            This link will expire in 1 hour. If the button doesn't work, copy and paste this link:<br>
            ${resetUrl}
          </p>
        </div>
        <p>If you didn't request this reset, please ignore this email.</p>
        <p>Best regards,<br>The Bug Tracker Team</p>
      </div>
    `;

    return await this.sendEmail({
      to: email,
      subject: subject,
      text: `Password reset link: ${resetUrl}`,
      html: html
    });
  }

  async sendTestEmail(to) {
    const subject = 'Bug Tracker Email Test';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Email Service Test</h2>
        <p>This is a test email from your Bug Tracker application.</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Test Details:</strong></p>
          <p>Timestamp: ${new Date().toISOString()}</p>
          <p>Service: SendGrid Web API</p>
          <p>Environment: ${process.env.NODE_ENV}</p>
        </div>
        <p>✅ Email service is working correctly!</p>
      </div>
    `;

    return await this.sendEmail({
      to: to,
      subject: subject,
      text: 'Email service test - if you receive this, email is working!',
      html: html
    });
  }
}

module.exports = SendGridWebAPIService;