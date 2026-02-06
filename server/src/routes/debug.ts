
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { sendEmail } from '../services/emailService';
import { generateFutureLetterEmail } from '../services/emailTemplates';
import net from 'net';
import dns from 'dns';
import { promisify } from 'util';

const router = express.Router();
const prisma = new PrismaClient();
const resolve4 = promisify(dns.resolve4);

// Connectivity Test Endpoint
router.get('/connectivity-check', async (req, res) => {
    const host = (req.query.host as string) || process.env.SMTP_HOST || 'smtp.ethereal.email';
    const results: any = { host };
    
    try {
        // 1. DNS Resolution
        const ips = await resolve4(host);
        results.dns = { status: 'ok', ips };

        if (ips.length > 0) {
            const targetIp = ips[0];
            results.targetIp = targetIp;

            // 2. TCP Connect Test (Port 465)
            results.port465 = await checkConnection(targetIp, 465);
            
            // 3. TCP Connect Test (Port 587)
            results.port587 = await checkConnection(targetIp, 587);
        }
    } catch (e: any) {
        results.dns = { status: 'error', message: e.message };
    }

    res.json(results);
});

function checkConnection(host: string, port: number): Promise<any> {
    return new Promise((resolve) => {
        const start = Date.now();
        const socket = new net.Socket();
        let status = 'pending';

        socket.setTimeout(5000); // 5s timeout for check

        socket.on('connect', () => {
            status = 'connected';
            socket.destroy();
            resolve({ status: 'open', timeMs: Date.now() - start });
        });

        socket.on('timeout', () => {
            status = 'timeout';
            socket.destroy();
            resolve({ status: 'timeout', timeMs: Date.now() - start });
        });

        socket.on('error', (err) => {
            status = 'error';
            resolve({ status: 'closed', error: err.message, timeMs: Date.now() - start });
        });

        try {
            socket.connect(port, host);
        } catch (e: any) {
             resolve({ status: 'failed_init', error: e.message });
        }
    });
}

    // Debug endpoint to manually force check and send letters
    router.get('/force-send', async (req, res) => {
      const logs: string[] = [];
      const log = (msg: string) => logs.push(`[${new Date().toISOString()}] ${msg}`);
    
      try {
        log('🚀 Starting manual email trigger...');
        const now = new Date();
        
        // Find letters that are due and haven't been sent
        // Note: We use a slightly wider window or just 'lte: now' to catch everything past due
        const dueLetters = await prisma.futureLetter.findMany({
          where: {
            sendDate: {
              lte: now,
            },
            isSent: false,
          },
          include: {
            user: true,
          },
        });
    
        log(`🔍 Found ${dueLetters.length} due letters.`);
    
        const results = [];
    
        for (const letter of dueLetters) {
          if (!letter.user.email) {
            log(`⚠️ User for letter ${letter.id} has no email. Skipping.`);
            continue;
          }
    
          log(`📨 Processing letter ${letter.id} for ${letter.user.email}...`);
          
          const subject = `📬 来自过去的信 (${letter.createdAt.toLocaleDateString()})`;
          const html = generateFutureLetterEmail(
            letter.content,
            letter.createdAt,
            letter.aiReply || undefined
          );
    
          try {
            // Respect rate limit: 1 second delay
            await new Promise(resolve => setTimeout(resolve, 1000));

            const sent = await sendEmail(letter.user.email, subject, html);
            
            if (sent) {
                await prisma.futureLetter.update({
                  where: { id: letter.id },
                  data: { isSent: true, isLocked: false },
                });
                log(`✅ Letter ${letter.id} sent successfully!`);
                results.push({ id: letter.id, status: 'sent', email: letter.user.email });
            } else {
                log(`❌ Failed to send email for letter ${letter.id} (Check server logs for transport error).`);
                results.push({ id: letter.id, status: 'failed_transport' });
            }
          } catch (innerErr: any) {
             log(`❌ Exception sending letter ${letter.id}: ${innerErr.message}`);
             results.push({ id: letter.id, status: 'error', error: innerErr.message });
          }
        }
    
        res.json({
            status: 'completed',
            processed: dueLetters.length,
            results,
            logs
        });
    
      } catch (error: any) {
        log(`💥 Critical Error: ${error.message}`);
        res.status(500).json({
            status: 'error',
            error: error.message,
            logs
        });
      }
    });

    // Endpoint to clear the backlog (mark all due letters as sent without sending)
    router.get('/clear-backlog', async (req, res) => {
        try {
            const now = new Date();
            const result = await prisma.futureLetter.updateMany({
                where: {
                    sendDate: { lte: now },
                    isSent: false
                },
                data: {
                    isSent: true,
                    isLocked: false // Ensure they are unlocked too
                }
            });
            res.json({
                status: 'success',
                message: `Cleared backlog: Marked ${result.count} letters as sent.`,
                count: result.count
            });
        } catch (error: any) {
            res.status(500).json({ status: 'error', error: error.message });
        }
    });

// Debug endpoint to check server time and env
router.get('/env-check', (req, res) => {
    res.json({
        serverTime: new Date().toISOString(),
        smtpConfig: {
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT,
            secure: process.env.SMTP_SECURE,
            user: process.env.SMTP_USER ? 'Set (Hidden)' : 'Not Set',
            from: process.env.SMTP_FROM
        }
    });
});

export default router;
