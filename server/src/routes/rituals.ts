import express, { Response } from 'express';
import prisma from '../prisma';
import { authenticateToken, AuthRequest } from '../middleware/auth';

const router = express.Router();

// Get all rituals
router.get('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const rituals = await prisma.ritualArchiveEntry.findMany({
      where: { userId: req.user!.userId },
      orderBy: { date: 'desc' }
    });
    
    const parsedRituals = rituals.map(r => ({
      ...r,
      reading: r.reading ? JSON.parse(r.reading) : undefined,
      oracleReading: r.oracleReading ? JSON.parse(r.oracleReading) : undefined,
      practice: r.practice ? JSON.parse(r.practice) : undefined,
      date: r.date.getTime() // Convert back to timestamp for frontend
    }));
    
    res.json(parsedRituals);
  } catch (error) {
    console.error('Get rituals error:', error);
    res.status(500).json({ error: 'Failed to fetch rituals' });
  }
});

// Create or Update ritual (Upsert based on ID)
router.post('/', authenticateToken, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { id, date, reading, oracleReading, practice } = req.body;
    
    // We use upsert here because frontend might generate ID locally
    // or we might want to update an existing entry by ID
    
    const ritual = await prisma.ritualArchiveEntry.upsert({
      where: { id: id },
      update: {
        date: new Date(date),
        reading: reading ? JSON.stringify(reading) : undefined,
        oracleReading: oracleReading ? JSON.stringify(oracleReading) : undefined,
        practice: practice ? JSON.stringify(practice) : undefined
      },
      create: {
        id: id,
        userId: req.user!.userId,
        date: new Date(date),
        reading: reading ? JSON.stringify(reading) : undefined,
        oracleReading: oracleReading ? JSON.stringify(oracleReading) : undefined,
        practice: practice ? JSON.stringify(practice) : undefined
      }
    });
    
    res.json({
      ...ritual,
      reading: ritual.reading ? JSON.parse(ritual.reading) : undefined,
      oracleReading: ritual.oracleReading ? JSON.parse(ritual.oracleReading) : undefined,
      practice: ritual.practice ? JSON.parse(ritual.practice) : undefined,
      date: ritual.date.getTime()
    });
  } catch (error) {
    console.error('Save ritual error:', error);
    res.status(500).json({ error: 'Failed to save ritual' });
  }
});

// Delete ritual
router.delete('/:id', authenticateToken, async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const { id } = req.params;
    await prisma.ritualArchiveEntry.delete({
      where: { 
        id: String(id),
        userId: req.user!.userId
      }
    });
    res.sendStatus(204);
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete ritual' });
  }
});

export default router;
