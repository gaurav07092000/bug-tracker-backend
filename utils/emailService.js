const nodemailer = require('nodemailer');
const SendGridWebAPIService = require('./sendgridWebAPI');

// Email service utility using SendGrid Web API (primary) with SMTP fallback
class EmailService {
  constructor() {
    this.transporter = null;
    this.webApiService = null;
    // Use Web API by default in production or when explicitly enabled
    this.useWebAPI = process.env.USE_SENDGRID_WEB_API === 'true' || 
                     process.env.NODE_ENV === 'production';
    this.initialize();
  }

  // Initialize email services (Web API primary, SMTP fallback)
  initialize() {
    try {
      const sendgridApiKey = process.env.SENDGRID_API_KEY;
      
      if (!sendgridApiKey || sendgridApiKey === 'your_sendgrid_api_key_here') {
        console.log('❌ SENDGRID_API_KEY not configured');
        return;
      }

      // PRIORITY 1: Initialize Web API service (recommended for production)
      try {
        this.webApiService = new SendGridWebAPIService();
        console.log('✅ SendGrid Web API service initialized (primary)');
      } catch (error) {
        console.error('❌ Web API service initialization failed:', error.message);
      }

      // PRIORITY 2: Initialize SMTP as fallback (for development/backup)
      if (!this.useWebAPI || process.env.NODE_ENV === 'development') {
        console.log('🔧 Initializing SMTP as fallback...');
        this.transporter = nodemailer.createTransport({
          host: process.env.EMAIL_HOST || 'smtp.sendgrid.net',
          port: parseInt(process.env.EMAIL_PORT || '587'),
          secure: false, // Use STARTTLS
          auth: {
            user: process.env.EMAIL_USER || 'apikey',
            pass: sendgridApiKey
          },
          // Production-specific settings
          connectionTimeout: 30000, // 30 seconds (reduced for faster fallback)
          greetingTimeout: 15000,   // 15 seconds
          socketTimeout: 30000,     // 30 seconds
          debug: process.env.NODE_ENV === 'development',
          logger: process.env.NODE_ENV === 'development',
          // Required for some hosting providers
          requireTLS: true,
          tls: {
            rejectUnauthorized: process.env.NODE_ENV === 'production'
          }
        });
        console.log('✅ SMTP transporter created (fallback)');
      } else {
        console.log('ℹ️  SMTP disabled in production (Web API only)');
      }

      // Verify services
      if (process.env.NODE_ENV === 'production') {
        // Non-blocking verification for production
        setImmediate(() => this.verifyServices());
      } else {
        // Blocking verification for development
        this.verifyServices();
      }
    } catch (error) {
      console.error('❌ Email service initialization failed:', error.message);
      // Set transporter to null so we know it failed
      this.transporter = null;
    }
  }

  // Verify email services (Web API primary, SMTP fallback)
  async verifyServices() {
    console.log('🔍 Verifying email services...');
    console.log('📧 Email FROM:', process.env.EMAIL_FROM);
    console.log('🌐 Environment:', process.env.NODE_ENV);
    console.log('🔧 Use Web API:', this.useWebAPI);
    
    let webApiOk = false;
    let smtpOk = false;
    
    // Test Web API (primary)
    if (this.webApiService) {
      console.log('✅ SendGrid Web API service available');
      webApiOk = true;
    } else {
      console.log('❌ SendGrid Web API service not available');
    }
    
    // Test SMTP (fallback)
    if (this.transporter) {
      try {
        console.log('🔍 Testing SMTP connection...');
        await this.transporter.verify();
        console.log('✅ SMTP service connected successfully');
        smtpOk = true;
      } catch (error) {
        console.log('❌ SMTP service failed:', error.message);
      }
    } else {
      console.log('ℹ️  SMTP service not configured');
    }
    
    // Summary
    if (webApiOk) {
      console.log('🎉 Email service ready (Web API primary)');
    } else if (smtpOk) {
      console.log('⚠️  Email service ready (SMTP only - may fail in production)');
    } else {
      console.log('❌ No email service available!');
      console.log('🔧 Check your environment variables:');
      console.log('   - SENDGRID_API_KEY:', process.env.SENDGRID_API_KEY ? 'Set (hidden)' : 'Not set');
      console.log('   - EMAIL_FROM:', process.env.EMAIL_FROM || 'Not set');
    }
    
    return webApiOk || smtpOk;
  }

  // Send email using Web API (primary) with SMTP fallback
  async sendEmail({ to, subject, text, html }, retryCount = 0) {
    
    // PRIORITY 1: Try Web API first (recommended for production)
    if (this.webApiService) {
      console.log('🌐 Attempting to send email via SendGrid Web API...');
      console.log(`   To: ${to}`);
      console.log(`   Subject: ${subject}`);
      
      const result = await this.webApiService.sendEmail({ to, subject, text, html });
      if (result.success) {
        console.log('✅ Email sent successfully via Web API');
        return { ...result, method: 'SendGrid Web API' };
      } else {
        console.log('❌ Web API failed:', result.error);
        if (!this.transporter || this.useWebAPI) {
          // If Web API fails and we don't have SMTP or we're in Web API only mode
          return result;
        }
        console.log('🔄 Falling back to SMTP...');
      }
    }

    // PRIORITY 2: Try SMTP fallback (may fail in production due to port blocking)
    if (this.transporter) {
      try {
        const mailOptions = {
          from: `"Bug Tracker" <${process.env.EMAIL_FROM || 'noreply@bugtracker.com'}>`,
          to,
          subject,
          text,
          html: html || text
        };

        console.log('📧 Attempting SMTP email (fallback)...');
        console.log(`   To: ${to}`);
        console.log(`   From: ${mailOptions.from}`);
        console.log(`   Subject: ${subject}`);
        
        const info = await this.transporter.sendMail(mailOptions);
        console.log('✅ Email sent successfully via SMTP:', info.messageId);
        return { success: true, messageId: info.messageId, method: 'SMTP (fallback)' };
      } catch (error) {
        console.error('❌ SMTP fallback also failed:', error.message);
        
        // Return the error from SMTP attempt
        return { 
          success: false, 
          error: `Both Web API and SMTP failed. Last error: ${error.message}`,
          details: {
            webApiError: this.webApiService ? 'Failed (see logs above)' : 'Not available',
            smtpError: error.message
          }
        };
      }
    }
    
    // No email services available
    console.log('❌ No email services available');
    return { 
      success: false, 
      error: 'No email services available. Check SENDGRID_API_KEY and configuration.',
      details: {
        webApiService: this.webApiService ? 'Available but failed' : 'Not initialized',
        smtpService: this.transporter ? 'Available but failed' : 'Not initialized'
      }
    };
  }

  // Send welcome email to new users
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
      subject,
      html
    });
  }

  // Send ticket assignment notification
  async sendTicketAssignmentEmail(ticket, assignedUser, assignedBy) {
    const subject = `Ticket Assigned: ${ticket.title}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">New Ticket Assignment</h2>
        <p>Hi ${assignedUser.name},</p>
        <p>A new ticket has been assigned to you.</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Ticket Details:</strong></p>
          <p><strong>Title:</strong> ${ticket.title}</p>
          <p><strong>Description:</strong> ${ticket.description}</p>
          <p><strong>Priority:</strong> <span style="color: ${this.getPriorityColor(ticket.priority)}">${ticket.priority}</span></p>
          <p><strong>Status:</strong> ${ticket.status}</p>
          <p><strong>Assigned by:</strong> ${assignedBy.name}</p>
          <p><strong>Due Date:</strong> ${ticket.dueDate ? new Date(ticket.dueDate).toLocaleDateString() : 'Not set'}</p>
        </div>
        <p>Please log in to the system to view more details and start working on this ticket.</p>
        <p>Best regards,<br>The Bug Tracker Team</p>
      </div>
    `;

    return await this.sendEmail({
      to: assignedUser.email,
      subject,
      html
    });
  }

  // Send ticket status update notification
  async sendTicketStatusUpdateEmail(ticket, updatedBy) {
    const subject = `Ticket Status Update: ${ticket.title}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Ticket Status Updated</h2>
        <p>A ticket you're involved with has been updated.</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Ticket Details:</strong></p>
          <p><strong>Title:</strong> ${ticket.title}</p>
          <p><strong>New Status:</strong> <span style="color: ${this.getStatusColor(ticket.status)}">${ticket.status}</span></p>
          <p><strong>Priority:</strong> ${ticket.priority}</p>
          <p><strong>Updated by:</strong> ${updatedBy.name}</p>
          <p><strong>Updated at:</strong> ${new Date().toLocaleString()}</p>
        </div>
        <p>Best regards,<br>The Bug Tracker Team</p>
      </div>
    `;

    // Send to assigned user and creator if they're different
    const recipients = [];
    if (ticket.assignedTo) recipients.push(ticket.assignedTo.email);
    if (ticket.createdBy && ticket.createdBy.email !== ticket.assignedTo?.email) {
      recipients.push(ticket.createdBy.email);
    }

    const promises = recipients.map(email => 
      this.sendEmail({ to: email, subject, html })
    );

    return await Promise.allSettled(promises);
  }

  // Send project invitation email
  async sendProjectInvitationEmail(project, invitedUser, invitedBy) {
    const subject = `Project Invitation: ${project.name}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Project Invitation</h2>
        <p>Hi ${invitedUser.name},</p>
        <p>You have been invited to join a project.</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p><strong>Project Details:</strong></p>
          <p><strong>Name:</strong> ${project.name}</p>
          <p><strong>Description:</strong> ${project.description}</p>
          <p><strong>Invited by:</strong> ${invitedBy.name}</p>
        </div>
        <p>You can now access this project and start working on tickets!</p>
        <p>Best regards,<br>The Bug Tracker Team</p>
      </div>
    `;

    return await this.sendEmail({
      to: invitedUser.email,
      subject,
      html
    });
  }

  // Get color for priority display
  getPriorityColor(priority) {
    switch (priority) {
      case 'LOW': return '#28a745';
      case 'MEDIUM': return '#ffc107';
      case 'HIGH': return '#dc3545';
      default: return '#6c757d';
    }
  }

  // Get color for status display
  getStatusColor(status) {
    switch (status) {
      case 'OPEN': return '#007bff';
      case 'IN_PROGRESS': return '#ffc107';
      case 'RESOLVED': return '#28a745';
      case 'CLOSED': return '#6c757d';
      default: return '#6c757d';
    }
  }

  // Send password reset email (for future enhancement)
  async sendPasswordResetEmail(user, resetToken) {
    const subject = 'Password Reset Request';
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>Hi ${user.name},</p>
        <p>You requested a password reset for your Bug Tracker account.</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p>Click the button below to reset your password:</p>
          <div style="text-align: center; margin: 20px 0;">
            <a href="${resetUrl}" style="background-color: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">Reset Password</a>
          </div>
          <p><small>If the button doesn't work, copy and paste this link: ${resetUrl}</small></p>
        </div>
        <p>This link will expire in 10 minutes for security reasons.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <p>Best regards,<br>The Bug Tracker Team</p>
      </div>
    `;

    return await this.sendEmail({
      to: user.email,
      subject,
      html
    });
  }
}

// Create singleton instance
const emailService = new EmailService();

module.exports = emailService;