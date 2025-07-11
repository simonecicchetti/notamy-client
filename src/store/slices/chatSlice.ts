// src/store/slices/chatSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '@/services/api';
import encryptionService from '@/services/encryptionService';
import { 
  ChatMessage,
  Conversation,
  SendMessageRequest,
  KeyExchangeResponse,
  ApiError 
} from '@/types/api';

// Client-side specific interfaces
interface ChatSession {
  sessionId: string;
  recipientId: string;
  encryptionKey: string;
  createdAt: number;
  lastMessageAt?: number;
}

interface ChatState {
  messages: Record<string, ChatMessage[]>;
  sessions: Record<string, ChatSession>;
  conversations: Conversation[];
  unreadCounts: Record<string, number>;
  loading: boolean;
  error: string | null;
}

const initialState: ChatState = {
  messages: {},
  sessions: {},
  conversations: [],
  unreadCounts: {},
  loading: false,
  error: null,
};

// Helper to generate conversation key
const getConversationKey = (userId: string, recipientId: string): string => {
  return [userId, recipientId].sort().join('_');
};

// Type guard for API errors
const isApiError = (response: any): response is ApiError => {
  return response?.error === true;
};

// Initialize chat session
export const initializeChatSession = createAsyncThunk(
  'chat/initializeSession',
  async ({ 
    userId, 
    recipientId
  }: { 
    userId: string; 
    recipientId: string;
  }) => {
    try {
      const conversationKey = getConversationKey(userId, recipientId);
      
      // Check for existing session in storage
      const storedSession = await AsyncStorage.getItem(`chat_${conversationKey}`);
      if (storedSession) {
        const session = JSON.parse(storedSession);
        
        // Validate session is not too old (30 days)
        const age = Date.now() - session.createdAt;
        if (age < 30 * 24 * 60 * 60 * 1000) {
          return { userId, recipientId, session };
        }
      }
      
      // Create new session
      const keyExchangeResponse = await apiService.exchangeKeys(recipientId);
      
      if (isApiError(keyExchangeResponse)) {
        throw new Error(keyExchangeResponse.detail || 'Key exchange failed');
      }

      const { session_id, shared_key } = keyExchangeResponse as KeyExchangeResponse;
      
      if (!session_id || !shared_key) {
        throw new Error('Invalid key exchange response');
      }
      
      const session: ChatSession = {
        sessionId: session_id,
        recipientId,
        encryptionKey: shared_key,
        createdAt: Date.now(),
      };
      
      // Store session
      await AsyncStorage.setItem(`chat_${conversationKey}`, JSON.stringify(session));
      
      return { userId, recipientId, session };
    } catch (error: any) {
      console.error('Failed to initialize chat session:', error);
      // Return a partial session without encryption
      return {
        userId,
        recipientId,
        session: {
          sessionId: `fallback_${Date.now()}`,
          recipientId,
          encryptionKey: '',
          createdAt: Date.now(),
        }
      };
    }
  }
);

// Send message
export const sendMessage = createAsyncThunk(
  'chat/sendMessage',
  async ({ 
    recipientId, 
    content, 
    sessionId,
    metadata
  }: { 
    recipientId: string; 
    content: string; 
    sessionId: string;
    metadata?: Record<string, string>;
  }, { getState }) => {
    const state = getState() as { auth: { user: { user_id: string } }; chat: ChatState };
    const senderId = state.auth.user.user_id;
    const conversationKey = getConversationKey(senderId, recipientId);
    
    // Get session from state
    const session = state.chat.sessions[conversationKey];
    
    let encryptedContent = content;
    let isEncrypted = false;
    
    // Try to encrypt if we have a key
    if (session?.encryptionKey && encryptionService.isAvailable()) {
      try {
        encryptedContent = await encryptionService.encrypt(content, session.encryptionKey);
        isEncrypted = true;
      } catch (error) {
        console.warn('Encryption failed, sending unencrypted');
      }
    }
    
    // Send message
    const response = await apiService.sendMessage({
      recipient_id: recipientId,
      content,
      encrypted_content: encryptedContent,
      is_encrypted: isEncrypted,
    });
    
    if (response.error) {
      throw new Error(response.error);
    }
    
    // Return message with original content
    return {
      ...response.message!,
      content,
      sender_id: senderId,
      recipient_id: recipientId,
      is_encrypted: isEncrypted,
    };
  }
);

// Load messages
export const loadMessages = createAsyncThunk(
  'chat/loadMessages',
  async ({ 
    conversationId,
    limit = 50,
    beforeTimestamp 
  }: { 
    conversationId: string;
    limit?: number;
    beforeTimestamp?: number;
  }, { getState }) => {
    const state = getState() as { chat: ChatState };
    
    // Get messages from API
    const response = await apiService.getConversationMessages(
      conversationId,
      limit,
      beforeTimestamp
    );
    
    if (isApiError(response)) {
      throw new Error(response.detail || 'Failed to load messages');
    }
    
    const { messages } = response;
    
    // Get session for decryption
    const session = state.chat.sessions[conversationId];
    
    // Decrypt messages
    const decryptedMessages = await Promise.all(
      messages.map(async (msg: ChatMessage) => {
        // If already has content, return as is
        if (msg.content) {
          return msg;
        }
        
        // Try to decrypt
        if (msg.encrypted_content && session?.encryptionKey && encryptionService.isAvailable()) {
          try {
            const decryptedContent = await encryptionService.decrypt(
              msg.encrypted_content,
              session.encryptionKey
            );
            
            return {
              ...msg,
              content: decryptedContent,
              is_encrypted: true,
            };
          } catch (error) {
            console.warn('Failed to decrypt message:', msg.id);
            return {
              ...msg,
              content: '🔐 Unable to decrypt',
              decryption_error: true,
            };
          }
        }
        
        // No encryption key available
        return {
          ...msg,
          content: msg.encrypted_content ? '🔐 Unable to decrypt' : '',
          decryption_error: !!msg.encrypted_content,
        };
      })
    );
    
    return {
      conversationId,
      messages: decryptedMessages,
    };
  }
);

// Load conversations list
export const loadConversations = createAsyncThunk(
  'chat/loadConversations',
  async (limit: number = 20) => {
    const response = await apiService.getConversations(limit);
    
    if (isApiError(response)) {
      throw new Error(response.detail || 'Failed to load conversations');
    }
    
    return response.conversations;
  }
);

// Background key rotation
export const rotateOldSessions = createAsyncThunk(
  'chat/rotateOldSessions',
  async (_, { getState, dispatch }) => {
    const state = getState() as { 
      auth: { user: { user_id: string } }; 
      chat: ChatState 
    };
    const userId = state.auth.user.user_id;
    
    // Check all sessions
    const rotatedSessions: string[] = [];
    
    for (const [conversationKey, session] of Object.entries(state.chat.sessions)) {
      const age = Date.now() - session.createdAt;
      
      // Rotate if older than 7 days
      if (age > 7 * 24 * 60 * 60 * 1000) {
        try {
          const response = await apiService.rotateSessionKey(session.sessionId);
          
          if (!isApiError(response) && response.new_session_id && response.shared_key) {
            // Update session in storage
            const newSession: ChatSession = {
              sessionId: response.new_session_id,
              recipientId: session.recipientId,
              encryptionKey: response.shared_key,
              createdAt: Date.now(),
              lastMessageAt: session.lastMessageAt,
            };
            
            await AsyncStorage.setItem(
              `chat_${conversationKey}`, 
              JSON.stringify(newSession)
            );
            
            rotatedSessions.push(conversationKey);
          }
        } catch (error) {
          console.warn(`Failed to rotate session for ${conversationKey}`);
        }
      }
    }
    
    return rotatedSessions;
  }
);

// Chat slice
const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    // Add message to store
    addMessage: (state, action: PayloadAction<ChatMessage>) => {
      const { sender_id, recipient_id } = action.payload;
      const chatKey = [sender_id, recipient_id].sort().join('_');
      
      if (!state.messages[chatKey]) {
        state.messages[chatKey] = [];
      }
      
      // Check if message already exists
      const exists = state.messages[chatKey].some(m => m.id === action.payload.id);
      if (!exists) {
        state.messages[chatKey].push(action.payload);
        
        // Update last message time for session
        if (state.sessions[chatKey]) {
          state.sessions[chatKey].lastMessageAt = Date.now();
        }
      }
    },
    
    // Update message
    updateMessage: (state, action: PayloadAction<{ 
      chatKey: string; 
      messageId: string; 
      updates: Partial<ChatMessage> 
    }>) => {
      const { chatKey, messageId, updates } = action.payload;
      const messages = state.messages[chatKey];
      
      if (messages) {
        const messageIndex = messages.findIndex(m => m.id === messageId);
        if (messageIndex !== -1) {
          messages[messageIndex] = { ...messages[messageIndex], ...updates };
        }
      }
    },
    
    // Clear chat messages
    clearChat: (state, action: PayloadAction<string>) => {
      delete state.messages[action.payload];
    },
    
    // Clear all data
    clearAllChats: (state) => {
      state.messages = {};
      state.sessions = {};
      state.conversations = [];
      state.unreadCounts = {};
    },
    
    // Mark conversation as read
    markConversationAsRead: (state, action: PayloadAction<string>) => {
      const conversationId = action.payload;
      
      // Update unread count
      state.unreadCounts[conversationId] = 0;
      
      // Update messages
      if (state.messages[conversationId]) {
        state.messages[conversationId] = state.messages[conversationId].map(msg => ({
          ...msg,
          read: true
        }));
      }
      
      // Update conversation in list
      const conversationIndex = state.conversations.findIndex(
        conv => conv.conversation_id === conversationId
      );
      if (conversationIndex !== -1) {
        state.conversations[conversationIndex].unread_count = 0;
      }
    },
    
    // Update unread count
    updateUnreadCount: (state, action: PayloadAction<{
      conversationId: string;
      count: number;
    }>) => {
      const { conversationId, count } = action.payload;
      state.unreadCounts[conversationId] = count;
    },
    
    // Receive message from WebSocket
    messageReceived: (state, action: PayloadAction<ChatMessage>) => {
      const message = action.payload;
      const chatKey = [message.sender_id, message.recipient_id].sort().join('_');
      
      if (!state.messages[chatKey]) {
        state.messages[chatKey] = [];
      }
      
      // Add message if it doesn't exist
      const exists = state.messages[chatKey].some(m => m.id === message.id);
      if (!exists) {
        state.messages[chatKey].unshift(message);
        
        // Increment unread count
        state.unreadCounts[chatKey] = (state.unreadCounts[chatKey] || 0) + 1;
      }
    },
    
    // Update session
    updateSession: (state, action: PayloadAction<{
      conversationKey: string;
      session: ChatSession;
    }>) => {
      const { conversationKey, session } = action.payload;
      state.sessions[conversationKey] = session;
    },
    
    // Clear error
    clearError: (state) => {
      state.error = null;
    },
  },
  
  extraReducers: (builder) => {
    // Initialize session
    builder
      .addCase(initializeChatSession.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(initializeChatSession.fulfilled, (state, action) => {
        state.loading = false;
        const { userId, recipientId, session } = action.payload;
        const chatKey = getConversationKey(userId, recipientId);
        state.sessions[chatKey] = session;
      })
      .addCase(initializeChatSession.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to initialize session';
      });
    
    // Send message
    builder
      .addCase(sendMessage.pending, (state) => {
        state.error = null;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        const message = action.payload;
        const chatKey = getConversationKey(message.sender_id, message.recipient_id);
        
        if (!state.messages[chatKey]) {
          state.messages[chatKey] = [];
        }
        
        // Update or add message
        const existingIndex = state.messages[chatKey].findIndex(m => m.id === message.id);
        if (existingIndex >= 0) {
          state.messages[chatKey][existingIndex] = message;
        } else {
          state.messages[chatKey].push(message);
        }
        
        // Update session last message time
        if (state.sessions[chatKey]) {
          state.sessions[chatKey].lastMessageAt = Date.now();
        }
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to send message';
      });
    
    // Load messages
    builder
      .addCase(loadMessages.pending, (state) => {
        state.loading = true;
      })
      .addCase(loadMessages.fulfilled, (state, action) => {
        state.loading = false;
        const { conversationId, messages } = action.payload;
        state.messages[conversationId] = messages;
      })
      .addCase(loadMessages.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to load messages';
      });
    
    // Load conversations
    builder
      .addCase(loadConversations.fulfilled, (state, action) => {
        state.conversations = action.payload;
        
        // Update unread counts
        action.payload.forEach((conv: Conversation) => {
          state.unreadCounts[conv.conversation_id] = conv.unread_count || 0;
        });
      });
    
    // Rotate sessions
    builder
      .addCase(rotateOldSessions.fulfilled, (state, action) => {
        // Sessions are updated individually in the thunk
        console.log(`Rotated ${action.payload.length} sessions`);
      });
  },
});

// Export actions
export const { 
  addMessage, 
  updateMessage,
  clearChat,
  clearAllChats,
  clearError,
  messageReceived,
  markConversationAsRead,
  updateUnreadCount,
  updateSession,
} = chatSlice.actions;

// Selectors
export const selectMessages = (state: { chat: ChatState }, conversationId: string) => 
  state.chat.messages[conversationId] || [];

export const selectSession = (state: { chat: ChatState }, conversationId: string) =>
  state.chat.sessions[conversationId];

export const selectUnreadCount = (state: { chat: ChatState }, conversationId: string) =>
  state.chat.unreadCounts[conversationId] || 0;

export const selectTotalUnreadCount = (state: { chat: ChatState }) =>
  Object.values(state.chat.unreadCounts).reduce((sum, count) => sum + count, 0);

// Export types
export type { ChatState, ChatSession };

export default chatSlice.reducer;