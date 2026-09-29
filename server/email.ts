import nodemailer from 'nodemailer';
import { organisation } from '../shared/content.ts';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

interface EnquiryEmailData {
  name: string;
  email: string;
  organisation?: string;
  topic: string;
  message: string;
}

/**
 * Email service for sending enquiry notifications.
 * 
 * If SMTP credentials are not configured, this function will gracefully skip
 * sending emails and only store the enquiry in the database.
 */
export async function sendEnquiryEmail(data: EnquiryEmailData): Promise<{ success: boolean; error?: string }> {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT;
  const smtpUser = process.env.SMTP_USER;
  const smtpPassword = process.env.SMTP_PASSWORD;
  const emailTo = process.env.EMAIL_TO;
  const emailFrom = process.env.EMAIL_FROM;
  const smtpSecure = process.env.SMTP_SECURE === 'true';

  // If email configuration is not set, skip sending but don't fail
  if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword || !emailTo || !emailFrom) {
    console.log('Email configuration not set. Skipping email send. Enquiry will be stored in database.');
    return { success: false, error: 'Email configuration not set' };
  }

  try {
    const config: EmailConfig = {
      host: smtpHost,
      port: parseInt(smtpPort, 10),
      secure: smtpSecure,
      auth: {
        user: smtpUser,
        pass: smtpPassword,
      },
    };

    const transporter = nodemailer.createTransport(config);

    const subject = `New Enquiry: ${data.topic} - ${data.name}`;
    
    const html = `
      <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: #164a3f; color: white; padding: 20px; text-align: center; }
            .content { background: #f9f9f9; padding: 20px; border-radius: 8px; }
            .field { margin-bottom: 15px; }
            .label { font-weight: bold; color: #164a3f; }
            .value { margin-top: 5px; }
            .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>New Enquiry Received</h1>
              <p>${organisation.name}</p>
            </div>
            <div class="content">
              <div class="field">
                <div class="label">Name:</div>
                <div class="value">${data.name}</div>
              </div>
              <div class="field">
                <div class="label">Email:</div>
                <div class="value">${data.email}</div>
              </div>
              ${data.organisation ? `
              <div class="field">
                <div class="label">Organisation:</div>
                <div class="value">${data.organisation}</div>
              </div>
              ` : ''}
              <div class="field">
                <div class="label">Topic:</div>
                <div class="value">${data.topic}</div>
              </div>
              <div class="field">
                <div class="label">Message:</div>
                <div class="value">${data.message.replace(/\n/g, '<br>')}</div>
              </div>
            </div>
            <div class="footer">
              <p>This enquiry was submitted via the Golden Steps website</p>
              <p>${new Date().toLocaleString()}</p>
            </div>
          </div>
        </body>
      </html>
    `;

    const text = `
New Enquiry Received - ${organisation.name}

Name: ${data.name}
Email: ${data.email}
${data.organisation ? `Organisation: ${data.organisation}\n` : ''}Topic: ${data.topic}

Message:
${data.message}

---
This enquiry was submitted via the Golden Steps website
${new Date().toLocaleString()}
    `;

    const info = await transporter.sendMail({
      from: emailFrom,
      to: emailTo,
      subject,
      text,
      html,
    });

    console.log('Email sent successfully:', info.messageId);
    return { success: true };
  } catch (error) {
    console.error('Failed to send email:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error sending email' 
    };
  }
}