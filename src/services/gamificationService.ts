import pino from 'pino';
import { prisma } from '../db/prisma.js';
import type { SessionScore } from './scoreCalculator.js';

const logger = pino();

// Types
export interface UserGamificationData {
  totalPoints: number;
  level: number;
  dailyPoints: number;
  weeklyPoints: number;
  monthlyPoints: number;
  currentStreak: number;
  longestStreak: number;
  pointsToNextLevel: number;
  achievements: Array<{
    code: string;
    name: string;
    description: string;
    icon: string;
    tier: string;
    earnedAt: Date;
  }>;
  recentActivity: Array<{
    points: number;
    reason: string;
    createdAt: Date;
  }>;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  userName: string;
  points: number;
  level: number;
}

/**
 * Get or create user points record
 */
export async function getOrCreateUserPoints(userId: string) {
  let userPoints = await prisma.userPoints.findUnique({
    where: { userId }
  });

  if (!userPoints) {
    userPoints = await prisma.userPoints.create({
      data: { userId }
    });
    logger.info({ userId }, 'Created new user points record');
  }

  return userPoints;
}

/**
 * Get gamification settings
 */
export async function getGamificationSettings() {
  let settings = await prisma.gamificationSettings.findFirst();

  if (!settings) {
    settings = await prisma.gamificationSettings.create({
      data: {} // Use defaults
    });
  }

  return settings;
}

/**
 * Calculate points for a session based on grade
 */
export async function calculateSessionPoints(
  score: SessionScore,
  saleConfirmed: boolean
): Promise<number> {
  const settings = await getGamificationSettings();
  let points = 0;

  // Points based on grade
  switch (score.grade) {
    case 'A': points = settings.pointsPerGradeA; break;
    case 'B': points = settings.pointsPerGradeB; break;
    case 'C': points = settings.pointsPerGradeC; break;
    case 'D': points = settings.pointsPerGradeD; break;
    default: points = settings.pointsPerGradeF;
  }

  // Bonus for making a sale
  if (saleConfirmed) {
    points += settings.bonusSaleMade;
  }

  return points;
}

/**
 * Award points to a user
 */
export async function awardPoints(
  userId: string,
  points: number,
  reason: string,
  sessionId?: string,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  const settings = await getGamificationSettings();

  if (!settings.achievementsEnabled) {
    logger.debug({ userId }, 'Gamification disabled, skipping points award');
    return;
  }

  const userPoints = await getOrCreateUserPoints(userId);
  const now = new Date();

  // Update user points
  const newTotalPoints = userPoints.totalPoints + points;
  const newLevel = Math.floor(newTotalPoints / settings.levelUpThreshold) + 1;

  await prisma.userPoints.update({
    where: { userId },
    data: {
      totalPoints: newTotalPoints,
      level: newLevel,
      dailyPoints: userPoints.dailyPoints + points,
      weeklyPoints: userPoints.weeklyPoints + points,
      monthlyPoints: userPoints.monthlyPoints + points,
      lastActivityAt: now
    }
  });

  // Record in history
  await prisma.pointsHistory.create({
    data: {
      userId,
      points,
      reason,
      sessionId,
      metadata: JSON.stringify(metadata)
    }
  });

  logger.info({ userId, points, reason, newTotalPoints, newLevel }, 'Points awarded');

  // Check for level up
  if (newLevel > userPoints.level) {
    logger.info({ userId, oldLevel: userPoints.level, newLevel }, 'User leveled up!');
  }
}

/**
 * Update user streak
 */
export async function updateStreak(userId: string): Promise<number> {
  const userPoints = await getOrCreateUserPoints(userId);
  const now = new Date();
  const lastActivity = userPoints.lastActivityAt;

  let newStreak = 1;

  if (lastActivity) {
    const lastDate = new Date(lastActivity);
    const today = new Date(now.toDateString());
    const lastDay = new Date(lastDate.toDateString());
    const diffDays = Math.floor((today.getTime() - lastDay.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
      // Same day, keep current streak
      newStreak = userPoints.currentStreak;
    } else if (diffDays === 1) {
      // Consecutive day, increment streak
      newStreak = userPoints.currentStreak + 1;
    }
    // diffDays > 1 means streak broken, reset to 1
  }

  const newLongestStreak = Math.max(newStreak, userPoints.longestStreak);

  await prisma.userPoints.update({
    where: { userId },
    data: {
      currentStreak: newStreak,
      longestStreak: newLongestStreak,
      lastActivityAt: now
    }
  });

  // Award streak bonuses
  const settings = await getGamificationSettings();
  if (newStreak === 3) {
    await awardPoints(userId, settings.bonusStreak3, 'streak_3');
  } else if (newStreak === 5) {
    await awardPoints(userId, settings.bonusStreak5, 'streak_5');
  } else if (newStreak === 7) {
    await awardPoints(userId, settings.bonusStreak7, 'streak_7');
  }

  return newStreak;
}

/**
 * Get leaderboard
 */
export async function getLeaderboard(
  period: 'daily' | 'weekly' | 'monthly' | 'alltime' = 'weekly',
  limit: number = 10
): Promise<LeaderboardEntry[]> {
  const pointsField = period === 'alltime' ? 'totalPoints' :
                      period === 'daily' ? 'dailyPoints' :
                      period === 'weekly' ? 'weeklyPoints' : 'monthlyPoints';

  const userPoints = await prisma.userPoints.findMany({
    orderBy: { [pointsField]: 'desc' },
    take: limit,
    include: {
      user: {
        select: { id: true, name: true }
      }
    }
  });

  return userPoints.map((up, index) => ({
    rank: index + 1,
    userId: up.userId,
    userName: up.user.name,
    points: up[pointsField as keyof typeof up] as number,
    level: up.level
  }));
}

/**
 * Get user's gamification profile
 */
export async function getUserProgress(userId: string): Promise<UserGamificationData> {
  const userPoints = await getOrCreateUserPoints(userId);
  const settings = await getGamificationSettings();

  // Get user achievements
  const achievements = await prisma.userAchievement.findMany({
    where: { userId },
    include: { achievement: true },
    orderBy: { earnedAt: 'desc' }
  });

  // Get recent activity
  const recentActivity = await prisma.pointsHistory.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 10
  });

  const pointsInCurrentLevel = userPoints.totalPoints % settings.levelUpThreshold;
  const pointsToNextLevel = settings.levelUpThreshold - pointsInCurrentLevel;

  return {
    totalPoints: userPoints.totalPoints,
    level: userPoints.level,
    dailyPoints: userPoints.dailyPoints,
    weeklyPoints: userPoints.weeklyPoints,
    monthlyPoints: userPoints.monthlyPoints,
    currentStreak: userPoints.currentStreak,
    longestStreak: userPoints.longestStreak,
    pointsToNextLevel,
    achievements: achievements.map(ua => ({
      code: ua.achievement.code,
      name: ua.achievement.name,
      description: ua.achievement.description,
      icon: ua.achievement.icon,
      tier: ua.achievement.tier,
      earnedAt: ua.earnedAt
    })),
    recentActivity: recentActivity.map(ph => ({
      points: ph.points,
      reason: ph.reason,
      createdAt: ph.createdAt
    }))
  };
}

/**
 * Reset daily points (run at midnight)
 */
export async function resetDailyPoints(): Promise<void> {
  await prisma.userPoints.updateMany({
    data: { dailyPoints: 0 }
  });
  logger.info('Daily points reset');
}

/**
 * Reset weekly points (run on Sunday midnight)
 */
export async function resetWeeklyPoints(): Promise<void> {
  await prisma.userPoints.updateMany({
    data: { weeklyPoints: 0 }
  });
  logger.info('Weekly points reset');
}

/**
 * Reset monthly points (run on 1st of month)
 */
export async function resetMonthlyPoints(): Promise<void> {
  await prisma.userPoints.updateMany({
    data: { monthlyPoints: 0 }
  });
  logger.info('Monthly points reset');
}

/**
 * Award points for completing a session
 */
export async function awardSessionPoints(
  userId: string,
  score: SessionScore,
  outcome: string,
  sessionId: string
): Promise<number> {
  const saleConfirmed = outcome === 'sale_made';
  const points = await calculateSessionPoints(score, saleConfirmed);

  await awardPoints(userId, points, 'session_complete', sessionId, {
    grade: score.grade,
    total: score.total,
    outcome
  });

  // Update streak
  await updateStreak(userId);

  return points;
}
