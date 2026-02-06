import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { sendEmail } from './emailService';
import { generateFutureLetterEmail } from './emailTemplates';

const prisma = new PrismaClient();

export const startScheduler = () => {
  console.log('⏰ Scheduler service started...');

  // Run every 1 minute to check for due letters (balanced for production)
  cron.schedule('* * * * *', async () => {
    console.log(`[${new Date().toISOString()}] ⏳ Checking for due letters...`);
    try {
      const now = new Date();
      
      // Find letters that are due and haven't been sent
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

      if (dueLetters.length > 0) {
        console.log(`Found ${dueLetters.length} due letters to send.`);

        for (const letter of dueLetters) {
          if (!letter.user.email) {
            console.warn(`User for letter ${letter.id} has no email.`);
            continue;
          }

          const subject = `📬 来自过去的信 (${letter.createdAt.toLocaleDateString()})`;
          const html = generateFutureLetterEmail(
            letter.content,
            letter.createdAt,
            letter.aiReply
          );

          // Respect rate limit: 1 second delay
          await new Promise(resolve => setTimeout(resolve, 1000));

          const sent = await sendEmail(letter.user.email, subject, html);

          if (sent) {
            await prisma.futureLetter.update({
              where: { id: letter.id },
              data: { isSent: true, isLocked: false }, // Also unlock it in the UI if it wasn't already
            });
            console.log(`Letter ${letter.id} sent to ${letter.user.email}`);
          }
        }
      }
    } catch (error) {
      console.error('Error in scheduler:', error);
    }
  });
};
