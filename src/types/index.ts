// src/types/index.ts

// =====================================================
// USER TYPES
// =====================================================

export interface Location {
  latitude: number;
  longitude: number;
  accuracy?: number; // ✅ Aggiunto per precisione GPS
}

export interface UserBehavior {
  acceleration: number;
  stationary_time: number;
  nearby_count: number;
  ble_variance: number;
  movement_pattern?: string;
}

export interface ChatPreferences {
  enable_e2e_encryption: boolean;
  max_messages_per_minute: number;
  preferred_channel?: string;
  allow_strangers: boolean;
  notification_sound: boolean;
}

export interface User {
  // Identificativi
  user_id: string;
  id?: string; // ✅ Alias per compatibilità
  descriptor: string;
  
  // Posizione e presenza
  location: Location;
  local_presence?: string;
  zone?: string; // ✅ Aggiunto per zone tracking
  
  // Personalizzazione
  emoji?: string;
  mood?: string;
  language: string;
  
  // Impostazioni
  silent_mode: boolean;
  saved_encounters: string[];
  
  // Comportamento
  current_behavior?: UserBehavior;
  behavior_class?: string;
  behavior_confidence?: number;
  last_behavior_update?: number;
  last_mood_update?: number;
  
  // Stato attività
  active: boolean;
  last_seen?: number;
  last_active?: number;
  expires_at?: number;
  status?: 'online' | 'offline'; // ✅ Aggiunto stato esplicito
  
  // Interazioni
  interaction_history: {
    attempts: number;
    responses: number;
    ignored: number;
  };
  
  // Note system ✅ NUOVO
  notes?: {
    sent: string[]; // user_ids a cui ho inviato note
    received: string[]; // user_ids che mi hanno notato
    mutual: string[]; // user_ids con note reciproche
  };
  
  // Metadata
  metadata?: Record<string, string>;
  social_scenario: string;
  intent: string;
  role: string;
  
  // Features
  badges: string[];
  chat_preferences: ChatPreferences;
  
  // Settings
  ethical_settings?: Record<string, any>;
  agent_persona?: string;
  tags?: string[];
}

// =====================================================
// PROFILE TYPES ✅ NUOVO DA profileSlice
// =====================================================

/**
 * Profilo utente completo per profileSlice
 */
export interface UserProfile {
  user_id: string;
  descriptor: string;
  emoji?: string;
  bio?: string;
  photos?: string[];
  age?: number;
  height?: number;
  languages?: string[];
  last_trip?: string;
  todays_song?: string;
  badges?: any[];
  stats?: {
    moments: number;
    mutuals: number;
    stars: number;
  };
  recent_activity?: {
    notes_today: number;
    last_note_time?: number;
    views_today: number;
    last_view_time?: number;
  };
}

/**
 * Profilo cached con metadata
 */
export interface CachedProfile {
  profile: UserProfile;
  lastFetched: number;
  accessType: 'proximity' | 'mutual' | 'blocked';
  conversationId?: string;
}

// =====================================================
// NEARBY USER TYPES ✅ NUOVO DA usersSlice
// =====================================================

/**
 * Utente vicino per usersSlice
 */
export interface NearbyUser {
  id: string;
  user_id?: string;
  descriptor: string;
  distance: number;
  status: 'online' | 'offline';
  emoji?: string;
  hasProfile?: boolean; // Indica se ha un profilo completo
  isMutual?: boolean;
  isNoted?: boolean;
  
  // Additional profile fields (if hasProfile is true)
  bio?: string;
  photos?: string[];
  age?: number;
  height?: number;
  languages?: string[];
  last_trip?: string;
  todays_song?: string;
  lastSeen?: string; // ISO timestamp
}

// =====================================================
// MOMENTS TYPES ✅ NUOVA SEZIONE
// =====================================================

/**
 * Richiesta per creare un nuovo moment
 */
export interface MomentRequest {
  description: string; // Descrizione di chi hai notato
  area: string; // Dove si trova la persona
  location?: Location; // Posizione opzionale del creator
  expires_in_hours?: number; // Default 3 ore
}

/**
 * Moment completo dal server
 */
export interface Moment {
  id: string;
  
  // Autore del moment
  author: {
    user_id: string;
    descriptor: string;
    emoji?: string;
  };
  
  // Contenuto
  description: string;
  
  // Posizione
  location: {
    name: string;
    area: string;
    coordinates?: Location;
  };
  
  // Timing
  created_at: number;
  expires_at: number;
  
  // Interazioni
  stars_received: string[]; // user_ids che hanno detto "sono io!"
  is_matched?: boolean; // Se c'è stato un match
  is_my_moment?: boolean; // Se è un mio moment
  
  // Metadata
  metadata?: Record<string, any>;
}

/**
 * Notifica per moment
 */
export interface MomentNotification {
  moment_id: string;
  type: 'star_received' | 'match' | 'expired';
  sender_id?: string;
  sender_descriptor?: string;
  timestamp: number;
}

// =====================================================
// BADGE TYPES
// =====================================================

export interface Badge {
  id?: string;
  user_id: string;
  type: BadgeType;
  timestamp: number;
  metadata?: Record<string, string | number>;
}

export type BadgeType = 
  | 'CreativeDescriptor' 
  | 'FrequentUser' 
  | 'SocialEngager' 
  | 'EncounterMaster' 
  | 'SocialConnector' 
  | 'ZoneExplorer'
  | 'MomentMaster' // ✅ Nuovo badge per moments
  | 'NoteStar'; // ✅ Nuovo badge per note system

// =====================================================
// CHAT TYPES
// =====================================================

export interface ChatMessage {
  id?: string;
  message_id?: string; // ✅ Alias per compatibilità
  sender_id: string;
  recipient_id: string;
  encrypted_content: string;
  content?: string; // ✅ Contenuto decriptato
  timestamp: number;
  session_id?: string;
  
  metadata?: Record<string, string>;
  deleted?: boolean; // ✅ Flag per messaggi cancellati
  read?: boolean; // ✅ Flag per stato lettura
  is_encrypted?: boolean; // ✅ Flag encryption
}

/**
 * Conversazione chat
 */
export interface Conversation {
  conversation_id: string;
  other_user: {
    user_id: string;
    descriptor: string;
    emoji?: string;
    online: boolean;
  };
  last_message_time?: number;
  last_sender_id?: string;
  unread_count: number;
  last_message_preview?: {
    id: string;
    sender_id: string;
    timestamp: number;
    is_encrypted: boolean;
  };
}

// =====================================================
// NOTIFICATION TYPES
// =====================================================

export interface Notification {
  id: string;
  sender_id: string;
  recipient_id: string;
  sender_display: string;
  message: string;
  timestamp: number;
  status: 'read' | 'unread';
  notification_type: NotificationType;
  language?: string;
  origin?: string;
  social_scenario?: string;
  intent?: string;
  metadata?: any;
  action?: string;
}

export type NotificationType = 
  | 'message' 
  | 'reaction' 
  | 'challenge' 
  | 'opportunity' 
  | 'match' 
  | 'system' 
  | 'badge' 
  | 'chat'
  | 'note' // ✅ Note ricevuta
  | 'mutual_note' // ✅ Note reciproca
  | 'moment' // ✅ Nuovo moment nearby
  | 'moment_star' // ✅ Qualcuno ha starred il tuo moment
  | 'moment_match' // ✅ Match su moment
  | 'moment_notice'; // ✅ Notifica aggregata moments

// =====================================================
// BLE TYPES
// =====================================================

export interface BLEDevice {
  id: string;
  name?: string;
  rssi: number;
  distance?: number;
  lastSeen: number;
}

// =====================================================
// WEBSOCKET TYPES
// =====================================================

export interface WSMessage {
  type: WSMessageType; // ✅ Tipizzato invece di string
  data: any;
  timestamp: number;
  compressed?: boolean;
}

/**
 * Tipi di messaggi WebSocket
 */
export type WSMessageType =
  | 'ping'
  | 'pong'
  | 'message'
  | 'new_message'
  | 'reaction'
  | 'user_noted'
  | 'typing_status'
  | 'user_status'
  | 'key_exchange'
  | 'message_deleted'
  | 'notification'
  | 'proximity_flash'
  | 'visual_hint_update'
  | 'user:nearby'
  | 'hint_ack'
  | 'battery_mode_updated'
  | 'error'
  // Moments related ✅
  | 'moment_dropped'
  | 'moment_star_received'
  | 'moment_matched'
  | 'moment_expired'
  | 'moment_deleted'
  | 'moment_notification';

// =====================================================
// API RESPONSE TYPES
// =====================================================

export interface ApiResponse<T> {
  data?: T;
  error?: {
    detail: string;
    error_code: string;
  };
  status: number;
}

/**
 * Risposta per nearby users
 */
export interface NearbyUsersResponse {
  users: User[];
  realtime_count: number;
  timestamp: number;
}

// =====================================================
// APP STATE TYPES ✅ AGGIORNATI PER SLICE ALIGNMENT
// =====================================================

/**
 * AuthState - ALLINEATO con authSlice.ts
 */
export interface AuthState {
  user: {
    // Existing fields
    id: string;
    user_id?: string;
    descriptor: string;
    badges?: string[];
    
    // NEW: Basic profile fields
    emoji?: string;
    bio?: string;
    photos?: string[];
    age?: number;
    height?: number;
    languages?: string[];
    last_trip?: string;
    todays_song?: string;
    stats?: {
      moments: number;
      mutuals: number;
      stars: number;
    };
  } | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

export interface BLEState {
  isScanning: boolean;
  devices: Record<string, BLEDevice>;
  nearbyUsers: User[];
  error: string | null;
}

export interface ChatState {
  conversations: Conversation[]; // ✅ Lista conversazioni
  messages: Record<string, ChatMessage[]>; // conversationId -> messages
  sessions: Record<string, string>; // user_id -> session_id
  refreshTrigger?: Record<string, number>; // ✅ Per forzare refresh
  loading: boolean;
  error: string | null;
}

export interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
}

/**
 * Stato per Moments ✅ NUOVO
 */
export interface MomentsState {
  moments: Moment[];
  myMoments: Moment[];
  starredMoments: string[]; // moment IDs
  notificationCount: number;
  loading: boolean;
  error: string | null;
}

/**
 * Stato per Notes ✅ NUOVO
 */
export interface NotesState {
  sent: Record<string, boolean>; // userId -> true se ho inviato nota
  received: Record<string, boolean>; // userId -> true se ho ricevuto nota
  mutual: string[]; // userIds con note reciproche
}

/**
 * UsersState - ALLINEATO con usersSlice.ts ✅ NUOVO
 */
export interface UsersState {
  nearbyUsers: NearbyUser[];
  onlineCount: number;
  loading: boolean;
  error: string | null;
  lastUpdated: string | null;
}

/**
 * ProfileState - ALLINEATO con profileSlice.ts ✅ NUOVO
 */
export interface ProfileState {
  // Cache profili con logica di accesso
  cachedProfiles: {
    [userId: string]: CachedProfile;
  };
  
  // Tracking visibilità
  visibleProfiles: string[]; // User IDs attualmente visibili
  mutualProfiles: string[]; // User IDs con mutual connection
  blockedProfiles: string[]; // User IDs bloccati
  
  // UI state
  loading: boolean;
  error: string | null;
  
  // Social proof
  profileViews: {
    today: number;
    lastViewTime?: number;
  };
}

// =====================================================
// SETTINGS
// =====================================================

export interface Settings {
  ALLOWED_REACTIONS: string[];
  CHALLENGE_TYPES: string[];
  SUPPORTED_LANGUAGES: string[];
  BADGE_TYPES: string[];
  RSSI_THRESHOLDS: {
    touch: number;
    close: number;
    nearby: number;
    far: number;
  };
  MAX_NEARBY_USERS: number;
  CHAT_SESSION_TTL: number;
  
  // Moments settings ✅
  MOMENT_DEFAULT_DURATION_HOURS: number;
  MAX_MOMENTS_PER_USER: number;
  MOMENT_STAR_COOLDOWN_MINUTES: number;
  
  // Notes settings ✅
  MAX_NOTE_DISTANCE_METERS: number;
  NOTE_COOLDOWN_SECONDS: number;
}