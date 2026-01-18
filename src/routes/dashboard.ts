import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Require auth for all dashboard routes
router.use(requireAuth);

// Dashboard home page
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.id;
    const basePath = req.headers['x-forwarded-prefix'] as string || '';

    // Get user's sessions with analytics
    const sessions = await prisma.salesSession.findMany({
      where: userId ? { userId } : {},
      include: {
        analytics: true,
        messages: {
          select: { id: true }
        }
      },
      orderBy: { startedAt: 'desc' },
      take: 50
    });

    // Get config for mode info
    const config = await prisma.appConfig.findFirst();

    // Calculate stats
    const totalSessions = sessions.length;
    const completedSessions = sessions.filter(s => s.endedAt !== null);
    const salesMade = sessions.filter(s => s.outcome === 'sale_made').length;
    const conversionRate = completedSessions.length > 0
      ? Math.round((salesMade / completedSessions.length) * 100)
      : 0;

    // Get last 10 session scores for trend
    const recentSessions = sessions.slice(0, 10).map(s => ({
      date: s.startedAt,
      outcome: s.outcome,
      messageCount: s.messages.length,
      phase: s.currentPhase
    }));

    // Calculate average metrics
    const avgMessages = completedSessions.length > 0
      ? Math.round(completedSessions.reduce((sum, s) => sum + s.messages.length, 0) / completedSessions.length)
      : 0;

    // Get best streak
    let currentStreak = 0;
    let bestStreak = 0;
    for (const session of [...sessions].reverse()) {
      if (session.outcome === 'sale_made') {
        currentStreak++;
        bestStreak = Math.max(bestStreak, currentStreak);
      } else if (session.outcome === 'no_sale') {
        currentStreak = 0;
      }
    }

    res.render('dashboard', {
      user: req.user,
      basePath,
      stats: {
        totalSessions,
        completedSessions: completedSessions.length,
        salesMade,
        conversionRate,
        avgMessages,
        currentStreak,
        bestStreak
      },
      recentSessions,
      currentMode: config?.salesMode || 'ai_sells'
    });

  } catch (err: any) {
    console.error('Dashboard error:', err);
    res.status(500).render('error', { message: 'Failed to load dashboard', user: req.user });
  }
});

// API: Get user stats for charts
router.get('/api/stats', async (req, res) => {
  try {
    const userId = req.user?.id;

    const sessions = await prisma.salesSession.findMany({
      where: userId ? { userId } : {},
      include: {
        analytics: true,
        messages: {
          select: { id: true, createdAt: true }
        }
      },
      orderBy: { startedAt: 'desc' },
      take: 100
    });

    // Group sessions by date for trend
    const byDate: Record<string, { total: number; sales: number }> = {};
    sessions.forEach(s => {
      const date = s.startedAt.toISOString().split('T')[0];
      if (!byDate[date]) byDate[date] = { total: 0, sales: 0 };
      byDate[date].total++;
      if (s.outcome === 'sale_made') byDate[date].sales++;
    });

    const trend = Object.entries(byDate)
      .map(([date, data]) => ({
        date,
        sessions: data.total,
        sales: data.sales,
        conversionRate: data.total > 0 ? Math.round((data.sales / data.total) * 100) : 0
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(-14); // Last 14 days

    res.json({
      success: true,
      trend
    });

  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
