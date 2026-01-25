import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import pino from 'pino';
import { getUserProgress, getLeaderboard } from '../services/gamificationService.js';
import { getAllAchievementsForUser, getUnnotifiedAchievements, markAchievementNotified } from '../services/achievementChecker.js';

const router = Router();
const logger = pino();

/**
 * Get current user's gamification profile
 */
router.get('/profile', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const progress = await getUserProgress(userId);
    res.json({ success: true, profile: progress });
  } catch (err) {
    logger.error({ err }, 'Get gamification profile error');
    res.status(500).json({ success: false, error: 'Failed to get profile' });
  }
});

/**
 * Get user's achievements (with earned status)
 */
router.get('/achievements', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const achievements = await getAllAchievementsForUser(userId);
    res.json({ success: true, achievements });
  } catch (err) {
    logger.error({ err }, 'Get achievements error');
    res.status(500).json({ success: false, error: 'Failed to get achievements' });
  }
});

/**
 * Get unnotified achievements (for toast notifications)
 */
router.get('/achievements/unnotified', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const achievements = await getUnnotifiedAchievements(userId);
    res.json({ success: true, achievements });
  } catch (err) {
    logger.error({ err }, 'Get unnotified achievements error');
    res.status(500).json({ success: false, error: 'Failed to get achievements' });
  }
});

/**
 * Mark achievement notification as read
 */
router.post('/achievements/:id/notified', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    await markAchievementNotified(userId, req.params.id);
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Mark achievement notified error');
    res.status(500).json({ success: false, error: 'Failed to mark achievement notified' });
  }
});

/**
 * Get public leaderboard
 */
router.get('/leaderboard', async (req: Request, res: Response) => {
  try {
    const period = (req.query.period as 'daily' | 'weekly' | 'monthly' | 'alltime') || 'weekly';
    const limit = parseInt(req.query.limit as string) || 10;

    // Check if leaderboard is enabled
    const settings = await prisma.gamificationSettings.findFirst();
    if (settings && !settings.leaderboardEnabled) {
      return res.json({ success: true, leaderboard: [], message: 'Leaderboard is disabled' });
    }

    const leaderboard = await getLeaderboard(period, limit);
    res.json({ success: true, leaderboard, period });
  } catch (err) {
    logger.error({ err }, 'Get leaderboard error');
    res.status(500).json({ success: false, error: 'Failed to get leaderboard' });
  }
});

/**
 * Get user's points history
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const limit = parseInt(req.query.limit as string) || 20;
    const history = await prisma.pointsHistory.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit
    });

    res.json({ success: true, history });
  } catch (err) {
    logger.error({ err }, 'Get points history error');
    res.status(500).json({ success: false, error: 'Failed to get history' });
  }
});

/**
 * Get user's rank for a given period
 */
router.get('/rank', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }

    const period = (req.query.period as string) || 'weekly';
    const pointsField = period === 'alltime' ? 'totalPoints' :
                        period === 'daily' ? 'dailyPoints' :
                        period === 'weekly' ? 'weeklyPoints' : 'monthlyPoints';

    // Get user's points
    const userPoints = await prisma.userPoints.findUnique({ where: { userId } });
    if (!userPoints) {
      return res.json({ success: true, rank: null, points: 0 });
    }

    // Count users with more points
    const higherCount = await prisma.userPoints.count({
      where: { [pointsField]: { gt: (userPoints as any)[pointsField] } }
    });

    res.json({
      success: true,
      rank: higherCount + 1,
      points: (userPoints as any)[pointsField],
      period
    });
  } catch (err) {
    logger.error({ err }, 'Get rank error');
    res.status(500).json({ success: false, error: 'Failed to get rank' });
  }
});

/**
 * Get available scenarios for training
 */
router.get('/scenarios', async (req: Request, res: Response) => {
  try {
    const category = req.query.category as string;
    const difficulty = req.query.difficulty as string;

    const where: any = { enabled: true };
    if (category) where.category = category;
    if (difficulty) where.difficulty = difficulty;

    const scenarios = await prisma.scenario.findMany({
      where,
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        category: true,
        difficulty: true,
        estimatedDuration: true,
        usageCount: true,
        avgScore: true
      }
    });

    res.json({ success: true, scenarios });
  } catch (err) {
    logger.error({ err }, 'Get scenarios error');
    res.status(500).json({ success: false, error: 'Failed to get scenarios' });
  }
});

/**
 * Get specific scenario details
 */
router.get('/scenarios/:id', async (req: Request, res: Response) => {
  try {
    const scenario = await prisma.scenario.findUnique({
      where: { id: req.params.id }
    });

    if (!scenario || !scenario.enabled) {
      return res.status(404).json({ success: false, error: 'Scenario not found' });
    }

    res.json({ success: true, scenario });
  } catch (err) {
    logger.error({ err }, 'Get scenario error');
    res.status(500).json({ success: false, error: 'Failed to get scenario' });
  }
});

export default router;
