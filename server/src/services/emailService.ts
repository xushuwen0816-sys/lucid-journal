import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import dns from 'dns';
import { promisify } from 'util';

dotenv.config();

const resolve4 = promisify(dns.resolve4);

// Force IPv4 for node process to avoid ENETUNREACH on Railway/AWS
// We keep this as a fallback, but will also manually resolve below
try {
    dns.setDefaultResultOrder('ipv4first');
} catch (e) {
    // Ignore if not supported in this node version
}

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

    const originalHost = process.env.SMTP_HOST || 'smtp.ethereal.email';
    let hostToUse = originalHost;

    // Manually resolve IPv4 to bypass IPv6 connection issues (ENETUNREACH)
    if (!/^\d+\.\d+\.\d+\.\d+$/.test(originalHost)) {
        try {
            console.log(`Resolving IPv4 for ${originalHost}...`);
            const addresses = await resolve4(originalHost);
            if (addresses && addresses.length > 0) {
                hostToUse = addresses[0];
                console.log(`✅ Resolved ${originalHost} to ${hostToUse}`);
            }
        } catch (dnsError) {
            console.warn(`⚠️ Failed to resolve IPv4 for ${originalHost}, falling back to hostname.`, dnsError);
        }
    }

    // Create a fresh transporter for this request to ensure config (like IP) is used
    const transporter = nodemailer.createTransport({
      host: hostToUse,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
      tls: {
        // Crucial: When connecting via IP, we must explicitly set the servername
        // so TLS verification checks against the domain, not the IP.
        servername: originalHost,
        rejectUnauthorized: false,
      },
      // Add timeouts to prevent hanging
      connectionTimeout: 10000, // 10s
      greetingTimeout: 5000,    // 5s
      socketTimeout: 15000      // 15s
    } as nodemailer.TransportOptions);

    console.log(`Attempting to send email to ${to} via ${hostToUse}...`);

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
