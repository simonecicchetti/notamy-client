// testCryptoDebug.js
// Metti questo file in src/utils/testCryptoDebug.js e chiamalo da App.tsx

import { Buffer } from 'buffer';

export async function runDetailedCryptoTest() {
  console.log('\n🔬 === DETAILED CRYPTO TEST ===\n');
  
  try {
    const AesGcmCrypto = require('react-native-aes-gcm-crypto').default;
    console.log('✅ Module loaded');
    
    // Test key
    const testKeyBase64 = 'MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI='; // 32 bytes
    const testKeyHex = Buffer.from(testKeyBase64, 'base64').toString('hex');
    const testMessage = 'Test message 123';
    
    console.log('\n📝 Test data:');
    console.log('- Message:', testMessage);
    console.log('- Key (base64):', testKeyBase64);
    console.log('- Key (hex):', testKeyHex);
    console.log('- Key length:', Buffer.from(testKeyBase64, 'base64').length, 'bytes');
    
    console.log('\n🔐 Testing encryption with different parameters...\n');
    
    // Test 1: Base64 key
    try {
      console.log('Test 1: encrypt(message, false, keyBase64)');
      const result1 = await AesGcmCrypto.encrypt(testMessage, false, testKeyBase64);
      console.log('✅ Success!');
      console.log('Result type:', typeof result1);
      console.log('Result:', JSON.stringify(result1, null, 2));
      
      // Try to decrypt
      if (result1 && result1.iv && result1.tag && result1.content) {
        console.log('\n🔓 Attempting decryption...');
        
        // Try different decrypt parameter combinations
        const decryptTests = [
          {
            name: 'decrypt(content, keyBase64, iv, tag, false)',
            params: [result1.content, testKeyBase64, result1.iv, result1.tag, false]
          },
          {
            name: 'decrypt(content, keyHex, iv, tag, false)',
            params: [result1.content, testKeyHex, result1.iv, result1.tag, false]
          },
          {
            name: 'decrypt(content, keyBase64, iv, tag)',
            params: [result1.content, testKeyBase64, result1.iv, result1.tag]
          },
          {
            name: 'decrypt with all parameters as strings',
            params: [
              result1.content.toString(),
              testKeyBase64,
              result1.iv.toString(),
              result1.tag.toString(),
              false
            ]
          }
        ];
        
        for (const test of decryptTests) {
          try {
            console.log(`\nTrying: ${test.name}`);
            const decrypted = await AesGcmCrypto.decrypt(...test.params);
            console.log('✅ Decryption succeeded!');
            console.log('Decrypted:', decrypted);
            console.log('Match:', decrypted === testMessage ? '✅ YES' : '❌ NO');
            break; // Stop on first success
          } catch (e) {
            console.log('❌ Failed:', e.message);
          }
        }
      }
    } catch (e) {
      console.log('❌ Failed:', e.message);
    }
    
    console.log('\n---\n');
    
    // Test 2: Hex key
    try {
      console.log('Test 2: encrypt(message, false, keyHex)');
      const result2 = await AesGcmCrypto.encrypt(testMessage, false, testKeyHex);
      console.log('✅ Success!');
      console.log('Result type:', typeof result2);
      console.log('Result:', JSON.stringify(result2, null, 2));
    } catch (e) {
      console.log('❌ Failed:', e.message);
    }
    
    console.log('\n---\n');
    
    // Test 3: Different parameter order
    try {
      console.log('Test 3: encrypt(keyBase64, message, false)');
      const result3 = await AesGcmCrypto.encrypt(testKeyBase64, testMessage, false);
      console.log('✅ Success!');
      console.log('Result:', JSON.stringify(result3, null, 2));
    } catch (e) {
      console.log('❌ Failed:', e.message);
    }
    
    console.log('\n---\n');
    
    // Test 4: Without boolean
    try {
      console.log('Test 4: encrypt(message, keyBase64)');
      const result4 = await AesGcmCrypto.encrypt(testMessage, testKeyBase64);
      console.log('✅ Success!');
      console.log('Result:', JSON.stringify(result4, null, 2));
    } catch (e) {
      console.log('❌ Failed:', e.message);
    }
    
    console.log('\n---\n');
    
    // Test 5: Check if methods exist
    console.log('📋 Available methods:');
    console.log('- encrypt:', typeof AesGcmCrypto.encrypt);
    console.log('- decrypt:', typeof AesGcmCrypto.decrypt);
    console.log('- encryptFile:', typeof AesGcmCrypto.encryptFile);
    console.log('- decryptFile:', typeof AesGcmCrypto.decryptFile);
    
    // Test 6: Try calling methods with callbacks
    console.log('\n📞 Testing callback-style (if supported)...');
    
    await new Promise((resolve) => {
      try {
        AesGcmCrypto.encrypt(testMessage, false, testKeyBase64, (error, result) => {
          if (error) {
            console.log('❌ Callback encrypt failed:', error);
          } else {
            console.log('✅ Callback encrypt succeeded:', result);
          }
          resolve();
        });
      } catch (e) {
        console.log('❌ Callback style not supported');
        resolve();
      }
    });
    
  } catch (error) {
    console.error('💥 Test failed:', error);
  }
  
  console.log('\n🔬 === END DETAILED TEST ===\n');
}

// Alternative: Simple working encryption for comparison
export function simpleEncrypt(text, password) {
  // This is just for testing - NOT SECURE
  const result = [];
  for (let i = 0; i < text.length; i++) {
    result.push(text.charCodeAt(i) ^ password.charCodeAt(i % password.length));
  }
  return Buffer.from(result).toString('base64');
}

export function simpleDecrypt(encrypted, password) {
  const data = Buffer.from(encrypted, 'base64');
  const result = [];
  for (let i = 0; i < data.length; i++) {
    result.push(data[i] ^ password.charCodeAt(i % password.length));
  }
  return String.fromCharCode(...result);
}