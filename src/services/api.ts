import axios, { AxiosInstance, AxiosError } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import types from centralized location
import {
  ERROR_CODES,
  ErrorCode,
  ApiError,
  UserRegistrationRequest,
  UserRegistrationResponse,
  NearbyUser,
  UserProfile,
  ProfileUpdateRequest,
  MomentRequest,
  MomentResponse,
  MomentNotificationResponse,
  SendStarRequest,
  SendStarResponse,
  ConfirmMatchRequest,
  ConfirmMatchResponse,
  SendMessageRequest,
  ChatMessage,
  Conversation,
  KeyExchangeRequest,
  KeyExchangeResponse,
  MarkReadRequest,
  TypingStatusRequest,
  FCMTokenRequest,
  FCMTokenResponse,
  Connection,
  ConnectionRequest,
  ConnectionResponse,
  Badge,
  BadgeProgress,
  Event,
  EventStats,
  Zone,
  ZoneHistory,
  Encounter,
  Challenge,
  UserSettings,
  Notification,
  ReactionNotification,
  NoteNotification,
  Coordinates,
  StarInfo,
  MomentLocation,
  MomentAuthor,
  MomentNotification,
} from '@/types/api';

// Use the server URL from .env
const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://192.168.0.8:8000';

console.log('API Service initialized with base URL:', API_BASE_URL);

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor con gestione token migliorata
    this.api.interceptors.request.use(
      async (config) => {
        console.log('Making request to:', config.url);
        console.log('Request method:', config.method);
        console.log('Request headers:', config.headers);
        console.log('Request data:', config.data);
        
        // Abilita il token per tutte le richieste tranne register-anonymous
        if (!config.url?.includes('register-anonymous')) {
          const token = await AsyncStorage.getItem('authToken');
          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
            console.log('Added Firebase auth token to request');
          }
        }
        
        // Add request ID for tracking
        config.headers['X-Request-ID'] = this.generateRequestId();
        return config;
      },
      (error) => {
        console.error('Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor con più logging
    this.api.interceptors.response.use(
      (response) => {
        console.log('Response received:', response.status);
        console.log('Response data:', response.data);
        return response;
      },
      async (error: AxiosError) => {
        console.error('Response error:', error.message);
        console.error('Error code:', error.code);
        console.error('Error response:', error.response);
        
        if (error.response?.status === 401) {
          await AsyncStorage.removeItem('authToken');
        }
        return Promise.reject(this.handleError(error));
      }
    );
  }

  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private handleError(error: AxiosError): ApiError {
    console.log('Handling error:', error);
    
    if (error.response) {
      const data = error.response.data as any;
      return {
        error: true,
        detail: data?.detail || data?.status || 'Server error',
        error_code: data?.error_code || data?.code || ERROR_CODES.UNKNOWN_ERROR,
        status: error.response.status,
      };
    } else if (error.request) {
      console.error('No response received. Request:', error.request);
      return {
        error: true,
        detail: 'Network error - no response from server',
        error_code: ERROR_CODES.NETWORK_ERROR,
        status: 0,
      };
    } else {
      console.error('Error setting up request:', error.message);
      return {
        error: true,
        detail: error.message || 'Unknown error',
        error_code: ERROR_CODES.UNKNOWN_ERROR,
        status: 0,
      };
    }
  }

  // Test diretto senza interceptor
  async testDirectConnection() {
    try {
      console.log('Testing direct connection to:', `${API_BASE_URL}/healthz`);
      const response = await fetch(`${API_BASE_URL}/healthz`);
      const text = await response.text();
      console.log('Direct connection response:', response.status, text);
      return { success: true, status: response.status, data: text };
    } catch (error: any) {
      console.error('Direct connection failed:', error);
      return { success: false, error: error.message };
    }
  }

  // RINOMINATO da registerUser a registerAnonymous per allineamento con IdentityScreen
  async registerAnonymous(userData: UserRegistrationRequest): Promise<UserRegistrationResponse | ApiError> {
    try {
      console.log('Registering anonymous user with data:', userData);
      console.log('API URL:', API_BASE_URL);
      
      // Trasforma i dati nel formato atteso dal server
      const requestData = {
        descriptor: userData.descriptor,
        event_id: userData.event_id || null,
        location: userData.location || null,
        firebase_uid: userData.firebase_uid, // IMPORTANTE: Passa l'UID Firebase
        local_presence: userData.local_presence || 'unknown',
        mood: userData.mood || '',
        emoji: userData.emoji || ''
      };
      
      const response = await this.api.post('/v1/register-anonymous', requestData);
      console.log('Registration response:', response.data);
      return response.data;
    } catch (error: any) {
      console.error('Registration error details:', error);
      console.error('Error response:', error.response?.data);
      console.error('Error status:', error.response?.status);
      return this.handleError(error as AxiosError);
    }
  }

  async healthCheck() {
    const response = await this.api.get('/healthz');
    return response.data;
  }

  // UPDATED: Aggiunto parametro maxDistance per estendere il raggio di ricerca
  async getNearbyUsers(
    maxDistance: number = 500, // Default 500m (matching server settings)
    limit: number = 50, 
    zone_filter?: string, 
    mood_filter?: string, 
    intent_filter?: string
  ): Promise<{ users: NearbyUser[] } | ApiError> {
    try {
      const params: any = { 
        limit,
        max_distance: maxDistance // Aggiungi il parametro distanza
      };
      
      if (zone_filter) params.zone_filter = zone_filter;
      if (mood_filter) params.mood_filter = mood_filter; 
      if (intent_filter) params.intent_filter = intent_filter;
      
      console.log('Getting nearby users with params:', params);
      
      const response = await this.api.get('/v1/nearby', { params });
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  async updateLocation(latitude: number, longitude: number, accuracy?: number) {
    try {
      const response = await this.api.post('/v1/share-location', {
        latitude,
        longitude,
        accuracy
      });
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  /**
   * Update user's FCM token for push notifications
   * @param userId - User ID (not used in request, but kept for compatibility)
   * @param fcmToken - Firebase Cloud Messaging token
   * @param platform - Platform (ios/android)
   */
  async updateUserFCMToken(userId: string, fcmToken: string, platform: string): Promise<FCMTokenResponse | ApiError> {
    try {
      console.log('Updating FCM token for user:', userId);
      console.log('Platform:', platform);
      console.log('Token length:', fcmToken.length);
      
      // Validate platform
      const normalizedPlatform = platform.toLowerCase();
      if (!['ios', 'android'].includes(normalizedPlatform)) {
        console.error('Invalid platform:', normalizedPlatform);
        return { 
          error: true, 
          detail: "Invalid platform. Must be 'ios' or 'android'",
          error_code: ERROR_CODES.VALIDATION_ERROR,
          status: 400
        };
      }
      
      // The backend expects only fcm_token and platform in the body
      // The user_id is taken from the auth token
      const response = await this.api.post('/v1/fcm-token', {
        fcm_token: fcmToken,
        platform: normalizedPlatform
      });
      
      console.log('FCM token update response:', response.data);
      return response.data;
    } catch (error) {
      console.error('Failed to update FCM token:', error);
      return this.handleError(error as AxiosError);
    }
  }

  // FIXED: Corrected encoding for emoji reactions
  async sendReaction(recipientId: string, reaction: string) {
    try {
      // Assicurati che l'emoji sia codificata correttamente
      const encodedReaction = reaction.normalize('NFC'); // Normalizza Unicode
      
      console.log('Sending reaction:', {
        recipient_id: recipientId,
        reaction: encodedReaction,
        reaction_codepoints: [...encodedReaction].map(c => c.codePointAt(0)),
        reaction_length: encodedReaction.length
      });
      
      const response = await this.api.post('/v1/send-reaction', {
        recipient_id: recipientId,
        reaction: encodedReaction
      }, {
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        }
      });
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  // NUOVO METODO: Send Note (per la funzionalità di "notare" qualcuno)
  async sendNote(targetUserId: string, metadata?: any) {
    try {
      console.log('Sending note to:', targetUserId);
      
      const response = await this.api.post('/v1/send-note', {
        target_user_id: targetUserId,
        metadata: metadata || {}
      });
      
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  // =====================================================
  // PROFILE ENDPOINTS - NEW
  // =====================================================

  /**
   * Get user profile by ID
   * @param userId - User ID to get profile for
   */
  async getUserProfile(userId: string): Promise<UserProfile | ApiError> {
    try {
      console.log('Getting user profile for:', userId);
      const response = await this.api.get(`/v1/users/profile/${userId}`);
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  /**
   * Update current user's profile
   * @param data - Profile update data
   */
  async updateUserProfile(data: ProfileUpdateRequest) {
    try {
      console.log('Updating user profile:', data);
      const response = await this.api.put('/v1/users/profile', data);
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  /**
   * Upload profile photo
   * @param photoUri - Local URI of the photo to upload
   * @param index - Photo index (0-4)
   */
  async uploadProfilePhoto(photoUri: string, index: number) {
    try {
      console.log('Uploading profile photo:', { photoUri, index });
      
      // Create FormData for multipart upload
      const formData = new FormData();
      
      // For React Native, we need to create a proper file object
      const photo = {
        uri: photoUri,
        type: 'image/jpeg', // You might want to detect this dynamically
        name: `photo_${index}.jpg`
      } as any;
      
      formData.append('photo', photo);
      
      const response = await this.api.post(`/v1/users/profile/photo/${index}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  /**
   * Remove profile photo
   * @param index - Photo index to remove (0-4)
   */
  async removeProfilePhoto(index: number) {
    try {
      console.log('Removing profile photo at index:', index);
      const response = await this.api.delete(`/v1/users/profile/photo/${index}`);
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  // =====================================================
  // END PROFILE ENDPOINTS
  // =====================================================

  // Metodi aggiuntivi per altre funzionalità
  async updateMood(emoji: string, mood: string) {
    try {
      const response = await this.api.post('/v1/update-mood', {
        emoji,
        mood
      });
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  async registerEncounter(otherUserId: string, rssi: number) {
    try {
      const response = await this.api.post('/v1/register-encounter', {
        other_user_id: otherUserId,
        rssi
      });
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  async getSavedEncounters(limit: number = 50, startAfter?: string) {
    try {
      const params: any = { limit };
      if (startAfter) params.start_after = startAfter;
      
      const response = await this.api.get('/v1/saved-encounters', { params });
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  async createChallenge(challengeType: string) {
    try {
      const response = await this.api.post('/v1/challenges', {
        challenge_type: challengeType
      });
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  async getChallenges(limit: number = 50, startAfter?: string) {
    try {
      const params: any = { limit };
      if (startAfter) params.start_after = startAfter;
      
      const response = await this.api.get('/v1/challenges', { params });
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  async reportUser(reportedUserId: string, reason: string) {
    try {
      const response = await this.api.post('/v1/report-user', {
        reported_user_id: reportedUserId,
        reason
      });
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  async deleteAccount() {
    try {
      const response = await this.api.delete('/v1/delete-account');
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  // Anonymous auth token endpoint
  async getAnonymousToken(descriptor: string, eventId?: string) {
    try {
      const response = await this.api.post('/v1/auth/anonymous-token', {
        descriptor,
        event_id: eventId
      });
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  // Batch update endpoint
  async batchUpdateUsers(updates: any[]) {
    try {
      const response = await this.api.post('/v1/batch-update', {
        updates
      });
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  // Export user data
  async exportMyData() {
    try {
      const response = await this.api.get('/v1/export-my-data');
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  async setEthicalSettings(settings: UserSettings) {
    try {
      const response = await this.api.post('/v1/set-ethical-settings', settings);
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  async checkGeofence(eventId: string, location: Coordinates) {
    try {
      const response = await this.api.post('/v1/users/geofence-check', {
        event_id: eventId,
        location
      });
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  // Configuration endpoints
  async getPublicConfig() {
    try {
      const response = await this.api.get('/config/public');
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  async getFeatureFlags() {
    try {
      const response = await this.api.get('/config/features');
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  // Notification endpoints
  async sendNotification(recipientId: string, type: string, content: any) {
    try {
      const response = await this.api.post('/v1/send', {
        recipient_id: recipientId,
        type,
        content
      });
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  async markNotificationRead(notificationId: string) {
    try {
      const response = await this.api.post('/v1/mark-read', {
        notification_id: notificationId
      });
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  async getOnlineUsers() {
    try {
      const response = await this.api.get('/v1/users/online');
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  // =====================================================
  // MOMENTS FEATURE ENDPOINTS - CORRECTED
  // =====================================================

  /**
   * Get moments near a location - FIXED to use query parameters
   * @param location - User's current location
   * @param radius - Search radius in meters
   * @param limit - Number of moments to return
   */
  async getMoments(
    location?: Coordinates,
    radius: number = 1000,
    limit: number = 50
  ): Promise<MomentResponse[] | ApiError> {
    try {
      const params = new URLSearchParams();
      
      if (location) {
        params.append('latitude', location.latitude.toString());
        params.append('longitude', location.longitude.toString());
      }
      params.append('radius', radius.toString());
      params.append('limit', limit.toString());
      
      console.log('Getting moments with URL:', `/v1/moments?${params.toString()}`);
      
      const response = await this.api.get(`/v1/moments?${params.toString()}`);
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  /**
   * Drop a new moment
   * @param momentData - Moment details
   */
  async dropMoment(momentData: MomentRequest): Promise<MomentResponse | ApiError> {
    try {
      console.log('Dropping moment:', momentData);
      
      const response = await this.api.post('/v1/moments', {
        ...momentData,
        expires_in_hours: momentData.expires_in_hours || 3 // Default 3 hours
      });
      
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  /**
   * Send a star to a moment (user saying "That's me!")
   * @param momentId - ID of the moment
   * @param userId - ID of the user claiming the moment (optional)
   */
  async sendStar(momentId: string, userId?: string): Promise<SendStarResponse | ApiError> {
    try {
      console.log('Sending star to moment:', momentId);
      
      const response = await this.api.post(`/v1/moments/${momentId}/star`, {
        user_id: userId // Optional override for testing
      });
      
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  /**
   * Get notifications about moments where someone noticed you
   */
  async getMomentNotifications(): Promise<MomentNotificationResponse | ApiError> {
    try {
      const response = await this.api.get('/v1/moments/notifications');
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  /**
   * Confirm or deny a moment match - FIXED to include star_user_id as query param
   * @param momentId - ID of the moment
   * @param starUserId - ID of the user who starred
   * @param isMatch - Whether to confirm the match
   */
  async confirmMomentMatch(momentId: string, starUserId: string, isMatch: boolean): Promise<ConfirmMatchResponse | ApiError> {
    try {
      const response = await this.api.post(
        `/v1/moments/${momentId}/confirm?star_user_id=${starUserId}`,
        {
          is_match: isMatch
        }
      );
      
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  /**
   * Get a specific moment by ID
   * @param momentId - ID of the moment
   */
  async getMomentById(momentId: string): Promise<MomentResponse | ApiError> {
    try {
      const response = await this.api.get(`/v1/moments/${momentId}`);
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  /**
   * Get user's moment history
   * @param userId - User ID (optional, defaults to current user)
   * @param includeExpired - Whether to include expired moments
   */
  async getUserMoments(userId?: string, includeExpired: boolean = false): Promise<MomentResponse[] | ApiError> {
    try {
      const params = new URLSearchParams();
      params.append('include_expired', includeExpired.toString());
        
      const response = await this.api.get(`/v1/moments/user/${userId || 'me'}/moments?${params.toString()}`);
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  /**
   * Delete a moment
   * @param momentId - ID of the moment to delete
   */
  async deleteMoment(momentId: string) {
    try {
      const response = await this.api.delete(`/v1/moments/${momentId}`);
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  /**
   * Report an inappropriate moment
   * @param momentId - ID of the moment
   * @param reason - Reason for reporting
   */
  async reportMoment(momentId: string, reason: string) {
    try {
      const response = await this.api.post(`/v1/moments/${momentId}/report`, {
        reason
      });
      
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  // =====================================================
  // BADGES ENDPOINTS - FIXED with spec's double /v1/v1/
  // =====================================================

  async awardBadge(userId: string, badgeType: string, metadata?: any) {
    try {
      const response = await this.api.post('/v1/v1/badges/award', {
        user_id: userId,
        badge_type: badgeType,
        metadata
      });
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  async getUserBadgesByUserId(userId: string) {
    try {
      const response = await this.api.get(`/v1/v1/badges/${userId}`);
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  async getBadgeProgress(userId: string) {
    try {
      const response = await this.api.get(`/v1/v1/badges/progress/${userId}`);
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  async getBadgeLeaderboard() {
    try {
      const response = await this.api.get('/v1/v1/badges/leaderboard');
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  async getBadgeStats(eventId: string) {
    try {
      const response = await this.api.get(`/v1/v1/badges/stats/${eventId}`);
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  async checkBadgeEligibility(userId: string) {
    try {
      const response = await this.api.post('/v1/v1/badges/check-eligibility', {
        user_id: userId
      });
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  // =====================================================
  // CHAT ENDPOINTS - FIXED
  // =====================================================

  // Alias per getConversationMessages -> getMessages (per compatibilità con ChatScreen)
  async getMessages(conversationId: string, limit: number = 50) {
    try {
      const response = await this.getConversationMessages(conversationId, limit);
      
      // Se la risposta è già formattata con { messages: [...] }
      if (response.messages) {
        return response;
      }
      
      // Altrimenti, wrappa l'array di messaggi
      return { 
        messages: Array.isArray(response) ? response : [],
        error: null 
      };
    } catch (error) {
      console.error('Failed to get messages:', error);
      return { 
        error: 'Failed to load messages', 
        messages: [] 
      };
    }
  }

  // Alias per markMessagesRead -> markMessagesAsRead (per compatibilità con ChatScreen)
  async markMessagesAsRead(conversationId: string) {
    try {
      // Ottieni prima i messaggi per avere gli ID
      const messagesResponse = await this.getConversationMessages(conversationId, 50);
      const messages = messagesResponse.messages || messagesResponse || [];
      
      // Estrai gli ID dei messaggi non letti
      const unreadMessageIds = messages
        .filter((msg: any) => !msg.read)
        .map((msg: any) => msg.id || msg.message_id);
      
      if (unreadMessageIds.length > 0) {
        const response = await this.markMessagesRead(conversationId, unreadMessageIds);
        return response;
      }
      
      return { success: true };
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
      return { error: 'Failed to mark messages as read' };
    }
  }

  // Override sendMessage per allineamento con ChatScreen
  async sendMessage(messageData: {
    recipient_id: string;
    content: string;
    encrypted_content?: string | null;
    is_encrypted: boolean;
  }): Promise<{ error: null | string; message?: ChatMessage }> {
    try {
      // Prepara il payload per il server
      const payload: SendMessageRequest = {
        recipient_id: messageData.recipient_id,
        encrypted_content: messageData.encrypted_content || messageData.content,
        metadata: {
          is_encrypted: String(messageData.is_encrypted),
          algorithm: messageData.is_encrypted ? 'aes-256-gcm' : 'none'
        }
      };
      
      const response = await this.api.post('/v1/chat/messages', payload);
      
      // Formatta la risposta per compatibilità con ChatScreen
      return {
        error: null,
        message: {
          ...response.data,
          id: response.data.id || response.data.message_id,
          content: messageData.content, // Mantieni il contenuto decriptato
          is_encrypted: messageData.is_encrypted
        }
      };
    } catch (error) {
      console.error('Failed to send message:', error);
      const apiError = this.handleError(error as AxiosError);
      return { 
        error: apiError.detail,
        message: undefined 
      };
    }
  }

  async getConversationMessages(
    conversationId: string,
    limit: number = 50,
    beforeTimestamp?: number
  ): Promise<{ messages: ChatMessage[] } | ApiError> {
    try {
      const params: any = { limit };
      if (beforeTimestamp) {
        params.before_timestamp = beforeTimestamp;
      }
      
      const response = await this.api.get(
        `/v1/chat/messages/${conversationId}`,
        { params }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to get messages:', error);
      return this.handleError(error as AxiosError);
    }
  }

  async getConversations(limit: number = 20): Promise<{ conversations: Conversation[] } | ApiError> {
    try {
      const response = await this.api.get(
        '/v1/chat/conversations',
        { params: { limit } }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to get conversations:', error);
      return this.handleError(error as AxiosError);
    }
  }

  // UPDATED: Key exchange for E2E encryption con supporto per options - ora usa aes-256-gcm
  async exchangeKeys(recipientId: string, options?: { algorithm?: string }): Promise<KeyExchangeResponse | ApiError> {
    try {
      const response = await this.api.post('/v1/chat/keys/exchange', {
        recipient_id: recipientId,
        metadata: options ? {
          algorithm: options.algorithm || 'aes-256-gcm'
        } : {
          algorithm: 'aes-256-gcm'
        }
      });
      return response.data;
    } catch (error) {
      console.error('Key exchange failed:', error);
      return this.handleError(error as AxiosError);
    }
  }

  async deleteMessage(messageId: string) {
    try {
      const response = await this.api.delete(
        `/v1/chat/messages/${messageId}`
      );
      return response.data;
    } catch (error) {
      console.error('Failed to delete message:', error);
      return this.handleError(error as AxiosError);
    }
  }

  async markMessagesRead(conversationId: string, messageIds: string[]) {
    try {
      const response = await this.api.post('/v1/chat/read', {
        conversation_id: conversationId,
        message_ids: messageIds
      });
      return response.data;
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
      return this.handleError(error as AxiosError);
    }
  }

  async generateChatKey(sessionId: string, publicKey: string) {
    try {
      const response = await this.api.post('/v1/chat/key', {
        session_id: sessionId,
        public_key: publicKey
      });
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  async getChatKey(sessionId: string) {
    try {
      const response = await this.api.get(`/v1/chat/key/${sessionId}`);
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  async setTypingStatus(recipientId: string, isTyping: boolean) {
    try {
      const response = await this.api.post('/v1/chat/typing', {
        recipient_id: recipientId,
        is_typing: isTyping
      });
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  // Additional useful endpoints from documentation
  async checkDescriptor(descriptor: string) {
    try {
      const response = await this.api.get(`/v1/check-descriptor/${encodeURIComponent(descriptor)}`);
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  async suggestDescriptor() {
    try {
      const response = await this.api.post('/v1/suggest-descriptor');
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  // Temporary users statistics
  async getTemporaryUsersStats() {
    try {
      const response = await this.api.get('/v1/users/temporary/stats');
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  // Location RTDB status
  async checkRTDBStatus() {
    try {
      const response = await this.api.get('/v1/location/rtdb-status');
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  // Detailed health check
  async getDetailedHealthCheck() {
    try {
      const response = await this.api.get('/healthcheck/detailed');
      return response.data;
    } catch (error) {
      return this.handleError(error as AxiosError);
    }
  }

  // Debug method per testare gli endpoint
  async debugEndpoints() {
    console.log('=== DEBUG ENDPOINTS ===');
    
    // Test reaction con diversi formati
    const testReactions = ['👋', 'wave', '\u{1F44B}', String.fromCodePoint(0x1F44B)];
    for (const reaction of testReactions) {
      try {
        console.log(`Testing reaction: ${reaction}`);
        const response = await this.api.post('/v1/send-reaction', {
          recipient_id: 'test_user',
          reaction: reaction
        });
        console.log('Success:', response.data);
      } catch (error: any) {
        console.log(`Failed with ${reaction}:`, error.response?.data);
      }
    }
    
    // Test chat endpoints
    const chatEndpoints = [
      '/v1/chat/conversations',
      '/chat/conversations',
      '/v1/v1/chat/conversations'  // In caso di doppio prefisso
    ];
    
    for (const endpoint of chatEndpoints) {
      try {
        console.log(`Testing endpoint: ${endpoint}`);
        const response = await this.api.get(endpoint);
        console.log('Success:', response.status);
      } catch (error: any) {
        console.log(`Failed ${endpoint}:`, error.response?.status, error.response?.data);
      }
    }
    
    console.log('=== END DEBUG ===');
  }
}

// Export types for use in other files (for backward compatibility)
export type {
  MomentResponse,
  MomentRequest,
  MomentAuthor,
  MomentLocation,
  StarInfo,
  MomentNotificationResponse,
  Conversation,
  ChatMessage,
  UserProfile,
  ProfileUpdateRequest,
  // Add other commonly used types here
};

export default new ApiService();