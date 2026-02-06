
import express from 'express';
import { PrismaClient } from '@prisma/client';
import { sendEmail } from '../services/emailService';
import { generateFutureLetterEmail } from '../services/emailTemplates';

const router = express.Router();
const prisma = new PrismaClient();

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
