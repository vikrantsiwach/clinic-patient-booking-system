import { Request, Response } from 'express';
import { getAvailableSlots, getAvailableMonthDates } from '../services/slotEngine';
import { getIST } from '../utils/time';

export async function getSlots(req: Request, res: Response): Promise<void> {
  try {
    const { date } = req.query as { date?: string };
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'date param required (YYYY-MM-DD)' });
      return;
    }
    const { date: today } = getIST();
    if (date < today) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'Cannot query slots for past dates' });
      return;
    }
    const slots = await getAvailableSlots(date);
    res.json(slots);
  } catch (err) {
    console.error('getSlots:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}

export async function getMonthAvailability(req: Request, res: Response): Promise<void> {
  try {
    const { month } = req.query as { month?: string };
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      res.status(400).json({ error: 'VALIDATION_ERROR', message: 'month param required (YYYY-MM)' });
      return;
    }
    const dates = await getAvailableMonthDates(month);
    res.json({ availableDates: dates });
  } catch (err) {
    console.error('getMonthAvailability:', err);
    res.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}
