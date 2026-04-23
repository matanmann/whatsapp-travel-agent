import express from 'express';
import { prisma } from '../db.js';
import { requireApiKey } from '../middleware/auth.js';

const router = express.Router();

router.get('/health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return res.json({ ok: true, status: 'healthy' });
  } catch {
    return res.status(500).json({ ok: false, status: 'degraded' });
  }
});

router.use(requireApiKey);

router.get('/trips', async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ error: 'userId is required' });

  const trips = await prisma.trip.findMany({
    where: { members: { some: { userId: String(userId) } } },
    orderBy: { createdAt: 'desc' },
  });

  return res.json(trips);
});

router.get('/trips/:id', async (req, res) => {
  const trip = await prisma.trip.findUnique({
    where: { id: req.params.id },
    include: {
      members: { include: { user: true } },
      destinations: { orderBy: { orderIndex: 'asc' } },
      tasks: true,
      decisions: { orderBy: { createdAt: 'desc' } },
    },
  });

  if (!trip) return res.status(404).json({ error: 'Trip not found' });
  return res.json(trip);
});

router.get('/trips/:id/tasks', async (req, res) => {
  const tasks = await prisma.task.findMany({
    where: { tripId: req.params.id },
    orderBy: [{ status: 'asc' }, { priority: 'desc' }, { dueDate: 'asc' }],
  });
  return res.json(tasks);
});

router.patch('/tasks/:id/status', async (req, res) => {
  const { status } = req.body;
  if (!status) return res.status(400).json({ error: 'status is required' });

  const task = await prisma.task.update({
    where: { id: req.params.id },
    data: {
      status,
      completedAt: status === 'completed' ? new Date() : null,
    },
  });

  return res.json(task);
});

router.get('/trips/:id/itinerary', async (req, res) => {
  const items = await prisma.itineraryItem.findMany({
    where: { destination: { tripId: req.params.id } },
    include: { destination: true },
    orderBy: [{ destination: { orderIndex: 'asc' } }, { dayNumber: 'asc' }, { timeSlot: 'asc' }],
  });
  return res.json(items);
});

router.get('/users', async (req, res) => {
  const { phone } = req.query;
  if (!phone) return res.status(400).json({ error: 'phone is required' });

  const user = await prisma.user.findUnique({ where: { phoneNumber: String(phone) } });
  if (!user) return res.status(404).json({ error: 'User not found' });

  return res.json(user);
});

router.get('/users/:id/preferences', async (req, res) => {
  const preferences = await prisma.userPreference.findMany({
    where: { userId: req.params.id },
    orderBy: [{ category: 'asc' }, { key: 'asc' }],
  });
  return res.json(preferences);
});

export default router;
