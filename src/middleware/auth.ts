import { Request, Response, NextFunction } from 'express';
import { prisma } from '../db/prisma.js';
import crypto from 'crypto';
import bcrypt from 'bcrypt';

// Extend Express Request to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name: string;
        role: string;
        mfaEnabled: boolean;
        passwordHash: string;
      };
      sessionToken?: string;
    }
  }
}

const SALT_ROUNDS = 12;

// Secure password hashing with bcrypt
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  // Support both bcrypt hashes (start with $2) and legacy SHA256 hashes (64 hex chars)
  if (hash.startsWith('$2')) {
    return bcrypt.compare(password, hash);
  }
  // Legacy SHA256 support for migration - compare and return true if match
  // After verifying, the calling code should upgrade the hash
  const sha256Hash = crypto.createHash('sha256').update(password).digest('hex');
  return sha256Hash === hash;
}

// Check if a hash is legacy SHA256 (for migration purposes)
export function isLegacyHash(hash: string): boolean {
  return !hash.startsWith('$2') && hash.length === 64;
}

// Generate session token
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Get session token from request (cookie or header)
function getSessionToken(req: Request): string | null {
  // Check cookie first
  const cookieToken = req.cookies?.session_token;
  if (cookieToken) return cookieToken;

  // Check Authorization header
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return null;
}

// Middleware to load user from session
export async function loadUser(req: Request, res: Response, next: NextFunction) {
  try {
    const token = getSessionToken(req);
    if (!token) {
      return next();
    }

    const session = await prisma.userSession.findUnique({
      where: { token },
      include: { user: true }
    });

    if (session && session.expiresAt > new Date() && session.user.isActive) {
      req.user = {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
        mfaEnabled: session.user.mfaEnabled,
        passwordHash: session.user.passwordHash
      };
      req.sessionToken = token;
      res.locals.user = req.user;
    }

    next();
  } catch (error) {
    console.error('Error loading user:', error);
    next();
  }
}

// Require authentication (any user)
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    return res.redirect('/auth/login?redirect=' + encodeURIComponent(req.originalUrl));
  }
  next();
}

// Require admin role
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const basePath = req.headers['x-forwarded-prefix'] as string || '';

  if (!req.user) {
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    // Include basePath in redirect so it returns to the correct URL after login
    const redirectUrl = basePath + req.originalUrl;
    return res.redirect(basePath + '/admin/login?redirect=' + encodeURIComponent(redirectUrl));
  }

  if (req.user.role !== 'admin') {
    if (req.xhr || req.headers.accept?.includes('application/json')) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    return res.status(403).render('admin/error', {
      error: 'Access denied. Admin privileges required.',
      token: ''
    });
  }

  next();
}

// Create session for user
export async function createSession(userId: string, remember: boolean = false): Promise<string> {
  const token = generateSessionToken();
  const expiresAt = new Date();

  // 30 days if remember, otherwise 24 hours
  if (remember) {
    expiresAt.setDate(expiresAt.getDate() + 30);
  } else {
    expiresAt.setHours(expiresAt.getHours() + 24);
  }

  await prisma.userSession.create({
    data: {
      userId,
      token,
      expiresAt
    }
  });

  // Update last login
  await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() }
  });

  return token;
}

// Destroy session
export async function destroySession(token: string): Promise<void> {
  try {
    await prisma.userSession.delete({
      where: { token }
    });
  } catch (error) {
    // Session may not exist
  }
}

// Clean up expired sessions (call periodically)
export async function cleanupExpiredSessions(): Promise<void> {
  await prisma.userSession.deleteMany({
    where: {
      expiresAt: { lt: new Date() }
    }
  });
}
