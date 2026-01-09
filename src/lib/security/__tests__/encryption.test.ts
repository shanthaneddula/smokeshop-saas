/**
 * Tests for Database Password Encryption
 * Run with: npm run test
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  encryptDatabasePassword,
  decryptDatabasePassword,
  isEncrypted,
  generateEncryptionKey,
  testEncryption,
  maskPassword,
  EncryptionError,
  DecryptionError,
  ConfigurationError,
} from '../encryption';

describe('Database Password Encryption', () => {
  const originalEnv = process.env.DB_PASSWORD_ENCRYPTION_KEY;
  
  beforeAll(() => {
    // Set up test encryption key
    process.env.DB_PASSWORD_ENCRYPTION_KEY = generateEncryptionKey();
  });
  
  afterAll(() => {
    // Restore original env
    process.env.DB_PASSWORD_ENCRYPTION_KEY = originalEnv;
  });
  
  describe('encryptDatabasePassword', () => {
    it('should encrypt a password successfully', async () => {
      const password = 'mySecurePassword123!';
      const encrypted = await encryptDatabasePassword(password);
      
      expect(encrypted).toBeDefined();
      expect(typeof encrypted).toBe('string');
      expect(encrypted).not.toBe(password);
      expect(encrypted.split(':')).toHaveLength(5);
    });
    
    it('should produce different encrypted values for same password', async () => {
      const password = 'samePassword';
      const encrypted1 = await encryptDatabasePassword(password);
      const encrypted2 = await encryptDatabasePassword(password);
      
      expect(encrypted1).not.toBe(encrypted2); // Different IVs and salts
    });
    
    it('should throw error for empty password', async () => {
      await expect(encryptDatabasePassword('')).rejects.toThrow(EncryptionError);
    });
    
    it('should throw error for non-string password', async () => {
      await expect(encryptDatabasePassword(null as any)).rejects.toThrow(EncryptionError);
    });
    
    it('should throw error for too long password', async () => {
      const longPassword = 'a'.repeat(1001);
      await expect(encryptDatabasePassword(longPassword)).rejects.toThrow(EncryptionError);
    });
    
    it('should handle special characters', async () => {
      const password = '!@#$%^&*()_+-=[]{}|;:,.<>?';
      const encrypted = await encryptDatabasePassword(password);
      const decrypted = await decryptDatabasePassword(encrypted);
      
      expect(decrypted).toBe(password);
    });
    
    it('should handle unicode characters', async () => {
      const password = '密码测试🔒';
      const encrypted = await encryptDatabasePassword(password);
      const decrypted = await decryptDatabasePassword(encrypted);
      
      expect(decrypted).toBe(password);
    });
  });
  
  describe('decryptDatabasePassword', () => {
    it('should decrypt an encrypted password successfully', async () => {
      const password = 'testPassword123';
      const encrypted = await encryptDatabasePassword(password);
      const decrypted = await decryptDatabasePassword(encrypted);
      
      expect(decrypted).toBe(password);
    });
    
    it('should throw error for invalid format', async () => {
      const invalid = 'not:valid:encrypted:data';
      await expect(decryptDatabasePassword(invalid)).rejects.toThrow(DecryptionError);
    });
    
    it('should throw error for tampered data', async () => {
      const password = 'testPassword';
      const encrypted = await encryptDatabasePassword(password);
      
      // Tamper with encrypted data
      const parts = encrypted.split(':');
      parts[4] = parts[4].slice(0, -2) + 'xx'; // Change last 2 chars
      const tampered = parts.join(':');
      
      await expect(decryptDatabasePassword(tampered)).rejects.toThrow(DecryptionError);
    });
    
    it('should throw error for wrong version', async () => {
      const encrypted = 'v2:aaaa:bbbb:cccc:dddd';
      await expect(decryptDatabasePassword(encrypted)).rejects.toThrow(DecryptionError);
    });
    
    it('should throw error for empty input', async () => {
      await expect(decryptDatabasePassword('')).rejects.toThrow(DecryptionError);
    });
  });
  
  describe('isEncrypted', () => {
    it('should return true for encrypted password', async () => {
      const password = 'testPassword';
      const encrypted = await encryptDatabasePassword(password);
      
      expect(isEncrypted(encrypted)).toBe(true);
    });
    
    it('should return false for plain text', () => {
      expect(isEncrypted('plainPassword')).toBe(false);
    });
    
    it('should return false for empty string', () => {
      expect(isEncrypted('')).toBe(false);
    });
    
    it('should return false for invalid format', () => {
      expect(isEncrypted('v1:a:b:c')).toBe(false);
    });
  });
  
  describe('generateEncryptionKey', () => {
    it('should generate a valid 64-char hex key', () => {
      const key = generateEncryptionKey();
      
      expect(key).toHaveLength(64);
      expect(/^[0-9a-f]{64}$/.test(key)).toBe(true);
    });
    
    it('should generate unique keys', () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();
      
      expect(key1).not.toBe(key2);
    });
  });
  
  describe('testEncryption', () => {
    it('should return true when encryption is working', async () => {
      const result = await testEncryption();
      expect(result).toBe(true);
    });
  });
  
  describe('maskPassword', () => {
    it('should mask password correctly', () => {
      expect(maskPassword('password123')).toBe('pa*******23');
    });
    
    it('should handle short passwords', () => {
      expect(maskPassword('abc')).toBe('***');
    });
    
    it('should handle empty string', () => {
      expect(maskPassword('')).toBe('***');
    });
  });
  
  describe('Configuration errors', () => {
    it('should throw error when encryption key is not set', async () => {
      const originalKey = process.env.DB_PASSWORD_ENCRYPTION_KEY;
      delete process.env.DB_PASSWORD_ENCRYPTION_KEY;
      
      await expect(encryptDatabasePassword('test')).rejects.toThrow(ConfigurationError);
      
      process.env.DB_PASSWORD_ENCRYPTION_KEY = originalKey;
    });
    
    it('should throw error for invalid key format', async () => {
      const originalKey = process.env.DB_PASSWORD_ENCRYPTION_KEY;
      process.env.DB_PASSWORD_ENCRYPTION_KEY = 'invalid_key';
      
      await expect(encryptDatabasePassword('test')).rejects.toThrow(ConfigurationError);
      
      process.env.DB_PASSWORD_ENCRYPTION_KEY = originalKey;
    });
  });
});
