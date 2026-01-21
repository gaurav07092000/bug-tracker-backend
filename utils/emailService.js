const nodemailer = require('nodemailer');

// Email service utility using Nodemailer
class EmailService {
  constructor() {
    this.transporter = null;
    this.initialize();
  }

  // Initialize nodemailer transporter
  initialize() {
    try {
      // Check if SendGrid API key is available
      const sendgridApiKey = process.env.SENDGRID_API_KEY;
      
      if (sendgridApiKey && sendgridApiKey !== 'your_sendgrid_api_key_here') {
        // Use SendGrid SMTP configuration
        console.log('🔧 Initializing SendGrid email service...');
        this.transporter = nodemailer.createTransport({
          host: process.env.EMAIL_HOST || 'smtp.sendgrid.net',
          port: parseInt(process.env.EMAIL_PORT || '587'),
          secure: false, // true for 465, false for other ports
          auth: {
            user: process.env.EMAIL_USER || 'apikey',
            pass: sendgridApiKey
          }
        });
        console.log('✅ SendGrid transporter created');
      } else {
        // Fallback to regular SMTP (for development)
        console.log('🔧 Initializing fallback SMTP email service...');
        this.transporter = nodemailer.createTransport({
          host: process.env.EMAIL_HOST,
          port: parseInt(process.env.EMAIL_PORT),
          secure: false,
          auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS
          },
          tls: {
            rejectUnauthorized: false // for development
          }
        });
        console.log('✅ SMTP transporter created');
      }

      // Verify connection configuration
      if (process.env.NODE_ENV === 'development') {
        this.verifyConnection();
      }
    } catch (error) {
      console.error('❌ Email service initialization failed:', error.message);
      // Set transporter to null so we know it failed
      this.transporter = null;
    }
  }

  // Verify email connection
  async verifyConnection() {
    try {
      await this.transporter.verify();
      console.log('✅ Email service connected successfully');
    } catch (error) {
      console.log('❌ Email service failed:', error.message);
    }
  }

  // Send email utility function
  async sendEmail({ to, subject, text, html }) {
    try {
      if (!this.transporter) {
        console.log('❌ Email transporter not initialized - check your email configuration');
        return { success: false, error: 'Email transporter not initialized. Check SENDGRID_API_KEY and email configuration.' };
      }

      const mailOptions = {
        from: `"Bug Tracker" <${process.env.EMAIL_FROM || 'noreply@bugtracker.com'}>`,
        to,
        subject,
        text,
        html: html || text
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('📧 Email sent successfully:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      console.error('📧 Email send failed:', error.message);
      
      // Check for specific SendGrid sender identity error
      if (error.message.includes('does not match a verified Sender Identity')) {
        console.error('❌ SENDGRID ERROR: Email address needs verification!');
        console.error('🔧 Fix: Go to SendGrid Dashboard → Settings → Sender Authentication');
        console.error('📧 Verify this email:', process.env.EMAIL_FROM);
        console.error('📖 Guide: https://sendgrid.com/docs/for-developers/sending-email/sender-identity/');
      }
      
      return { success: false, error: error.message };
    }
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