// src/utils/polyfills.ts
import 'react-native-get-random-values';
import { Buffer } from 'buffer';

// Install Buffer globally
global.Buffer = Buffer;

// Text encoding polyfills - React Native often has these built-in
if (!global.TextEncoder) {
  // Simple TextEncoder polyfill
  global.TextEncoder = class TextEncoder {
    encode(str: string): Uint8Array {
      const buf = Buffer.from(str, 'utf8');
      const arr = new Uint8Array(buf.length);
      for (let i = 0; i < buf.length; i++) {
        arr[i] = buf[i];
      }
      return arr;
    }
  };
}

if (!global.TextDecoder) {
  // Simple TextDecoder polyfill
  global.TextDecoder = class TextDecoder {
    decode(arr: Uint8Array): string {
      return Buffer.from(arr).toString('utf8');
    }
  };
}

// Base64 polyfills
if (!global.btoa) {
  global.btoa = (str: string) => Buffer.from(str, 'binary').toString('base64');
}
if (!global.atob) {
  global.atob = (str: string) => Buffer.from(str, 'base64').toString('binary');
}

// Final check
console.log('✅ Polyfills loaded:', {
  Buffer: !!global.Buffer,
  TextEncoder: !!global.TextEncoder,
  TextDecoder: !!global.TextDecoder,
  btoa: !!global.btoa,
  atob: !!global.atob,
});

// Export to verify it was loaded
export const polyfillsLoaded = true;