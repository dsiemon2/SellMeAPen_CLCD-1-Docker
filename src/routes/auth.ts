import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import {
  hashPassword,
  verifyPassword,
  createSession,
  destroySession,
  loadUser
} from '../middleware/auth.js';

const router = Router();

// Login page
router.get('/login', (req: Request, res: Response) => {
  // If already logged in, redirect to chat
  if (req.user) {
    return res.redirect('/chat');
  }

  res.render('auth/login', {
    title: 'Login',
    error: req.query.error || null,
    success: req.query.success || null,
    email: req.query.email || '',
    redirect: req.query.redirect || '/chat'
  });
});

// Login POST
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password, redirect, remember } = req.body;

    if (!email || !password) {
      return res.render('auth/login', {
        title: 'Login',
        error: 'Email and password are required',
        email,
        redirect: redirect || '/chat'
      });
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user || !verifyPassword(password, user.passwordHash)) {
      return res.render('auth/login', {
        title: 'Login',
        error: 'Invalid email or password',
        email,
        redirect: redirect || '/chat'
      });
    }

    if (!user.isActive) {
      return res.render('auth/login', {
        title: 'Login',
        error: 'Your account has been deactivated',
        email,
        redirect: redirect || '/chat'
      });
    }

    // Create session
    const token = await createSession(user.id, remember === 'on');

    // Set cookie
    res.cookie('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: remember === 'on' ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
    });

    // Redirect
    res.redirect(redirect || '/chat');
  } catch (error) {
    console.error('Login error:', error);
    res.render('auth/login', {
      title: 'Login',
      error: 'An error occurred. Please try again.',
      email: req.body.email,
      redirect: req.body.redirect || '/chat'
    });
  }
});

// Logout
router.get('/logout', async (req: Request, res: Response) => {
  if (req.sessionToken) {
    await destroySession(req.sessionToken);
  }
  res.clearCookie('session_token');
  res.redirect('/?success=logged_out');
});

router.post('/logout', async (req: Request, res: Response) => {
  if (req.sessionToken) {
    await destroySession(req.sessionToken);
  }
  res.clearCookie('session_token');
  res.redirect('/');
});

export default router;
