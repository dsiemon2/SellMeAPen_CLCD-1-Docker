import pino from 'pino';
import { prisma } from '../db/prisma.js';

const logger = pino();

// Common filler words to detect
const FILLER_WORDS = [
  'um', 'uh', 'er', 'ah', 'like', 'you know', 'basically',
  'actually', 'literally', 'sort of', 'kind of', 'i mean',
  'right', 'so', 'well', 'yeah', 'okay so', 'i guess'
];

// Words that diminish confidence
const CONFIDENCE_DIMINISHERS = [
  'i think', 'maybe', 'probably', 'might', 'possibly',
  'not sure', 'i hope', 'kind of', 'sort of', 'i believe'
];

// Words that boost confidence perception
const CONFIDENCE_BOOSTERS = [
  'absolutely', 'definitely', 'certainly', 'guaranteed',
  'proven', 'i know', 'confident', 'without doubt', 'clearly'
];

// Ideal speaking metrics
const IDEAL_METRICS = {
  wpm: { min: 120, ideal: 150, max: 180 },
  fillerPercentage: { good: 2, acceptable: 5, poor: 10 },
  avgPauseMs: { min: 300, ideal: 600, max: 1500 }
};

export interface UtteranceMetrics {
  wordCount: number;
  durationMs: number;
  wpm: number;
  fillerCount: number;
  fillerWords: Record<string, number>;
}

export interface FillerWordResult {
  count: number;
  words: Record<string, number>;
  percentage: number;
}

export interface SpeechMetrics {
  totalWords: number;
  totalSpeakingTimeMs: number;
  wordsPerMinute: number;
  avgWordsPerUtterance: number;
  fillerWordCount: number;
  fillerWords: Record<string, number>;
  fillerWordPercentage: number;
  pauseCount: number;
  avgPauseDurationMs: number;
  longestPauseDurationMs: number;
  clarityScore: number;
  confidenceScore: number;
}

/**
 * Analyze a single utterance
 */
export function analyzeUtterance(text: string, durationMs: number): UtteranceMetrics {
  const words = text.toLowerCase().trim().split(/\s+/).filter(w => w.length > 0);
  const wordCount = words.length;

  // Calculate WPM for this utterance
  const wpm = durationMs > 0 ? (wordCount / (durationMs / 1000)) * 60 : 0;

  // Detect filler words
  const fillerResult = detectFillerWords(text);

  return {
    wordCount,
    durationMs,
    wpm,
    fillerCount: fillerResult.count,
    fillerWords: fillerResult.words
  };
}

/**
 * Detect filler words in text
 */
export function detectFillerWords(text: string): FillerWordResult {
  const lowerText = text.toLowerCase();
  const words = lowerText.split(/\s+/).filter(w => w.length > 0);
  const totalWords = words.length;

  const fillerCounts: Record<string, number> = {};
  let totalFillers = 0;

  for (const filler of FILLER_WORDS) {
    // Count occurrences (handle multi-word fillers)
    const regex = new RegExp(`\\b${filler}\\b`, 'gi');
    const matches = lowerText.match(regex);
    if (matches && matches.length > 0) {
      fillerCounts[filler] = matches.length;
      totalFillers += matches.length;
    }
  }

  return {
    count: totalFillers,
    words: fillerCounts,
    percentage: totalWords > 0 ? (totalFillers / totalWords) * 100 : 0
  };
}

/**
 * Calculate clarity score (0-100)
 * Based on filler word ratio and pace consistency
 */
export function calculateClarityScore(metrics: Partial<SpeechMetrics>): number {
  let score = 100;

  // Penalize for filler words
  const fillerPct = metrics.fillerWordPercentage || 0;
  if (fillerPct > IDEAL_METRICS.fillerPercentage.poor) {
    score -= 30;
  } else if (fillerPct > IDEAL_METRICS.fillerPercentage.acceptable) {
    score -= 15;
  } else if (fillerPct > IDEAL_METRICS.fillerPercentage.good) {
    score -= 5;
  }

  // Penalize for extreme pace (too fast or too slow)
  const wpm = metrics.wordsPerMinute || 150;
  if (wpm < IDEAL_METRICS.wpm.min) {
    score -= Math.min(20, (IDEAL_METRICS.wpm.min - wpm) / 2);
  } else if (wpm > IDEAL_METRICS.wpm.max) {
    score -= Math.min(20, (wpm - IDEAL_METRICS.wpm.max) / 2);
  }

  // Penalize for very long pauses
  const avgPause = metrics.avgPauseDurationMs || 0;
  if (avgPause > IDEAL_METRICS.avgPauseMs.max) {
    score -= 10;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Calculate confidence score (0-100)
 * Based on pace, filler words, and confident language
 */
export function calculateConfidenceScore(
  metrics: Partial<SpeechMetrics>,
  fullText: string
): number {
  let score = 70; // Start at baseline

  const lowerText = fullText.toLowerCase();

  // Boost for confident language
  for (const booster of CONFIDENCE_BOOSTERS) {
    if (lowerText.includes(booster)) {
      score += 3;
    }
  }

  // Penalize for diminishing language
  for (const diminisher of CONFIDENCE_DIMINISHERS) {
    if (lowerText.includes(diminisher)) {
      score -= 3;
    }
  }

  // Penalize for excessive filler words
  const fillerPct = metrics.fillerWordPercentage || 0;
  if (fillerPct > 5) {
    score -= (fillerPct - 5) * 2;
  }

  // Optimal pace indicates confidence
  const wpm = metrics.wordsPerMinute || 150;
  if (wpm >= IDEAL_METRICS.wpm.min && wpm <= IDEAL_METRICS.wpm.max) {
    score += 10;
  } else if (wpm < 100) {
    // Very slow can indicate uncertainty
    score -= 10;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

/**
 * Analyze speech for an entire session
 */
export async function analyzeSpeechForSession(sessionId: string): Promise<SpeechMetrics | null> {
  try {
    // Get session messages
    const session = await prisma.salesSession.findUnique({
      where: { sessionId },
      include: {
        messages: {
          where: { role: 'user' },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!session || session.messages.length === 0) {
      logger.warn({ sessionId }, 'No user messages found for speech analysis');
      return null;
    }

    // Combine all user messages
    const fullText = session.messages.map(m => m.content).join(' ');
    const words = fullText.split(/\s+/).filter(w => w.length > 0);
    const totalWords = words.length;

    // Estimate speaking time (assume ~150 WPM average if no timing data)
    // In production, this would use actual audio timing
    const estimatedSpeakingTimeMs = (totalWords / 150) * 60 * 1000;

    // Calculate filler words
    const fillerResult = detectFillerWords(fullText);

    // Calculate pauses based on message gaps
    const pauses: number[] = [];
    for (let i = 1; i < session.messages.length; i++) {
      const gap = session.messages[i].createdAt.getTime() -
                  session.messages[i - 1].createdAt.getTime();
      // Consider gaps over 2 seconds as pauses (AI response time excluded)
      if (gap > 2000 && gap < 30000) {
        pauses.push(gap);
      }
    }

    const avgPauseDurationMs = pauses.length > 0 ?
      pauses.reduce((a, b) => a + b, 0) / pauses.length : 0;
    const longestPauseDurationMs = pauses.length > 0 ? Math.max(...pauses) : 0;

    // Calculate metrics
    const wpm = estimatedSpeakingTimeMs > 0 ?
      (totalWords / (estimatedSpeakingTimeMs / 1000)) * 60 : 0;

    const metrics: SpeechMetrics = {
      totalWords,
      totalSpeakingTimeMs: Math.round(estimatedSpeakingTimeMs),
      wordsPerMinute: Math.round(wpm),
      avgWordsPerUtterance: Math.round(totalWords / session.messages.length),
      fillerWordCount: fillerResult.count,
      fillerWords: fillerResult.words,
      fillerWordPercentage: Math.round(fillerResult.percentage * 10) / 10,
      pauseCount: pauses.length,
      avgPauseDurationMs: Math.round(avgPauseDurationMs),
      longestPauseDurationMs: Math.round(longestPauseDurationMs),
      clarityScore: 0,
      confidenceScore: 0
    };

    // Calculate final scores
    metrics.clarityScore = calculateClarityScore(metrics);
    metrics.confidenceScore = calculateConfidenceScore(metrics, fullText);

    // Store in database
    await prisma.speechAnalytics.upsert({
      where: { sessionId },
      update: {
        totalWords: metrics.totalWords,
        totalSpeakingTimeMs: metrics.totalSpeakingTimeMs,
        wordsPerMinute: metrics.wordsPerMinute,
        avgWordsPerUtterance: metrics.avgWordsPerUtterance,
        fillerWordCount: metrics.fillerWordCount,
        fillerWords: JSON.stringify(metrics.fillerWords),
        fillerWordPercentage: metrics.fillerWordPercentage,
        pauseCount: metrics.pauseCount,
        avgPauseDurationMs: metrics.avgPauseDurationMs,
        longestPauseDurationMs: metrics.longestPauseDurationMs,
        clarityScore: metrics.clarityScore,
        confidenceScore: metrics.confidenceScore
      },
      create: {
        sessionId,
        totalWords: metrics.totalWords,
        totalSpeakingTimeMs: metrics.totalSpeakingTimeMs,
        wordsPerMinute: metrics.wordsPerMinute,
        avgWordsPerUtterance: metrics.avgWordsPerUtterance,
        fillerWordCount: metrics.fillerWordCount,
        fillerWords: JSON.stringify(metrics.fillerWords),
        fillerWordPercentage: metrics.fillerWordPercentage,
        pauseCount: metrics.pauseCount,
        avgPauseDurationMs: metrics.avgPauseDurationMs,
        longestPauseDurationMs: metrics.longestPauseDurationMs,
        clarityScore: metrics.clarityScore,
        confidenceScore: metrics.confidenceScore
      }
    });

    logger.info({ sessionId, clarityScore: metrics.clarityScore, confidenceScore: metrics.confidenceScore },
      'Speech analysis complete');

    return metrics;

  } catch (error) {
    logger.error({ error, sessionId }, 'Failed to analyze speech');
    return null;
  }
}

/**
 * Get speech analytics for a session
 */
export async function getSpeechAnalytics(sessionId: string) {
  return prisma.speechAnalytics.findUnique({
    where: { sessionId }
  });
}

/**
 * Generate speech coaching tips based on metrics
 */
export function generateSpeechTips(metrics: SpeechMetrics): string[] {
  const tips: string[] = [];

  // WPM tips
  if (metrics.wordsPerMinute < IDEAL_METRICS.wpm.min) {
    tips.push('Try to pick up your pace slightly. Speaking too slowly can lose the listener\'s attention.');
  } else if (metrics.wordsPerMinute > IDEAL_METRICS.wpm.max) {
    tips.push('Slow down a bit. Speaking too fast can make it hard for customers to follow your pitch.');
  }

  // Filler word tips
  if (metrics.fillerWordPercentage > IDEAL_METRICS.fillerPercentage.acceptable) {
    const topFillers = Object.entries(metrics.fillerWords)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([word]) => `"${word}"`);

    tips.push(`Watch out for filler words like ${topFillers.join(', ')}. Try pausing silently instead.`);
  }

  // Pause tips
  if (metrics.avgPauseDurationMs > IDEAL_METRICS.avgPauseMs.max) {
    tips.push('Your pauses are a bit long. While pausing is good, very long pauses can make you seem uncertain.');
  } else if (metrics.pauseCount === 0) {
    tips.push('Don\'t forget to pause occasionally. Strategic pauses give customers time to absorb information.');
  }

  // Clarity tips
  if (metrics.clarityScore < 70) {
    tips.push('Focus on speaking clearly and confidently. Practice your key points until they flow naturally.');
  }

  // Confidence tips
  if (metrics.confidenceScore < 70) {
    tips.push('Use more assertive language. Replace "I think" with "I know" and "maybe" with "definitely" when appropriate.');
  }

  // Default tip if everything is good
  if (tips.length === 0) {
    tips.push('Great speaking skills! Keep practicing to maintain your confidence and clarity.');
  }

  return tips;
}
