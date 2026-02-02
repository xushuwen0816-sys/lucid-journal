import express, { Response } from 'express';
import prisma from '../prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Get all journals
router.get('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const journals = await prisma.journalEntry.findMany({
      where: { userId: req.user!.userId },
      orderBy: { date: 'desc' }
    });
    
    const parsedJournals = journals.map(j => ({
      ...j,
      aiAnalysis: j.aiAnalysis ? JSON.parse(j.aiAnalysis) : null,
      date: j.date.getTime() // Convert back to timestamp for frontend
    }));
    
    res.json(parsedJournals);
  } catch (error) {
    console.error('Get journals error:', error);
    res.status(500).json({ error: 'Failed to fetch journals' });
  }
});

// Create journal
router.post('/', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id, content, date, aiAnalysis } = req.body;
    
    // Check if ID exists (upsert logic if syncing?)
    // For now, let's assume create only or standard CRUD.
    // Front-end sends 'date' as timestamp.
    
    const journal = await prisma.journalEntry.create({
      data: {
        id: id, // Optional: if frontend generates UUID
        userId: req.user!.userId,
        content,
        date: new Date(date), 
        aiAnalysis: aiAnalysis ? JSON.stringify(aiAnalysis) : undefined
      }
    });
    
    res.status(201).json({
      ...journal,
      aiAnalysis: journal.aiAnalysis ? JSON.parse(journal.aiAnalysis) : null,
      date: journal.date.getTime()
    });
  } catch (error) {
    console.error('Create journal error:', error);
    res.status(500).json({ error: 'Failed to create journal' });
  }
});

// Update journal
router.put('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { content, aiAnalysis } = req.body;
    
    const journal = await prisma.journalEntry.update({
      where: { 
        id: String(id),
        userId: req.user!.userId // Ensure ownership
      },
      data: {
        content,
        aiAnalysis: aiAnalysis ? JSON.stringify(aiAnalysis) : undefined
      }
    });
    
    res.json({
      ...journal,
      aiAnalysis: journal.aiAnalysis ? JSON.parse(journal.aiAnalysis) : null,
      date: journal.date.getTime()
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update journal' });
  }
});

// Delete journal
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.journalEntry.delete({
      where: { 
        id: String(id),
        userId: req.user!.userId
      }
    });
    res.sendStatus(204);
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete journal' });
  }
});

export default router;
