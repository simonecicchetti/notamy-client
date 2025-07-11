/**
 * WebSocket Service per Notamy
 *
 * Gestisce la connessione WebSocket per:
 * - Messaggi real-time
 * - Notifiche
 * - Scambio chiavi per crittografia E2E
 * - Eventi moments
 * - Sincronizzazione stato utenti
 *
 * Features:
 * - Riconnessione automatica con backoff esponenziale
 * - Coda messaggi quando offline
 * - Event emitter pattern per componenti React
 * - Gestione token authentication
 * - Supporto completo per crittografia E2E automatica
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { store } from '@/store';
import { addMessage, updateMessage } from '@/store/slices/chatSlice';
import { addNotification } from '@/store/slices/notificationSlice';
import { updateNearbyUsers } from '@/store/slices/usersSlice';
// Import moments actions (da creare se non esistono)
import {
  addNearbyMoment,
  updateMomentStars,
  updateMomentMatch,
  removeMoment,
  setMomentExpired
} from '@/store/slices/momentsSlice';

// Get WebSocket URL from environment variables
const WS_BASE_URL = process.env.EXPO_PUBLIC_API_URL?.replace('http://', 'ws://').replace('https://', 'wss://') || 'ws://192.168.0.8:8000';

// WebSocket message types from server
interface WSMessage {
  type: string;
  [key: string]: any;
}

// Server envelope structure - il server wrappa tutti i messaggi in questo formato
interface WSEnvelope {
  compressed: boolean;
  timestamp: number;
  data: WSMessage | string;
}

// Event emitter type definitions
type EventCallback = (data: any) => void;
type EventListeners = { [event: string]: EventCallback[] };

/**
 * Servizio WebSocket singleton per gestire tutte le comunicazioni real-time
 */
class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private pingInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private userId: string | null = null;
  private currentUserId: string | null = null;
  private messageQueue: any[] = [];
  private isConnecting = false;
  private currentToken: string | null = null;
  
  // Event emitter properties per pattern pub/sub interno
  private listeners: EventListeners = {};

  /**
   * Connette al WebSocket server con autenticazione Firebase
   * @param userId - ID dell'utente corrente
   */
  async connect(userId: string): Promise<void> {
    // Validazione userId
    if (!userId || userId.trim() === '') {
      console.error('Invalid userId provided to WebSocket connect');
      return;
    }

    // Evita connessioni multiple
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      console.log('WebSocket already connected or connecting');
      return;
    }

    this.isConnecting = true;
    this.userId = userId;
    this.currentUserId = userId;
    
    try {
      // Ottieni il token Firebase più recente per autenticazione
      const token = await AsyncStorage.getItem('authToken');
      if (!token) {
        console.error('No auth token for WebSocket connection');
        this.isConnecting = false;
        
        // Notifica l'utente che deve autenticarsi
        store.dispatch(addNotification({
          id: `${Date.now()}_auth_error`,
          type: 'error',
          message: 'Authentication required. Please login again.',
          senderId: 'system',
          timestamp: new Date().toISOString(),
          status: 'unread',
        }));
        return;
      }

      // Salva il token corrente per verifiche future
      this.currentToken = token;

      // Costruisci l'URL WebSocket con il token per autenticazione
      const wsUrl = `${WS_BASE_URL}/v1/chat/${userId}?token=${encodeURIComponent(token)}`;
      console.log('Connecting to WebSocket:', wsUrl.replace(token, 'TOKEN_HIDDEN'));
      console.log('WebSocket URL base:', WS_BASE_URL);
      console.log('User ID:', userId);
      
      this.ws = new WebSocket(wsUrl);
      this.setupEventHandlers();
    } catch (error) {
      console.error('WebSocket connection error:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  /**
   * Configura tutti gli event handler del WebSocket
   * Gestisce connessione, disconnessione, errori e messaggi
   */
  private setupEventHandlers(): void {
    if (!this.ws) return;

    // Handler per connessione stabilita
    this.ws.onopen = () => {
      console.log('WebSocket connected successfully');
      console.log('Connection state:', this.ws?.readyState);
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      this.startPingInterval();
      this.flushMessageQueue();

      // Emit connection event per listener esterni
      this.emit('connected', {});

      // Notifica connessione riuscita (opzionale, potrebbe essere troppo invasivo)
      store.dispatch(addNotification({
        id: `${Date.now()}_connected`,
        type: 'success',
        message: 'Real-time connection established',
        senderId: 'system',
        timestamp: new Date().toISOString(),
        status: 'unread',
      }));
    };

    // Handler per disconnessione
    this.ws.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason);
      this.isConnecting = false;
      this.stopPingInterval();
      
      // Emit disconnection event
      this.emit('disconnected', { code: event.code, reason: event.reason });
      
      if (event.code === 4001) {
        // Token non valido o scaduto - codice custom del server
        console.error('WebSocket auth failed, clearing token');
        this.clearAuthAndNotify();
      } else if (event.code !== 1000 && event.code !== 1001) {
        // Chiusura anomala, tenta riconnessione
        this.scheduleReconnect();
      }
    };

    // Handler per errori di connessione
    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.isConnecting = false;
      
      // Emit error event
      this.emit('error', error);
    };

    // Handler principale per messaggi ricevuti
    this.ws.onmessage = (event) => {
      console.log('📨 WebSocket raw message received:', event.data);
      
      try {
        // Parse the envelope - il server wrappa tutti i messaggi
        const envelope: WSEnvelope = JSON.parse(event.data);
        console.log('📨 Parsed WebSocket envelope:', envelope);
        
        // Extract the actual message data from the envelope
        let messageData: WSMessage;
        
        // Check if data is compressed (base64 string)
        if (envelope.compressed && typeof envelope.data === 'string') {
          // TODO: Implement decompression if needed
          console.warn('Compressed messages not yet implemented');
          return;
        } else if (typeof envelope.data === 'object' && envelope.data !== null) {
          // Data is already an object
          messageData = envelope.data as WSMessage;
        } else {
          // Fallback: treat the entire envelope as the message
          messageData = envelope as any;
        }
        
        console.log('📨 Extracted message data:', {
          type: messageData.type,
          ...messageData
        });
        
        // Process the extracted message based on type
        this.handleMessage(messageData);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };
  }

  /**
   * Pulisce l'autenticazione e notifica l'utente
   * Chiamato quando il token non è più valido
   */
  private async clearAuthAndNotify(): Promise<void> {
    this.currentToken = null;
    await AsyncStorage.removeItem('authToken');
    
    store.dispatch(addNotification({
      id: `${Date.now()}_auth_expired`,
      type: 'error',
      message: 'Session expired. Please login again.',
      senderId: 'system',
      timestamp: new Date().toISOString(),
      status: 'unread',
    }));
  }

  /**
   * Gestisce tutti i tipi di messaggi ricevuti dal server
   * Questo è il cuore del sistema di messaggistica real-time
   * @param data - Messaggio decodificato dal server
   */
  private async handleMessage(data: WSMessage): Promise<void> {
    console.log('🔍 Processing message type:', data.type);

    // Emit raw message event per qualsiasi listener registrato
    this.emit(data.type, data);

    switch (data.type) {
      // =====================================================
      // SYSTEM MESSAGES
      // =====================================================
      
      case 'ping':
        console.log('🏓 Received ping, sending pong');
        // Respond to server ping per mantenere la connessione viva
        this.send({ type: 'pong', timestamp: data.timestamp });
        break;

      // =====================================================
      // ENCRYPTION & KEY EXCHANGE - CRITICAL FOR E2E
      // =====================================================
      
      // Handler per notifica che la crittografia è pronta
      case 'encryption_ready':
        console.log('🔐 Encryption ready notification:', {
          session_id: data.session_id,
          sender_id: data.sender_id,
          recipient_id: data.recipient_id
        });
        
        // Emit l'evento per ChatScreen che sta aspettando
        this.emit('encryption_ready', data);
        
        // Notifica visuale discreta (auto-dismiss dopo 3 secondi)
        if (data.sender_id !== this.currentUserId) {
          store.dispatch(addNotification({
            id: `${Date.now()}_encryption_ready`,
            type: 'info',
            message: '🔐 Chat is now encrypted',
            senderId: 'system',
            timestamp: new Date().toISOString(),
            metadata: {
              sessionId: data.session_id,
              senderId: data.sender_id
            },
            status: 'unread',
            autoDismiss: 3000 // Se il sistema notifiche lo supporta
          }));
        }
        break;

      // Handler per richiesta di scambio chiavi
      case 'key_exchange':
      case 'key_exchange_request':  // Supporta entrambi i nomi per compatibilità
        console.log('🔑 Key exchange request:', {
          sender_id: data.sender_id,
          has_public_key: !!data.public_key,
          algorithm: data.algorithm,
          key_type: data.key_type
        });
        
        // Verifica che l'algoritmo sia supportato
        const supportedAlgorithms = ['aes-256-gcm', 'x25519', 'ecdh-p256'];
        if (data.algorithm && !supportedAlgorithms.includes(data.algorithm)) {
          console.warn('⚠️ Unsupported algorithm:', data.algorithm);
          return;
        }
        
        // Emit per notificare ChatScreen che qualcuno vuole scambiare chiavi
        this.emit('key_exchange_request', data);
        
        // Salva la richiesta per reference futura
        await AsyncStorage.setItem(
          `pending_key_exchange_${data.sender_id}`,
          JSON.stringify({
            sessionId: data.session_id,
            senderId: data.sender_id,
            timestamp: data.timestamp,
            algorithm: data.algorithm || 'x25519',
            keyType: data.key_type || 'x25519',
            publicKey: data.public_key // Se il server lo inoltra
          })
        );
        break;

      // Handler per notifica di rotazione chiavi
      case 'key_rotation':
        console.log('🔄 Key rotation notification received');
        this.emit('key_rotation', data);
        break;

      // Handler per richiesta di rotazione chiavi obbligatoria
      case 'key_rotation_required':
        console.log('🔑 Key rotation required for session:', data.session_id);
        
        // Emit event per ChatScreen
        this.emit('key_rotation_required', {
          session_id: data.session_id,
          reason: data.reason
        });
        
        // Show notification
        store.dispatch(addNotification({
          id: `${Date.now()}_key_rotation`,
          type: 'security',
          message: 'Encryption key updated for enhanced security',
          senderId: 'system',
          timestamp: new Date().toISOString(),
          status: 'unread',
        }));
        break;

      // =====================================================
      // CHAT MESSAGES - CORE MESSAGING
      // =====================================================
      
      // Handler principale per messaggi chat (supporta entrambi i tipi)
      case 'message':
      case 'new_message':
        console.log('📨 New chat message received:', data);
        
        // Log dell'algoritmo di crittografia se presente
        if (data.metadata?.custom_encryption) {
          console.log('🔐 Message encrypted with:', data.metadata.custom_encryption);
        }
        
        // Emit specific new_message event per ChatScreen
        this.emit('new_message', data);
        
        // Show notification only if it's not our own message
        if (data.sender_id !== this.currentUserId) {
          // Notifica il ChatScreen se è aperto per questo sender
          store.dispatch({
            type: 'chat/messageReceived',
            payload: {
              senderId: data.sender_id,
              message: {
                id: data.message_id,
                sender_id: data.sender_id,
                recipient_id: data.recipient_id,
                encrypted_content: data.encrypted_content,
                timestamp: data.timestamp,
                session_id: data.session_id,
                metadata: data.metadata
              }
            }
          });
          
          // Trigger refresh per il ChatScreen
          store.dispatch({
            type: 'chat/setRefreshTrigger',
            payload: {
              senderId: data.sender_id
            }
          });
          
          // Mostra notifica push locale se l'app è in background
          if (data.sender_descriptor) {
            const { showNotification } = await import('@/utils/notifications');
            showNotification({
              title: `${data.sender_descriptor}`,
              body: '🔐 New encrypted message',
              data: {
                type: 'chat',
                senderId: data.sender_id,
                messageId: data.message_id
              }
            });
          }
        }
        break;

      // Handler per indicatore di digitazione
      case 'typing_status':
        console.log('⌨️ Typing status received:', data);
        this.emit('typing_status', data);
        break;

      // Handler per status online/offline utente
      case 'user_status':
        console.log('👤 User status received:', data);
        this.emit('user_status', data);
        break;

      // Handler per messaggio cancellato
      case 'message_deleted':
        console.log('🗑️ Message deleted notification:', {
          message_id: data.message_id,
          sender_id: data.sender_id
        });
        
        this.handleMessageDeleted(data);
        break;

      // Handler legacy per chat (mantenuto per compatibilità)
      case 'chat':
        console.log('💬 Legacy chat message received:', {
          sender_id: data.sender_id,
          session_id: data.session_id,
          event_id: data.event_id
        });
        
        // Handle encrypted chat message only if not from current user
        if (data.sender_id !== this.currentUserId) {
          store.dispatch(addMessage({
            id: `${Date.now()}_${Math.random()}`,
            senderId: data.sender_id,
            encryptedContent: data.encrypted_content,
            sessionId: data.session_id,
            eventId: data.event_id,
            timestamp: new Date().toISOString(),
          }));
        }
        break;

      // =====================================================
      // SOCIAL INTERACTIONS
      // =====================================================
      
      case 'reaction':
        // Handle reaction message
        console.log('🎉 REACTION RECEIVED:', {
          sender_id: data.sender_id,
          reaction: data.reaction,
          recipient_id: data.recipient_id,
          sender_descriptor: data.sender_descriptor,
          full_data: data
        });
        
        // Show notification only if it's not our own reaction
        if (data.sender_id !== this.currentUserId) {
          const reactionEmoji = data.reaction || '👋';
          const senderName = data.sender_descriptor || 'Someone';
          
          store.dispatch(addNotification({
            id: `${Date.now()}_reaction_${Math.random()}`,
            type: 'reaction',
            message: `${senderName} sent you ${reactionEmoji}`,
            senderId: data.sender_id,
            timestamp: new Date().toISOString(),
            metadata: {
              reaction: reactionEmoji,
              senderDescriptor: senderName,
            },
            status: 'unread',
          }));
        }
        break;

      case 'user_noted':
        console.log('⭐ User noted received:', {
          sender_id: data.sender_id,
          sender_descriptor: data.sender_descriptor,
          is_mutual: data.is_mutual,
          timestamp: data.timestamp
        });
        
        // Emit the event for DiscoverScreen to handle
        this.emit('user_noted', data);
        
        // Show notification only if it's not our own action
        if (data.sender_id !== this.currentUserId) {
          const senderName = data.sender_descriptor || 'Someone';
          
          store.dispatch(addNotification({
            id: `${Date.now()}_noted_${Math.random()}`,
            type: data.is_mutual ? 'mutual_note' : 'note',
            message: data.is_mutual
              ? `✨ Mutual note with ${senderName}!`
              : `${senderName} noted you ⭐`,
            senderId: data.sender_id,
            timestamp: new Date().toISOString(),
            metadata: {
              senderDescriptor: senderName,
              isMutual: data.is_mutual,
            },
            status: 'unread',
          }));
        }
        break;

      // =====================================================
      // USER DISCOVERY & PROXIMITY
      // =====================================================
      
      case 'proximity_flash':
        console.log('⚡ Proximity flash received:', {
          descriptor: data.descriptor,
          full_data: data
        });
        
        // Handle proximity flash only if not from current user
        if (data.sender_id !== this.currentUserId) {
          // Only dispatch notification to store
          store.dispatch(addNotification({
            id: `${Date.now()}_proximity_${Math.random()}`,
            type: 'proximity',
            message: `${data.descriptor} is very close to you!`,
            senderId: data.sender_id,
            timestamp: new Date().toISOString(),
            metadata: {
              descriptor: data.descriptor,
            },
            status: 'unread',
          }));
        }
        break;

      case 'visual_hint_update':
        console.log('👁️ Visual hint update received:', {
          user_id: data.user_id,
          descriptor: data.descriptor,
          hint: data.hint
        });
        
        // Handle visual hint updates only if not from current user
        if (data.user_id !== this.currentUserId) {
          store.dispatch(addNotification({
            id: `${Date.now()}_${Math.random()}`,
            type: 'visual_hint',
            message: `${data.descriptor} set a visual hint: ${data.hint}`,
            senderId: data.user_id,
            timestamp: new Date().toISOString(),
            metadata: {
              hint: data.hint,
              expiresAt: data.expires_at,
            },
            status: 'unread',
          }));
        }
        break;

      case 'user:nearby':
        console.log('👥 Nearby users update:', {
          users_count: data.users?.length || 0,
          users: data.users
        });
        
        // Update nearby users in Redux store
        if (data.users) {
          store.dispatch(updateNearbyUsers(data.users));
        }
        break;

      case 'hint_ack':
        console.log('✅ Hint acknowledged');
        
        // Someone acknowledged your hint
        store.dispatch(addNotification({
          id: `${Date.now()}_hint_ack_${Math.random()}`,
          type: 'hint_ack',
          message: 'Someone recognized your visual hint!',
          senderId: 'system',
          timestamp: new Date().toISOString(),
          status: 'unread',
        }));
        break;

      // =====================================================
      // PROFILE INTERACTIONS
      // =====================================================
      
      case 'profile_view':
        console.log('👁️ Profile view received:', {
          viewer_id: data.viewer_id,
          viewer_descriptor: data.viewer_descriptor,
          viewed_at: data.viewed_at,
          your_profile: data.your_profile_id === this.currentUserId
        });
        
        // Emit event for ProfileScreen
        this.emit('profile_view', data);
        
        // Show notification only if someone viewed YOUR profile
        if (data.your_profile_id === this.currentUserId && data.viewer_id !== this.currentUserId) {
          store.dispatch(addNotification({
            id: `${Date.now()}_profile_view_${Math.random()}`,
            type: 'profile_view',
            message: `${data.viewer_descriptor || 'Someone'} viewed your profile`,
            senderId: data.viewer_id,
            timestamp: new Date().toISOString(),
            metadata: {
              viewerDescriptor: data.viewer_descriptor,
              viewedAt: data.viewed_at
            },
            status: 'unread',
          }));
        }
        break;

      // =====================================================
      // MOMENTS FEATURE HANDLERS
      // =====================================================
      
      case 'moment_dropped':
        console.log('💫 New moment dropped:', {
          moment_id: data.moment_id,
          author_id: data.author_id,
          author_descriptor: data.author_descriptor,
          area: data.area,
          expires_at: data.expires_at
        });
        
        // Emit event for MomentsScreen to update
        this.emit('moment_dropped', data);
        
        // Update Redux store if it's nearby and not from current user
        if (data.is_nearby && data.author_id !== this.currentUserId) {
          store.dispatch(addNearbyMoment({
            id: data.moment_id,
            author: {
              user_id: data.author_id,
              descriptor: data.author_descriptor,
              emoji: data.author_emoji
            },
            description: data.description,
            location: {
              name: data.area || 'Nearby',
              area: data.area,
              coordinates: data.location
            },
            created_at: data.created_at,
            expires_at: data.expires_at,
            star_count: 0,
            is_nearby: true,
            can_star: true,
            distance: data.distance
          }));
          
          // Show notification
          store.dispatch(addNotification({
            id: `${Date.now()}_moment_${data.moment_id}`,
            type: 'moment',
            message: `${data.author_descriptor} dropped a moment nearby`,
            senderId: data.author_id,
            timestamp: new Date().toISOString(),
            metadata: {
              momentId: data.moment_id,
              area: data.area,
              expiresAt: data.expires_at
            },
            status: 'unread',
          }));
        }
        break;

      // Handler per quando qualcuno da una stella al tuo moment
      case 'moment_starred':
      case 'moment_star_received':
        console.log('⭐ Someone starred your moment:', {
          moment_id: data.moment_id,
          star_sender_id: data.star_sender_id,
          star_sender_descriptor: data.star_sender_descriptor,
          total_stars: data.total_stars,
          moment_author_id: data.moment_author_id
        });
        
        // Emit event for UI updates
        this.emit('moment_starred', data);
        
        // Update Redux store if we're the moment author
        if (data.moment_author_id === this.currentUserId) {
          store.dispatch(updateMomentStars({
            momentId: data.moment_id,
            totalStars: data.total_stars,
            starSender: {
              user_id: data.star_sender_id,
              descriptor: data.star_sender_descriptor,
              timestamp: data.timestamp
            }
          }));
          
          // Show notification
          store.dispatch(addNotification({
            id: `${Date.now()}_star_${data.moment_id}`,
            type: 'moment_star',
            message: `${data.star_sender_descriptor} thinks they're in your moment! ⭐`,
            senderId: data.star_sender_id,
            timestamp: new Date().toISOString(),
            metadata: {
              momentId: data.moment_id,
              starSenderDescriptor: data.star_sender_descriptor,
              totalStars: data.total_stars
            },
            status: 'unread',
          }));
        }
        break;

      case 'moment_matched':
        console.log('💕 Moment matched!', {
          moment_id: data.moment_id,
          matched_user_id: data.matched_user_id,
          matched_user_descriptor: data.matched_user_descriptor,
          is_mutual: data.is_mutual
        });
        
        // Emit event for UI updates
        this.emit('moment_matched', data);
        
        // Update Redux store
        store.dispatch(updateMomentMatch({
          momentId: data.moment_id,
          matchedUserId: data.matched_user_id,
          matchedUserDescriptor: data.matched_user_descriptor,
          isMutual: data.is_mutual
        }));
        
        // Show match notification
        store.dispatch(addNotification({
          id: `${Date.now()}_moment_match_${data.moment_id}`,
          type: 'moment_match',
          message: data.is_mutual
            ? `✨ Mutual moment match with ${data.matched_user_descriptor}!`
            : `💕 You matched with ${data.matched_user_descriptor}'s moment!`,
          senderId: data.matched_user_id,
          timestamp: new Date().toISOString(),
          metadata: {
            momentId: data.moment_id,
            matchedUserDescriptor: data.matched_user_descriptor,
            isMutual: data.is_mutual
          },
          status: 'unread',
        }));
        
        // Auto-navigate to chat if mutual match
        if (data.is_mutual) {
          // Emit special event per auto-navigation
          this.emit('mutual_moment_match', {
            userId: data.matched_user_id,
            descriptor: data.matched_user_descriptor
          });
        }
        break;

      case 'moment_expired':
        console.log('⏰ Moment expired:', {
          moment_id: data.moment_id,
          expired_at: data.expired_at
        });
        
        // Emit event for UI to remove expired moment
        this.emit('moment_expired', data);
        
        // Update Redux store
        store.dispatch(setMomentExpired(data.moment_id));
        break;

      case 'moment_deleted':
        console.log('🗑️ Moment deleted:', {
          moment_id: data.moment_id,
          deleted_by: data.deleted_by
        });
        
        // Emit event for UI to remove deleted moment
        this.emit('moment_deleted', data);
        
        // Update Redux store
        store.dispatch(removeMoment(data.moment_id));
        break;

      case 'moment_notification':
        console.log('🔔 Moment notification:', {
          type: data.notification_type,
          count: data.count,
          moments: data.moments
        });
        
        // Update notification count in MomentsScreen
        this.emit('moment_notifications', data);
        
        // Show aggregated notification
        if (data.count > 0) {
          store.dispatch(addNotification({
            id: `${Date.now()}_moment_notice`,
            type: 'moment_notice',
            message: `${data.count} people might have noticed you!`,
            senderId: 'system',
            timestamp: new Date().toISOString(),
            metadata: {
              count: data.count,
              moments: data.moments
            },
            status: 'unread',
          }));
        }
        break;

      // =====================================================
      // SYSTEM & MISC HANDLERS
      // =====================================================
      
      case 'notification':
        console.log('🔔 Generic notification received:', {
          notification_type: data.notification_type,
          message: data.message,
          sender_id: data.sender_id
        });
        
        // Handle general notification
        store.dispatch(addNotification({
          id: `${Date.now()}_${Math.random()}`,
          type: data.notification_type || 'general',
          message: data.message,
          senderId: data.sender_id,
          timestamp: new Date().toISOString(),
          metadata: data.metadata,
          status: 'unread',
        }));
        break;

      case 'battery_mode_updated':
        console.log('🔋 Battery mode updated:', data.mode);
        break;

      case 'error':
        console.error('❌ WebSocket error message:', data);
        
        if (data.error_code === 'TOO_MANY_REQUESTS') {
          // Rate limit error
          store.dispatch(addNotification({
            id: `${Date.now()}_rate_limit`,
            type: 'warning',
            message: 'You are sending messages too quickly. Please slow down.',
            senderId: 'system',
            timestamp: new Date().toISOString(),
            status: 'unread',
          }));
        } else if (data.error_code === 'UNAUTHORIZED') {
          // Token non valido
          this.clearAuthAndNotify();
        }
        break;

      default:
        console.log('❓ Unknown message type:', data.type, 'Full data:', data);
        
        // Log any unhandled message types for debugging (solo in dev)
        if (__DEV__) {
          store.dispatch(addNotification({
            id: `${Date.now()}_unknown_${Math.random()}`,
            type: 'debug',
            message: `Unknown message type: ${data.type}`,
            senderId: 'system',
            timestamp: new Date().toISOString(),
            metadata: data,
            status: 'unread',
          }));
        }
    }
  }

  /**
   * Handler specifico per messaggi cancellati
   * Aggiorna lo store Redux per riflettere la cancellazione
   */
  private async handleMessageDeleted(data: any): Promise<void> {
    try {
      const { message_id, sender_id } = data;
      
      // Calcola l'ID della conversazione
      const conversationId = this.userId && this.userId < sender_id
        ? `${this.userId}_${sender_id}`
        : `${sender_id}_${this.userId}`;
      
      // Aggiorna lo store Redux
      store.dispatch(updateMessage({
        chatKey: conversationId,
        messageId: message_id,
        updates: {
          deleted: true,
          decrypted_content: 'Message deleted'
        }
      }));
      
      console.log('[WebSocket] Message marked as deleted:', message_id);
    } catch (error) {
      console.error('[WebSocket] Error handling message deletion:', error);
    }
  }

  /**
   * Inizia l'invio periodico di ping per mantenere la connessione viva
   * Il server chiude le connessioni inattive dopo 60 secondi
   */
  private startPingInterval(): void {
    // Send ping every 30 seconds to keep connection alive
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        console.log('🏓 Sending ping to keep connection alive');
        this.send({ type: 'ping', timestamp: Date.now() });
      }
    }, 30000);
  }

  /**
   * Ferma l'invio di ping
   */
  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Programma un tentativo di riconnessione con backoff esponenziale
   * Massimo 5 tentativi prima di arrendersi
   */
  private async scheduleReconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.log('Max reconnection attempts reached');
      store.dispatch(addNotification({
        id: `${Date.now()}_error`,
        type: 'error',
        message: 'Connection lost. Please check your internet connection.',
        senderId: 'system',
        timestamp: new Date().toISOString(),
        status: 'unread',
      }));
      return;
    }

    // Verifica se il token è ancora valido prima di riconnettersi
    const currentToken = await AsyncStorage.getItem('authToken');
    if (!currentToken) {
      console.log('No auth token available, cancelling reconnect');
      return;
    }

    // Se il token è cambiato, resetta i tentativi
    if (currentToken !== this.currentToken) {
      console.log('Auth token changed, resetting reconnect attempts');
      this.reconnectAttempts = 0;
      this.currentToken = currentToken;
    }

    this.reconnectAttempts++;
    // Backoff esponenziale: 1s, 2s, 4s, 8s, 16s (max 30s)
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 30000);
    
    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimeout = setTimeout(() => {
      if (this.userId) {
        this.connect(this.userId);
      }
    }, delay);
  }

  /**
   * Invia tutti i messaggi in coda quando la connessione è ristabilita
   */
  private flushMessageQueue(): void {
    console.log(`Flushing ${this.messageQueue.length} queued messages`);
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.send(message);
    }
  }

  // =====================================================
  // EVENT EMITTER METHODS - Pattern pub/sub interno
  // =====================================================
  
  /**
   * Sottoscrivi a eventi WebSocket
   * @param event - Nome dell'evento (es: 'new_message', 'encryption_ready')
   * @param callback - Funzione da chiamare quando l'evento si verifica
   */
  on(event: string, callback: EventCallback): void {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
    console.log(`[WebSocket] Listener added for event: ${event}`);
  }

  /**
   * Rimuovi sottoscrizione a eventi WebSocket
   * @param event - Nome dell'evento
   * @param callback - Riferimento alla stessa funzione passata a on()
   */
  off(event: string, callback: EventCallback): void {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
      console.log(`[WebSocket] Listener removed for event: ${event}`);
    }
  }

  /**
   * Emetti eventi a tutti i listener registrati
   * @internal Uso interno, non per inviare al server
   */
  private emit(event: string, data: any): void {
    if (this.listeners[event]) {
      this.listeners[event].forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`[WebSocket] Error in ${event} listener:`, error);
        }
      });
    }
  }

  // =====================================================
  // PUBLIC METHODS - API pubblica del servizio
  // =====================================================

  /**
   * Invia un messaggio generico al server
   * Se offline, accoda il messaggio per l'invio successivo
   * @param data - Dati da inviare
   */
  send(data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('📤 Sending WebSocket message:', data);
      this.ws.send(JSON.stringify(data));
    } else {
      console.log('WebSocket not connected, queuing message:', data);
      this.messageQueue.push(data);
    }
  }

  /**
   * Invia un messaggio chat crittografato con tutti i metadata necessari
   * @param recipientId - ID del destinatario
   * @param encryptedContent - Contenuto già crittografato (JSON string)
   * @param sessionId - ID della sessione di crittografia
   * @param keyType - Tipo di chiave usata (default: x25519)
   */
  sendEncryptedMessage(
    recipientId: string,
    encryptedContent: string,
    sessionId: string,
    keyType: string = 'x25519'
  ): void {
    const message = {
      type: 'message',  // Usa 'message' per il nuovo formato
      recipient_id: recipientId,
      encrypted_content: encryptedContent,
      session_id: sessionId,
      key_type: keyType,
      metadata: {
        custom_encryption: 'aes-256-gcm',
        encrypted: true,
        client_version: '1.0',
        timestamp: Date.now()
      }
    };
    
    console.log('🔐 Sending encrypted message:', {
      recipient: recipientId,
      session: sessionId,
      encrypted: true,
      keyType: keyType
    });
    
    this.send(message);
  }

  /**
   * Metodo legacy per compatibilità
   * @deprecated Usa sendEncryptedMessage invece
   */
  sendChatMessage(recipientId: string, encryptedContent: string, sessionId: string): void {
    this.sendEncryptedMessage(recipientId, encryptedContent, sessionId);
  }

  /**
   * Invia proximity flash per notificare utenti molto vicini
   */
  sendProximityFlash(): void {
    console.log('⚡ Sending proximity flash');
    this.send({
      type: 'proximity_flash',
    });
  }

  /**
   * Aggiorna la modalità batteria per ottimizzare le notifiche
   * @param mode - Modalità batteria: normal, saving, critical
   */
  updateBatteryMode(mode: 'normal' | 'saving' | 'critical'): void {
    console.log('🔋 Updating battery mode:', mode);
    this.send({
      type: 'battery_mode',
      mode,
    });
  }

  /**
   * Invia notifica di moment creato
   * @param momentData - Dettagli del moment
   */
  sendMomentDropped(momentData: {
    description: string;
    area: string;
    location?: { latitude: number; longitude: number };
  }): void {
    console.log('💫 Broadcasting moment dropped');
    this.send({
      type: 'moment_dropped',
      ...momentData
    });
  }

  /**
   * Invia una stella per un moment
   * @param momentId - ID del moment
   * @param momentAuthorId - ID dell'autore del moment
   */
  sendMomentStar(momentId: string, momentAuthorId: string): void {
    console.log('⭐ Sending moment star');
    this.send({
      type: 'moment_star',
      moment_id: momentId,
      moment_author_id: momentAuthorId
    });
  }

  /**
   * Invia indicatore di digitazione per moments
   * @param isTyping - Se l'utente sta digitando
   */
  sendMomentTyping(isTyping: boolean): void {
    this.send({
      type: 'moment_typing',
      is_typing: isTyping
    });
  }

  /**
   * Disconnetti dal WebSocket server
   * Pulisce tutte le risorse e listener
   */
  disconnect(): void {
    console.log('Disconnecting WebSocket');
    
    this.stopPingInterval();
    
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    
    if (this.ws) {
      this.ws.close(1000, 'User disconnect');
      this.ws = null;
    }
    
    this.userId = null;
    this.currentUserId = null;
    this.currentToken = null;
    this.reconnectAttempts = 0;
    this.messageQueue = [];
    this.isConnecting = false;
    this.listeners = {}; // Clear all listeners
  }

  /**
   * Verifica se il WebSocket è connesso
   * @returns true se connesso
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Ottieni lo stato corrente della connessione
   * @returns Stato: disconnected, connecting, connected, closing, closed
   */
  getConnectionState(): string {
    if (!this.ws) return 'disconnected';
    
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING:
        return 'connecting';
      case WebSocket.OPEN:
        return 'connected';
      case WebSocket.CLOSING:
        return 'closing';
      case WebSocket.CLOSED:
        return 'closed';
      default:
        return 'unknown';
    }
  }

  /**
   * Verifica e aggiorna il token se necessario
   * Utile dopo il refresh del token Firebase
   */
  async refreshConnection(): Promise<void> {
    const newToken = await AsyncStorage.getItem('authToken');
    if (newToken && newToken !== this.currentToken) {
      console.log('Token changed, reconnecting WebSocket');
      this.disconnect();
      if (this.userId) {
        await this.connect(this.userId);
      }
    }
  }
}

// Esporta istanza singleton
export default new WebSocketService();
