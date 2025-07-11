// src/screens/chat/ChatListScreen.tsx
import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Animated,
  RefreshControl,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme, GRADIENTS } from '@/config/theme';
import { sharedStyles, AVATAR_SIZES, getAvatarStyle } from '@/config/sharedStyles';
import apiService from '@/services/api';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { RootStackScreenProps } from '@/types/navigation';
import { useAppSelector, useAppDispatch } from '@/store';
import { loadConversations, markConversationAsRead } from '@/store/slices/chatSlice';
import websocketService from '@/services/websocket';
import * as Haptics from 'expo-haptics';
import { Conversation as ApiConversation } from '@/types/api';

const { width, height } = Dimensions.get('window');

// Extend API Conversation with client-side fields
interface Conversation extends ApiConversation {
  session_id?: string;
  client_encrypted?: boolean;
}

type Props = RootStackScreenProps<'Main'>;

// Pre-calculate item height for better performance
const ITEM_HEIGHT = 80;

export default function ChatListScreen({ navigation }: Props) {
  const dispatch = useAppDispatch();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Get data from Redux
  const conversations = useAppSelector(state => state.chat.conversations);
  const unreadCounts = useAppSelector(state => state.chat.unreadCounts);
  const currentUserId = useAppSelector(state => state.auth?.user?.user_id || state.auth?.user?.id);
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
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
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }),
    ]).start();
    
    // Load initial data
    loadChats();
    
    // WebSocket listeners for real-time updates
    const handleNewMessage = (data: any) => {
      // Refresh conversations to update last message
      loadChats();
      // Haptic feedback
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };
    
    const handleUserStatus = (data: any) => {
      // User online/offline status changed
      // Could update specific user in list if needed
    };
    
    websocketService.on('new_message', handleNewMessage);
    websocketService.on('user_status', handleUserStatus);
    
    return () => {
      websocketService.off('new_message', handleNewMessage);
      websocketService.off('user_status', handleUserStatus);
    };
  }, []);

  // Reload when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadChats();
    }, [])
  );

  const loadChats = async () => {
    try {
      await dispatch(loadConversations(20)).unwrap();
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadChats();
  };

  const formatTime = (timestamp?: number): string => {
    if (!timestamp) return '';
    
    const now = Date.now();
    const diff = now - timestamp * 1000;
    
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d`;
    
    const date = new Date(timestamp * 1000);
    return date.toLocaleDateString('en', { month: 'short', day: 'numeric' });
  };

  const getLastMessageText = (conversation: Conversation) => {
    if (!conversation.last_message_preview) {
      return 'Send a message';
    }
    
    const prefix = conversation.last_sender_id === currentUserId ? 'You: ' : '';
    return `${prefix}Message`;
  };

  const navigateToChat = (conversation: Conversation) => {
    // Mark as read when opening
    dispatch(markConversationAsRead(conversation.conversation_id));
    
    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    navigation.navigate('Chat', {
      recipientId: conversation.other_user.user_id,
      recipientDescriptor: conversation.other_user.descriptor,
      conversationId: conversation.conversation_id
    });
  };

  const navigateToProfile = (userId: string, descriptor: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    navigation.navigate('Profile', {
      userId,
      descriptor
    });
  };

  const renderChat = ({ item }: { item: Conversation }) => {
    const actualUnreadCount = unreadCounts[item.conversation_id] || item.unread_count || 0;
    const hasEncryption = item.client_encrypted !== false; // Default to encrypted
    
    return (
      <TouchableOpacity
        style={styles.chatItem}
        activeOpacity={0.8}
        onPress={() => navigateToChat(item)}
      >
        <View style={styles.userCardContent}>
          <View style={styles.userLeft}>
            {/* Avatar - clickable for profile */}
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={() => navigateToProfile(item.other_user.user_id, item.other_user.descriptor)}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={[
                  `hsl(${(item.other_user.descriptor.charCodeAt(0) * 137) % 360}, 70%, 50%)`,
                  `hsl(${(item.other_user.descriptor.charCodeAt(0) * 137 + 30) % 360}, 70%, 60%)`,
                ]}
                style={[
                  styles.avatar,
                  item.other_user.online && styles.avatarOnline
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.avatarText}>
                  {item.other_user.descriptor.charAt(0).toUpperCase()}
                </Text>
              </LinearGradient>
              
              {/* Online indicator */}
              {item.other_user.online && (
                <View style={styles.onlineDot} />
              )}
            </TouchableOpacity>

            {/* User info */}
            <View style={styles.userInfo}>
              <View style={styles.chatHeader}>
                <View style={styles.userNameContainer}>
                  <Text style={styles.userName} numberOfLines={1}>
                    {item.other_user.emoji && `${item.other_user.emoji} `}
                    {item.other_user.descriptor}
                  </Text>
                  {hasEncryption && (
                    <Ionicons name="lock-closed" size={12} color={theme.colors.textTertiary} style={styles.encryptionIcon} />
                  )}
                </View>
                <Text style={styles.time}>{formatTime(item.last_message_time)}</Text>
              </View>
              
              <Text
                style={[
                  styles.lastMessage,
                  actualUnreadCount > 0 && styles.unreadMessage
                ]}
                numberOfLines={1}
              >
                {getLastMessageText(item)}
              </Text>
            </View>
          </View>

          {/* Unread badge */}
          {actualUnreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <LinearGradient
                colors={GRADIENTS.primary.colors}
                style={styles.unreadGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.unreadCount}>
                  {actualUnreadCount > 99 ? '99+' : actualUnreadCount}
                </Text>
              </LinearGradient>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmptyState = () => (
    <Animated.View
      style={[
        styles.emptyState,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        }
      ]}
    >
      <View style={styles.emptyIcon}>
        <Ionicons name="chatbubbles-outline" size={64} color={theme.colors.textTertiary} />
      </View>
      
      <Text style={styles.emptyTitle}>No conversations yet</Text>
      <Text style={styles.emptyText}>
        Start chatting with people nearby
      </Text>
      
      <TouchableOpacity
        style={styles.discoverButton}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          navigation.navigate('Discover');
        }}
        activeOpacity={0.8}
      >
        <LinearGradient
          colors={GRADIENTS.primary.colors}
          style={styles.discoverButtonGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Text style={styles.discoverButtonText}>Discover People</Text>
          <Ionicons name="arrow-forward" size={20} color={theme.colors.black} />
        </LinearGradient>
      </TouchableOpacity>
    </Animated.View>
  );

  const getTotalUnreadCount = () => {
    return Object.values(unreadCounts).reduce((sum, count) => sum + count, 0);
  };

  const getItemLayout = (data: any, index: number) => ({
    length: ITEM_HEIGHT,
    offset: ITEM_HEIGHT * index,
    index,
  });

  if (loading) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={GRADIENTS.dark.colors}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      </View>
    );
  }

  const totalUnread = getTotalUnreadCount();

  return (
    <View style={styles.container}>
      {/* Background */}
      <LinearGradient
        colors={GRADIENTS.dark.colors}
        style={StyleSheet.absoluteFillObject}
      />
      
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <Animated.View
          style={[
            styles.header,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            }
          ]}
        >
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.title}>Messages</Text>
              {totalUnread > 0 && (
                <Text style={styles.subtitle}>
                  <Text style={styles.unreadCountHighlight}>{totalUnread}</Text>
                  {` unread message${totalUnread === 1 ? '' : 's'}`}
                </Text>
              )}
            </View>
            
            <TouchableOpacity
              style={styles.discoverBtn}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                navigation.navigate('Discover');
              }}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={[theme.colors.blackElevated, theme.colors.blackElevated]}
                style={styles.discoverBtnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="compass-outline" size={22} color={theme.colors.primary} />
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Chat List */}
        <FlatList
          data={conversations}
          renderItem={renderChat}
          keyExtractor={item => item.conversation_id}
          contentContainerStyle={[
            styles.listContent,
            conversations.length === 0 && styles.emptyListContent
          ]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
              colors={[theme.colors.primary]}
            />
          }
          ListEmptyComponent={renderEmptyState}
          // Performance optimizations
          removeClippedSubviews={true}
          initialNumToRender={10}
          maxToRenderPerBatch={10}
          windowSize={10}
          getItemLayout={getItemLayout}
          updateCellsBatchingPeriod={50}
        />
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Base containers
  container: sharedStyles.container,
  safeArea: sharedStyles.safeArea,
  
  // Header
  header: sharedStyles.screenHeader,
  headerContent: sharedStyles.headerContent,
  title: sharedStyles.screenTitle,
  subtitle: sharedStyles.screenSubtitle,
  unreadCountHighlight: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  
  // Discover button
  discoverBtn: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  discoverBtnGradient: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 24,
  },
  
  // List
  listContent: {
    padding: theme.spacing.md,
    paddingBottom: 100,
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  emptyListContent: {
    flex: 1,
  },
  
  // Chat item
  chatItem: {
    ...sharedStyles.cardInteractive,
    minHeight: ITEM_HEIGHT,
  },
  userCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  userLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    flex: 1,
  },
  
  // Avatar
  avatarContainer: {
    position: 'relative',
  },
  avatar: getAvatarStyle('medium'),
  avatarOnline: {
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  avatarText: sharedStyles.avatarTextMedium,
  onlineDot: sharedStyles.onlineIndicator,
  
  // User info
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xxs,
  },
  userNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: theme.spacing.xs,
  },
  userName: {
    fontSize: theme.typography.fontSize.body,
    fontWeight: '600',
    color: theme.colors.textPrimary,
    letterSpacing: -0.3,
  },
  encryptionIcon: {
    marginLeft: theme.spacing.xxs,
  },
  time: {
    fontSize: theme.typography.fontSize.small,
    color: theme.colors.textTertiary,
    letterSpacing: 0.2,
  },
  lastMessage: {
    fontSize: theme.typography.fontSize.caption,
    color: theme.colors.textSecondary,
    letterSpacing: 0.1,
  },
  unreadMessage: {
    color: theme.colors.textPrimary,
    fontWeight: '500',
  },
  
  // Unread badge
  unreadBadge: {
    marginLeft: theme.spacing.sm,
  },
  unreadGradient: {
    minWidth: 26,
    height: 26,
    borderRadius: 13,
    paddingHorizontal: theme.spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadCount: {
    fontSize: theme.typography.fontSize.micro,
    color: theme.colors.black,
    fontWeight: '700',
  },
  
  // Empty state
  emptyState: sharedStyles.emptyState,
  emptyIcon: {
    marginBottom: theme.spacing.xl,
  },
  emptyTitle: sharedStyles.emptyTitle,
  emptyText: sharedStyles.emptyText,
  
  // Discover button in empty state
  discoverButton: {
    borderRadius: 50,
    overflow: 'hidden',
  },
  discoverButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
  },
  discoverButtonText: {
    fontSize: theme.typography.fontSize.body,
    fontWeight: '600',
    color: theme.colors.black,
    letterSpacing: 0.3,
  },
  
  // Loading
  loading: sharedStyles.loadingContainer,
});