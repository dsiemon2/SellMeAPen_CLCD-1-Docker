import crypto from 'crypto';

// TOTP configuration
const TOTP_PERIOD = 30; // 30 seconds
const TOTP_DIGITS = 6;
const TOTP_ALGORITHM = 'sha1';
const RECOVERY_CODE_COUNT = 10;
const RECOVERY_CODE_LENGTH = 8;

/**
 * Generate a random base32 secret for TOTP
 */
export function generateSecret(length: number = 20): string {
  const buffer = crypto.randomBytes(length);
  return base32Encode(buffer);
}

/**
 * Generate TOTP code from secret
 */
export function generateTOTP(secret: string, time?: number): string {
  const epoch = time || Math.floor(Date.now() / 1000);
  const counter = Math.floor(epoch / TOTP_PERIOD);

  const counterBuffer = Buffer.alloc(8);
  counterBuffer.writeBigInt64BE(BigInt(counter));

  const decodedSecret = base32Decode(secret);
  const hmac = crypto.createHmac(TOTP_ALGORITHM, decodedSecret);
  hmac.update(counterBuffer);
  const hash = hmac.digest();

  const offset = hash[hash.length - 1] & 0xf;
  const binary =
    ((hash[offset] & 0x7f) << 24) |
    ((hash[offset + 1] & 0xff) << 16) |
    ((hash[offset + 2] & 0xff) << 8) |
    (hash[offset + 3] & 0xff);

  const otp = binary % Math.pow(10, TOTP_DIGITS);
  return otp.toString().padStart(TOTP_DIGITS, '0');
}

/**
 * Verify a TOTP code
 * Allows for time drift (checks current, previous, and next period)
 */
export function verifyTOTP(secret: string, code: string, window: number = 1): boolean {
  const epoch = Math.floor(Date.now() / 1000);

  for (let i = -window; i <= window; i++) {
    const time = epoch + (i * TOTP_PERIOD);
    const expectedCode = generateTOTP(secret, time);

    if (timingSafeEqual(code, expectedCode)) {
      return true;
    }
  }

  return false;
}

/**
 * Generate a TOTP URI for QR code generation
 */
export function generateTOTPUri(secret: string, email: string, issuer: string = 'SellMeAPen'): string {
  const encodedIssuer = encodeURIComponent(issuer);
  const encodedEmail = encodeURIComponent(email);
  return `otpauth://totp/${encodedIssuer}:${encodedEmail}?secret=${secret}&issuer=${encodedIssuer}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`;
}

/**
 * Generate recovery codes
 */
export function generateRecoveryCodes(count: number = RECOVERY_CODE_COUNT): string[] {
  const codes: string[] = [];

  for (let i = 0; i < count; i++) {
    const code = crypto.randomBytes(RECOVERY_CODE_LENGTH / 2)
      .toString('hex')
      .toUpperCase();
    // Format as XXXX-XXXX
    codes.push(`${code.slice(0, 4)}-${code.slice(4)}`);
  }

  return codes;
}

/**
 * Hash a recovery code for storage
 */
export function hashRecoveryCode(code: string): string {
  return crypto.createHash('sha256')
    .update(code.replace(/-/g, '').toUpperCase())
    .digest('hex');
}

/**
 * Verify a recovery code against stored hashes
 */
export function verifyRecoveryCode(code: string, hashedCodes: string[]): { valid: boolean; index: number } {
  const inputHash = hashRecoveryCode(code);
  const index = hashedCodes.indexOf(inputHash);
  return { valid: index !== -1, index };
}

// Base32 encoding/decoding
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

function base32Encode(buffer: Buffer): string {
  let result = '';
  let bits = 0;
  let value = 0;

  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;

    while (bits >= 5) {
      bits -= 5;
      result += BASE32_ALPHABET[(value >>> bits) & 31];
    }
  }

  if (bits > 0) {
    result += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }

  return result;
}

function base32Decode(encoded: string): Buffer {
  const cleaned = encoded.toUpperCase().replace(/[^A-Z2-7]/g, '');
  const bytes: number[] = [];
  let bits = 0;
  let value = 0;

  for (const char of cleaned) {
    const index = BASE32_ALPHABET.indexOf(char);
    if (index === -1) continue;

    value = (value << 5) | index;
    bits += 5;

    if (bits >= 8) {
      bits -= 8;
      bytes.push((value >>> bits) & 255);
    }
  }

  return Buffer.from(bytes);
}

// Timing-safe comparison
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);

  return crypto.timingSafeEqual(bufA, bufB);
}

// MFA Session handling
export interface MFAVerification {
  userId: string;
  verified: boolean;
  timestamp: number;
}

// Temporary storage for MFA verification state (in production, use Redis)
const mfaPendingVerifications = new Map<string, MFAVerification>();

/**
 * Create a pending MFA verification
 */
export function createMFAPending(userId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  mfaPendingVerifications.set(token, {
    userId,
    verified: false,
    timestamp: Date.now()
  });

  // Clean up after 5 minutes
  setTimeout(() => {
    mfaPendingVerifications.delete(token);
  }, 5 * 60 * 1000);

  return token;
}

/**
 * Get pending MFA verification
 */
export function getMFAPending(token: string): MFAVerification | undefined {
  return mfaPendingVerifications.get(token);
}

/**
 * Mark MFA as verified
 */
export function markMFAVerified(token: string): boolean {
  const verification = mfaPendingVerifications.get(token);
  if (!verification) return false;

  verification.verified = true;
  return true;
}

/**
 * Clear MFA pending verification
 */
export function clearMFAPending(token: string): void {
  mfaPendingVerifications.delete(token);
}

// Export types for use in other modules
export interface MFASetupData {
  secret: string;
  qrCodeUri: string;
  recoveryCodes: string[];
}

/**
 * Generate complete MFA setup data for a user
 */
export function generateMFASetup(email: string, issuer?: string): MFASetupData {
  const secret = generateSecret();
  const recoveryCodes = generateRecoveryCodes();
  const qrCodeUri = generateTOTPUri(secret, email, issuer);

  return {
    secret,
    qrCodeUri,
    recoveryCodes
  };
}
