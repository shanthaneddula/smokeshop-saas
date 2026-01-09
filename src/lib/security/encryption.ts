/**
 * Database Password Encryption Service
 * 
 * Uses AES-256-GCM for encryption with authentication tags to prevent tampering.
 * This is critical for storing tenant database credentials securely.
 * 
 * Security requirements:
 * - 256-bit encryption key (32 bytes)
 * - Unique IV per encryption (16 bytes)
 * - Authentication tag validation (16 bytes)
 * - Key rotation support
 * 
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html
 */

import { createCipheriv, createDecipheriv, randomBytes, scrypt } from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(scrypt);

// Algorithm configuration
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32;

// Encryption format: version:salt:iv:authTag:encrypted
const VERSION = 'v1';

/**
 * Error types for better error handling
 */
export class EncryptionError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'EncryptionError';
  }
}

export class DecryptionError extends Error {
  constructor(message: string, public cause?: Error) {
    super(message);
    this.name = 'DecryptionError';
  }
}

export class ConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigurationError';
  }
}

/**
 * Validates encryption key is properly configured
 */
function validateEncryptionKey(): string {
  const key = process.env.DB_PASSWORD_ENCRYPTION_KEY;
  
  if (!key) {
    throw new ConfigurationError(
      'DB_PASSWORD_ENCRYPTION_KEY environment variable is not set. ' +
      'Generate one with: openssl rand -hex 32'
    );
  }
  
  // Remove any whitespace
  const trimmedKey = key.trim();
  
  // Check if it's a hex string (64 characters for 32 bytes)
  if (!/^[0-9a-fA-F]{64}$/.test(trimmedKey)) {
    throw new ConfigurationError(
      'DB_PASSWORD_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
      'Generate one with: openssl rand -hex 32'
    );
  }
  
  return trimmedKey;
}

/**
 * Derives encryption key from master key and salt using PBKDF2
 * This adds an extra layer of security and allows key rotation
 */
async function deriveKey(masterKey: string, salt: Buffer): Promise<Buffer> {
  try {
    // Use scrypt (more secure than PBKDF2) to derive key
    const derivedKey = (await scryptAsync(masterKey, salt, KEY_LENGTH)) as Buffer;
    return derivedKey;
  } catch (error) {
    throw new EncryptionError(
      'Failed to derive encryption key',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Encrypts a database password
 * 
 * @param password - Plain text password to encrypt
 * @returns Encrypted password string with format: version:salt:iv:authTag:encrypted
 * 
 * @example
 * const encrypted = await encryptDatabasePassword('mySecretPassword123');
 * // Returns: "v1:64chars:32chars:32chars:encryptedData"
 */
export async function encryptDatabasePassword(password: string): Promise<string> {
  if (!password || typeof password !== 'string') {
    throw new EncryptionError('Password must be a non-empty string');
  }
  
  if (password.length > 1000) {
    throw new EncryptionError('Password too long (max 1000 characters)');
  }
  
  try {
    // Validate configuration
    const masterKey = validateEncryptionKey();
    
    // Generate random salt and IV for this encryption
    const salt = randomBytes(SALT_LENGTH);
    const iv = randomBytes(IV_LENGTH);
    
    // Derive encryption key from master key + salt
    const derivedKey = await deriveKey(masterKey, salt);
    
    // Create cipher
    const cipher = createCipheriv(ALGORITHM, derivedKey, iv);
    
    // Encrypt password
    let encrypted = cipher.update(password, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    // Get authentication tag (prevents tampering)
    const authTag = cipher.getAuthTag();
    
    // Format: version:salt:iv:authTag:encrypted
    const encryptedData = [
      VERSION,
      salt.toString('hex'),
      iv.toString('hex'),
      authTag.toString('hex'),
      encrypted,
    ].join(':');
    
    return encryptedData;
    
  } catch (error) {
    if (error instanceof EncryptionError || error instanceof ConfigurationError) {
      throw error;
    }
    
    throw new EncryptionError(
      'Failed to encrypt password',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Decrypts a database password
 * 
 * @param encryptedPassword - Encrypted password string
 * @returns Decrypted plain text password
 * 
 * @example
 * const decrypted = await decryptDatabasePassword(encrypted);
 * // Returns: "mySecretPassword123"
 */
export async function decryptDatabasePassword(encryptedPassword: string): Promise<string> {
  if (!encryptedPassword || typeof encryptedPassword !== 'string') {
    throw new DecryptionError('Encrypted password must be a non-empty string');
  }
  
  try {
    // Validate configuration
    const masterKey = validateEncryptionKey();
    
    // Parse encrypted data
    const parts = encryptedPassword.split(':');
    
    if (parts.length !== 5) {
      throw new DecryptionError(
        'Invalid encrypted password format. Expected: version:salt:iv:authTag:encrypted'
      );
    }
    
    const [version, saltHex, ivHex, authTagHex, encrypted] = parts;
    
    // Check version
    if (version !== VERSION) {
      throw new DecryptionError(
        `Unsupported encryption version: ${version}. Expected: ${VERSION}`
      );
    }
    
    // Convert hex strings to buffers
    const salt = Buffer.from(saltHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    
    // Validate lengths
    if (salt.length !== SALT_LENGTH) {
      throw new DecryptionError(`Invalid salt length: ${salt.length}. Expected: ${SALT_LENGTH}`);
    }
    if (iv.length !== IV_LENGTH) {
      throw new DecryptionError(`Invalid IV length: ${iv.length}. Expected: ${IV_LENGTH}`);
    }
    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new DecryptionError(`Invalid auth tag length: ${authTag.length}. Expected: ${AUTH_TAG_LENGTH}`);
    }
    
    // Derive same encryption key
    const derivedKey = await deriveKey(masterKey, salt);
    
    // Create decipher
    const decipher = createDecipheriv(ALGORITHM, derivedKey, iv);
    decipher.setAuthTag(authTag);
    
    // Decrypt password
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
    
  } catch (error) {
    if (error instanceof DecryptionError || error instanceof ConfigurationError) {
      throw error;
    }
    
    // Authentication tag verification failure
    if (error instanceof Error && error.message.includes('Unsupported state')) {
      throw new DecryptionError('Authentication failed. Password may have been tampered with.');
    }
    
    throw new DecryptionError(
      'Failed to decrypt password',
      error instanceof Error ? error : undefined
    );
  }
}

/**
 * Checks if a string is encrypted (has our format)
 * Useful for migration scenarios where some passwords may already be encrypted
 * 
 * @param value - String to check
 * @returns true if string appears to be encrypted with our format
 */
export function isEncrypted(value: string): boolean {
  if (!value || typeof value !== 'string') {
    return false;
  }
  
  const parts = value.split(':');
  return parts.length === 5 && parts[0] === VERSION;
}

/**
 * Generates a new encryption key for initial setup
 * This should be run once and stored securely in environment variables
 * 
 * @returns 64-character hex string (32 bytes)
 * 
 * @example
 * const key = generateEncryptionKey();
 * console.log(`DB_PASSWORD_ENCRYPTION_KEY=${key}`);
 */
export function generateEncryptionKey(): string {
  return randomBytes(KEY_LENGTH).toString('hex');
}

/**
 * Tests encryption/decryption roundtrip
 * Useful for verifying configuration
 */
export async function testEncryption(): Promise<boolean> {
  try {
    const testPassword = 'test_password_123';
    const encrypted = await encryptDatabasePassword(testPassword);
    const decrypted = await decryptDatabasePassword(encrypted);
    
    return decrypted === testPassword;
  } catch (error) {
    console.error('Encryption test failed:', error);
    return false;
  }
}

/**
 * Safely masks a password for logging
 * Shows only first and last 2 characters
 * 
 * @example
 * maskPassword("myPassword123")
 * // Returns: "my**********23"
 */
export function maskPassword(password: string): string {
  if (!password || password.length < 6) {
    return '***';
  }
  
  const start = password.slice(0, 2);
  const end = password.slice(-2);
  const middle = '*'.repeat(Math.min(password.length - 4, 10));
  
  return `${start}${middle}${end}`;
}
