import crypto from 'crypto';

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;

// Get encryption key from environment or generate a warning
function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;

  if (!key) {
    console.warn('WARNING: ENCRYPTION_KEY not set in environment. Using derived key from SESSION_SECRET.');
    // Fallback: derive key from SESSION_SECRET if available
    const secret = process.env.SESSION_SECRET || 'default-insecure-key';
    return crypto.scryptSync(secret, 'sellmeapen-salt', KEY_LENGTH);
  }

  // If key is provided as hex string
  if (key.length === 64) {
    return Buffer.from(key, 'hex');
  }

  // If key is provided as base64
  if (key.length === 44) {
    return Buffer.from(key, 'base64');
  }

  // Derive key from provided string
  return crypto.scryptSync(key, 'sellmeapen-salt', KEY_LENGTH);
}

/**
 * Encrypt a plaintext string
 * @param plaintext - The string to encrypt
 * @returns Encrypted string in format: iv:authTag:ciphertext (all hex encoded)
 */
export function encrypt(plaintext: string): string {
  if (!plaintext) return '';

  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:ciphertext
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypt an encrypted string
 * @param encryptedText - The encrypted string in format: iv:authTag:ciphertext
 * @returns Decrypted plaintext string
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return '';

  // Check if it's already decrypted (not in our format)
  if (!encryptedText.includes(':')) {
    // Return as-is for legacy unencrypted values
    return encryptedText;
  }

  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    // Not in expected format, return as-is
    return encryptedText;
  }

  try {
    const key = getEncryptionKey();
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const ciphertext = parts[2];

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(ciphertext, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    // Return empty string on decryption failure
    return '';
  }
}

/**
 * Check if a value is encrypted (in our format)
 */
export function isEncrypted(value: string): boolean {
  if (!value) return false;
  const parts = value.split(':');
  return parts.length === 3 && parts[0].length === 32 && parts[1].length === 32;
}

/**
 * Encrypt a value only if it's not already encrypted
 */
export function ensureEncrypted(value: string): string {
  if (!value) return '';
  if (isEncrypted(value)) return value;
  return encrypt(value);
}

/**
 * Mask a decrypted value for display (show only last 4 chars)
 */
export function maskValue(value: string, showLast: number = 4): string {
  if (!value || value.length <= showLast) return '****';
  return '****' + value.slice(-showLast);
}

/**
 * Generate a new random encryption key (for setup)
 */
export function generateEncryptionKey(): string {
  return crypto.randomBytes(KEY_LENGTH).toString('hex');
}

// Utility for API key management
export const ApiKeyEncryption = {
  /**
   * Encrypt an API key for storage
   */
  encrypt(apiKey: string): string {
    return encrypt(apiKey);
  },

  /**
   * Decrypt an API key for use
   */
  decrypt(encryptedKey: string): string {
    return decrypt(encryptedKey);
  },

  /**
   * Check if an API key value is encrypted
   */
  isEncrypted(value: string): boolean {
    return isEncrypted(value);
  },

  /**
   * Get masked version of an API key for display
   */
  getMasked(encryptedKey: string): string {
    const decrypted = decrypt(encryptedKey);
    return maskValue(decrypted);
  }
};
