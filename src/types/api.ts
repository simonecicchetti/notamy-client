/**
 * API Types and Interfaces
 * Central location for all API-related type definitions
 */

// =====================================================
// ERROR CODES
// =====================================================

export const ERROR_CODES = {
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
  NETWORK_ERROR: 'NETWORK_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  EVENT_NOT_FOUND: 'EVENT_NOT_FOUND',
  CHAT_NOT_ENABLED: 'CHAT_NOT_ENABLED',
  REDIS_ERROR: 'REDIS_ERROR',
  AI_API_FAIL: 'AI_API_FAIL',
  // Moments specific errors
  MOMENT_NOT_FOUND: 'MOMENT_NOT_FOUND',
  MOMENT_EXPIRED: 'MOMENT_EXPIRED',
  CANNOT_STAR_MOMENT: 'CANNOT_STAR_MOMENT',
  STAR_NOT_FOUND: 'STAR_NOT_FOUND',
  MATCH_FAILED: 'MATCH_FAILED',
  ALREADY_REPORTED: 'ALREADY_REPORTED',
  MOMENT_LIMIT_EXCEEDED: 'MOMENT_LIMIT_EXCEEDED',
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

// =====================================================
// BASE TYPES
// =====================================================

export interface ApiError {
  error: true;
  detail: string;
  error_code: ErrorCode;
  status: number;
}

export interface ApiResponse<T> {
  data?: T;
  error?: ApiError;
  status: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Timestamp {
  created_at: number;
  updated_at?: number;
}

// =====================================================
// USER TYPES
// =====================================================

export interface BaseUser {
  user_id: string;
  descriptor: string;
  emoji?: string;
  online?: boolean;
}

export interface UserRegistrationRequest {
  descriptor: string;
  event_id?: string | null;
  location?: Coordinates | null;
  firebase_uid?: string;
  local_presence?: string;
  mood?: string;
  emoji?: string;
}

export interface UserRegistrationResponse {
  user_id: string;
  descriptor: string;
  emoji?: string;
  token: string;
  is_new_user: boolean;
  event_id?: string;
  message: string;
}

export interface NearbyUser extends BaseUser {
  distance: number;
  location?: {
    zone: string;
    last_updated: number;
  };
  mood?: string;
  local_presence?: string;
  visual_hint?: string;
  badges?: Badge[];
  is_premium?: boolean;
}

export interface UserProfile extends BaseUser {
  bio?: string;
  interests?: string[];
  photos?: string[];
  created_at?: number;
  last_active?: number;
  stats?: {
    moments_created?: number;
    connections_made?: number;
    notes_received?: number;
  };
}

export interface ProfileUpdateRequest {
  bio?: string;
  interests?: string[];
  emoji?: string;
}

// =====================================================
// MOMENTS TYPES
// =====================================================

export interface StarInfo {
  user_id: string;
  descriptor: string;
  timestamp: number;
  confirmed: boolean;
}

export interface MomentLocation {
  name: string;
  area?: string;
  coordinates?: Coordinates;
}

export interface MomentAuthor {
  user_id?: string; // Optional - only present for own moments
  descriptor: string;
  emoji?: string;
}

export interface MomentRequest {
  description: string;
  area?: string;
  location?: Coordinates;
  expires_in_hours?: number;
}

export interface MomentResponse {
  id: string;
  author: MomentAuthor;
  description: string;
  location: MomentLocation;
  created_at: number;
  expires_at: number;
  status: 'active' | 'expired' | 'deleted';
  star_count: number;
  visibility_radius: number;
  
  // Computed flags from server
  is_expired: boolean;
  is_matched: boolean;
  is_my_moment: boolean;
  i_starred: boolean;
  my_star_confirmed: boolean;
  matched_with_me: boolean;
  can_star: boolean;
  can_manage: boolean;
  
  // Optional fields - only for specific users
  stars_received?: StarInfo[]; // Only for moment author
  confirmed_matches?: string[]; // Only for moment author
  metadata?: Record<string, any>;
  
  // Client-side computed fields
  distance?: number;
  is_nearby?: boolean;
}

export interface MomentNotification {
  id: string;
  description: string;
  location: MomentLocation;
  star_count: number;
  created_at: number;
  expires_at: number;
  author_descriptor: string;
}

export interface MomentNotificationResponse {
  count: number;
  moments: MomentNotification[];
  message: string;
}

export interface SendStarRequest {
  user_id?: string; // Optional override for testing
}

export interface SendStarResponse {
  success: boolean;
  message: string;
  moment_id: string;
  star_count: number;
  is_mutual?: boolean;
}

export interface ConfirmMatchRequest {
  is_match: boolean;
}

export interface ConfirmMatchResponse {
  success: boolean;
  message: string;
  is_mutual: boolean;
  matched_user_id?: string;
  matched_user_descriptor?: string;
  conversation_id?: string;
}

// =====================================================
// CHAT TYPES
// =====================================================

export interface SendMessageRequest {
  recipient_id: string;
  encrypted_content: string;
  session_id?: string;
  metadata?: Record<string, string>;
}

export interface ChatMessage {
  id: string;
  sender_id: string;
  recipient_id: string;
  encrypted_content: string;
  timestamp: number;
  session_id?: string;
  event_id?: string;
  metadata?: Record<string, string>;
  deleted?: boolean;
  read?: boolean;
  // Client-side fields
  content?: string; // Decrypted content
  is_encrypted?: boolean;
}

export interface Conversation {
  conversation_id: string;
  other_user: BaseUser;
  last_message_time?: number;
  last_sender_id?: string;
  unread_count: number;
  last_message_preview?: {
    id: string;
    sender_id: string;
    timestamp: number;
    is_encrypted: boolean;
  };
  // Client-side fields
  typing?: boolean;
  lastMessage?: string; // Decrypted last message
}

export interface KeyExchangeRequest {
  recipient_id: string;
  public_key?: string;
  metadata?: Record<string, string>;
}

export interface KeyExchangeResponse {
  session_id: string;
  recipient_public_key?: string;
  expires_at: number;
  algorithm: string;
}

export interface MarkReadRequest {
  conversation_id: string;
  message_ids: string[];
}

export interface TypingStatusRequest {
  recipient_id: string;
  is_typing: boolean;
}

// =====================================================
// NOTIFICATION TYPES
// =====================================================

export interface Notification {
  id: string;
  type: 'reaction' | 'note' | 'moment_star' | 'moment_match' | 'chat' | 'system';
  sender_id?: string;
  sender_descriptor?: string;
  content: any;
  timestamp: number;
  read: boolean;
  metadata?: Record<string, any>;
}

export interface ReactionNotification {
  sender_id: string;
  sender_descriptor: string;
  reaction: string;
  timestamp: number;
}

export interface NoteNotification {
  sender_id: string;
  sender_descriptor: string;
  timestamp: number;
  metadata?: any;
}

// =====================================================
// CONNECTION TYPES
// =====================================================

export interface Connection {
  connection_id: string;
  user_id: string;
  other_user_id: string;
  status: 'pending' | 'accepted' | 'rejected' | 'blocked';
  initiated_by: string;
  created_at: number;
  updated_at?: number;
  metadata?: Record<string, any>;
}

export interface ConnectionRequest {
  target_user_id: string;
  metadata?: Record<string, any>;
}

export interface ConnectionResponse {
  connection_id: string;
  accept: boolean;
  metadata?: Record<string, any>;
}

// =====================================================
// BADGE TYPES
// =====================================================

export interface Badge {
  badge_id: string;
  user_id: string;
  badge_type: string;
  name: string;
  description: string;
  icon: string;
  awarded_at: number;
  event_id?: string;
  metadata?: Record<string, any>;
}

export interface BadgeProgress {
  badge_type: string;
  current_progress: number;
  required_progress: number;
  percentage: number;
  description: string;
}

// =====================================================
// EVENT TYPES
// =====================================================

export interface Event {
  event_id: string;
  name: string;
  description?: string;
  location: {
    name: string;
    coordinates: Coordinates;
    radius: number;
  };
  start_time: number;
  end_time: number;
  created_by: string;
  participant_count: number;
  is_active: boolean;
  metadata?: Record<string, any>;
}

export interface EventStats {
  event_id: string;
  total_participants: number;
  active_participants: number;
  total_connections: number;
  total_reactions: number;
  popular_zones: Array<{
    zone: string;
    count: number;
  }>;
  peak_hour: number;
}

// =====================================================
// ZONE TYPES
// =====================================================

export interface Zone {
  zone_id: string;
  name: string;
  coordinates: Coordinates;
  radius: number;
  active_users: number;
  metadata?: Record<string, any>;
}

export interface ZoneHistory {
  zone_id: string;
  user_id: string;
  entered_at: number;
  left_at?: number;
  duration?: number;
}

// =====================================================
// ENCOUNTER TYPES
// =====================================================

export interface Encounter {
  encounter_id: string;
  user_id: string;
  other_user_id: string;
  other_user_descriptor: string;
  timestamp: number;
  rssi?: number;
  duration?: number;
  location?: {
    zone: string;
    coordinates?: Coordinates;
  };
  metadata?: Record<string, any>;
}

// =====================================================
// CHALLENGE TYPES
// =====================================================

export interface Challenge {
  challenge_id: string;
  challenge_type: string;
  name: string;
  description: string;
  requirements: Record<string, any>;
  reward: {
    type: string;
    value: any;
  };
  expires_at?: number;
  completed?: boolean;
  progress?: number;
}

// =====================================================
// SETTINGS TYPES
// =====================================================

export interface UserSettings {
  notifications: {
    reactions: boolean;
    notes: boolean;
    moments: boolean;
    chat: boolean;
    system: boolean;
  };
  privacy: {
    show_online_status: boolean;
    show_location: boolean;
    allow_reactions: boolean;
    allow_notes: boolean;
  };
  ethical: {
    consent_to_ai: boolean;
    data_retention_days: number;
  };
}

// =====================================================
// WEBSOCKET TYPES
// =====================================================

export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: number;
  sender_id?: string;
}

export interface WebSocketEvent {
  user_online: { user_id: string; descriptor: string };
  user_offline: { user_id: string };
  typing_status: { user_id: string; is_typing: boolean };
  new_message: ChatMessage;
  message_read: { message_id: string; reader_id: string };
  reaction_received: ReactionNotification;
  note_received: NoteNotification;
  moment_starred: {
    moment_id: string;
    moment_author_id: string;
    star_sender_id: string;
    star_sender_descriptor: string;
    total_stars: number;
  };
  moment_matched: {
    moment_id: string;
    matched_user_id: string;
    matched_user_descriptor: string;
    is_mutual: boolean;
  };
  moment_dropped: {
    moment_id: string;
    author_id: string;
    location: MomentLocation;
  };
  moment_deleted: {
    moment_id: string;
  };
  location_update: {
    user_id: string;
    zone: string;
  };
}

// =====================================================
// FCM TYPES
// =====================================================

export interface FCMTokenRequest {
  fcm_token: string;
  platform: 'ios' | 'android';
}

export interface FCMTokenResponse {
  success: boolean;
  message: string;
}

// =====================================================
// UTILITY TYPES
// =====================================================

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;
export type RequireAtLeastOne<T> = { [K in keyof T]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<keyof T, K>>> }[keyof T];
export type RequireOnlyOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> & { [K in Keys]-?: Required<Pick<T, K>> & Partial<Record<Exclude<Keys, K>, undefined>> }[Keys];