import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Get all letters for the user
router.get('/', authenticateToken, async (req: any, res) => {
  try {
    const letters = await prisma.futureLetter.findMany({
      where: { userId: req.user.userId },
      orderBy: { createdAt: 'desc' }
    });
    res.json(letters);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch letters' });
  }
});

// Create or Update a letter (Upsert)
router.post('/', authenticateToken, async (req: any, res) => {
  try {
    const { id, content, sendDate, aiReply, isLocked, isSent, createdAt, isRead } = req.body;
    
    // Check for ID, if not provided, we can't upsert reliably unless we generate one here, 
    // but usually client provides ID for sync.
    // Assuming client ALWAYS provides ID for sync.
    
    if (!id) {
       return res.status(400).json({ error: 'ID is required for syncing' });
    }

    const letter = await prisma.futureLetter.upsert({
      where: { id: id },
      update: {
        content,
        sendDate: new Date(sendDate),
        aiReply,
        isLocked,
        isSent: isSent || false,
        isRead: isRead || false
      },
      create: {
        id,
        userId: req.user.userId,
        content,
        sendDate: new Date(sendDate),
        aiReply,
        isLocked,
        isSent: isSent || false,
        isRead: isRead || false,
        createdAt: createdAt ? new Date(createdAt) : new Date()
      }
    });
    
    res.status(200).json(letter);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to save letter' });
  }
});

// Delete a letter
router.delete('/:id', authenticateToken, async (req: any, res) => {
  try {
    const { id } = req.params;
    
    // Verify ownership
    const existingLetter = await prisma.futureLetter.findFirst({
      where: { 
        id,
        userId: req.user.userId 
      }
    });

    if (!existingLetter) {
      return res.status(404).json({ error: 'Letter not found' });
    }

    await prisma.futureLetter.delete({
      where: { id }
    });
    
    res.status(204).send();
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete letter' });
  }
});

export default router;
