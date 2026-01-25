import pino from 'pino';
import { prisma } from '../db/prisma.js';
import { awardPoints, getGamificationSettings } from './gamificationService.js';

const logger = pino();

export interface EarnedAchievement {
  code: string;
  name: string;
  description: string;
  icon: string;
  tier: string;
  pointsReward: number;
}

/**
 * Check and award any new achievements for a user
 */
export async function checkAchievements(userId: string): Promise<EarnedAchievement[]> {
  const settings = await getGamificationSettings();

  if (!settings.achievementsEnabled) {
    return [];
  }

  const newAchievements: EarnedAchievement[] = [];

  // Get all active achievements
  const achievements = await prisma.achievement.findMany({
    where: { isActive: true }
  });

  // Get user's existing achievements
  const existingAchievements = await prisma.userAchievement.findMany({
    where: { userId },
    select: { achievementId: true }
  });
  const earnedIds = new Set(existingAchievements.map(ua => ua.achievementId));

  // Get user stats for checking
  const stats = await getUserStats(userId);

  for (const achievement of achievements) {
    // Skip if already earned
    if (earnedIds.has(achievement.id)) continue;

    // Check if achievement is earned
    const earned = await checkAchievementCriteria(achievement, stats);

    if (earned) {
      // Award the achievement
      await prisma.userAchievement.create({
        data: {
          userId,
          achievementId: achievement.id
        }
      });

      // Award bonus points
      if (achievement.pointsReward > 0) {
        await awardPoints(userId, achievement.pointsReward, 'achievement', undefined, {
          achievementCode: achievement.code
        });
      }

      newAchievements.push({
        code: achievement.code,
        name: achievement.name,
        description: achievement.description,
        icon: achievement.icon,
        tier: achievement.tier,
        pointsReward: achievement.pointsReward
      });

      logger.info({ userId, achievementCode: achievement.code }, 'Achievement unlocked');
    }
  }

  return newAchievements;
}

/**
 * Get user statistics for achievement checking
 */
async function getUserStats(userId: string) {
  // Get session stats
  const sessions = await prisma.salesSession.findMany({
    where: { userId },
    select: {
      outcome: true,
      saleConfirmed: true,
      endedAt: true
    }
  });

  const completedSessions = sessions.filter(s => s.endedAt);
  const salesMade = sessions.filter(s => s.outcome === 'sale_made' || s.saleConfirmed).length;

  // Get points stats
  const userPoints = await prisma.userPoints.findUnique({
    where: { userId }
  });

  // Get recent scores from points history
  const recentScores = await prisma.pointsHistory.findMany({
    where: {
      userId,
      reason: 'session_complete'
    },
    orderBy: { createdAt: 'desc' },
    take: 20
  });

  // Calculate average score from metadata
  let totalScore = 0;
  let scoreCount = 0;
  let perfectScores = 0;

  for (const ph of recentScores) {
    try {
      const metadata = JSON.parse(ph.metadata || '{}');
      if (metadata.total) {
        totalScore += metadata.total;
        scoreCount++;
        if (metadata.total === 100) perfectScores++;
      }
    } catch {
      // Ignore parse errors
    }
  }

  const avgScore = scoreCount > 0 ? totalScore / scoreCount : 0;
  const conversionRate = completedSessions.length > 0 ? (salesMade / completedSessions.length) * 100 : 0;

  return {
    totalSessions: completedSessions.length,
    salesMade,
    conversionRate,
    avgScore,
    perfectScores,
    currentStreak: userPoints?.currentStreak || 0,
    longestStreak: userPoints?.longestStreak || 0,
    totalPoints: userPoints?.totalPoints || 0,
    level: userPoints?.level || 1
  };
}

/**
 * Check if achievement criteria is met
 */
async function checkAchievementCriteria(
  achievement: { code: string; requirement: string },
  stats: Awaited<ReturnType<typeof getUserStats>>
): Promise<boolean> {
  // Parse requirement JSON
  let requirement: { type: string; value?: number };
  try {
    requirement = JSON.parse(achievement.requirement || '{}');
  } catch {
    requirement = { type: 'unknown' };
  }

  // Match based on achievement code patterns
  switch (achievement.code) {
    // Milestone achievements
    case 'first_sale':
      return stats.salesMade >= 1;

    case 'sales_5':
      return stats.salesMade >= 5;

    case 'sales_25':
      return stats.salesMade >= 25;

    case 'sessions_10':
      return stats.totalSessions >= 10;

    case 'sessions_25':
      return stats.totalSessions >= 25;

    case 'sessions_50':
      return stats.totalSessions >= 50;

    case 'sessions_100':
      return stats.totalSessions >= 100;

    // Performance achievements
    case 'perfect_score':
      return stats.perfectScores >= 1;

    case 'avg_score_90':
      return stats.totalSessions >= 10 && stats.avgScore >= 90;

    case 'conversion_50':
      return stats.totalSessions >= 10 && stats.conversionRate >= 50;

    case 'conversion_75':
      return stats.totalSessions >= 20 && stats.conversionRate >= 75;

    // Streak achievements
    case 'streak_3':
      return stats.currentStreak >= 3 || stats.longestStreak >= 3;

    case 'streak_5':
      return stats.currentStreak >= 5 || stats.longestStreak >= 5;

    case 'streak_7':
      return stats.currentStreak >= 7 || stats.longestStreak >= 7;

    case 'speed_demon':
      // Quick session completion - would need session duration tracking
      return false;

    default:
      // Check generic requirement format
      if (requirement.type && requirement.value) {
        switch (requirement.type) {
          case 'sessions':
            return stats.totalSessions >= requirement.value;
          case 'sales':
            return stats.salesMade >= requirement.value;
          case 'streak':
            return stats.currentStreak >= requirement.value || stats.longestStreak >= requirement.value;
          case 'score':
            return stats.avgScore >= requirement.value;
          case 'conversion':
            return stats.conversionRate >= requirement.value;
        }
      }
      return false;
  }
}

/**
 * Mark achievement notification as read
 */
export async function markAchievementNotified(userId: string, achievementId: string): Promise<void> {
  await prisma.userAchievement.update({
    where: {
      userId_achievementId: { userId, achievementId }
    },
    data: { notified: true }
  });
}

/**
 * Get unnotified achievements for a user
 */
export async function getUnnotifiedAchievements(userId: string): Promise<EarnedAchievement[]> {
  const achievements = await prisma.userAchievement.findMany({
    where: {
      userId,
      notified: false
    },
    include: { achievement: true }
  });

  return achievements.map(ua => ({
    code: ua.achievement.code,
    name: ua.achievement.name,
    description: ua.achievement.description,
    icon: ua.achievement.icon,
    tier: ua.achievement.tier,
    pointsReward: ua.achievement.pointsReward
  }));
}

/**
 * Get all achievements with earned status for a user
 */
export async function getAllAchievementsForUser(userId: string) {
  const achievements = await prisma.achievement.findMany({
    where: { isActive: true },
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }]
  });

  const userAchievements = await prisma.userAchievement.findMany({
    where: { userId },
    select: { achievementId: true, earnedAt: true }
  });

  const earnedMap = new Map(userAchievements.map(ua => [ua.achievementId, ua.earnedAt]));

  return achievements.map(a => ({
    ...a,
    earned: earnedMap.has(a.id),
    earnedAt: earnedMap.get(a.id) || null
  }));
}
