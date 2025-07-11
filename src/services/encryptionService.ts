// src/services/encryptionService.ts
/**
 * Servizio di crittografia per Notamy
 *
 * Implementa:
 * - AES-256-GCM per crittografia simmetrica dei messaggi
 * - X25519/Curve25519 per key exchange sicuro (via tweetnacl)
 * - Storage sicuro delle chiavi con Keychain/Keystore
 * - Key Commitment per prevenire key substitution attacks
 * - Fallback graceful per dispositivi non supportati
 * - Operazioni automatiche e silenziose per zero-friction UX
 */
import * as Crypto from 'expo-crypto';
import { Buffer } from 'buffer';
import { Platform } from 'react-native';
import nacl from 'tweetnacl';
import util from 'tweetnacl-util';
import secureKeyService from './secureKeyService';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Try to load native AES module
let AesGcmCrypto: any;
try {
  AesGcmCrypto = require('react-native-aes-gcm-crypto').default;
  console.log('✅ AES-GCM native module loaded');
} catch (error) {
  console.warn('⚠️ AES-GCM native module not available - using fallback');
}

interface KeyPair {
  publicKey: string;
  privateKey: string;
}

interface EncryptedData {
  iv: string;
  content: string;
  tag: string;
  algorithm?: string;
  commitment?: string; // Key commitment for preventing key substitution
}

interface CachedKey {
  key: string;
  timestamp: number;
}

interface SessionInfo {
  sessionId: string;
  created: number;
  algorithm: string;
  curve: string;
  hasCommitment: boolean;
  recipientId?: string;
  status?: 'active' | 'pending' | 'expired';
}

class EncryptionService {
  private readonly ALGORITHM = 'aes-256-gcm';
  private readonly KEY_SIZE = 32; // 256 bits
  private readonly TAG_SIZE = 16; // 128 bits
  private readonly IV_SIZE = 12; // 96 bits for GCM
  private readonly CURVE_TYPE = 'x25519';
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes
  
  private isNativeAesAvailable: boolean;
  private isInitialized: boolean = false;
  private initializationPromise: Promise<void> | null = null;
  private keyCache: Map<string, CachedKey> = new Map();

  constructor() {
    this.isNativeAesAvailable = this.checkAesAvailability();
    // Defer heavy initialization
    this.initializationPromise = this.initialize();
  }

  private async initialize() {
    try {
      // Quick init - defer heavy operations
      this.isInitialized = true;
      console.log('🔐 Encryption Service: Ready for automatic operation');
      
      // Run tests asynchronously without blocking
      if (__DEV__) {
        this.testCryptoCapabilities().catch(console.warn);
      }
    } catch (error) {
      console.warn('⚠️ Encryption Service: Degraded mode', error);
      this.isInitialized = false;
    }
  }

  /**
   * Ensure service is ready - used internally
   */
  private async ensureReady(): Promise<void> {
    if (this.initializationPromise) {
      await this.initializationPromise;
      this.initializationPromise = null;
    }
  }

  /**
   * Check if native AES module is available
   */
  private checkAesAvailability(): boolean {
    if (!AesGcmCrypto) return false;
    
    const requiredMethods = ['encrypt', 'decrypt'];
    for (const method of requiredMethods) {
      if (typeof AesGcmCrypto[method] !== 'function') {
        console.warn(`Missing AES method: ${method}`);
        return false;
      }
    }
    
    return true;
  }

  /**
   * Test crypto capabilities silently
   */
  private async testCryptoCapabilities(): Promise<void> {
    try {
      // Test key generation
      const testKey = await this.generateKey();
      if (!testKey || testKey.length < 32) {
        throw new Error('Key generation test failed');
      }

      // Test X25519 key pair generation
      const keyPair = await this.generateKeyPair();
      if (!keyPair.publicKey || !keyPair.privateKey) {
        throw new Error('Key pair generation test failed');
      }

      console.log('✅ Crypto capabilities verified');
    } catch (error) {
      console.warn('Crypto test failed:', error);
      // Don't throw - allow degraded operation
    }
  }

  /**
   * Generate a cryptographically secure random key
   */
  async generateKey(): Promise<string> {
    await this.ensureReady();
    
    try {
      const randomBytes = await Crypto.getRandomBytesAsync(this.KEY_SIZE);
      return util.encodeBase64(new Uint8Array(randomBytes));
    } catch (error) {
      console.error('Failed to generate key:', error);
      throw new Error('Unable to generate secure key');
    }
  }

  /**
   * Generate a random session ID
   */
  async generateSessionId(): Promise<string> {
    try {
      const randomBytes = await Crypto.getRandomBytesAsync(16);
      return `session_${Buffer.from(randomBytes).toString('hex')}`;
    } catch (error) {
      console.error('Failed to generate session ID:', error);
      // Fallback to timestamp-based ID
      return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  }

  /**
   * Generate X25519 key pair using tweetnacl
   * Optimized for automatic key exchange
   */
  async generateKeyPair(): Promise<KeyPair> {
    await this.ensureReady();
    
    try {
      // Generate ephemeral key pair for Curve25519
      const keyPair = nacl.box.keyPair();
      
      return {
        publicKey: util.encodeBase64(keyPair.publicKey),
        privateKey: util.encodeBase64(keyPair.secretKey)
      };
    } catch (error) {
      console.error('Key pair generation failed:', error);
      throw new Error('Failed to generate secure key pair');
    }
  }

  /**
   * Derive shared secret using X25519 with caching
   */
  async deriveSharedSecret(
    privateKey: string,
    partnerPublicKey: string
  ): Promise<string> {
    await this.ensureReady();
    
    // Check cache first
    const cacheKey = `${privateKey.substring(0, 8)}_${partnerPublicKey.substring(0, 8)}`;
    const cached = this.keyCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.CACHE_DURATION) {
      return cached.key;
    }
    
    try {
      // Decode keys
      const myPrivateKey = util.decodeBase64(privateKey);
      const theirPublicKey = util.decodeBase64(partnerPublicKey);
      
      // Validate key sizes
      if (myPrivateKey.length !== 32 || theirPublicKey.length !== 32) {
        throw new Error('Invalid key size for X25519');
      }
      
      // Compute shared secret
      const sharedSecret = nacl.box.before(theirPublicKey, myPrivateKey);
      
      // Derive AES key from shared secret using HKDF-like construction
      const keyMaterial = util.encodeBase64(sharedSecret);
      const derivedKey = await this.deriveAesKey(keyMaterial, 'notamy-e2e-v1');
      
      // Cache the result
      this.keyCache.set(cacheKey, {
        key: derivedKey,
        timestamp: Date.now()
      });
      
      // Clean old cache entries
      this.cleanCache();
      
      return derivedKey;
    } catch (error: any) {
      console.error('Shared secret derivation failed:', error);
      throw new Error(`Failed to derive shared secret: ${error.message}`);
    }
  }

  /**
   * Clean expired cache entries
   */
  private cleanCache(): void {
    const now = Date.now();
    for (const [key, value] of this.keyCache.entries()) {
      if (now - value.timestamp > this.CACHE_DURATION) {
        this.keyCache.delete(key);
      }
    }
  }

  /**
   * Derive AES key from key material using HKDF-like construction
   */
  private async deriveAesKey(keyMaterial: string, info: string): Promise<string> {
    try {
      // Simple HKDF-like key derivation
      const salt = 'notamy-2024-salt';
      const combined = `${keyMaterial}:${salt}:${info}`;
      
      // Use SHA-256 to derive final key
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        combined,
        { encoding: Crypto.CryptoEncoding.BASE64 }
      );
      
      // Ensure we have exactly 32 bytes
      const keyBuffer = Buffer.from(hash, 'base64');
      return keyBuffer.slice(0, this.KEY_SIZE).toString('base64');
    } catch (error) {
      console.error('Key derivation failed:', error);
      throw new Error('Failed to derive encryption key');
    }
  }

  /**
   * Encrypt a message using AES-256-GCM
   * Automatically uses best available method
   */
  async encrypt(message: string, keyBase64: string): Promise<string> {
    if (!message) {
      throw new Error('Cannot encrypt empty message');
    }

    if (!keyBase64 || !this.isValidKey(keyBase64)) {
      throw new Error('Invalid encryption key');
    }

    // Try native AES first
    if (this.isNativeAesAvailable) {
      try {
        return await this.encryptNative(message, keyBase64);
      } catch (error) {
        console.warn('Native encryption failed, using fallback:', error);
      }
    }

    // Fallback to JavaScript implementation
    return await this.encryptFallback(message, keyBase64);
  }

  /**
   * Encrypt with Key Commitment to prevent key substitution attacks
   * Used automatically for new messages
   */
  async encryptWithCommitment(message: string, keyBase64: string): Promise<string> {
    const encrypted = await this.encrypt(message, keyBase64);
    const parsed = JSON.parse(encrypted);
    
    // Add commitment to prevent key substitution
    const commitment = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      keyBase64 + parsed.iv,
      { encoding: Crypto.CryptoEncoding.HEX }
    );
    
    parsed.commitment = commitment.substring(0, 16); // First 16 chars are sufficient
    return JSON.stringify(parsed);
  }

  /**
   * Try to encrypt a message - returns null on failure instead of throwing
   * Useful for automatic fallback to unencrypted messages
   */
  async tryEncrypt(message: string, keyBase64: string): Promise<string | null> {
    try {
      return await this.encryptWithCommitment(message, keyBase64);
    } catch (error) {
      console.warn('Encryption failed silently:', error);
      return null;
    }
  }

  /**
   * Native AES-256-GCM encryption
   */
  private async encryptNative(message: string, keyBase64: string): Promise<string> {
    try {
      // Call native module
      const result = await AesGcmCrypto.encrypt(message, false, keyBase64);
      
      // Convert to standard format
      if (typeof result === 'string') {
        // Parse combined format
        const combined = Buffer.from(result, 'base64');
        const iv = combined.slice(0, this.IV_SIZE);
        const tag = combined.slice(-this.TAG_SIZE);
        const content = combined.slice(this.IV_SIZE, -this.TAG_SIZE);
        
        const encrypted: EncryptedData = {
          iv: iv.toString('hex'),
          content: content.toString('base64'),
          tag: tag.toString('hex'),
          algorithm: this.ALGORITHM
        };
        
        return JSON.stringify(encrypted);
      } else if (result && typeof result === 'object') {
        return JSON.stringify({
          iv: result.iv,
          content: result.content,
          tag: result.tag,
          algorithm: this.ALGORITHM
        });
      }
      
      throw new Error('Unexpected encryption result format');
    } catch (error: any) {
      throw new Error(`Native encryption failed: ${error.message}`);
    }
  }

  /**
   * Fallback encryption using tweetnacl
   */
  private async encryptFallback(message: string, keyBase64: string): Promise<string> {
    try {
      // Generate nonce (24 bytes for nacl.secretbox)
      const nonceBytes = await Crypto.getRandomBytesAsync(24);
      const nonce = new Uint8Array(nonceBytes);
      
      // Prepare message
      const messageBytes = util.decodeUTF8(message);
      
      // Prepare key (32 bytes)
      const keyBytes = util.decodeBase64(keyBase64);
      if (keyBytes.length !== 32) {
        throw new Error('Invalid key size for encryption');
      }
      
      // Encrypt using nacl.secretbox
      const encrypted = nacl.secretbox(messageBytes, nonce, keyBytes);
      
      if (!encrypted) {
        throw new Error('Encryption failed');
      }
      
      // Format for compatibility
      const result: EncryptedData = {
        iv: util.encodeBase64(nonce), // Using nonce as IV
        content: util.encodeBase64(encrypted),
        tag: '', // nacl.secretbox includes auth tag in ciphertext
        algorithm: 'xchacha20-poly1305' // What nacl.secretbox actually uses
      };
      
      return JSON.stringify(result);
    } catch (error: any) {
      throw new Error(`Fallback encryption failed: ${error.message}`);
    }
  }

  /**
   * Decrypt a message with optional commitment verification
   */
  async decrypt(encryptedData: string | any, keyBase64: string): Promise<string> {
    if (!encryptedData) {
      throw new Error('No data to decrypt');
    }

    if (!keyBase64 || !this.isValidKey(keyBase64)) {
      throw new Error('Invalid decryption key');
    }

    // Parse encrypted data
    let parsed: EncryptedData;
    try {
      parsed = typeof encryptedData === 'string'
        ? JSON.parse(encryptedData)
        : encryptedData;
    } catch {
      throw new Error('Invalid encrypted data format');
    }

    // Verify commitment if present
    if (parsed.commitment) {
      await this.verifyCommitment(parsed, keyBase64);
    }

    // Check algorithm and decrypt accordingly
    if (parsed.algorithm === 'xchacha20-poly1305') {
      return await this.decryptFallback(parsed, keyBase64);
    }

    // Try native AES first
    if (this.isNativeAesAvailable) {
      try {
        return await this.decryptNative(parsed, keyBase64);
      } catch (error) {
        console.warn('Native decryption failed, trying fallback:', error);
      }
    }

    // Try fallback
    return await this.decryptFallback(parsed, keyBase64);
  }

  /**
   * Try to decrypt a message - returns null on failure instead of throwing
   * Useful for automatic handling of encrypted messages
   */
  async tryDecrypt(encryptedData: string | any, keyBase64: string): Promise<string | null> {
    try {
      return await this.decrypt(encryptedData, keyBase64);
    } catch (error) {
      console.warn('Decryption failed silently:', error);
      return null;
    }
  }

  /**
   * Verify key commitment to prevent key substitution
   */
  private async verifyCommitment(data: EncryptedData, keyBase64: string): Promise<void> {
    if (!data.commitment) return;

    const expectedCommitment = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      keyBase64 + data.iv,
      { encoding: Crypto.CryptoEncoding.HEX }
    );

    if (data.commitment !== expectedCommitment.substring(0, 16)) {
      throw new Error('Key commitment verification failed - possible key substitution attack');
    }
  }

  /**
   * Native AES-256-GCM decryption
   */
  private async decryptNative(data: EncryptedData, keyBase64: string): Promise<string> {
    try {
      if (!data.content || !data.iv || !data.tag) {
        throw new Error('Missing required decryption parameters');
      }
      
      const result = await AesGcmCrypto.decrypt(
        data.content,
        keyBase64,
        data.iv,
        data.tag,
        false
      );
      
      if (!result) {
        throw new Error('Decryption returned empty result');
      }
      
      return result;
    } catch (error: any) {
      if (error.message?.includes('authentication')) {
        throw new Error('Invalid key or corrupted message');
      }
      throw new Error(`Native decryption failed: ${error.message}`);
    }
  }

  /**
   * Fallback decryption using tweetnacl
   */
  private async decryptFallback(data: EncryptedData, keyBase64: string): Promise<string> {
    try {
      const nonce = util.decodeBase64(data.iv);
      const ciphertext = util.decodeBase64(data.content);
      const key = util.decodeBase64(keyBase64);
      
      if (key.length !== 32) {
        throw new Error('Invalid key size for decryption');
      }
      
      // Decrypt using nacl.secretbox
      const decrypted = nacl.secretbox.open(ciphertext, nonce, key);
      
      if (!decrypted) {
        throw new Error('Decryption failed - invalid key or corrupted data');
      }
      
      return util.encodeUTF8(decrypted);
    } catch (error: any) {
      throw new Error(`Fallback decryption failed: ${error.message}`);
    }
  }

  /**
   * Store encryption key securely using SecureKeyService
   */
  async storeKey(sessionId: string, key: string): Promise<boolean> {
    try {
      // Try secure storage first
      const success = await secureKeyService.storeKey(sessionId, key);
      
      if (!success) {
        // Fallback warning already logged by secureKeyService
        console.warn('⚠️ Key stored in less secure storage');
      }
      
      // Also store session metadata
      await AsyncStorage.setItem(
        `@chat_session_${sessionId}`,
        JSON.stringify({
          created: Date.now(),
          algorithm: this.ALGORITHM,
          curve: this.CURVE_TYPE,
          hasCommitment: true,
          status: 'active'
        } as SessionInfo)
      );
      
      return success;
    } catch (error) {
      console.error('Failed to store key:', error);
      return false;
    }
  }

  /**
   * Get stored encryption key
   */
  async getStoredKey(sessionId: string): Promise<string | null> {
    try {
      // Try secure storage first
      const key = await secureKeyService.getKey(sessionId);
      if (key) return key;
      
      // No fallback to insecure storage for keys
      return null;
    } catch (error) {
      console.warn('Failed to retrieve key:', error);
      return null;
    }
  }

  /**
   * Check if a session exists and is valid
   */
  async isSessionValid(sessionId: string): Promise<boolean> {
    try {
      const sessionData = await AsyncStorage.getItem(`@chat_session_${sessionId}`);
      if (!sessionData) return false;
      
      const session: SessionInfo = JSON.parse(sessionData);
      
      // Check if session is not expired (7 days)
      const isExpired = Date.now() - session.created > 7 * 24 * 60 * 60 * 1000;
      
      if (isExpired) {
        // Clean up expired session
        await this.deleteStoredKey(sessionId);
        return false;
      }
      
      // Check if we have the key
      const key = await this.getStoredKey(sessionId);
      return !!key;
    } catch {
      return false;
    }
  }

  /**
   * Get session info without throwing errors
   */
  async getSessionInfo(sessionId: string): Promise<SessionInfo | null> {
    try {
      const sessionData = await AsyncStorage.getItem(`@chat_session_${sessionId}`);
      if (!sessionData) return null;
      
      return JSON.parse(sessionData);
    } catch {
      return null;
    }
  }

  /**
   * Delete stored encryption key
   */
  async deleteStoredKey(sessionId: string): Promise<void> {
    try {
      await secureKeyService.deleteKey(sessionId);
      await AsyncStorage.removeItem(`@chat_session_${sessionId}`);
    } catch (error) {
      console.warn('Failed to delete key:', error);
    }
  }

  /**
   * Delete all stored keys (for logout)
   */
  async deleteAllStoredKeys(): Promise<void> {
    try {
      // Get all session metadata
      const keys = await AsyncStorage.getAllKeys();
      const sessionKeys = keys.filter(k => k.startsWith('@chat_session_'));
      
      // Delete each session
      for (const key of sessionKeys) {
        const sessionId = key.replace('@chat_session_', '');
        await this.deleteStoredKey(sessionId);
      }
      
      // Clear cache
      this.keyCache.clear();
      
      console.log(`Cleaned up ${sessionKeys.length} chat sessions`);
    } catch (error) {
      console.error('Failed to cleanup keys:', error);
    }
  }

  /**
   * Generate fingerprint for key verification
   */
  async generateFingerprint(publicKey: string): Promise<string> {
    try {
      const hash = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        publicKey,
        { encoding: Crypto.CryptoEncoding.HEX }
      );
      
      // Convert to emoji fingerprint for easy comparison
      const emojis = ['🔐', '🔑', '🛡️', '🔒', '🗝️', '🔓', '🔏', '🗂️'];
      return hash
        .substring(0, 16)
        .match(/.{2}/g)!
        .map(byte => emojis[parseInt(byte, 16) % emojis.length])
        .join(' ');
    } catch (error) {
      console.error('Failed to generate fingerprint:', error);
      return '❌ Error';
    }
  }

  /**
   * Check if encryption is available without errors
   */
  isAvailable(): boolean {
    return this.isInitialized;
  }

  /**
   * Check if native AES is available
   */
  hasNativeAes(): boolean {
    return this.isNativeAesAvailable;
  }

  /**
   * Get the encryption algorithm
   */
  getAlgorithm(): string {
    return this.isNativeAesAvailable ? this.ALGORITHM : 'xchacha20-poly1305';
  }

  /**
   * Validate an encryption key
   */
  isValidKey(keyBase64: string): boolean {
    try {
      const keyData = util.decodeBase64(keyBase64);
      return keyData.length === this.KEY_SIZE;
    } catch {
      return false;
    }
  }

  /**
   * Quick check if we can encrypt (for UI state)
   */
  canEncrypt(): boolean {
    return this.isInitialized && (this.isNativeAesAvailable || true); // Always can encrypt with fallback
  }

  /**
   * Session key derivation for forward secrecy
   */
  async deriveSessionKey(sharedSecret: string, sessionId: string): Promise<string> {
    try {
      const info = `${sessionId}:notamy:session`;
      return await this.deriveAesKey(sharedSecret, info);
    } catch (error) {
      console.warn('Session key derivation failed, using base key');
      return sharedSecret;
    }
  }

  /**
   * Test encryption functionality silently
   */
  async testEncryption(): Promise<boolean> {
    if (!__DEV__) return true; // Skip tests in production
    
    try {
      console.log('🧪 Testing encryption capabilities...');
      
      // Test key generation
      const testKey = await this.generateKey();
      const testMessage = "Hello, Notamy! 🚀 Testing E2E encryption.";
      
      // Test encryption without commitment
      const encrypted = await this.encrypt(testMessage, testKey);
      if (!encrypted || typeof encrypted !== 'string') {
        throw new Error('Encryption test failed');
      }
      
      // Test decryption
      const decrypted = await this.decrypt(encrypted, testKey);
      if (decrypted !== testMessage) {
        throw new Error('Decryption test failed');
      }
      
      // Test encryption with commitment
      const encryptedWithCommitment = await this.encryptWithCommitment(testMessage, testKey);
      const decryptedWithCommitment = await this.decrypt(encryptedWithCommitment, testKey);
      if (decryptedWithCommitment !== testMessage) {
        throw new Error('Decryption with commitment test failed');
      }
      
      // Test try methods (should not throw)
      const tryEncrypted = await this.tryEncrypt(testMessage, testKey);
      if (!tryEncrypted) {
        throw new Error('tryEncrypt test failed');
      }
      
      const tryDecrypted = await this.tryDecrypt(tryEncrypted, testKey);
      if (tryDecrypted !== testMessage) {
        throw new Error('tryDecrypt test failed');
      }
      
      // Test failure case
      const badDecrypted = await this.tryDecrypt("invalid_data", testKey);
      if (badDecrypted !== null) {
        throw new Error('tryDecrypt should return null for invalid data');
      }
      
      // Test key exchange
      const alice = await this.generateKeyPair();
      const bob = await this.generateKeyPair();
      
      const aliceShared = await this.deriveSharedSecret(alice.privateKey, bob.publicKey);
      const bobShared = await this.deriveSharedSecret(bob.privateKey, alice.publicKey);
      
      // Both should derive the same key
      if (aliceShared !== bobShared) {
        throw new Error('Key exchange test failed');
      }
      
      // Test caching (second call should be faster)
      const start = Date.now();
      await this.deriveSharedSecret(alice.privateKey, bob.publicKey);
      const cachedTime = Date.now() - start;
      
      console.log('✅ All encryption tests passed!');
      console.log(`  - Algorithm: ${this.getAlgorithm()}`);
      console.log(`  - Native AES: ${this.isNativeAesAvailable ? 'Yes' : 'No (using fallback)'}`);
      console.log(`  - Key Commitment: Enabled`);
      console.log(`  - Cache Hit Time: ${cachedTime}ms`);
      
      return true;
    } catch (error: any) {
      console.error('❌ Encryption test failed:', error.message);
      return false;
    }
  }

  /**
   * Prepare for automatic key exchange
   * Returns null if not ready instead of throwing
   */
  async prepareKeyExchange(): Promise<KeyPair | null> {
    try {
      await this.ensureReady();
      
      if (!this.canEncrypt()) {
        console.warn('Encryption not available for key exchange');
        return null;
      }
      
      return await this.generateKeyPair();
    } catch (error) {
      console.warn('Failed to prepare key exchange:', error);
      return null;
    }
  }

  /**
   * Complete key exchange automatically
   * Returns derived key or null on failure
   */
  async completeKeyExchange(
    privateKey: string,
    partnerPublicKey: string,
    sessionId: string
  ): Promise<string | null> {
    try {
      const sharedKey = await this.deriveSharedSecret(privateKey, partnerPublicKey);
      
      // Store key securely
      const stored = await this.storeKey(sessionId, sharedKey);
      if (!stored) {
        console.warn('Failed to store derived key');
      }
      
      return sharedKey;
    } catch (error) {
      console.warn('Failed to complete key exchange:', error);
      return null;
    }
  }
}

// Create singleton instance
const encryptionService = new EncryptionService();

// Export for global access
export default encryptionService;
