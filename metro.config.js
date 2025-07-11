// metro.config.js
const { getDefaultConfig } = require('@expo/metro-config');

module.exports = (() => {
  const config = getDefaultConfig(__dirname);
  
  /* ---------- EXTENSIONI CHE METRO DEVE RICONOSCERE ---------- */
  // .cjs → pacchetti Firebase ESM in CommonJS
  // .mjs → eventuali import ES-Module
  // .rn.js / .rn.cjs → build specifiche React-Native
  config.resolver.sourceExts.push('cjs', 'mjs', 'rn.js', 'rn.cjs');
  
  /* ---------- ABILITA PACKAGE EXPORTS ---------- */
  config.resolver.unstable_enablePackageExports = true;
  
  /* ---------- DICHIARA LE CONDITION NAMES ---------- */
  // Senza "react-native" Metro non applica la sezione corretta
  // della mappa exports di Firebase (che ha { "react-native": {...} } ).
  config.resolver.conditionNames = [
    'react-native',
    ...(config.resolver.conditionNames || []),
  ];
  
  return config;
})();