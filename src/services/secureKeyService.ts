// src/services/secureKeyService.ts
/**
 * Gestione sicura delle chiavi con Keychain/Keystore
 *
 * Zero-friction approach:
 * - Nessun prompt di autenticazione durante l'uso normale
 * - Fallback automatico se Keychain non disponibile
 * - Operazioni silenziose senza interruzioni UX
 */
import * as Keychain from 'react-native-keychain';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

interface StoredKey {
  sessionId: string;
  key: string;
  timestamp: number;
}

interface BackupMetadata {
  userId: string;
  deviceId: string;
  timestamp: number;
  keysCount: number;
}

class SecureKeyService {
  private readonly SERVICE_NAME = 'com.notamy.chat';
  private readonly FALLBACK_PREFIX = '@notamy_secure_key_';
  private readonly BACKUP_PREFIX = '@notamy_key_backup_';
  private isKeychainAvailable: boolean | null = null;
  private memoryCache: Map<string, { key: string; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor() {
    this.checkKeychainAvailability();
  }

  /**
   * Check if Keychain is available on this device
   */
  private async checkKeychainAvailability(): Promise<boolean> {
    if (this.isKeychainAvailable !== null) {
      return this.isKeychainAvailable;
    }

    try {
      // Test write and read
      const testKey = 'test_availability';
      await Keychain.setInternetCredentials(
        this.SERVICE_NAME,
        testKey,
        'test_value',
        {
          accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
          // NO authentication prompt - zero friction
        }
      );
      
      const result = await Keychain.getInternetCredentials(this.SERVICE_NAME);
      await Keychain.resetInternetCredentials(this.SERVICE_NAME);
      
      this.isKeychainAvailable = result !== false;
      console.log(`🔐 Keychain available: ${this.isKeychainAvailable}`);
      
      return this.isKeychainAvailable;
    } catch (error) {
      console.warn('Keychain not available:', error);
      this.isKeychainAvailable = false;
      return false;
    }
  }

  /**
   * Store a key securely - automatic fallback if needed
   */
  async storeKey(sessionId: string, key: string): Promise<boolean> {
    try {
      // Memory cache for performance
      this.memoryCache.set(sessionId, { key, timestamp: Date.now() });
      this.cleanMemoryCache();

      // Try Keychain first
      if (await this.checkKeychainAvailability()) {
        try {
          await Keychain.setInternetCredentials(
            this.SERVICE_NAME,
            sessionId,
            key,
            {
              // Use least intrusive option - no biometric prompt
              accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED,
              // NO authenticatePrompt - zero friction approach
            }
          );
          
          // Mark as stored securely
          await AsyncStorage.setItem(
            `${this.FALLBACK_PREFIX}meta_${sessionId}`,
            JSON.stringify({ secure: true, timestamp: Date.now() })
          );
          
          return true;
        } catch (keychainError) {
          console.warn('Keychain storage failed, using fallback:', keychainError);
        }
      }

      // Fallback to encrypted AsyncStorage
      return await this.storeFallback(sessionId, key);
      
    } catch (error) {
      console.error('Failed to store key:', error);
      return false;
    }
  }

  /**
   * Retrieve a key - check memory cache first, then storage
   */
  async getKey(sessionId: string): Promise<string | null> {
    try {
      // Check memory cache first
      const cached = this.memoryCache.get(sessionId);
      if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
        return cached.key;
      }

      // Check if stored securely
      const metaData = await AsyncStorage.getItem(`${this.FALLBACK_PREFIX}meta_${sessionId}`);
      const meta = metaData ? JSON.parse(metaData) : null;

      if (meta?.secure && await this.checkKeychainAvailability()) {
        try {
          const credentials = await Keychain.getInternetCredentials(this.SERVICE_NAME);
          if (credentials && credentials.username === sessionId) {
            // Update cache
            this.memoryCache.set(sessionId, {
              key: credentials.password,
              timestamp: Date.now()
            });
            return credentials.password;
          }
        } catch (keychainError) {
          console.warn('Keychain retrieval failed:', keychainError);
        }
      }

      // Try fallback
      return await this.getFallback(sessionId);
      
    } catch (error) {
      console.error('Failed to retrieve key:', error);
      return null;
    }
  }

  /**
   * Delete a key from all storages
   */
  async deleteKey(sessionId: string): Promise<void> {
    try {
      // Remove from memory cache
      this.memoryCache.delete(sessionId);

      // Remove from Keychain if available
      if (await this.checkKeychainAvailability()) {
        try {
          // Reset credentials for this session
          const allCreds = await Keychain.getInternetCredentials(this.SERVICE_NAME);
          if (allCreds && allCreds.username === sessionId) {
            await Keychain.resetInternetCredentials(this.SERVICE_NAME);
          }
        } catch (error) {
          console.warn('Failed to delete from Keychain:', error);
        }
      }

      // Remove from fallback storage
      await AsyncStorage.multiRemove([
        `${this.FALLBACK_PREFIX}${sessionId}`,
        `${this.FALLBACK_PREFIX}meta_${sessionId}`
      ]);
      
    } catch (error) {
      console.error('Failed to delete key:', error);
    }
  }

  /**
   * Fallback storage with device-specific encryption
   */
  private async storeFallback(sessionId: string, key: string): Promise<boolean> {
    try {
      // Get device-specific encryption key
      const deviceKey = await this.getDeviceKey();
      
      // Simple XOR encryption for obfuscation (not true encryption)
      const encrypted = await this.obfuscateKey(key, deviceKey);
      
      await AsyncStorage.setItem(
        `${this.FALLBACK_PREFIX}${sessionId}`,
        encrypted
      );
      
      await AsyncStorage.setItem(
        `${this.FALLBACK_PREFIX}meta_${sessionId}`,
        JSON.stringify({ secure: false, timestamp: Date.now() })
      );
      
      return true;
    } catch (error) {
      console.error('Fallback storage failed:', error);
      return false;
    }
  }

  /**
   * Retrieve from fallback storage
   */
  private async getFallback(sessionId: string): Promise<string | null> {
    try {
      const encrypted = await AsyncStorage.getItem(`${this.FALLBACK_PREFIX}${sessionId}`);
      if (!encrypted) return null;

      const deviceKey = await this.getDeviceKey();
      const key = await this.deobfuscateKey(encrypted, deviceKey);
      
      // Update cache
      this.memoryCache.set(sessionId, { key, timestamp: Date.now() });
      
      return key;
    } catch (error) {
      console.error('Fallback retrieval failed:', error);
      return null;
    }
  }

  /**
   * Get or generate device-specific key for fallback encryption
   */
  private async getDeviceKey(): Promise<string> {
    const deviceKeyId = '@notamy_device_key';
    
    try {
      let deviceKey = await AsyncStorage.getItem(deviceKeyId);
      
      if (!deviceKey) {
        // Generate new device key
        const randomBytes = await Crypto.getRandomBytesAsync(32);
        deviceKey = Buffer.from(randomBytes).toString('base64');
        await AsyncStorage.setItem(deviceKeyId, deviceKey);
      }
      
      return deviceKey;
    } catch (error) {
      // Fallback to a constant if all else fails
      console.error('Failed to get device key:', error);
      return 'notamy_fallback_2024';
    }
  }

  /**
   * Simple obfuscation for fallback storage
   */
  private async obfuscateKey(key: string, deviceKey: string): Promise<string> {
    // Simple XOR obfuscation - not cryptographically secure
    // but better than plaintext for fallback storage
    const keyBuffer = Buffer.from(key, 'base64');
    const deviceBuffer = Buffer.from(deviceKey, 'base64');
    
    const result = Buffer.alloc(keyBuffer.length);
    for (let i = 0; i < keyBuffer.length; i++) {
      result[i] = keyBuffer[i] ^ deviceBuffer[i % deviceBuffer.length];
    }
    
    return result.toString('base64');
  }

  /**
   * Deobfuscate key from fallback storage
   */
  private async deobfuscateKey(encrypted: string, deviceKey: string): Promise<string> {
    // Reverse the XOR operation
    const encryptedBuffer = Buffer.from(encrypted, 'base64');
    const deviceBuffer = Buffer.from(deviceKey, 'base64');
    
    const result = Buffer.alloc(encryptedBuffer.length);
    for (let i = 0; i < encryptedBuffer.length; i++) {
      result[i] = encryptedBuffer[i] ^ deviceBuffer[i % deviceBuffer.length];
    }
    
    return result.toString('base64');
  }

  /**
   * Clean expired entries from memory cache
   */
  private cleanMemoryCache(): void {
    const now = Date.now();
    for (const [sessionId, data] of this.memoryCache.entries()) {
      if (now - data.timestamp > this.CACHE_TTL) {
        this.memoryCache.delete(sessionId);
      }
    }
  }

  /**
   * Optional backup functionality - non-blocking
   * User can backup keys but it's not required
   */
  async createBackup(userId: string): Promise<string | null> {
    try {
      // Get all stored keys metadata
      const keys = await AsyncStorage.getAllKeys();
      const sessionKeys = keys.filter(k => k.startsWith(this.FALLBACK_PREFIX) && !k.includes('meta'));
      
      const backup: StoredKey[] = [];
      
      for (const key of sessionKeys) {
        const sessionId = key.replace(this.FALLBACK_PREFIX, '');
        const storedKey = await this.getKey(sessionId);
        
        if (storedKey) {
          backup.push({
            sessionId,
            key: storedKey,
            timestamp: Date.now()
          });
        }
      }
      
      if (backup.length === 0) {
        return null;
      }
      
      // Create encrypted backup bundle
      const backupData = JSON.stringify({
        version: 1,
        userId,
        deviceId: await this.getDeviceId(),
        timestamp: Date.now(),
        keys: backup
      });
      
      // Encrypt with user-derived key (could use password/PIN)
      const backupKey = await this.deriveBackupKey(userId);
      const encrypted = await this.obfuscateKey(backupData, backupKey);
      
      // Store backup reference
      await AsyncStorage.setItem(
        `${this.BACKUP_PREFIX}${Date.now()}`,
        JSON.stringify({
          userId,
          timestamp: Date.now(),
          keysCount: backup.length
        } as BackupMetadata)
      );
      
      return encrypted;
      
    } catch (error) {
      console.error('Backup creation failed:', error);
      return null;
    }
  }

  /**
   * Restore from backup - optional feature
   */
  async restoreBackup(encryptedBackup: string, userId: string): Promise<boolean> {
    try {
      const backupKey = await this.deriveBackupKey(userId);
      const decrypted = await this.deobfuscateKey(encryptedBackup, backupKey);
      const backupData = JSON.parse(decrypted);
      
      if (backupData.version !== 1 || backupData.userId !== userId) {
        throw new Error('Invalid backup data');
      }
      
      // Restore keys
      let restored = 0;
      for (const item of backupData.keys) {
        const success = await this.storeKey(item.sessionId, item.key);
        if (success) restored++;
      }
      
      console.log(`Restored ${restored}/${backupData.keys.length} keys from backup`);
      return restored > 0;
      
    } catch (error) {
      console.error('Backup restoration failed:', error);
      return false;
    }
  }

  /**
   * Get device ID for backup identification
   */
  private async getDeviceId(): Promise<string> {
    try {
      const stored = await AsyncStorage.getItem('@notamy_device_id');
      if (stored) return stored;
      
      const randomBytes = await Crypto.getRandomBytesAsync(16);
      const deviceId = Buffer.from(randomBytes).toString('hex');
      await AsyncStorage.setItem('@notamy_device_id', deviceId);
      
      return deviceId;
    } catch {
      return 'unknown_device';
    }
  }

  /**
   * Derive backup key from user ID (could be enhanced with password)
   */
  private async deriveBackupKey(userId: string): Promise<string> {
    const hash = await Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      `notamy_backup_${userId}_2024`,
      { encoding: Crypto.CryptoEncoding.BASE64 }
    );
    
    return hash;
  }

  /**
   * Check storage health and available space
   */
  async getStorageInfo(): Promise<{
    isHealthy: boolean;
    keychainAvailable: boolean;
    keysCount: number;
    hasBackups: boolean;
  }> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const sessionKeys = keys.filter(k => k.startsWith(this.FALLBACK_PREFIX) && !k.includes('meta'));
      const backupKeys = keys.filter(k => k.startsWith(this.BACKUP_PREFIX));
      
      return {
        isHealthy: true,
        keychainAvailable: await this.checkKeychainAvailability(),
        keysCount: sessionKeys.length,
        hasBackups: backupKeys.length > 0
      };
    } catch {
      return {
        isHealthy: false,
        keychainAvailable: false,
        keysCount: 0,
        hasBackups: false
      };
    }
  }

  /**
   * Clear all stored keys - for logout
   */
  async clearAll(): Promise<void> {
    try {
      // Clear memory cache
      this.memoryCache.clear();
      
      // Clear Keychain if available
      if (await this.checkKeychainAvailability()) {
        try {
          await Keychain.resetInternetCredentials(this.SERVICE_NAME);
        } catch (error) {
          console.warn('Failed to clear Keychain:', error);
        }
      }
      
      // Clear AsyncStorage
      const keys = await AsyncStorage.getAllKeys();
      const ourKeys = keys.filter(k =>
        k.startsWith(this.FALLBACK_PREFIX) ||
        k.startsWith(this.BACKUP_PREFIX) ||
        k === '@notamy_device_key' ||
        k === '@notamy_device_id'
      );
      
      if (ourKeys.length > 0) {
        await AsyncStorage.multiRemove(ourKeys);
      }
      
      console.log('Cleared all secure storage');
    } catch (error) {
      console.error('Failed to clear storage:', error);
    }
  }
}

// Create singleton instance
const secureKeyService = new SecureKeyService();

export default secureKeyService;
