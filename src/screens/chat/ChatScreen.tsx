// src/screens/chat/ChatScreen.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ActivityIndicator,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme, GRADIENTS } from '@/config/theme';
import { useRoute, useNavigation, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/types/navigation';
import { useAppSelector, useAppDispatch } from '@/store';
import {
  addMessage,
  markConversationAsRead,
} from '@/store/slices/chatSlice';
import websocketService from '@/services/websocket';
import apiService from '@/services/api';
import encryptionService from '@/services/encryptionService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import EncryptionStatus from '@/components/chat/EncryptionStatus';
import { useEncryption, useKeyVerification } from '@/hooks/useEncryption';

const { width, height } = Dimensions.get('window');

type ChatScreenRouteProp = RouteProp<RootStackParamList, 'Chat'>;
type ChatScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Chat'>;

interface Message {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string;
  encrypted_content?: string;
  timestamp: number;
  is_encrypted: boolean;
  status?: 'sending' | 'sent' | 'delivered' | 'read' | 'failed';
  metadata?: {
    custom_encryption?: string;
    encrypted?: boolean;
  };
  session_id?: string;
}

interface PublicKeys {
  mine: string;
  theirs: string;
}

export default function ChatScreen() {
  const route = useRoute<ChatScreenRouteProp>();
  const navigation = useNavigation<ChatScreenNavigationProp>();
  const dispatch = useAppDispatch();
  
  const { recipientId, recipientDescriptor, conversationId } = route.params;
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [recipientOnline, setRecipientOnline] = useState(false);
  
  // Public keys state for EncryptionStatus component
  const [publicKeys, setPublicKeys] = useState<PublicKeys | null>(null);
  const [waitingForRecipient, setWaitingForRecipient] = useState(false);
  
  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Get current user from Redux
  const currentUser = useAppSelector(state => state.auth.user);
  const currentUserId = currentUser?.user_id;
  
  // Generate conversation key
  const chatKey = currentUserId && recipientId
    ? [currentUserId, recipientId].sort().join('_')
    : conversationId;
  
  // Use encryption hook
  const { 
    hasEncryption, 
    sessionId, 
    isVerified,
    canEncrypt,
    refresh: refreshEncryption,
    getEncryptionKey
  } = useEncryption(chatKey || '');
  
  const { verifyKeys } = useKeyVerification(chatKey || '', recipientId);
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  // Get encryption status for UI
  const getEncryptionStatus = () => {
    if (loading) return 'loading';
    if (!canEncrypt) return 'unavailable';
    if (hasEncryption) return 'enabled';
    return 'disabled';
  };

  // Setup encryption when chat opens
  const setupEncryption = async () => {
    if (!canEncrypt || !chatKey) return;

    try {
      // Check for existing session metadata
      const storedMeta = await AsyncStorage.getItem(`@chat_meta_${chatKey}`);
      if (storedMeta) {
        const metadata = JSON.parse(storedMeta);
        if (metadata.publicKeys) {
          setPublicKeys(metadata.publicKeys);
        }
        // Session already exists, refresh hook will handle it
        return;
      }

      // Generate new key pair
      const keyPair = await encryptionService.generateKeyPair();
      
      // Exchange keys with server
      const response = await apiService.post('/v1/chat/keys/exchange', {
        recipient_id: recipientId,
        public_key: keyPair.publicKey,
        key_type: 'x25519'
      });
      
      if (response.recipient_public_key && response.status === 'ready') {
        // Complete key exchange
        const sharedKey = await encryptionService.deriveSharedSecret(
          keyPair.privateKey,
          response.recipient_public_key
        );
        
        // Store encryption key
        await encryptionService.storeKey(response.session_id, sharedKey);
        
        // Save metadata
        const metadata = {
          sessionId: response.session_id,
          created: Date.now(),
          keyExchangeType: 'x25519-client',
          publicKeys: {
            mine: keyPair.publicKey,
            theirs: response.recipient_public_key
          }
        };
        
        await AsyncStorage.setItem(`@chat_meta_${chatKey}`, JSON.stringify(metadata));
        
        setPublicKeys(metadata.publicKeys);
        setWaitingForRecipient(false);
        
        // Refresh hook state
        await refreshEncryption();
        
        console.log('✅ E2E encryption established');
        
      } else if (response.status === 'pending') {
        // Waiting for recipient
        setWaitingForRecipient(true);
        
        // Store pending exchange data
        await AsyncStorage.setItem(
          `@pending_exchange_${chatKey}`,
          JSON.stringify({
            privateKey: keyPair.privateKey,
            publicKey: keyPair.publicKey,
            timestamp: Date.now()
          })
        );
        
        console.log('⏳ Waiting for recipient to open chat');
      }
      
    } catch (error) {
      console.error('Failed to setup encryption:', error);
    }
  };

  // Initialize chat
  useEffect(() => {
    const initializeChat = async () => {
      try {
        setLoading(true);
        
        if (!chatKey) {
          throw new Error('Unable to generate conversation ID');
        }
        
        // Setup encryption
        await setupEncryption();
        
        // Load messages
        await loadMessages();
        
      } catch (error) {
        console.error('Failed to initialize chat:', error);
      } finally {
        setLoading(false);
      }
    };

    // Entry animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();

    initializeChat();
    
    // Set up WebSocket listeners
    const handleNewMessage = async (message: any) => {
      if (message.sender_id === recipientId || message.recipient_id === recipientId) {
        let decryptedContent = message.content || '🔐 Message';
        
        // Try to decrypt if we have encryption
        if (message.encrypted_content && hasEncryption) {
          try {
            const encryptionKey = await getEncryptionKey();
            if (encryptionKey) {
              decryptedContent = await encryptionService.decrypt(message.encrypted_content, encryptionKey);
            }
          } catch (error) {
            console.warn('Failed to decrypt incoming message');
            decryptedContent = '🔐 Unable to decrypt';
          }
        }
        
        const newMessage: Message = {
          id: message.message_id || message.id,
          sender_id: message.sender_id,
          recipient_id: message.recipient_id,
          content: decryptedContent,
          encrypted_content: message.encrypted_content,
          timestamp: message.timestamp || Date.now() / 1000,
          is_encrypted: !!message.encrypted_content,
          session_id: message.session_id,
          metadata: message.metadata
        };
        
        setMessages(prev => [...prev, newMessage]);
        markAsRead();
        
        // Haptic feedback for new message
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    };

    const handleTypingStatus = (data: any) => {
      if (data.user_id === recipientId) {
        setIsTyping(data.is_typing);
      }
    };

    const handleUserStatus = (data: any) => {
      if (data.user_id === recipientId) {
        setRecipientOnline(data.online);
      }
    };

    // Handle encryption ready event from WebSocket
    const handleEncryptionReady = async (data: any) => {
      if (data.sender_id === recipientId && data.session_id && chatKey) {
        console.log('🔐 Encryption ready signal received');
        
        try {
          const pendingData = await AsyncStorage.getItem(`@pending_exchange_${chatKey}`);
          if (!pendingData) return;

          const { privateKey, publicKey } = JSON.parse(pendingData);
          
          // Get recipient's public key
          const response = await apiService.get(`/v1/chat/keys/status/${recipientId}`);
          
          if (response.public_key) {
            // Complete the exchange
            const sharedKey = await encryptionService.deriveSharedSecret(
              privateKey,
              response.public_key
            );
            
            // Store encryption key
            await encryptionService.storeKey(response.session_id, sharedKey);
            
            // Save metadata
            const metadata = {
              sessionId: response.session_id,
              created: Date.now(),
              keyExchangeType: 'x25519-client',
              publicKeys: {
                mine: publicKey,
                theirs: response.public_key
              }
            };
            
            await AsyncStorage.setItem(`@chat_meta_${chatKey}`, JSON.stringify(metadata));
            
            setPublicKeys(metadata.publicKeys);
            setWaitingForRecipient(false);
            
            // Clean up pending data
            await AsyncStorage.removeItem(`@pending_exchange_${chatKey}`);
            
            // Refresh hook state
            await refreshEncryption();
            
            console.log('✅ E2E encryption established via WebSocket');
            
            // Reload messages to decrypt them
            await loadMessages();
          }
        } catch (error) {
          console.error('Failed to complete encryption setup:', error);
        }
      }
    };

    websocketService.on('new_message', handleNewMessage);
    websocketService.on('typing_status', handleTypingStatus);
    websocketService.on('user_status', handleUserStatus);
    websocketService.on('encryption_ready', handleEncryptionReady);

    return () => {
      websocketService.off('new_message', handleNewMessage);
      websocketService.off('typing_status', handleTypingStatus);
      websocketService.off('user_status', handleUserStatus);
      websocketService.off('encryption_ready', handleEncryptionReady);
      
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    };
  }, [recipientId, currentUserId, chatKey]); // Removed unnecessary dependencies

  const loadMessages = async () => {
    try {
      const response = await apiService.getMessages(conversationId || recipientId, 50);
      
      if (!response.error && response.messages) {
        // Decrypt messages if we have encryption
        const decryptedMessages = await Promise.all(
          response.messages.map(async (msg: any) => {
            let content = msg.content || '🔐 Message';
            
            if (msg.encrypted_content && hasEncryption) {
              try {
                const encryptionKey = await getEncryptionKey();
                if (encryptionKey) {
                  content = await encryptionService.decrypt(msg.encrypted_content, encryptionKey);
                }
              } catch (error) {
                console.warn('Failed to decrypt message:', msg.id);
                content = '🔐 Unable to decrypt';
              }
            } else if (msg.encrypted_content && !hasEncryption) {
              content = '🔐 Encrypted message';
            }
            
            return {
              ...msg,
              content,
              is_encrypted: !!msg.encrypted_content,
            };
          })
        );
        
        setMessages(decryptedMessages.reverse());
        markAsRead();
      }
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const markAsRead = async () => {
    const conversationKey = conversationId || chatKey;
    
    if (conversationKey) {
      try {
        await apiService.markMessagesAsRead(conversationKey);
        dispatch(markConversationAsRead(conversationKey));
      } catch (error) {
        console.error('Failed to mark messages as read:', error);
      }
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() || sending) return;

    const messageText = inputText.trim();
    setInputText('');
    setSending(true);

    // Create temporary message for instant feedback
    const tempMessage: Message = {
      id: `temp-${Date.now()}`,
      sender_id: currentUserId!,
      recipient_id: recipientId,
      content: messageText,
      timestamp: Date.now() / 1000,
      is_encrypted: hasEncryption,
      status: 'sending',
      session_id: sessionId || undefined,
    };

    setMessages(prev => [...prev, tempMessage]);

    try {
      let encryptedContent = messageText;
      let isEncrypted = false;
      
      // Try to encrypt if we have encryption
      if (hasEncryption && canEncrypt) {
        try {
          const encryptionKey = await getEncryptionKey();
          if (encryptionKey) {
            encryptedContent = await encryptionService.encrypt(messageText, encryptionKey);
            isEncrypted = true;
          }
        } catch (error) {
          console.warn('Encryption failed:', error);
          
          // Ask user if they want to send unencrypted
          const shouldSend = await new Promise<boolean>((resolve) => {
            Alert.alert(
              'Encryption Failed',
              'Unable to encrypt message. Send unencrypted?',
              [
                { text: 'Cancel', onPress: () => resolve(false), style: 'cancel' },
                { text: 'Send Anyway', onPress: () => resolve(true), style: 'destructive' }
              ]
            );
          });
          
          if (!shouldSend) {
            // Remove temp message
            setMessages(prev => prev.filter(m => m.id !== tempMessage.id));
            setSending(false);
            setInputText(messageText); // Restore text
            return;
          }
        }
      }

      // Send message
      const response = await apiService.sendMessage({
        recipient_id: recipientId,
        encrypted_content: encryptedContent,
        session_id: sessionId || await encryptionService.generateSessionId(),
        key_type: isEncrypted ? 'x25519' : 'none',
        metadata: {
          custom_encryption: isEncrypted ? encryptionService.getAlgorithm() : 'none',
          message_type: 'text',
          encrypted: isEncrypted.toString()
        }
      });

      if (!response.error && response.message) {
        // Update temp message with real data
        setMessages(prev => prev.map(msg =>
          msg.id === tempMessage.id
            ? {
                ...response.message,
                content: messageText,
                encrypted_content: encryptedContent,
                status: 'sent',
                is_encrypted: isEncrypted
              }
            : msg
        ));
        
        // Haptic feedback
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        
        // Update Redux store
        if (chatKey) {
          dispatch(addMessage({
            ...response.message,
            content: messageText,
            sender_id: currentUserId,
            recipient_id: recipientId,
          }));
        }
      } else {
        throw new Error(response.error || 'Failed to send message');
      }
    } catch (error: any) {
      console.error('Failed to send message:', error);
      
      // Mark message as failed
      setMessages(prev => prev.map(msg =>
        msg.id === tempMessage.id
          ? { ...msg, status: 'failed' }
          : msg
      ));
      
      // Haptic feedback for error
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      
      // Show error to user
      Alert.alert(
        'Message Failed',
        'Unable to send message. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setSending(false);
    }
  };

  const handleTyping = useCallback(() => {
    websocketService.send({
      type: 'typing_status',
      recipient_id: recipientId,
      is_typing: true,
    });
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      websocketService.send({
        type: 'typing_status',
        recipient_id: recipientId,
        is_typing: false,
      });
    }, 3000);
  }, [recipientId]);

  const formatTime = (timestamp: number): string => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isOwnMessage = item.sender_id === currentUserId;
    
    return (
      <View style={[
        styles.messageContainer,
        isOwnMessage ? styles.ownMessageContainer : styles.otherMessageContainer
      ]}>
        <View style={[
          styles.messageBubble,
          isOwnMessage ? styles.ownMessageBubble : styles.otherMessageBubble,
          item.status === 'failed' && styles.failedMessage
        ]}>
          {isOwnMessage ? (
            <LinearGradient
              colors={GRADIENTS.primary.colors}
              style={styles.messageBubbleGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Text style={styles.messageText}>{item.content}</Text>
            </LinearGradient>
          ) : (
            <View style={styles.otherMessageContent}>
              <Text style={styles.otherMessageText}>{item.content}</Text>
            </View>
          )}
        </View>
        
        <View style={styles.messageFooter}>
          <Text style={styles.messageTime}>{formatTime(item.timestamp)}</Text>
          {isOwnMessage && (
            <View style={styles.messageStatus}>
              {item.status === 'sending' && (
                <Ionicons name="time-outline" size={12} color={theme.colors.textTertiary} />
              )}
              {item.status === 'sent' && (
                <Ionicons name="checkmark" size={12} color={theme.colors.textTertiary} />
              )}
              {item.status === 'delivered' && (
                <Ionicons name="checkmark-done" size={12} color={theme.colors.textTertiary} />
              )}
              {item.status === 'read' && (
                <Ionicons name="checkmark-done" size={12} color={theme.colors.primary} />
              )}
              {item.status === 'failed' && (
                <Ionicons name="alert-circle" size={12} color={theme.colors.error} />
              )}
              {item.is_encrypted && (
                <Ionicons name="lock-closed" size={10} color={theme.colors.textTertiary} style={styles.messageEncrypted} />
              )}
            </View>
          )}
        </View>
      </View>
    );
  };

  const ListHeaderComponent = () => {
    if (loading) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={theme.colors.primary} />
        </View>
      );
    }
    
    if (messages.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Ionicons name="chatbubbles-outline" size={48} color={theme.colors.textTertiary} />
          <Text style={styles.emptyText}>Start a conversation</Text>
          <Text style={styles.emptySubtext}>
            {hasEncryption ? 'Messages are end-to-end encrypted' : 'Messages are private'}
          </Text>
        </View>
      );
    }
    
    return null;
  };

  const renderHeader = () => (
    <Animated.View
      style={[
        styles.header,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }
      ]}
    >
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
        activeOpacity={0.8}
      >
        <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
      </TouchableOpacity>
      
      <View style={styles.headerInfo}>
        <View style={styles.headerTop}>
          <Text style={styles.recipientName} numberOfLines={1}>
            {recipientDescriptor}
          </Text>
          {recipientOnline && (
            <View style={styles.onlineIndicator} />
          )}
          <EncryptionStatus
            sessionId={sessionId || ''}
            recipientId={recipientId}
            publicKey={publicKeys?.mine}
            theirPublicKey={publicKeys?.theirs}
            isVerified={isVerified}
            onVerify={verifyKeys}
          />
        </View>
        <Text style={styles.headerStatus}>
          {isTyping ? 'typing...' : (recipientOnline ? 'online' : 'offline')}
        </Text>
      </View>
      
      <TouchableOpacity
        style={styles.menuButton}
        activeOpacity={0.8}
        onPress={() => {
          navigation.navigate('Profile', {
            userId: recipientId,
            descriptor: recipientDescriptor
          });
        }}
      >
        <Ionicons name="person-circle-outline" size={24} color={theme.colors.textPrimary} />
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={GRADIENTS.dark.colors}
        style={StyleSheet.absoluteFillObject}
      />
      
      <SafeAreaView style={styles.safeArea}>
        {renderHeader()}

        {waitingForRecipient && (
          <View style={styles.encryptionWarning}>
            <Ionicons name="time-outline" size={16} color={theme.colors.warning} />
            <Text style={styles.encryptionWarningText}>
              Waiting for {recipientDescriptor} to enable encryption
            </Text>
          </View>
        )}

        <KeyboardAvoidingView
          style={styles.keyboardAvoid}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <Animated.View
            style={[
              styles.messagesContainer,
              {
                opacity: fadeAnim,
              }
            ]}
          >
            <FlatList
              ref={flatListRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={item => item.id}
              inverted
              contentContainerStyle={styles.messagesList}
              showsVerticalScrollIndicator={false}
              ListFooterComponent={ListHeaderComponent}
              removeClippedSubviews={true}
              initialNumToRender={20}
              maxToRenderPerBatch={10}
              windowSize={10}
              maintainVisibleContentPosition={{
                minIndexForVisible: 0,
              }}
            />
          </Animated.View>

          <Animated.View
            style={[
              styles.inputContainer,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              }
            ]}
          >
            <View style={styles.inputWrapper}>
              <TextInput
                ref={inputRef}
                style={styles.textInput}
                value={inputText}
                onChangeText={setInputText}
                placeholder={hasEncryption ? "Type a secure message..." : "Type a message..."}
                placeholderTextColor={theme.colors.textTertiary}
                multiline
                maxLength={1000}
                onFocus={handleTyping}
                editable={!sending}
              />
              
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (!inputText.trim() || sending) && styles.sendButtonDisabled
                ]}
                onPress={sendMessage}
                disabled={!inputText.trim() || sending}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={inputText.trim() && !sending
                    ? GRADIENTS.primary.colors
                    : [theme.colors.blackSurface, theme.colors.blackSurface]
                  }
                  style={styles.sendButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  {sending ? (
                    <ActivityIndicator size="small" color={theme.colors.textPrimary} />
                  ) : (
                    <Ionicons
                      name="send"
                      size={20}
                      color={theme.colors.textPrimary}
                    />
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.black,
  },
  safeArea: {
    flex: 1,
  },
  
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    padding: theme.spacing.sm,
    marginRight: theme.spacing.sm,
  },
  headerInfo: {
    flex: 1,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  recipientName: {
    fontSize: theme.typography.fontSize.subtitle,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.textPrimary,
    letterSpacing: theme.typography.letterSpacing.tight,
  },
  onlineIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.success,
  },
  encryptionIcon: {
    marginLeft: 4,
  },
  headerStatus: {
    fontSize: theme.typography.fontSize.caption,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  menuButton: {
    padding: theme.spacing.sm,
  },
  
  // Encryption warning
  encryptionWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.overlay.dark,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  encryptionWarningText: {
    fontSize: theme.typography.fontSize.caption,
    color: theme.colors.warning,
    flex: 1,
  },
  
  // Messages
  keyboardAvoid: {
    flex: 1,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesList: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  
  // Loading & Empty states
  loadingContainer: {
    paddingVertical: theme.spacing.xxxl * 2,
    alignItems: 'center',
  },
  emptyContainer: {
    paddingVertical: theme.spacing.huge * 2,
    alignItems: 'center',
    gap: theme.spacing.md,
  },
  emptyText: {
    fontSize: theme.typography.fontSize.body,
    color: theme.colors.textPrimary,
    fontWeight: theme.typography.fontWeight.medium,
  },
  emptySubtext: {
    fontSize: theme.typography.fontSize.caption,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  
  // Message item
  messageContainer: {
    marginBottom: theme.spacing.md,
  },
  ownMessageContainer: {
    alignItems: 'flex-end',
  },
  otherMessageContainer: {
    alignItems: 'flex-start',
  },
  messageBubble: {
    maxWidth: '80%',
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
  },
  ownMessageBubble: {
    borderBottomRightRadius: theme.borderRadius.xs,
  },
  otherMessageBubble: {
    borderBottomLeftRadius: theme.borderRadius.xs,
  },
  failedMessage: {
    opacity: 0.7,
  },
  messageBubbleGradient: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  otherMessageContent: {
    backgroundColor: theme.colors.blackElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  messageText: {
    fontSize: theme.typography.fontSize.body,
    color: theme.colors.textPrimary,
    lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.body,
  },
  otherMessageText: {
    fontSize: theme.typography.fontSize.body,
    color: theme.colors.textPrimary,
    lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.body,
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    marginTop: theme.spacing.xxs,
    paddingHorizontal: theme.spacing.xs,
  },
  messageTime: {
    fontSize: theme.typography.fontSize.micro,
    color: theme.colors.textTertiary,
  },
  messageStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: theme.spacing.xxs,
    gap: 2,
  },
  messageEncrypted: {
    marginLeft: 2,
  },
  
  // Input
  inputContainer: {
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.black,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: theme.spacing.sm,
  },
  textInput: {
    flex: 1,
    maxHeight: 120,
    minHeight: 40,
    backgroundColor: theme.colors.blackElevated,
    borderRadius: theme.borderRadius.xl,
    borderWidth: 1,
    borderColor: theme.colors.border,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    fontSize: theme.typography.fontSize.body,
    color: theme.colors.textPrimary,
  },
  sendButton: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  sendButtonGradient: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
});