import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// Double-submit cookie CSRF protection
// This is a modern, secure approach that doesn't require server-side session storage

const CSRF_COOKIE_NAME = '_csrf';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_FORM_FIELD = '_csrf';

// Generate a cryptographically secure token
export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Middleware to set CSRF token cookie and make it available to templates
export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  // Get existing token from cookie or generate new one
  let token = req.cookies[CSRF_COOKIE_NAME];

  if (!token) {
    token = generateCsrfToken();
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false, // Must be readable by JS to include in AJAX requests
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    });
  }

  // Make token available to templates
  res.locals.csrfToken = token;

  // For safe methods (GET, HEAD, OPTIONS), just continue
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // For state-changing methods, validate the token
  const submittedToken = req.body[CSRF_FORM_FIELD] || req.headers[CSRF_HEADER_NAME];

  if (!submittedToken || submittedToken !== token) {
    return res.status(403).json({
      error: 'Invalid CSRF token',
      message: 'Your session may have expired. Please refresh the page and try again.'
    });
  }

  next();
}

// Middleware that only generates token but doesn't validate (for API routes that use other auth)
export function csrfTokenOnly(req: Request, res: Response, next: NextFunction) {
  let token = req.cookies[CSRF_COOKIE_NAME];

  if (!token) {
    token = generateCsrfToken();
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 24 * 60 * 60 * 1000
    });
  }

  res.locals.csrfToken = token;
  next();
}
