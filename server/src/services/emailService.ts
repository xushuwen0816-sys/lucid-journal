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
    // Strategy: Try user's config first. If it fails (timeout/socket), try fallback config.
    
    const configsToTry = [];
    
    // 1. Primary Config (from .env)
    const envPort = parseInt(process.env.SMTP_PORT || '587');
    configsToTry.push({
        port: envPort,
        secure: process.env.SMTP_SECURE === 'true'
    });

    // 2. Fallback Config
    // If user is using 465 (SSL), try 587 (STARTTLS)
    // If user is using 587, try 465
    if (envPort === 465) {
        configsToTry.push({ port: 587, secure: false });
    } else {
        configsToTry.push({ port: 465, secure: true });
    }

    let lastError = null;

    for (const config of configsToTry) {
        try {
            console.log(`Attempting to send email to ${to} via ${hostToUse} (Port: ${config.port}, Secure: ${config.secure})...`);
            
            const transporter = nodemailer.createTransport({
              host: hostToUse,
              port: config.port,
              secure: config.secure,
              auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
              },
              tls: {
                servername: originalHost,
                rejectUnauthorized: false,
              },
              connectionTimeout: 20000, // Increased to 20s
              greetingTimeout: 20000,
              socketTimeout: 30000
            } as nodemailer.TransportOptions);

            const info = await transporter.sendMail({
              from: process.env.SMTP_FROM || '"Lucid Journal" <no-reply@lucid.com>',
              to,
              subject,
              html,
            });

            console.log('✅ Message sent successfully: %s', info.messageId);
            return true; // Success!

        } catch (error: any) {
            console.warn(`❌ Failed with Port ${config.port}: ${error.message}`);
            lastError = error;
            // Continue to next config
        }
    }

    console.error('All email attempts failed.');
    if (lastError) console.error('Last error:', lastError);
    return false;
  } catch (error) {
    console.error('Critical Error sending email:', error);
    return false;
  }
};
