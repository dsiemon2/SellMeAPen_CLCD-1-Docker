import { Router } from 'express';
import { prisma } from '../db/prisma.js';
import { v4 as uuidv4 } from 'uuid';
import { requireAuth } from '../middleware/auth.js';
import { calculateSessionScore } from '../services/scoreCalculator.js';

const router = Router();

// Require auth for chat
router.use(requireAuth);

// Serve the main chat page
router.get('/', async (req, res) => {
  try {
    const config = await prisma.appConfig.findFirst();
    const basePath = req.headers['x-forwarded-prefix'] as string || '';
    res.render('chat', {
      appName: config?.appName || 'AI Sales Training',
      greeting: config?.greeting || 'Welcome to AI Sales, Sell Me a Pen Training App!',
      basePath,
      user: req.user
    });
  } catch (err) {
    const basePath = req.headers['x-forwarded-prefix'] as string || '';
    res.render('chat', {
      appName: 'AI Sales Training',
      greeting: 'Welcome to AI Sales, Sell Me a Pen Training App!',
      basePath,
      user: req.user
    });
  }
});

// API: Create new session
router.post('/api/session', async (req, res) => {
  try {
    const sessionId = uuidv4();
    const session = await prisma.salesSession.create({
      data: {
        sessionId,
        userId: req.user?.id, // Link session to authenticated user
        userName: req.body.userName || req.user?.name || null,
        currentPhase: 'greeting'
      }
    });

    // Create analytics entry
    await prisma.sessionAnalytics.create({
      data: { sessionId: session.id }
    });

    res.json({ success: true, sessionId: session.sessionId });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: End session (with ownership enforcement)
router.post('/api/session/:sessionId/end', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { outcome } = req.body;

    // Find session with ownership check
    const session = await prisma.salesSession.findFirst({
      where: {
        sessionId,
        ...(req.user?.role !== 'admin' ? { userId: req.user?.id } : {})
      }
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found or access denied' });
    }

    await prisma.salesSession.update({
      where: { sessionId },
      data: {
        endedAt: new Date(),
        outcome: outcome || 'abandoned'
      }
    });

    // Update global analytics
    await updateGlobalAnalytics();

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Get app config (for frontend mode/voice/difficulty selection)
router.get('/api/config', async (req, res) => {
  try {
    const config = await prisma.appConfig.findFirst();
    const languages = await prisma.language.findMany({
      where: { enabled: true },
      orderBy: { name: 'asc' }
    });

    res.json({
      success: true,
      config: {
        appName: config?.appName || 'AI Sales Training',
        greeting: config?.greeting || 'Welcome!',
        salesMode: config?.salesMode || 'ai_sells',
        difficulty: config?.difficulty || 'medium',
        selectedVoice: config?.selectedVoice || 'alloy',
        triggerPhrase: config?.triggerPhrase || 'sell me a pen'
      },
      voices: [
        { id: 'ash', name: 'Ash', gender: 'male', desc: 'Confident & authoritative' },
        { id: 'echo', name: 'Echo', gender: 'male', desc: 'Calm & reassuring' },
        { id: 'verse', name: 'Verse', gender: 'male', desc: 'Dynamic & engaging' },
        { id: 'alloy', name: 'Alloy', gender: 'female', desc: 'Neutral & balanced' },
        { id: 'ballad', name: 'Ballad', gender: 'female', desc: 'Warm & expressive' },
        { id: 'coral', name: 'Coral', gender: 'female', desc: 'Friendly & upbeat' },
        { id: 'sage', name: 'Sage', gender: 'female', desc: 'Wise & professional' },
        { id: 'shimmer', name: 'Shimmer', gender: 'female', desc: 'Bright & energetic' }
      ],
      languages
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Update session config (mode, voice, difficulty)
router.post('/api/config', async (req, res) => {
  try {
    const { salesMode, difficulty, selectedVoice } = req.body;

    const updateData: any = {};
    if (salesMode && ['ai_sells', 'user_sells'].includes(salesMode)) {
      updateData.salesMode = salesMode;
    }
    if (difficulty && ['easy', 'medium', 'hard', 'expert'].includes(difficulty)) {
      updateData.difficulty = difficulty;
    }
    if (selectedVoice) {
      updateData.selectedVoice = selectedVoice;
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.appConfig.updateMany({ data: updateData });
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Get session history (with ownership enforcement)
router.get('/api/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await prisma.salesSession.findFirst({
      where: {
        sessionId,
        // Enforce session ownership - user can only access their own sessions
        // Admin users (checked via role) can access any session
        ...(req.user?.role !== 'admin' ? { userId: req.user?.id } : {})
      },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        analytics: true
      }
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found or access denied' });
    }

    res.json({ success: true, session });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Log a message (with ownership enforcement)
router.post('/api/session/:sessionId/message', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { role, content, phase, sentiment, keywords } = req.body;

    // Find session with ownership check
    const session = await prisma.salesSession.findFirst({
      where: {
        sessionId,
        ...(req.user?.role !== 'admin' ? { userId: req.user?.id } : {})
      }
    });
    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found or access denied' });
    }

    const message = await prisma.message.create({
      data: {
        sessionId: session.id,
        role,
        content,
        phase,
        sentiment,
        keywords: keywords ? JSON.stringify(keywords) : '[]'
      }
    });

    // Update session analytics
    await updateSessionAnalytics(session.id);

    res.json({ success: true, messageId: message.id });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// API: Get session score (AI-calculated performance feedback, with ownership enforcement)
router.get('/api/session/:sessionId/score', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Verify ownership first
    const session = await prisma.salesSession.findFirst({
      where: {
        sessionId,
        ...(req.user?.role !== 'admin' ? { userId: req.user?.id } : {})
      }
    });

    if (!session) {
      return res.status(404).json({ success: false, error: 'Session not found or access denied' });
    }

    const score = await calculateSessionScore(sessionId);
    if (!score) {
      return res.status(404).json({ success: false, error: 'Unable to calculate score' });
    }

    res.json({ success: true, score });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Helper: Update session analytics
async function updateSessionAnalytics(sessionId: string) {
  const messages = await prisma.message.findMany({ where: { sessionId } });

  const userMessages = messages.filter(m => m.role === 'user');
  const aiMessages = messages.filter(m => m.role === 'assistant');

  const avgLength = userMessages.length > 0
    ? userMessages.reduce((sum, m) => sum + m.content.length, 0) / userMessages.length
    : 0;

  await prisma.sessionAnalytics.update({
    where: { sessionId },
    data: {
      totalMessages: messages.length,
      userMessageCount: userMessages.length,
      aiMessageCount: aiMessages.length,
      avgResponseLength: avgLength
    }
  });
}

// Helper: Update global analytics
async function updateGlobalAnalytics() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const sessions = await prisma.salesSession.findMany({
    where: { endedAt: { not: null } }
  });

  const successful = sessions.filter(s => s.outcome === 'sale_made').length;
  const failed = sessions.filter(s => s.outcome === 'no_sale').length;
  const abandoned = sessions.filter(s => s.outcome === 'abandoned').length;

  const conversionRate = sessions.length > 0 ? (successful / sessions.length) * 100 : 0;

  await prisma.globalAnalytics.upsert({
    where: { date: today },
    update: {
      totalSessions: sessions.length,
      successfulSales: successful,
      failedSales: failed,
      abandonedSessions: abandoned,
      conversionRate
    },
    create: {
      date: today,
      totalSessions: sessions.length,
      successfulSales: successful,
      failedSales: failed,
      abandonedSessions: abandoned,
      conversionRate
    }
  });
}

export default router;
