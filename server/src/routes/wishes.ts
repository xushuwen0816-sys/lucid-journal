import express, { Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();
const prisma = new PrismaClient();

// Get all wishes for the authenticated user
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const wishes = await prisma.wish.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    // Parse JSON fields
    const parsedWishes = wishes.map(wish => ({
      ...wish,
      tags: wish.tags ? JSON.parse(wish.tags) : {},
      // deepDiveChat is a string, no need to parse if it's just text history, 
      // but if it's structured, we might need to. Based on schema it's String.
      // beliefs is String in schema, but usage implies JSON object.
      beliefs: wish.beliefs ? JSON.parse(wish.beliefs) : {},
      affirmations: wish.affirmations ? JSON.parse(wish.affirmations) : []
    }));

    res.json(parsedWishes);
  } catch (error) {
    console.error('Error fetching wishes:', error);
    res.status(500).json({ error: 'Failed to fetch wishes' });
  }
});

// Create or Update a wish (Upsert)
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    const { id, content, status, tags, deepDiveChat, beliefs, affirmations, createdAt } = req.body;

    const wish = await prisma.wish.upsert({
      where: { id: id },
      update: {
        content,
        status: status || 'active',
        tags: JSON.stringify(tags || {}),
        deepDiveChat: typeof deepDiveChat === 'object' ? JSON.stringify(deepDiveChat) : (deepDiveChat || ''),
        beliefs: JSON.stringify(beliefs || {}),
        affirmations: JSON.stringify(affirmations || [])
      },
      create: {
        id, // Use client-provided UUID
        userId,
        content,
        status: status || 'active',
        createdAt: createdAt ? new Date(createdAt) : new Date(),
        tags: JSON.stringify(tags || {}),
        deepDiveChat: typeof deepDiveChat === 'object' ? JSON.stringify(deepDiveChat) : (deepDiveChat || ''),
        beliefs: JSON.stringify(beliefs || {}),
        affirmations: JSON.stringify(affirmations || [])
      }
    });

    res.status(200).json(wish);
  } catch (error) {
    console.error('Error saving wish:', error);
    res.status(500).json({ error: 'Failed to save wish' });
  }
});

// Update an existing wish
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    
    if (typeof id !== 'string') {
        res.status(400).json({ error: 'Invalid ID format' });
        return;
    }

    const { content, status, tags, deepDiveChat, beliefs, affirmations } = req.body;

    // Verify ownership
    const existingWish = await prisma.wish.findFirst({
      where: { id, userId }
    });

    if (!existingWish) {
      res.status(404).json({ error: 'Wish not found' });
      return;
    }

    const updatedWish = await prisma.wish.update({
      where: { id },
      data: {
        content,
        status,
        tags: tags ? JSON.stringify(tags) : undefined,
        deepDiveChat: deepDiveChat ? (typeof deepDiveChat === 'object' ? JSON.stringify(deepDiveChat) : deepDiveChat) : undefined,
        beliefs: beliefs ? JSON.stringify(beliefs) : undefined,
        affirmations: affirmations ? JSON.stringify(affirmations) : undefined
      }
    });

    res.json(updatedWish);
  } catch (error) {
    console.error('Error updating wish:', error);
    res.status(500).json({ error: 'Failed to update wish' });
  }
});

// Delete a wish
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    if (typeof id !== 'string') {
        res.status(400).json({ error: 'Invalid ID format' });
        return;
    }

    // Verify ownership
    const existingWish = await prisma.wish.findFirst({
      where: { id, userId }
    });

    if (!existingWish) {
      res.status(404).json({ error: 'Wish not found' });
      return;
    }

    await prisma.wish.delete({
      where: { id }
    });

    res.json({ message: 'Wish deleted successfully' });
  } catch (error) {
    console.error('Error deleting wish:', error);
    res.status(500).json({ error: 'Failed to delete wish' });
  }
});

export default router;
