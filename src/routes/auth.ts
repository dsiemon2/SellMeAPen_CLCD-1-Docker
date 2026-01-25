import { Router, Request, Response } from 'express';
import { prisma } from '../db/prisma.js';
import rateLimit from 'express-rate-limit';
import {
  hashPassword,
  verifyPassword,
  isLegacyHash,
  createSession,
  destroySession,
  loadUser,
  requireAuth
} from '../middleware/auth.js';
import {
  generateMFASetup,
  verifyTOTP,
  hashRecoveryCode,
  verifyRecoveryCode,
  createMFAPending,
  getMFAPending,
  markMFAVerified,
  clearMFAPending
} from '../utils/mfa.js';
import { encrypt, decrypt } from '../utils/encryption.js';

const router = Router();

// Rate limiting for login attempts
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: 'Too many login attempts, please try again after 15 minutes',
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.render('auth/login', {
      title: 'Login',
      error: 'Too many login attempts. Please try again after 15 minutes.',
      email: req.body?.email || '',
      redirect: req.body?.redirect || '/chat'
    });
  }
});

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

// Login POST (with rate limiting)
router.post('/login', loginLimiter, async (req: Request, res: Response) => {
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

    // Verify password (now async)
    const passwordValid = user ? await verifyPassword(password, user.passwordHash) : false;

    if (!user || !passwordValid) {
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

    // Upgrade legacy SHA256 hash to bcrypt on successful login
    if (isLegacyHash(user.passwordHash)) {
      const newHash = await hashPassword(password);
      await prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash }
      });
      console.log(`Upgraded password hash for user: ${user.email}`);
    }

    // Check if MFA is enabled
    if (user.mfaEnabled && user.mfaSecret) {
      // Create MFA pending token and redirect to MFA verification
      const mfaToken = createMFAPending(user.id);
      return res.render('auth/mfa_verify', {
        title: 'Two-Factor Authentication',
        mfaToken,
        redirect: redirect || '/chat',
        remember: remember === 'on' ? 'on' : '',
        error: null
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

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
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

// =============================================
// MFA VERIFICATION (during login)
// =============================================

// MFA verification POST
router.post('/mfa/verify', async (req: Request, res: Response) => {
  try {
    const { mfaToken, code, redirect, remember } = req.body;

    // Validate MFA token
    const pending = getMFAPending(mfaToken);
    if (!pending) {
      return res.redirect('/auth/login?error=Session expired. Please login again.');
    }

    // Get user
    const user = await prisma.user.findUnique({
      where: { id: pending.userId }
    });

    if (!user || !user.mfaSecret) {
      clearMFAPending(mfaToken);
      return res.redirect('/auth/login?error=Invalid session');
    }

    // Decrypt and verify TOTP
    const decryptedSecret = decrypt(user.mfaSecret);
    const isValid = verifyTOTP(decryptedSecret, code);

    if (!isValid) {
      return res.render('auth/mfa_verify', {
        title: 'Two-Factor Authentication',
        mfaToken,
        redirect: redirect || '/chat',
        remember: remember || '',
        error: 'Invalid verification code. Please try again.'
      });
    }

    // Clear pending and create session
    clearMFAPending(mfaToken);
    const token = await createSession(user.id, remember === 'on');

    res.cookie('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: remember === 'on' ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
    });

    // Update MFA verified timestamp
    await prisma.user.update({
      where: { id: user.id },
      data: { mfaVerifiedAt: new Date(), lastLoginAt: new Date() }
    });

    res.redirect(redirect || '/chat');
  } catch (error) {
    console.error('MFA verification error:', error);
    res.redirect('/auth/login?error=Verification failed');
  }
});

// MFA recovery code POST
router.post('/mfa/recovery', async (req: Request, res: Response) => {
  try {
    const { mfaToken, recoveryCode, redirect, remember } = req.body;

    const pending = getMFAPending(mfaToken);
    if (!pending) {
      return res.redirect('/auth/login?error=Session expired. Please login again.');
    }

    const user = await prisma.user.findUnique({
      where: { id: pending.userId }
    });

    if (!user) {
      clearMFAPending(mfaToken);
      return res.redirect('/auth/login?error=Invalid session');
    }

    // Parse stored recovery codes
    const storedCodes: string[] = JSON.parse(user.recoveryCodes || '[]');
    const { valid, index } = verifyRecoveryCode(recoveryCode, storedCodes);

    if (!valid) {
      return res.render('auth/mfa_verify', {
        title: 'Two-Factor Authentication',
        mfaToken,
        redirect: redirect || '/chat',
        remember: remember || '',
        error: 'Invalid recovery code'
      });
    }

    // Remove used recovery code
    storedCodes.splice(index, 1);
    await prisma.user.update({
      where: { id: user.id },
      data: { recoveryCodes: JSON.stringify(storedCodes) }
    });

    // Clear pending and create session
    clearMFAPending(mfaToken);
    const token = await createSession(user.id, remember === 'on');

    res.cookie('session_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: remember === 'on' ? 30 * 24 * 60 * 60 * 1000 : 24 * 60 * 60 * 1000
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { mfaVerifiedAt: new Date(), lastLoginAt: new Date() }
    });

    res.redirect(redirect || '/chat');
  } catch (error) {
    console.error('MFA recovery error:', error);
    res.redirect('/auth/login?error=Recovery failed');
  }
});

// =============================================
// MFA SETUP (authenticated users)
// =============================================

// MFA setup page
router.get('/mfa/setup', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;

    if (user.mfaEnabled) {
      return res.render('auth/mfa_setup', {
        title: 'Two-Factor Authentication',
        mfaEnabled: true,
        setupData: null,
        error: null,
        success: null
      });
    }

    // Generate new MFA setup data
    const setupData = generateMFASetup(user.email, 'SellMeAPen');

    res.render('auth/mfa_setup', {
      title: 'Set Up Two-Factor Authentication',
      mfaEnabled: false,
      setupData,
      error: null,
      success: null
    });
  } catch (error) {
    console.error('MFA setup error:', error);
    res.render('auth/mfa_setup', {
      title: 'Two-Factor Authentication',
      mfaEnabled: false,
      setupData: null,
      error: 'Failed to generate MFA setup',
      success: null
    });
  }
});

// Enable MFA POST
router.post('/mfa/enable', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { secret, code, recoveryCodes } = req.body;

    if (!secret || !code || !recoveryCodes) {
      return res.render('auth/mfa_setup', {
        title: 'Set Up Two-Factor Authentication',
        mfaEnabled: false,
        setupData: generateMFASetup(user.email, 'SellMeAPen'),
        error: 'Missing required fields',
        success: null
      });
    }

    // Verify the code
    const isValid = verifyTOTP(secret, code);
    if (!isValid) {
      return res.render('auth/mfa_setup', {
        title: 'Set Up Two-Factor Authentication',
        mfaEnabled: false,
        setupData: generateMFASetup(user.email, 'SellMeAPen'),
        error: 'Invalid verification code. Please try again.',
        success: null
      });
    }

    // Hash recovery codes for storage
    const parsedCodes: string[] = JSON.parse(recoveryCodes);
    const hashedCodes = parsedCodes.map(hashRecoveryCode);

    // Encrypt and store MFA secret
    const encryptedSecret = encrypt(secret);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        mfaEnabled: true,
        mfaSecret: encryptedSecret,
        recoveryCodes: JSON.stringify(hashedCodes),
        mfaVerifiedAt: new Date()
      }
    });

    res.redirect('/auth/settings?success=Two-factor authentication enabled successfully');
  } catch (error) {
    console.error('MFA enable error:', error);
    res.render('auth/mfa_setup', {
      title: 'Set Up Two-Factor Authentication',
      mfaEnabled: false,
      setupData: null,
      error: 'Failed to enable MFA',
      success: null
    });
  }
});

// Disable MFA POST
router.post('/mfa/disable', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { password } = req.body;

    // Verify password
    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) {
      return res.render('auth/mfa_setup', {
        title: 'Two-Factor Authentication',
        mfaEnabled: true,
        setupData: null,
        error: 'Invalid password',
        success: null
      });
    }

    // Disable MFA
    await prisma.user.update({
      where: { id: user.id },
      data: {
        mfaEnabled: false,
        mfaSecret: null,
        recoveryCodes: '[]',
        mfaVerifiedAt: null
      }
    });

    res.redirect('/auth/settings?success=Two-factor authentication disabled');
  } catch (error) {
    console.error('MFA disable error:', error);
    res.redirect('/auth/settings?error=Failed to disable MFA');
  }
});

// =============================================
// USER SETTINGS
// =============================================

// Settings page
router.get('/settings', requireAuth, async (req: Request, res: Response) => {
  res.render('auth/settings', {
    title: 'Account Settings',
    user: req.user,
    error: req.query.error || null,
    success: req.query.success || null
  });
});

// Change password POST
router.post('/change-password', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { currentPassword, newPassword, confirmPassword } = req.body;

    // Validate inputs
    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.redirect('/auth/settings?error=All fields are required');
    }

    if (newPassword !== confirmPassword) {
      return res.redirect('/auth/settings?error=New passwords do not match');
    }

    if (newPassword.length < 8) {
      return res.redirect('/auth/settings?error=Password must be at least 8 characters');
    }

    // Verify current password
    const passwordValid = await verifyPassword(currentPassword, user.passwordHash);
    if (!passwordValid) {
      return res.redirect('/auth/settings?error=Current password is incorrect');
    }

    // Hash and update new password
    const newHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash }
    });

    res.redirect('/auth/settings?success=Password changed successfully');
  } catch (error) {
    console.error('Change password error:', error);
    res.redirect('/auth/settings?error=Failed to change password');
  }
});

export default router;
