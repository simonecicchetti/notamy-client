// index.ts
// CRITICAL: Polyfills MUST be the very first import
import './src/utils/polyfills';

// After polyfills are loaded, we can import react-native modules
import { registerRootComponent } from 'expo';

// Small delay to ensure polyfills are fully initialized
setTimeout(() => {
  console.log('🚀 App starting with crypto support:', !!global.crypto?.subtle);
}, 100);

// Import the main app
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);