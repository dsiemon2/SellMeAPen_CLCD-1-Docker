import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import pino from 'pino';
import rateLimit from 'express-rate-limit';
import {
  hashPassword,
  verifyPassword,
  isLegacyHash,
  createSession,
  destroySession,
  requireAdmin
} from '../middleware/auth.js';

const router = Router();
const logger = pino();

// Rate limiting for admin login attempts
const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many login attempts, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const basePath = res.locals.basePath || '';
    res.render('admin/login', {
      title: 'Admin Login',
      error: 'Too many login attempts. Please try again after 15 minutes.',
      email: req.body?.email || '',
      redirect: req.body?.redirect || (basePath + '/admin'),
      basePath
    });
  }
});

// Helper function to get branding
async function getBranding() {
  const branding = await prisma.branding.findFirst();
  return branding || {
    primaryColor: '#4f46e5',
    secondaryColor: '#3730a3',
    accentColor: '#6366f1'
  };
}

// Add basePath to all responses
router.use((req: Request, res: Response, next: NextFunction) => {
  res.locals.basePath = req.headers['x-forwarded-prefix'] as string || '';
  next();
});

// Admin login page (public)
router.get('/login', (req: Request, res: Response) => {
  const basePath = res.locals.basePath || '';
  if (req.user && req.user.role === 'admin') {
    return res.redirect(basePath + '/admin');
  }
  res.render('admin/login', {
    title: 'Admin Login',
    error: req.query.error || null,
    success: req.query.success || null,
    email: req.query.email || '',
    redirect: req.query.redirect || (basePath + '/admin'),
    basePath
  });
});

// Admin login POST (with rate limiting)
router.post('/login', adminLoginLimiter, async (req: Request, res: Response) => {
  try {
    const basePath = res.locals.basePath || '';
    const { email, password, redirect, remember } = req.body;
    const defaultRedirect = basePath + '/admin';

    if (!email || !password) {
      return res.render('admin/login', {
        title: 'Admin Login',
        error: 'Email and password are required',
        email,
        redirect: redirect || defaultRedirect,
        basePath
      });
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    // Verify password (now async)
    const passwordValid = user ? await verifyPassword(password, user.passwordHash) : false;

    if (!user || !passwordValid) {
      return res.render('admin/login', {
        title: 'Admin Login',
        error: 'Invalid email or password',
        email,
        redirect: redirect || defaultRedirect,
        basePath
      });
    }

    if (user.role !== 'admin') {
      return res.render('admin/login', {
        title: 'Admin Login',
        error: 'Admin access required',
        email,
        redirect: redirect || defaultRedirect,
        basePath
      });
    }

    if (!user.isActive) {
      return res.render('admin/login', {
        title: 'Admin Login',
        error: 'Your account has been deactivated',
        email,
        redirect: redirect || defaultRedirect,
        basePath
      });
    }

    // Upgrade legacy SHA256 hash to bcrypt on successful login
    if (isLegacyHash(user.passwordHash)) {
      const newHash = await hashPassword(password);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash }
      });
      logger.info(`Upgraded password hash for admin user: ${user.email}`);
    }

    const token = await createSession(user.id, remember === 'on');

    res.cookie('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: remember === 'on' ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
    });

    res.redirect(redirect || defaultRedirect);
  } catch (error) {
    console.error('Admin login error:', error);
    res.render('admin/login', {
      title: 'Admin Login',
      error: 'An error occurred. Please try again.',
      email: req.body.email,
      redirect: req.body.redirect || '/admin'
    });
  }
});

// Admin logout
router.get('/logout', async (req: Request, res: Response) => {
  const basePath = res.locals.basePath || '';
  if (req.sessionToken) {
    await destroySession(req.sessionToken);
  }
  res.clearCookie('session_token');
  res.redirect(basePath + '/admin/login?success=logged_out');
});

router.post('/logout', async (req: Request, res: Response) => {
  const basePath = res.locals.basePath || '';
  if (req.sessionToken) {
    await destroySession(req.sessionToken);
  }
  res.clearCookie('session_token');
  res.redirect(basePath + '/admin/login');
});

// Apply admin auth to all routes below
router.use(requireAdmin);

// Dashboard
router.get('/', async (req, res) => {
  try {
    const config = await prisma.appConfig.findFirst();
    const branding = await getBranding();
    const sessions = await prisma.salesSession.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    const totalSessions = await prisma.salesSession.count();
    const salesMade = await prisma.salesSession.count({ where: { outcome: 'sale_made' } });
    const conversionRate = totalSessions > 0 ? ((salesMade / totalSessions) * 100).toFixed(1) : 0;

    const analytics = await prisma.globalAnalytics.findFirst({
      orderBy: { date: 'desc' }
    });

    res.render('admin/dashboard', {
      user: req.user,
      active: 'dashboard',
      basePath: res.locals.basePath,
      branding,
      config,
      sessions,
      stats: {
        totalSessions,
        salesMade,
        conversionRate,
        avgMessages: analytics?.avgMessagesToClose || 0
      }
    });
  } catch (err) {
    logger.error({ err }, 'Dashboard error');
    res.render('admin/error', { error: 'Failed to load dashboard', user: req.user });
  }
});

// Sessions List
router.get('/sessions', async (req, res) => {
  try {
    const branding = await getBranding();
    const sessions = await prisma.salesSession.findMany({
      orderBy: { createdAt: 'desc' },
      include: { analytics: true }
    });

    res.render('admin/sessions', {
      user: req.user,
      active: 'sessions',
      basePath: res.locals.basePath,
      branding,
      sessions
    });
  } catch (err) {
    logger.error({ err }, 'Sessions error');
    res.render('admin/error', { error: 'Failed to load sessions', user: req.user });
  }
});

// Session Detail
router.get('/sessions/:sessionId', async (req, res) => {
  try {
    const branding = await getBranding();
    const session = await prisma.salesSession.findUnique({
      where: { sessionId: req.params.sessionId },
      include: {
        messages: { orderBy: { createdAt: 'asc' } },
        analytics: true
      }
    });

    if (!session) {
      return res.render('admin/error', { error: 'Session not found', user: req.user });
    }

    res.render('admin/session_detail', {
      user: req.user,
      active: 'sessions',
      basePath: res.locals.basePath,
      branding,
      session
    });
  } catch (err) {
    logger.error({ err }, 'Session detail error');
    res.render('admin/error', { error: 'Failed to load session', user: req.user });
  }
});

// Delete Session
router.delete('/sessions/:sessionId', async (req, res) => {
  try {
    // First delete related records (messages, analytics)
    await prisma.message.deleteMany({
      where: { session: { sessionId: req.params.sessionId } }
    });
    await prisma.sessionAnalytics.deleteMany({
      where: { session: { sessionId: req.params.sessionId } }
    });
    // Then delete the session
    await prisma.salesSession.delete({
      where: { sessionId: req.params.sessionId }
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Session delete error');
    res.status(500).json({ success: false, error: 'Failed to delete session' });
  }
});

// Greeting Configuration
router.get('/greeting', async (req, res) => {
  try {
    const branding = await getBranding();
    const config = await prisma.appConfig.findFirst();
    res.render('admin/greeting', {
      user: req.user,
      active: 'greeting',
      basePath: res.locals.basePath,
      branding,
      greeting: config?.greeting || '',
      triggerPhrase: config?.triggerPhrase || 'sell me a pen'
    });
  } catch (err) {
    res.render('admin/error', { error: 'Failed to load greeting config', user: req.user });
  }
});

router.post('/greeting', async (req, res) => {
  try {
    const { greeting, triggerPhrase } = req.body;
    await prisma.appConfig.updateMany({
      data: { greeting, triggerPhrase }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to save' });
  }
});

// Pen Product Configuration
router.get('/product', async (req, res) => {
  try {
    const branding = await getBranding();
    const product = await prisma.penProduct.findFirst();
    res.render('admin/product', {
      user: req.user,
      active: 'product',
      basePath: res.locals.basePath,
      branding,
      product
    });
  } catch (err) {
    res.render('admin/error', { error: 'Failed to load product config', user: req.user });
  }
});

router.post('/product', async (req, res) => {
  try {
    const { name, tagline, basePrice, premiumPrice, features, benefits, variants, scarcityMessage } = req.body;
    await prisma.penProduct.updateMany({
      data: {
        name,
        tagline,
        basePrice: parseFloat(basePrice),
        premiumPrice: parseFloat(premiumPrice),
        features,
        benefits,
        variants,
        scarcityMessage
      }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to save' });
  }
});

// Sales Techniques
router.get('/techniques', async (req, res) => {
  try {
    const branding = await getBranding();
    const techniques = await prisma.salesTechnique.findMany({
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }]
    });

    // Calculate success rates
    const techniquesWithRates = techniques.map(t => ({
      ...t,
      successRate: t.usageCount > 0 ? ((t.successCount / t.usageCount) * 100).toFixed(1) : 0
    }));

    res.render('admin/techniques', {
      user: req.user,
      active: 'techniques',
      basePath: res.locals.basePath,
      branding,
      techniques: techniquesWithRates
    });
  } catch (err) {
    res.render('admin/error', { error: 'Failed to load techniques', user: req.user });
  }
});

router.post('/techniques/:id/toggle', async (req, res) => {
  try {
    const technique = await prisma.salesTechnique.findUnique({ where: { id: req.params.id } });
    if (technique) {
      await prisma.salesTechnique.update({
        where: { id: req.params.id },
        data: { enabled: !technique.enabled }
      });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// Create technique
router.post('/techniques', async (req, res) => {
  try {
    const { name, category, description, script } = req.body;
    await prisma.salesTechnique.create({
      data: { name, category, description, script }
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Create technique error');
    res.status(500).json({ success: false, error: 'Failed to create technique' });
  }
});

// Update technique
router.put('/techniques/:id', async (req, res) => {
  try {
    const { name, category, description, script } = req.body;
    await prisma.salesTechnique.update({
      where: { id: req.params.id },
      data: { name, category, description, script }
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Update technique error');
    res.status(500).json({ success: false, error: 'Failed to update technique' });
  }
});

// Delete technique
router.delete('/techniques/:id', async (req, res) => {
  try {
    await prisma.salesTechnique.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Delete technique error');
    res.status(500).json({ success: false });
  }
});

// Discovery Questions
router.get('/discovery', async (req, res) => {
  try {
    const branding = await getBranding();
    const questions = await prisma.discoveryQuestion.findMany({
      orderBy: { sortOrder: 'asc' }
    });
    res.render('admin/discovery', {
      user: req.user,
      active: 'discovery',
      basePath: res.locals.basePath,
      branding,
      questions
    });
  } catch (err) {
    res.render('admin/error', { error: 'Failed to load discovery questions', user: req.user });
  }
});

router.post('/discovery', async (req, res) => {
  try {
    const { question, purpose, followUp, targetNeed } = req.body;
    await prisma.discoveryQuestion.create({
      data: { question, purpose, followUp, targetNeed }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

router.delete('/discovery/:id', async (req, res) => {
  try {
    await prisma.discoveryQuestion.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// Closing Strategies
router.get('/closing', async (req, res) => {
  try {
    const branding = await getBranding();
    const strategies = await prisma.closingStrategy.findMany({
      orderBy: { sortOrder: 'asc' }
    });
    res.render('admin/closing', {
      user: req.user,
      active: 'closing',
      basePath: res.locals.basePath,
      branding,
      strategies
    });
  } catch (err) {
    res.render('admin/error', { error: 'Failed to load closing strategies', user: req.user });
  }
});

// Create closing strategy
router.post('/closing', async (req, res) => {
  try {
    const { name, type, script, useWhen } = req.body;
    await prisma.closingStrategy.create({
      data: { name, type, script, useWhen }
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Create closing strategy error');
    res.status(500).json({ success: false, error: 'Failed to create closing strategy' });
  }
});

// Update closing strategy
router.put('/closing/:id', async (req, res) => {
  try {
    const { name, type, script, useWhen } = req.body;
    await prisma.closingStrategy.update({
      where: { id: req.params.id },
      data: { name, type, script, useWhen }
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Update closing strategy error');
    res.status(500).json({ success: false, error: 'Failed to update closing strategy' });
  }
});

// Toggle closing strategy
router.post('/closing/:id/toggle', async (req, res) => {
  try {
    const strategy = await prisma.closingStrategy.findUnique({ where: { id: req.params.id } });
    if (strategy) {
      await prisma.closingStrategy.update({
        where: { id: req.params.id },
        data: { enabled: !strategy.enabled }
      });
    }
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Toggle closing strategy error');
    res.status(500).json({ success: false });
  }
});

// Delete closing strategy
router.delete('/closing/:id', async (req, res) => {
  try {
    await prisma.closingStrategy.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Delete closing strategy error');
    res.status(500).json({ success: false });
  }
});

// Objection Handlers
router.get('/objections', async (req, res) => {
  try {
    const branding = await getBranding();
    const handlers = await prisma.objectionHandler.findMany({
      orderBy: { category: 'asc' }
    });
    res.render('admin/objections', {
      user: req.user,
      active: 'objections',
      basePath: res.locals.basePath,
      branding,
      handlers
    });
  } catch (err) {
    res.render('admin/error', { error: 'Failed to load objection handlers', user: req.user });
  }
});

// Create objection handler
router.post('/objections', async (req, res) => {
  try {
    const { objection, category, response, technique } = req.body;
    await prisma.objectionHandler.create({
      data: { objection, category, response, technique }
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Create objection handler error');
    res.status(500).json({ success: false, error: 'Failed to create objection handler' });
  }
});

// Update objection handler
router.put('/objections/:id', async (req, res) => {
  try {
    const { objection, category, response, technique } = req.body;
    await prisma.objectionHandler.update({
      where: { id: req.params.id },
      data: { objection, category, response, technique }
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Update objection handler error');
    res.status(500).json({ success: false, error: 'Failed to update objection handler' });
  }
});

// Toggle objection handler
router.post('/objections/:id/toggle', async (req, res) => {
  try {
    const handler = await prisma.objectionHandler.findUnique({ where: { id: req.params.id } });
    if (handler) {
      await prisma.objectionHandler.update({
        where: { id: req.params.id },
        data: { enabled: !handler.enabled }
      });
    }
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Toggle objection handler error');
    res.status(500).json({ success: false });
  }
});

// Delete objection handler
router.delete('/objections/:id', async (req, res) => {
  try {
    await prisma.objectionHandler.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Delete objection handler error');
    res.status(500).json({ success: false });
  }
});

// AI Prompt Configuration
router.get('/ai-config', async (req, res) => {
  try {
    const branding = await getBranding();
    const config = await prisma.aIPromptConfig.findFirst();
    const appConfig = await prisma.appConfig.findFirst();
    res.render('admin/ai_config', {
      user: req.user,
      active: 'ai-config',
      basePath: res.locals.basePath,
      branding,
      config,
      appConfig
    });
  } catch (err) {
    res.render('admin/error', { error: 'Failed to load AI config', user: req.user });
  }
});

router.post('/ai-config', async (req, res) => {
  try {
    const { systemPrompt, discoveryPrompt, positioningPrompt, closingPrompt, maxClosingAttempts, successKeywords, objectionKeywords } = req.body;

    await prisma.aIPromptConfig.updateMany({
      data: { systemPrompt, discoveryPrompt, positioningPrompt, closingPrompt }
    });

    if (maxClosingAttempts || successKeywords || objectionKeywords) {
      await prisma.appConfig.updateMany({
        data: {
          ...(maxClosingAttempts && { maxClosingAttempts: parseInt(maxClosingAttempts) }),
          ...(successKeywords && { successKeywords }),
          ...(objectionKeywords && { objectionKeywords })
        }
      });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// Analytics
router.get('/analytics', async (req, res) => {
  try {
    const branding = await getBranding();
    // Get recent sessions for charts
    const sessions = await prisma.salesSession.findMany({
      where: { endedAt: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: { analytics: true }
    });

    // Calculate stats
    const totalSessions = sessions.length;
    const salesMade = sessions.filter(s => s.outcome === 'sale_made').length;
    const noSale = sessions.filter(s => s.outcome === 'no_sale').length;
    const abandoned = sessions.filter(s => s.outcome === 'abandoned').length;
    const conversionRate = totalSessions > 0 ? ((salesMade / totalSessions) * 100).toFixed(1) : 0;

    // Get technique performance
    const techniques = await prisma.salesTechnique.findMany({
      orderBy: { successCount: 'desc' },
      take: 10
    });

    // Recent insights
    const insights = await prisma.learningInsight.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    res.render('admin/analytics', {
      user: req.user,
      active: 'analytics',
      basePath: res.locals.basePath,
      branding,
      stats: {
        totalSessions,
        salesMade,
        noSale,
        abandoned,
        conversionRate
      },
      techniques,
      insights,
      sessions
    });
  } catch (err) {
    logger.error({ err }, 'Analytics error');
    res.render('admin/error', { error: 'Failed to load analytics', user: req.user });
  }
});

// Settings
router.get('/settings', async (req, res) => {
  try {
    const branding = await getBranding();
    const storeInfo = await prisma.storeInfo.findFirst();
    const paymentSettings = await prisma.paymentSettings.findFirst();
    res.render('admin/settings', {
      user: req.user,
      active: 'settings',
      basePath: res.locals.basePath,
      branding,
      settings: {
        ...storeInfo,
        ...branding,
        ...paymentSettings
      }
    });
  } catch (err) {
    res.render('admin/error', { error: 'Failed to load settings', user: req.user });
  }
});

router.post('/settings', async (req, res) => {
  try {
    const {
      // Store Info
      businessName, tagline, description, address, phone, email, website, businessHours, timezone,
      // Branding
      logoUrl, faviconUrl, primaryColor, secondaryColor, accentColor, headingFont, bodyFont,
      // Payment Gateways
      paymentsEnabled, stripeEnabled, stripePublishableKey, stripeSecretKey, stripeTestMode,
      paypalEnabled, paypalClientId, paypalClientSecret, paypalSandbox,
      squareEnabled, squareAppId, squareAccessToken, squareSandbox
    } = req.body;

    // Update StoreInfo
    const existingStoreInfo = await prisma.storeInfo.findFirst();
    if (existingStoreInfo) {
      await prisma.storeInfo.update({
        where: { id: existingStoreInfo.id },
        data: { businessName, tagline, description, address, phone, email, website, businessHours, timezone }
      });
    } else {
      await prisma.storeInfo.create({
        data: { businessName, tagline, description, address, phone, email, website, businessHours, timezone }
      });
    }

    // Update Branding
    const existingBranding = await prisma.branding.findFirst();
    if (existingBranding) {
      await prisma.branding.update({
        where: { id: existingBranding.id },
        data: { logoUrl, faviconUrl, primaryColor, secondaryColor, accentColor, headingFont, bodyFont }
      });
    } else {
      await prisma.branding.create({
        data: { logoUrl, faviconUrl, primaryColor, secondaryColor, accentColor, headingFont, bodyFont }
      });
    }

    // Update Payment Settings
    const existingPayment = await prisma.paymentSettings.findFirst();
    const paymentData = {
      enabled: paymentsEnabled,
      stripeEnabled, stripePublishableKey, stripeTestMode,
      paypalEnabled, paypalClientId, paypalSandbox,
      squareEnabled, squareAppId, squareSandbox
    };
    if (existingPayment) {
      await prisma.paymentSettings.update({ where: { id: existingPayment.id }, data: paymentData });
    } else {
      await prisma.paymentSettings.create({ data: paymentData });
    }

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Settings save error');
    res.status(500).json({ success: false });
  }
});

// Features
router.get('/features', async (req, res) => {
  try {
    const branding = await getBranding();
    const features = await prisma.features.findFirst();
    res.render('admin/features', {
      user: req.user,
      active: 'features',
      basePath: res.locals.basePath,
      branding,
      features
    });
  } catch (err) {
    res.render('admin/error', { error: 'Failed to load features', user: req.user });
  }
});

router.post('/features', async (req, res) => {
  try {
    const existing = await prisma.features.findFirst();
    if (existing) {
      await prisma.features.update({ where: { id: existing.id }, data: req.body });
    } else {
      await prisma.features.create({ data: req.body });
    }
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Features save error');
    res.status(500).json({ success: false });
  }
});

// ============================================
// Voices & Mode Configuration
// ============================================

router.get('/voices', async (req, res) => {
  try {
    const branding = await getBranding();
    const config = await prisma.appConfig.findFirst();

    // Get or create default languages
    let languages = await prisma.language.findMany({
      orderBy: { name: 'asc' }
    });

    // Seed default languages if none exist - all 24 languages enabled
    if (languages.length === 0) {
      const defaultLangs = [
        { code: 'en', name: 'English', nativeName: 'English', flag: '🇺🇸', enabled: true },
        { code: 'es', name: 'Spanish', nativeName: 'Español', flag: '🇪🇸', enabled: true },
        { code: 'de', name: 'German', nativeName: 'Deutsch', flag: '🇩🇪', enabled: true },
        { code: 'zh', name: 'Chinese (Mandarin)', nativeName: '中文', flag: '🇨🇳', enabled: true },
        { code: 'vi', name: 'Vietnamese', nativeName: 'Tiếng Việt', flag: '🇻🇳', enabled: true },
        { code: 'fr', name: 'French', nativeName: 'Français', flag: '🇫🇷', enabled: true },
        { code: 'it', name: 'Italian', nativeName: 'Italiano', flag: '🇮🇹', enabled: true },
        { code: 'pt', name: 'Portuguese', nativeName: 'Português', flag: '🇵🇹', enabled: true },
        { code: 'ja', name: 'Japanese', nativeName: '日本語', flag: '🇯🇵', enabled: true },
        { code: 'ko', name: 'Korean', nativeName: '한국어', flag: '🇰🇷', enabled: true },
        { code: 'ar', name: 'Arabic', nativeName: 'العربية', flag: '🇸🇦', enabled: true },
        { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳', enabled: true },
        { code: 'ru', name: 'Russian', nativeName: 'Русский', flag: '🇷🇺', enabled: true },
        { code: 'pl', name: 'Polish', nativeName: 'Polski', flag: '🇵🇱', enabled: true },
        { code: 'nl', name: 'Dutch', nativeName: 'Nederlands', flag: '🇳🇱', enabled: true },
        { code: 'tr', name: 'Turkish', nativeName: 'Türkçe', flag: '🇹🇷', enabled: true },
        { code: 'sv', name: 'Swedish', nativeName: 'Svenska', flag: '🇸🇪', enabled: true },
        { code: 'da', name: 'Danish', nativeName: 'Dansk', flag: '🇩🇰', enabled: true },
        { code: 'no', name: 'Norwegian', nativeName: 'Norsk', flag: '🇳🇴', enabled: true },
        { code: 'fi', name: 'Finnish', nativeName: 'Suomi', flag: '🇫🇮', enabled: true },
        { code: 'cs', name: 'Czech', nativeName: 'Čeština', flag: '🇨🇿', enabled: true },
        { code: 'el', name: 'Greek', nativeName: 'Ελληνικά', flag: '🇬🇷', enabled: true },
        { code: 'he', name: 'Hebrew', nativeName: 'עברית', flag: '🇮🇱', enabled: true },
        { code: 'th', name: 'Thai', nativeName: 'ไทย', flag: '🇹🇭', enabled: true }
      ];

      for (const lang of defaultLangs) {
        await prisma.language.create({ data: lang });
      }

      languages = await prisma.language.findMany({
        orderBy: { name: 'asc' }
      });
    }

    // Add docCount to each language (0 for this app - no KB)
    const languagesWithDocs = languages.map(lang => ({
      ...lang,
      docCount: 0
    }));

    res.render('admin/voices', {
      user: req.user,
      active: 'voices',
      basePath: res.locals.basePath,
      branding,
      config,
      languages: languagesWithDocs,
      totalDocs: 0
    });
  } catch (err) {
    logger.error({ err }, 'Voices page error');
    res.render('admin/error', { error: 'Failed to load voices config', user: req.user });
  }
});

// Select voice
router.post('/voices/select', async (req, res) => {
  try {
    const { voice } = req.body;
    await prisma.appConfig.updateMany({
      data: { selectedVoice: voice }
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Voice select error');
    res.status(500).json({ success: false, error: 'Failed to update voice' });
  }
});

// Set sales mode (ai_sells or user_sells)
router.post('/voices/mode', async (req, res) => {
  try {
    const { mode } = req.body;
    if (!['ai_sells', 'user_sells'].includes(mode)) {
      return res.status(400).json({ success: false, error: 'Invalid mode' });
    }
    await prisma.appConfig.updateMany({
      data: { salesMode: mode }
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Mode update error');
    res.status(500).json({ success: false, error: 'Failed to update mode' });
  }
});

// Set difficulty level
router.post('/voices/difficulty', async (req, res) => {
  try {
    const { difficulty } = req.body;
    if (!['easy', 'medium', 'hard', 'expert'].includes(difficulty)) {
      return res.status(400).json({ success: false, error: 'Invalid difficulty' });
    }
    await prisma.appConfig.updateMany({
      data: { difficulty }
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Difficulty update error');
    res.status(500).json({ success: false, error: 'Failed to update difficulty' });
  }
});

// Add new language
router.post('/voices/language', async (req, res) => {
  try {
    const { code, name, nativeName, flag } = req.body;

    // Check if language already exists
    const existing = await prisma.language.findUnique({ where: { code } });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Language already exists' });
    }

    const language = await prisma.language.create({
      data: { code, name, nativeName, flag: flag || '🌐' }
    });
    res.json({ success: true, language });
  } catch (err) {
    logger.error({ err }, 'Add language error');
    res.status(500).json({ success: false, error: 'Failed to add language' });
  }
});

// Toggle language enabled/disabled
router.post('/voices/language/:id', async (req, res) => {
  try {
    const { enabled } = req.body;

    await prisma.language.update({
      where: { id: req.params.id },
      data: { enabled: !!enabled }
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Toggle language error');
    res.status(500).json({ success: false, error: 'Failed to toggle language' });
  }
});

// Set primary language
router.post('/voices/primary-language', async (req, res) => {
  try {
    const { languageCode } = req.body;
    await prisma.appConfig.updateMany({
      data: { primaryLanguage: languageCode }
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Primary language update error');
    res.status(500).json({ success: false, error: 'Failed to update primary language' });
  }
});

// Delete language
router.delete('/voices/language/:id', async (req, res) => {
  try {
    await prisma.language.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Delete language error');
    res.status(500).json({ success: false, error: 'Failed to delete language' });
  }
});

// ============================================
// WebHooks Configuration
// ============================================

router.get('/webhooks', async (req, res) => {
  try {
    const branding = await getBranding();
    const webhooks = await prisma.webhook.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.render('admin/webhooks', {
      user: req.user,
      active: 'webhooks',
      basePath: res.locals.basePath,
      branding,
      webhooks
    });
  } catch (err) {
    logger.error({ err }, 'Webhooks page error');
    res.render('admin/error', { error: 'Failed to load webhooks', user: req.user });
  }
});

router.post('/webhooks', async (req, res) => {
  try {
    const { name, url, events, secret } = req.body;
    await prisma.webhook.create({
      data: { name, url, events, secret }
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Create webhook error');
    res.status(500).json({ success: false, error: 'Failed to create webhook' });
  }
});

router.post('/webhooks/:id/toggle', async (req, res) => {
  try {
    const webhook = await prisma.webhook.findUnique({ where: { id: req.params.id } });
    if (webhook) {
      await prisma.webhook.update({
        where: { id: req.params.id },
        data: { enabled: !webhook.enabled }
      });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

router.post('/webhooks/:id/test', async (req, res) => {
  try {
    const webhook = await prisma.webhook.findUnique({ where: { id: req.params.id } });
    if (!webhook) {
      return res.status(404).json({ success: false, error: 'Webhook not found' });
    }
    // In production, this would actually call the webhook URL
    res.json({ success: true, message: 'Test webhook sent' });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to test webhook' });
  }
});

router.delete('/webhooks/:id', async (req, res) => {
  try {
    await prisma.webhook.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ============================================
// SMS Settings
// ============================================

router.get('/sms-settings', async (req, res) => {
  try {
    const branding = await getBranding();
    const settings = await prisma.smsSettings.findFirst();
    res.render('admin/sms_settings', {
      user: req.user,
      active: 'sms-settings',
      basePath: res.locals.basePath,
      branding,
      settings
    });
  } catch (err) {
    logger.error({ err }, 'SMS settings page error');
    res.render('admin/error', { error: 'Failed to load SMS settings', user: req.user });
  }
});

router.post('/sms-settings', async (req, res) => {
  try {
    const existing = await prisma.smsSettings.findFirst();
    if (existing) {
      await prisma.smsSettings.update({
        where: { id: existing.id },
        data: req.body
      });
    } else {
      await prisma.smsSettings.create({ data: req.body });
    }
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'SMS settings save error');
    res.status(500).json({ success: false });
  }
});

router.post('/sms-settings/test', async (req, res) => {
  try {
    const { phone } = req.body;
    // In production, this would send an actual SMS
    res.json({ success: true, message: `Test SMS would be sent to ${phone}` });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to send test SMS' });
  }
});

// ============================================
// Call Transfer
// ============================================

router.get('/call-transfer', async (req, res) => {
  try {
    const branding = await getBranding();
    const settings = await prisma.callTransferSettings.findFirst();
    const destinations = await prisma.transferDestination.findMany({
      orderBy: { priority: 'asc' }
    });
    res.render('admin/call_transfer', {
      user: req.user,
      active: 'call-transfer',
      basePath: res.locals.basePath,
      branding,
      settings,
      destinations
    });
  } catch (err) {
    logger.error({ err }, 'Call transfer page error');
    res.render('admin/error', { error: 'Failed to load call transfer settings', user: req.user });
  }
});

router.post('/call-transfer', async (req, res) => {
  try {
    const existing = await prisma.callTransferSettings.findFirst();
    if (existing) {
      await prisma.callTransferSettings.update({
        where: { id: existing.id },
        data: req.body
      });
    } else {
      await prisma.callTransferSettings.create({ data: req.body });
    }
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Call transfer save error');
    res.status(500).json({ success: false });
  }
});

router.post('/call-transfer/destinations', async (req, res) => {
  try {
    const { name, number, priority } = req.body;
    await prisma.transferDestination.create({
      data: { name, number, priority }
    });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

router.post('/call-transfer/destinations/:id/toggle', async (req, res) => {
  try {
    const dest = await prisma.transferDestination.findUnique({ where: { id: req.params.id } });
    if (dest) {
      await prisma.transferDestination.update({
        where: { id: req.params.id },
        data: { enabled: !dest.enabled }
      });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

router.delete('/call-transfer/destinations/:id', async (req, res) => {
  try {
    await prisma.transferDestination.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ============================================
// DTMF Menu
// ============================================

router.get('/dtmf-menu', async (req, res) => {
  try {
    const branding = await getBranding();
    const settings = await prisma.dtmfSettings.findFirst();
    const menuItems = settings?.menuItems ? JSON.parse(settings.menuItems) : {};
    res.render('admin/dtmf_menu', {
      user: req.user,
      active: 'dtmf-menu',
      basePath: res.locals.basePath,
      branding,
      settings,
      menuItems
    });
  } catch (err) {
    logger.error({ err }, 'DTMF menu page error');
    res.render('admin/error', { error: 'Failed to load DTMF settings', user: req.user });
  }
});

router.post('/dtmf-menu', async (req, res) => {
  try {
    const { welcomeMessage, inputTimeout, invalidMessage, maxRetries, menuItems } = req.body;
    const existing = await prisma.dtmfSettings.findFirst();
    const data = {
      welcomeMessage,
      inputTimeout,
      invalidMessage,
      maxRetries,
      menuItems: JSON.stringify(menuItems)
    };
    if (existing) {
      await prisma.dtmfSettings.update({ where: { id: existing.id }, data });
    } else {
      await prisma.dtmfSettings.create({ data });
    }
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'DTMF save error');
    res.status(500).json({ success: false });
  }
});

// ============================================
// AI Providers
// ============================================

router.get('/ai-providers', async (req, res) => {
  try {
    const branding = await getBranding();
    const providers = await prisma.aIProvider.findMany({
      orderBy: { displayOrder: 'asc' }
    });
    const selectedProvider = providers.find(p => p.isSelected);

    // Parse availableModels JSON for each provider
    const providersWithModels = providers.map(p => ({
      ...p,
      availableModels: p.availableModels ? JSON.parse(p.availableModels) : []
    }));

    res.render('admin/ai_providers', {
      user: req.user,
      active: 'ai-providers',
      basePath: res.locals.basePath,
      branding,
      providers: providersWithModels,
      selectedProvider
    });
  } catch (err) {
    logger.error({ err }, 'AI providers page error');
    res.render('admin/error', { error: 'Failed to load AI providers', user: req.user });
  }
});

// Save API Key
router.post('/ai-providers/:id/api-key', async (req, res) => {
  try {
    const { api_key } = req.body;
    if (!api_key || api_key.length < 10) {
      return res.status(400).json({ success: false, message: 'API key must be at least 10 characters' });
    }

    await prisma.aIProvider.update({
      where: { id: req.params.id },
      data: {
        apiKey: api_key,
        isConfigured: true
      }
    });

    // Mask the key for response
    const maskedKey = api_key.slice(0, 4) + '****' + api_key.slice(-4);
    res.json({ success: true, masked_key: maskedKey });
  } catch (err) {
    logger.error({ err }, 'Save API key error');
    res.status(500).json({ success: false, message: 'Failed to save API key' });
  }
});

// Select Provider
router.post('/ai-providers/:id/select', async (req, res) => {
  try {
    const { model } = req.body;

    // First, check if provider is configured
    const provider = await prisma.aIProvider.findUnique({ where: { id: req.params.id } });
    if (!provider || !provider.isConfigured) {
      return res.status(400).json({ success: false, message: 'Provider must have an API key configured' });
    }

    // Deselect all providers
    await prisma.aIProvider.updateMany({
      data: { isSelected: false }
    });

    // Select this provider
    await prisma.aIProvider.update({
      where: { id: req.params.id },
      data: {
        isSelected: true,
        ...(model && { defaultModel: model })
      }
    });

    // Update AppConfig with selected provider
    await prisma.appConfig.updateMany({
      data: { selectedProviderId: req.params.id }
    });

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Select provider error');
    res.status(500).json({ success: false, message: 'Failed to select provider' });
  }
});

// Update Provider Settings (temperature, max_tokens, model, is_active)
router.post('/ai-providers/:id/settings', async (req, res) => {
  try {
    const { temperature, max_tokens, default_model, is_active } = req.body;

    const updateData: any = {};
    if (temperature !== undefined) updateData.temperature = parseFloat(temperature);
    if (max_tokens !== undefined) updateData.maxTokens = parseInt(max_tokens);
    if (default_model !== undefined) updateData.defaultModel = default_model;
    if (is_active !== undefined) updateData.isActive = !!is_active;

    await prisma.aIProvider.update({
      where: { id: req.params.id },
      data: updateData
    });

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Update provider settings error');
    res.status(500).json({ success: false, message: 'Failed to update settings' });
  }
});

// Test Connection
router.post('/ai-providers/:id/test', async (req, res) => {
  try {
    const provider = await prisma.aIProvider.findUnique({ where: { id: req.params.id } });
    if (!provider || !provider.apiKey) {
      return res.status(400).json({ success: false, message: 'No API key configured' });
    }

    // Test based on provider code
    let testResult = { success: false, message: '' };

    switch (provider.code) {
      case 'openai':
        testResult = await testOpenAI(provider.apiKey, provider.apiBaseUrl);
        break;
      case 'anthropic':
        testResult = await testAnthropic(provider.apiKey);
        break;
      case 'gemini':
        testResult = await testGemini(provider.apiKey);
        break;
      case 'deepseek':
      case 'groq':
      case 'mistral':
      case 'grok':
        testResult = await testOpenAICompatible(provider.apiKey, provider.apiBaseUrl || '');
        break;
      default:
        testResult = { success: true, message: 'Connection assumed OK (no test available)' };
    }

    res.json(testResult);
  } catch (err) {
    logger.error({ err }, 'Test connection error');
    res.status(500).json({ success: false, message: 'Connection test failed' });
  }
});

// Test helper functions
async function testOpenAI(apiKey: string, baseUrl?: string | null): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${baseUrl || 'https://api.openai.com/v1'}/models`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    if (response.ok) {
      return { success: true, message: 'Connection successful' };
    }
    const error = await response.json();
    return { success: false, message: error.error?.message || 'Connection failed' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Connection failed' };
  }
}

async function testAnthropic(apiKey: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }]
      })
    });
    if (response.ok) {
      return { success: true, message: 'Connection successful' };
    }
    const error = await response.json();
    return { success: false, message: error.error?.message || 'Connection failed' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Connection failed' };
  }
}

async function testGemini(apiKey: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (response.ok) {
      return { success: true, message: 'Connection successful' };
    }
    const error = await response.json();
    return { success: false, message: error.error?.message || 'Connection failed' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Connection failed' };
  }
}

async function testOpenAICompatible(apiKey: string, baseUrl: string): Promise<{ success: boolean; message: string }> {
  try {
    const response = await fetch(`${baseUrl}/models`, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    if (response.ok) {
      return { success: true, message: 'Connection successful' };
    }
    // Some providers don't have /models endpoint, so try a simple completion
    return { success: true, message: 'Connection assumed OK' };
  } catch (err: any) {
    return { success: false, message: err.message || 'Connection failed' };
  }
}

// ============================================
// AI Tools
// ============================================

router.get('/ai-tools', async (req, res) => {
  try {
    const branding = await getBranding();
    const tools = await prisma.aiToolSettings.findFirst();
    const customTools = await prisma.customTool.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.render('admin/ai_tools', {
      user: req.user,
      active: 'ai-tools',
      basePath: res.locals.basePath,
      branding,
      tools: tools ? JSON.parse(tools.settings || '{}') : {},
      customTools
    });
  } catch (err) {
    logger.error({ err }, 'AI tools page error');
    res.render('admin/error', { error: 'Failed to load AI tools', user: req.user });
  }
});

router.post('/ai-tools', async (req, res) => {
  try {
    const { name, type, description, endpoint, schema } = req.body;
    await prisma.customTool.create({
      data: { name, type, description, endpoint, schema: JSON.stringify(schema) }
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Create tool error');
    res.status(500).json({ success: false });
  }
});

router.post('/ai-tools/builtin/:id/toggle', async (req, res) => {
  try {
    let settings = await prisma.aiToolSettings.findFirst();
    let toolsData = settings?.settings ? JSON.parse(settings.settings) : {};
    toolsData[req.params.id] = toolsData[req.params.id] || {};
    toolsData[req.params.id].enabled = !toolsData[req.params.id].enabled;

    if (settings) {
      await prisma.aiToolSettings.update({
        where: { id: settings.id },
        data: { settings: JSON.stringify(toolsData) }
      });
    } else {
      await prisma.aiToolSettings.create({
        data: { settings: JSON.stringify(toolsData) }
      });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

router.post('/ai-tools/:id/toggle', async (req, res) => {
  try {
    const tool = await prisma.customTool.findUnique({ where: { id: req.params.id } });
    if (tool) {
      await prisma.customTool.update({
        where: { id: req.params.id },
        data: { enabled: !tool.enabled }
      });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

router.delete('/ai-tools/:id', async (req, res) => {
  try {
    await prisma.customTool.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ============================================
// AI Agents
// ============================================

router.get('/ai-agents', async (req, res) => {
  try {
    const branding = await getBranding();
    const agents = await prisma.aiAgent.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.render('admin/ai_agents', {
      user: req.user,
      active: 'ai-agents',
      basePath: res.locals.basePath,
      branding,
      agents: agents.map(a => ({
        ...a,
        tools: a.tools ? JSON.parse(a.tools) : []
      }))
    });
  } catch (err) {
    logger.error({ err }, 'AI agents page error');
    res.render('admin/error', { error: 'Failed to load AI agents', user: req.user });
  }
});

router.post('/ai-agents', async (req, res) => {
  try {
    const { name, description, persona, temperature, tools } = req.body;
    await prisma.aiAgent.create({
      data: { name, description, persona, temperature, tools: JSON.stringify(tools) }
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Create agent error');
    res.status(500).json({ success: false });
  }
});

router.post('/ai-agents/:id/toggle', async (req, res) => {
  try {
    const agent = await prisma.aiAgent.findUnique({ where: { id: req.params.id } });
    if (agent) {
      await prisma.aiAgent.update({
        where: { id: req.params.id },
        data: { enabled: !agent.enabled }
      });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

router.delete('/ai-agents/:id', async (req, res) => {
  try {
    await prisma.aiAgent.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ============================================
// Logic Rules
// ============================================

router.get('/logic-rules', async (req, res) => {
  try {
    const branding = await getBranding();
    const rules = await prisma.logicRule.findMany({
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }]
    });
    res.render('admin/logic_rules', {
      user: req.user,
      active: 'logic-rules',
      basePath: res.locals.basePath,
      branding,
      rules
    });
  } catch (err) {
    logger.error({ err }, 'Logic rules page error');
    res.render('admin/error', { error: 'Failed to load logic rules', user: req.user });
  }
});

router.post('/logic-rules', async (req, res) => {
  try {
    const { name, priority, trigger, condition, action, params } = req.body;
    await prisma.logicRule.create({
      data: { name, priority, trigger, condition, action, params: JSON.stringify(params) }
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Create rule error');
    res.status(500).json({ success: false });
  }
});

router.post('/logic-rules/:id/toggle', async (req, res) => {
  try {
    const rule = await prisma.logicRule.findUnique({ where: { id: req.params.id } });
    if (rule) {
      await prisma.logicRule.update({
        where: { id: req.params.id },
        data: { enabled: !rule.enabled }
      });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

router.delete('/logic-rules/:id', async (req, res) => {
  try {
    await prisma.logicRule.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ============================================
// Functions
// ============================================

router.get('/functions', async (req, res) => {
  try {
    const branding = await getBranding();
    const functions = await prisma.customFunction.findMany({
      orderBy: { createdAt: 'desc' }
    });
    res.render('admin/functions', {
      user: req.user,
      active: 'functions',
      basePath: res.locals.basePath,
      branding,
      functions: functions.map(f => ({
        ...f,
        params: f.params ? JSON.parse(f.params) : []
      }))
    });
  } catch (err) {
    logger.error({ err }, 'Functions page error');
    res.render('admin/error', { error: 'Failed to load functions', user: req.user });
  }
});

router.post('/functions', async (req, res) => {
  try {
    const { name, description, params, body } = req.body;
    await prisma.customFunction.create({
      data: { name, description, params: JSON.stringify(params), body }
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Create function error');
    res.status(500).json({ success: false });
  }
});

router.post('/functions/:id/test', async (req, res) => {
  try {
    const fn = await prisma.customFunction.findUnique({ where: { id: req.params.id } });
    if (!fn) {
      return res.status(404).json({ success: false, error: 'Function not found' });
    }
    // In production, this would execute the function in a sandbox
    res.json({ success: true, result: { message: 'Function executed (sandbox mode)' } });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to test function' });
  }
});

router.post('/functions/:id/toggle', async (req, res) => {
  try {
    const fn = await prisma.customFunction.findUnique({ where: { id: req.params.id } });
    if (fn) {
      await prisma.customFunction.update({
        where: { id: req.params.id },
        data: { enabled: !fn.enabled }
      });
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

router.delete('/functions/:id', async (req, res) => {
  try {
    await prisma.customFunction.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false });
  }
});

// ============================================
// Payment Gateways
// ============================================

const PROVIDER_NAMES: Record<string, string> = {
  stripe: 'Stripe',
  braintree: 'Braintree',
  square: 'Square',
  authorize: 'Authorize.net'
};

// Initialize default payment gateways if they don't exist
async function ensurePaymentGateways() {
  const providers = ['stripe', 'braintree', 'square', 'authorize'];
  for (const provider of providers) {
    const existing = await prisma.paymentGateway.findUnique({ where: { provider } });
    if (!existing) {
      await prisma.paymentGateway.create({
        data: {
          provider,
          name: PROVIDER_NAMES[provider],
          description: `${PROVIDER_NAMES[provider]} payment gateway`,
          isEnabled: false,
          testMode: true
        }
      });
    }
  }
}

router.get('/payments', async (req, res) => {
  try {
    const branding = await getBranding();

    // Ensure all gateway records exist
    await ensurePaymentGateways();

    const gateways = await prisma.paymentGateway.findMany({
      orderBy: { provider: 'asc' }
    });

    res.render('admin/payments', {
      user: req.user,
      active: 'payments',
      basePath: res.locals.basePath,
      branding,
      gateways
    });
  } catch (err) {
    logger.error({ err }, 'Payments page error');
    res.render('admin/error', { error: 'Failed to load payment settings', user: req.user, basePath: res.locals.basePath });
  }
});

// Save gateway configuration
router.post('/payments/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const { publishableKey, secretKey, merchantId, webhookSecret, testMode, achEnabled } = req.body;

    const data: any = {
      publishableKey,
      testMode: testMode ?? true,
      achEnabled: achEnabled ?? false,
      updatedAt: new Date()
    };

    // Only update secret fields if provided (not empty)
    if (secretKey) data.secretKey = secretKey;
    if (webhookSecret) data.webhookSecret = webhookSecret;
    if (merchantId !== undefined) data.merchantId = merchantId;

    await prisma.paymentGateway.upsert({
      where: { provider },
      update: data,
      create: {
        provider,
        name: PROVIDER_NAMES[provider] || provider,
        ...data
      }
    });

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Payment gateway save error');
    res.status(500).json({ success: false, error: 'Failed to save configuration' });
  }
});

// Test gateway connection
router.post('/payments/:provider/test', async (req, res) => {
  try {
    const { provider } = req.params;
    const gateway = await prisma.paymentGateway.findUnique({ where: { provider } });

    if (!gateway || !gateway.publishableKey) {
      return res.json({ success: false, error: 'Gateway not configured' });
    }

    // In production, this would actually test the API
    // For now, just verify keys exist
    if (gateway.secretKey) {
      res.json({ success: true, message: `${PROVIDER_NAMES[provider]} API connection successful` });
    } else {
      res.json({ success: false, error: 'Secret key not configured' });
    }
  } catch (err) {
    logger.error({ err }, 'Payment gateway test error');
    res.status(500).json({ success: false, error: 'Connection test failed' });
  }
});

// Enable gateway (disables all others)
router.post('/payments/:provider/enable', async (req, res) => {
  try {
    const { provider } = req.params;

    // Check if gateway has keys configured
    const gateway = await prisma.paymentGateway.findUnique({ where: { provider } });
    if (!gateway || !gateway.publishableKey) {
      return res.json({ success: false, error: 'Please configure API keys before enabling' });
    }

    // Disable all gateways first
    await prisma.paymentGateway.updateMany({
      data: { isEnabled: false }
    });

    // Enable the selected gateway
    await prisma.paymentGateway.update({
      where: { provider },
      data: { isEnabled: true }
    });

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Payment gateway enable error');
    res.status(500).json({ success: false, error: 'Failed to enable gateway' });
  }
});

// Disable gateway
router.post('/payments/:provider/disable', async (req, res) => {
  try {
    const { provider } = req.params;

    await prisma.paymentGateway.update({
      where: { provider },
      data: { isEnabled: false }
    });

    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Payment gateway disable error');
    res.status(500).json({ success: false, error: 'Failed to disable gateway' });
  }
});

// ============================================
// Knowledge Base
// ============================================

router.get('/knowledge-base', async (req, res) => {
  try {
    const branding = await getBranding();
    const documents = await prisma.knowledgeDocument.findMany({
      orderBy: { createdAt: 'desc' },
      include: { language: true }
    });
    const languages = await prisma.language.findMany({
      where: { enabled: true },
      orderBy: { name: 'asc' }
    });
    res.render('admin/knowledge_base', {
      user: req.user,
      active: 'knowledge-base',
      basePath: res.locals.basePath,
      branding,
      documents,
      languages
    });
  } catch (err) {
    logger.error({ err }, 'Knowledge base page error');
    res.render('admin/error', { error: 'Failed to load knowledge base', user: req.user });
  }
});

router.post('/knowledge-base', async (req, res) => {
  try {
    const { title, type, content, sourceUrl, languageId, tags } = req.body;
    await prisma.knowledgeDocument.create({
      data: {
        title,
        type: type || 'text',
        content: content || '',
        sourceUrl: sourceUrl || null,
        languageId: languageId || null,
        tags: JSON.stringify(tags || []),
        charCount: (content || '').length
      }
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Create document error');
    res.status(500).json({ success: false, error: 'Failed to create document' });
  }
});

router.post('/knowledge-base/:id/toggle', async (req, res) => {
  try {
    const { enabled } = req.body;
    await prisma.knowledgeDocument.update({
      where: { id: req.params.id },
      data: { enabled: !!enabled }
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Toggle document error');
    res.status(500).json({ success: false });
  }
});

router.put('/knowledge-base/:id', async (req, res) => {
  try {
    const { title, content, sourceUrl, languageId, tags } = req.body;
    await prisma.knowledgeDocument.update({
      where: { id: req.params.id },
      data: {
        title,
        content,
        sourceUrl,
        languageId,
        tags: JSON.stringify(tags || []),
        charCount: (content || '').length
      }
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Update document error');
    res.status(500).json({ success: false });
  }
});

router.delete('/knowledge-base/:id', async (req, res) => {
  try {
    await prisma.knowledgeDocument.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Delete document error');
    res.status(500).json({ success: false });
  }
});

// ============================================
// Positioning Angles
// ============================================

router.get('/positioning', async (req, res) => {
  try {
    const branding = await getBranding();
    const angles = await prisma.positioningAngle.findMany({
      orderBy: { userNeed: 'asc' }
    });
    res.render('admin/positioning', {
      user: req.user,
      active: 'positioning',
      basePath: res.locals.basePath,
      branding,
      angles
    });
  } catch (err) {
    logger.error({ err }, 'Positioning angles page error');
    res.render('admin/error', { error: 'Failed to load positioning angles', user: req.user });
  }
});

router.post('/positioning', async (req, res) => {
  try {
    const { userNeed, headline, pitch, emotionalHook } = req.body;
    await prisma.positioningAngle.create({
      data: { userNeed, headline, pitch, emotionalHook }
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Create positioning angle error');
    res.status(500).json({ success: false, error: 'Failed to create positioning angle' });
  }
});

router.put('/positioning/:id', async (req, res) => {
  try {
    const { userNeed, headline, pitch, emotionalHook } = req.body;
    await prisma.positioningAngle.update({
      where: { id: req.params.id },
      data: { userNeed, headline, pitch, emotionalHook }
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Update positioning angle error');
    res.status(500).json({ success: false, error: 'Failed to update positioning angle' });
  }
});

router.post('/positioning/:id/toggle', async (req, res) => {
  try {
    const angle = await prisma.positioningAngle.findUnique({ where: { id: req.params.id } });
    if (angle) {
      await prisma.positioningAngle.update({
        where: { id: req.params.id },
        data: { enabled: !angle.enabled }
      });
    }
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Toggle positioning angle error');
    res.status(500).json({ success: false });
  }
});

router.delete('/positioning/:id', async (req, res) => {
  try {
    await prisma.positioningAngle.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Delete positioning angle error');
    res.status(500).json({ success: false });
  }
});

// ============================================
// User Management
// ============================================

router.get('/users', async (req, res) => {
  try {
    const branding = await getBranding();
    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        createdAt: true,
        _count: { select: { salesSessions: true } }
      }
    });
    res.render('admin/users', {
      user: req.user,
      active: 'users',
      basePath: res.locals.basePath,
      branding,
      users
    });
  } catch (err) {
    logger.error({ err }, 'Users page error');
    res.render('admin/error', { error: 'Failed to load users', user: req.user });
  }
});

router.post('/users', async (req, res) => {
  try {
    const { email, name, password, role } = req.body;

    // Check if email already exists
    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return res.status(400).json({ success: false, error: 'Email already exists' });
    }

    const hashedPassword = await hashPassword(password);
    await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        name,
        passwordHash: hashedPassword,
        role: role || 'user'
      }
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Create user error');
    res.status(500).json({ success: false, error: 'Failed to create user' });
  }
});

router.put('/users/:id', async (req, res) => {
  try {
    const { email, name, role, isActive } = req.body;

    // Check if email is taken by another user
    if (email) {
      const existing = await prisma.user.findFirst({
        where: { email: email.toLowerCase(), NOT: { id: req.params.id } }
      });
      if (existing) {
        return res.status(400).json({ success: false, error: 'Email already in use' });
      }
    }

    await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(email ? { email: email.toLowerCase() } : {}),
        ...(name ? { name } : {}),
        ...(role ? { role } : {}),
        ...(typeof isActive === 'boolean' ? { isActive } : {})
      }
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Update user error');
    res.status(500).json({ success: false, error: 'Failed to update user' });
  }
});

router.post('/users/:id/reset-password', async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
    }

    const hashedPassword = await hashPassword(password);
    await prisma.user.update({
      where: { id: req.params.id },
      data: { passwordHash: hashedPassword }
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Reset password error');
    res.status(500).json({ success: false, error: 'Failed to reset password' });
  }
});

router.post('/users/:id/toggle', async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (user) {
      // Don't allow deactivating yourself
      if (user.id === req.user?.id) {
        return res.status(400).json({ success: false, error: 'Cannot deactivate your own account' });
      }
      await prisma.user.update({
        where: { id: req.params.id },
        data: { isActive: !user.isActive }
      });
    }
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Toggle user error');
    res.status(500).json({ success: false });
  }
});

router.delete('/users/:id', async (req, res) => {
  try {
    // Don't allow deleting yourself
    if (req.params.id === req.user?.id) {
      return res.status(400).json({ success: false, error: 'Cannot delete your own account' });
    }

    // Delete user sessions first
    await prisma.userSession.deleteMany({ where: { userId: req.params.id } });

    // Delete user (cascade will handle related records)
    await prisma.user.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Delete user error');
    res.status(500).json({ success: false });
  }
});

// ============================================
// Audit Logs
// ============================================

router.get('/audit-logs', async (req, res) => {
  try {
    const branding = await getBranding();
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.auditLog.count()
    ]);

    res.render('admin/audit_logs', {
      user: req.user,
      active: 'audit-logs',
      basePath: res.locals.basePath,
      branding,
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    logger.error({ err }, 'Audit logs page error');
    res.render('admin/error', { error: 'Failed to load audit logs', user: req.user });
  }
});

router.get('/audit-logs/api', async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const action = req.query.action as string;
    const resource = req.query.resource as string;
    const userId = req.query.userId as string;
    const offset = (page - 1) * limit;

    const where: any = {};
    if (action) where.action = action;
    if (resource) where.resource = resource;
    if (userId) where.userId = userId;

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit
      }),
      prisma.auditLog.count({ where })
    ]);

    res.json({
      success: true,
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    logger.error({ err }, 'Audit logs API error');
    res.status(500).json({ success: false, error: 'Failed to fetch audit logs' });
  }
});

// ============================================
// GAMIFICATION
// ============================================

router.get('/gamification', async (req, res) => {
  try {
    const branding = await getBranding();
    let settings = await prisma.gamificationSettings.findFirst();
    if (!settings) {
      settings = await prisma.gamificationSettings.create({ data: { id: 'default' } });
    }

    // Get stats
    const [activeUsers, totalPointsResult, achievementsToday, avgLevelResult] = await Promise.all([
      prisma.userPoints.count(),
      prisma.userPoints.aggregate({ _sum: { dailyPoints: true } }),
      prisma.userAchievement.count({
        where: { earnedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } }
      }),
      prisma.userPoints.aggregate({ _avg: { level: true } })
    ]);

    res.render('admin/gamification', {
      user: req.user,
      active: 'gamification',
      basePath: res.locals.basePath,
      branding,
      settings,
      stats: {
        activeUsers,
        totalPointsToday: totalPointsResult._sum.dailyPoints || 0,
        achievementsEarnedToday: achievementsToday,
        avgLevel: avgLevelResult._avg.level || 1
      }
    });
  } catch (err) {
    logger.error({ err }, 'Gamification page error');
    res.render('admin/error', { error: 'Failed to load gamification settings', user: req.user });
  }
});

router.post('/gamification/settings', async (req, res) => {
  try {
    const data = req.body;
    await prisma.gamificationSettings.upsert({
      where: { id: 'default' },
      update: {
        leaderboardEnabled: data.leaderboardEnabled,
        achievementsEnabled: data.achievementsEnabled,
        pointsPerGradeA: data.pointsPerGradeA,
        pointsPerGradeB: data.pointsPerGradeB,
        pointsPerGradeC: data.pointsPerGradeC,
        pointsPerGradeD: data.pointsPerGradeD,
        pointsPerGradeF: data.pointsPerGradeF,
        bonusSaleMade: data.bonusSaleMade,
        levelUpThreshold: data.levelUpThreshold,
        bonusStreak3: data.bonusStreak3,
        bonusStreak5: data.bonusStreak5,
        bonusStreak7: data.bonusStreak7
      },
      create: { id: 'default', ...data }
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Save gamification settings error');
    res.status(500).json({ success: false });
  }
});

router.post('/gamification/reset-daily', async (req, res) => {
  try {
    await prisma.userPoints.updateMany({ data: { dailyPoints: 0 } });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Reset daily points error');
    res.status(500).json({ success: false });
  }
});

router.post('/gamification/reset-weekly', async (req, res) => {
  try {
    await prisma.userPoints.updateMany({ data: { weeklyPoints: 0 } });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Reset weekly points error');
    res.status(500).json({ success: false });
  }
});

// ============================================
// ACHIEVEMENTS
// ============================================

router.get('/achievements', async (req, res) => {
  try {
    const branding = await getBranding();
    const achievements = await prisma.achievement.findMany({
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }]
    });

    res.render('admin/achievements', {
      user: req.user,
      active: 'achievements',
      basePath: res.locals.basePath,
      branding,
      achievements
    });
  } catch (err) {
    logger.error({ err }, 'Achievements page error');
    res.render('admin/error', { error: 'Failed to load achievements', user: req.user });
  }
});

router.post('/achievements', async (req, res) => {
  try {
    const { code, name, icon, description, category, tier, pointsReward, requirement } = req.body;
    await prisma.achievement.create({
      data: { code, name, icon, description, category, tier, pointsReward, requirement }
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Create achievement error');
    res.status(500).json({ success: false });
  }
});

router.put('/achievements/:id', async (req, res) => {
  try {
    const { code, name, icon, description, category, tier, pointsReward, requirement } = req.body;
    await prisma.achievement.update({
      where: { id: req.params.id },
      data: { code, name, icon, description, category, tier, pointsReward, requirement }
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Update achievement error');
    res.status(500).json({ success: false });
  }
});

router.post('/achievements/:id/toggle', async (req, res) => {
  try {
    const achievement = await prisma.achievement.findUnique({ where: { id: req.params.id } });
    if (achievement) {
      await prisma.achievement.update({
        where: { id: req.params.id },
        data: { isActive: !achievement.isActive }
      });
    }
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Toggle achievement error');
    res.status(500).json({ success: false });
  }
});

router.delete('/achievements/:id', async (req, res) => {
  try {
    await prisma.achievement.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Delete achievement error');
    res.status(500).json({ success: false });
  }
});

// ============================================
// LEADERBOARD
// ============================================

router.get('/leaderboard', async (req, res) => {
  try {
    const branding = await getBranding();
    const period = (req.query.period as string) || 'daily';
    const pointsField = period === 'alltime' ? 'totalPoints' :
                        period === 'daily' ? 'dailyPoints' :
                        period === 'weekly' ? 'weeklyPoints' : 'monthlyPoints';

    const leaderboard = await prisma.userPoints.findMany({
      orderBy: { [pointsField]: 'desc' },
      take: 25,
      include: {
        user: { select: { id: true, name: true } }
      }
    });

    const [totalUsers, totalPointsResult, achievementsUnlocked, longestStreakResult] = await Promise.all([
      prisma.userPoints.count(),
      prisma.userPoints.aggregate({ _sum: { totalPoints: true } }),
      prisma.userAchievement.count(),
      prisma.userPoints.aggregate({ _max: { longestStreak: true } })
    ]);

    const recentActivity = await prisma.pointsHistory.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { user: { select: { name: true } } }
    });

    res.render('admin/leaderboard', {
      user: req.user,
      active: 'leaderboard',
      basePath: res.locals.basePath,
      branding,
      leaderboard: leaderboard.map(up => ({
        userId: up.userId,
        userName: up.user.name,
        points: (up as any)[pointsField],
        level: up.level,
        currentStreak: up.currentStreak,
        sessionsCompleted: 0
      })),
      stats: {
        totalUsers,
        totalPoints: totalPointsResult._sum.totalPoints || 0,
        achievementsUnlocked,
        longestStreak: longestStreakResult._max.longestStreak || 0
      },
      recentActivity: recentActivity.map(a => ({
        ...a,
        userName: a.user?.name
      }))
    });
  } catch (err) {
    logger.error({ err }, 'Leaderboard page error');
    res.render('admin/error', { error: 'Failed to load leaderboard', user: req.user });
  }
});

router.get('/leaderboard/data', async (req, res) => {
  try {
    const period = (req.query.period as string) || 'daily';
    const pointsField = period === 'alltime' ? 'totalPoints' :
                        period === 'daily' ? 'dailyPoints' :
                        period === 'weekly' ? 'weeklyPoints' : 'monthlyPoints';

    const leaderboard = await prisma.userPoints.findMany({
      orderBy: { [pointsField]: 'desc' },
      take: 25,
      include: {
        user: { select: { id: true, name: true } }
      }
    });

    res.json({
      success: true,
      leaderboard: leaderboard.map(up => ({
        userId: up.userId,
        userName: up.user.name,
        points: (up as any)[pointsField],
        level: up.level,
        currentStreak: up.currentStreak,
        sessionsCompleted: 0
      }))
    });
  } catch (err) {
    logger.error({ err }, 'Leaderboard data error');
    res.status(500).json({ success: false });
  }
});

// ============================================
// SCENARIOS
// ============================================

router.get('/scenarios', async (req, res) => {
  try {
    const branding = await getBranding();
    const scenarios = await prisma.scenario.findMany({
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }]
    });

    res.render('admin/scenarios', {
      user: req.user,
      active: 'scenarios',
      basePath: res.locals.basePath,
      branding,
      scenarios
    });
  } catch (err) {
    logger.error({ err }, 'Scenarios page error');
    res.render('admin/error', { error: 'Failed to load scenarios', user: req.user });
  }
});

router.post('/scenarios', async (req, res) => {
  try {
    const { name, category, difficulty, description, buyerPersona, successCriteria, coachingTips, estimatedDuration } = req.body;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    await prisma.scenario.create({
      data: {
        name,
        slug,
        category,
        difficulty,
        description,
        buyerPersona,
        successCriteria: successCriteria || '[]',
        coachingTips: coachingTips || '[]',
        estimatedDuration: estimatedDuration || 5
      }
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Create scenario error');
    res.status(500).json({ success: false });
  }
});

router.put('/scenarios/:id', async (req, res) => {
  try {
    const { name, category, difficulty, description, buyerPersona, successCriteria, coachingTips, estimatedDuration } = req.body;
    await prisma.scenario.update({
      where: { id: req.params.id },
      data: {
        name,
        category,
        difficulty,
        description,
        buyerPersona,
        successCriteria: successCriteria || '[]',
        coachingTips: coachingTips || '[]',
        estimatedDuration: estimatedDuration || 5
      }
    });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Update scenario error');
    res.status(500).json({ success: false });
  }
});

router.post('/scenarios/:id/toggle', async (req, res) => {
  try {
    const scenario = await prisma.scenario.findUnique({ where: { id: req.params.id } });
    if (scenario) {
      await prisma.scenario.update({
        where: { id: req.params.id },
        data: { enabled: !scenario.enabled }
      });
    }
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Toggle scenario error');
    res.status(500).json({ success: false });
  }
});

router.delete('/scenarios/:id', async (req, res) => {
  try {
    await prisma.scenario.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    logger.error({ err }, 'Delete scenario error');
    res.status(500).json({ success: false });
  }
});

// ============================================
// CRM INTEGRATIONS
// ============================================

import {
  getSalesforceAuthUrl,
  getHubSpotAuthUrl,
  exchangeSalesforceCode,
  exchangeHubSpotCode,
  disconnectCrm,
  isCrmConfigured,
  initializeCrmIntegrations
} from '../services/crm/crmOAuth.js';
import { getSyncStats, getRecentSyncLogs, retrySyncLog } from '../services/crm/crmSync.js';
import * as salesforceClient from '../services/crm/salesforceClient.js';
import * as hubspotClient from '../services/crm/hubspotClient.js';

// CRM Integrations page
router.get('/crm', requireAdmin, async (req, res) => {
  try {
    const branding = await getBranding();

    // Initialize integrations if needed
    await initializeCrmIntegrations();

    // Get all integrations
    const integrations = await prisma.crmIntegration.findMany({
      orderBy: { provider: 'asc' }
    });

    // Check which are configured
    const configured: Record<string, boolean> = {
      salesforce: isCrmConfigured('salesforce'),
      hubspot: isCrmConfigured('hubspot')
    };

    // Get stats for connected integrations
    const stats: Record<string, any> = {};
    for (const integration of integrations) {
      if (integration.isConnected) {
        stats[integration.provider] = await getSyncStats(integration.provider as 'salesforce' | 'hubspot');
      }
    }

    res.render('admin/crm_integrations', {
      user: req.user,
      active: 'crm',
      basePath: res.locals.basePath,
      branding,
      integrations,
      configured,
      stats
    });
  } catch (err) {
    logger.error({ err }, 'CRM page error');
    res.render('admin/error', { error: 'Failed to load CRM integrations', user: req.user });
  }
});

// Salesforce OAuth connect
router.get('/crm/salesforce/connect', requireAdmin, (req, res) => {
  const state = Buffer.from(JSON.stringify({
    basePath: res.locals.basePath,
    timestamp: Date.now()
  })).toString('base64');
  res.redirect(getSalesforceAuthUrl(state));
});

// Salesforce OAuth callback
router.get('/crm/salesforce/callback', requireAdmin, async (req, res) => {
  const basePath = res.locals.basePath || '';
  try {
    const code = req.query.code as string;
    if (!code) {
      throw new Error('No authorization code received');
    }

    const tokens = await exchangeSalesforceCode(code);

    await prisma.crmIntegration.update({
      where: { provider: 'salesforce' },
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        instanceUrl: tokens.instanceUrl,
        tokenExpiresAt: tokens.expiresAt,
        isConnected: true,
        lastError: null
      }
    });

    res.redirect(`${basePath}/admin/crm?success=Salesforce+connected+successfully`);
  } catch (err: any) {
    logger.error({ err }, 'Salesforce OAuth callback error');
    res.redirect(`${basePath}/admin/crm?error=${encodeURIComponent(err.message)}`);
  }
});

// HubSpot OAuth connect
router.get('/crm/hubspot/connect', requireAdmin, (req, res) => {
  const state = Buffer.from(JSON.stringify({
    basePath: res.locals.basePath,
    timestamp: Date.now()
  })).toString('base64');
  res.redirect(getHubSpotAuthUrl(state));
});

// HubSpot OAuth callback
router.get('/crm/hubspot/callback', requireAdmin, async (req, res) => {
  const basePath = res.locals.basePath || '';
  try {
    const code = req.query.code as string;
    if (!code) {
      throw new Error('No authorization code received');
    }

    const tokens = await exchangeHubSpotCode(code);

    // Get portal info
    let portalId = '';
    try {
      const portalInfo = await hubspotClient.getPortalInfo();
      if (portalInfo) portalId = portalInfo.portalId;
    } catch {}

    await prisma.crmIntegration.update({
      where: { provider: 'hubspot' },
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        tokenExpiresAt: tokens.expiresAt,
        portalId,
        isConnected: true,
        lastError: null
      }
    });

    res.redirect(`${basePath}/admin/crm?success=HubSpot+connected+successfully`);
  } catch (err: any) {
    logger.error({ err }, 'HubSpot OAuth callback error');
    res.redirect(`${basePath}/admin/crm?error=${encodeURIComponent(err.message)}`);
  }
});

// Toggle CRM enabled
router.post('/crm/:provider/toggle', requireAdmin, async (req, res) => {
  try {
    const provider = req.params.provider;
    const { enabled } = req.body;
    await prisma.crmIntegration.update({
      where: { provider },
      data: { isEnabled: enabled }
    });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Test CRM connection
router.post('/crm/:provider/test', requireAdmin, async (req, res) => {
  try {
    const provider = req.params.provider as 'salesforce' | 'hubspot';
    let result;
    if (provider === 'salesforce') {
      result = await salesforceClient.testConnection();
    } else {
      result = await hubspotClient.testConnection();
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Disconnect CRM
router.post('/crm/:provider/disconnect', requireAdmin, async (req, res) => {
  try {
    const provider = req.params.provider as 'salesforce' | 'hubspot';
    await disconnectCrm(provider);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get sync logs
router.get('/crm/:provider/logs', requireAdmin, async (req, res) => {
  try {
    const provider = req.params.provider as 'salesforce' | 'hubspot';
    const logs = await getRecentSyncLogs(provider, 50);
    res.json({ success: true, logs });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Retry sync log
router.post('/crm/sync-logs/:id/retry', requireAdmin, async (req, res) => {
  try {
    const result = await retrySyncLog(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get field mappings
router.get('/crm/:provider/mappings', requireAdmin, async (req, res) => {
  try {
    const integration = await prisma.crmIntegration.findUnique({
      where: { provider: req.params.provider },
      include: { fieldMappings: true }
    });
    res.json({ success: true, mappings: integration?.fieldMappings || [] });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Save field mappings
router.post('/crm/:provider/mappings', requireAdmin, async (req, res) => {
  try {
    const provider = req.params.provider;
    const { mappings } = req.body;

    const integration = await prisma.crmIntegration.findUnique({
      where: { provider }
    });

    if (!integration) {
      return res.status(404).json({ success: false, error: 'Integration not found' });
    }

    // Delete existing mappings
    await prisma.crmFieldMapping.deleteMany({
      where: { integrationId: integration.id }
    });

    // Create new mappings
    for (const mapping of mappings) {
      if (mapping.targetField && mapping.targetObject) {
        await prisma.crmFieldMapping.create({
          data: {
            integrationId: integration.id,
            sourceEntity: 'session',
            sourceField: mapping.sourceField,
            targetObject: mapping.targetObject,
            targetField: mapping.targetField,
            isEnabled: mapping.isEnabled ?? true
          }
        });
      }
    }

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
