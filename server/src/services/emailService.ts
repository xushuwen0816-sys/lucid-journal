import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

dotenv.config();

// Create transporter
// For production, use environment variables for SMTP settings
// For development, we can log to console if no creds provided
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export const sendEmail = async (to: string, subject: string, html: string) => {
  try {
    if (!process.env.SMTP_USER) {
        console.log('---------------------------------------------------');
        console.log('⚠️  No SMTP Credentials provided. Email simulation:');
        console.log(`To: ${to}`);
        console.log(`Subject: ${subject}`);
        console.log('---------------------------------------------------');
        return true;
    }

    const info = await transporter.sendMail({
      from: process.env.SMTP_FROM || '"Lucid Journal" <no-reply@lucid.com>',
      to,
      subject,
      html,
    });

    console.log('Message sent: %s', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};
