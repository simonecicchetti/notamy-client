// src/config/constants.ts

export const API_BASE_URL = __DEV__ 
  ? 'http://192.168.0.8:8000/v1' 
  : 'https://api.notamy.app/v1';

export const WS_BASE_URL = __DEV__
  ? 'ws://192.168.0.8:8000'
  : 'wss://api.notamy.app';

export const APP_CONFIG = {
  // App info
  name: 'Notamy',
  version: '1.0.0',
  
  // Timeouts
  API_TIMEOUT: 30000,
  WS_TIMEOUT: 5000,
  WS_PING_INTERVAL: 30000,
  
  // BLE
  BLE_SCAN_DURATION: 10000,
  BLE_SCAN_INTERVAL: 5000,
  RSSI_SMOOTHING_FACTOR: 0.3,
  
  // Location
  LOCATION_UPDATE_INTERVAL: 30000,
  LOCATION_ACCURACY: 'high',
  
  // Cache
  CACHE_TTL: 300000, // 5 minutes
  
  // UI
  MAX_DESCRIPTOR_LENGTH: 20,
  MAX_MOOD_LENGTH: 30,
  MAX_MESSAGE_LENGTH: 200,
  
  // Social scenarios
  SOCIAL_SCENARIOS: {
    default: {
      local_proximity_m: 100,
      default_tone: 'friendly',
      local_zones: ['zone_social', 'zone_active', 'zone_calm', 'zone_connect', 'unknown'],
      max_users: 500
    },
    ConnectFlow: {
      local_proximity_m: 200,
      default_tone: 'spontaneous',
      local_zones: ['MeetSpot', 'ConnectSpot', 'ChillSpot', 'BuzzSpot', 'SparkSpot'],
      max_users: 1500
    },
    context_group: {
      local_proximity_m: 50,
      default_tone: 'contextual',
      local_zones: ['zone_social', 'zone_active', 'zone_calm', 'zone_connect', 'unknown'],
      max_users: 200
    },
    shared_space: {
      local_proximity_m: 150,
      default_tone: 'casual',
      local_zones: ['zone_social', 'zone_active', 'zone_calm', 'zone_connect', 'unknown'],
      max_users: 1000
    }
  },
  
  // RSSI thresholds
  RSSI_THRESHOLDS: {
    touch: -60,
    close: -75,
    nearby: -85,
    far: -90
  },
  
  // Reactions
  ALLOWED_REACTIONS: ['👋', '🎧', '🥂', '🕺', '💃'],
  
  // Languages
  SUPPORTED_LANGUAGES: [
    { code: 'it', name: 'Italiano' },
    { code: 'en', name: 'English' },
    { code: 'es', name: 'Español' },
    { code: 'fr', name: 'Français' }
  ],
  
  // Badge types
  BADGE_TYPES: [
    'CreativeDescriptor',
    'FrequentUser',
    'SocialEngager',
    'EncounterMaster',
    'SocialConnector',
    'ZoneExplorer',
    'EventLegend'
  ]
};

// Error codes
export const ERROR_CODES = {
  // Auth errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  
  // User errors  
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  USER_CREATE_FAIL: 'USER_CREATE_FAIL',
  
  // Network errors
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
  
  // BLE errors
  BLE_NOT_AVAILABLE: 'BLE_NOT_AVAILABLE',
  BLE_PERMISSION_DENIED: 'BLE_PERMISSION_DENIED',
  
  // WebSocket errors
  WS_CONNECTION_FAIL: 'WS_CONNECTION_FAIL',
  WS_MESSAGE_FAIL: 'WS_MESSAGE_FAIL',
  
  // Generic
  UNKNOWN_ERROR: 'UNKNOWN_ERROR'
};