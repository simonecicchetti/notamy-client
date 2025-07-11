import 'react-native-get-random-values';
import React, { useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { AppState, AppStateStatus, Alert, Platform } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import messaging from '@react-native-firebase/messaging';
import { initializeApp } from 'firebase/app'; // NEW: For Firebase init
import { store } from '@/store';
import AppNavigator from '@/navigation/AppNavigator';
import GlobalStatusBar from '@/components/GlobalStatusBar';
import websocketService from '@/services/websocket';
import apiService from '@/services/api';
import encryptionService from '@/services/encryptionService';
import { useAppSelector } from '@/store';
import { requestNotificationPermissions, showNotification, setBadgeCount } from '@/utils/notifications';
import { NavigationService } from '@/services/navigationService';
import { NativeModules } from 'react-native';
// NEW: Import moments actions for syncing notification count
import { setMomentNotifications } from '@/store/slices/momentsSlice';

// Import test function if in development
let runDetailedCryptoTest: any;
if (__DEV__) {
  try {
    runDetailedCryptoTest = require('@/utils/testCryptoDebug').runDetailedCryptoTest;
  } catch (e) {
    // Silent fail - test module not available
  }
}

// Register FCM token function - UPDATED
const registerFCMToken = async (userId: string) => {
  try {
    // Request permission if not already granted
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;
    
    if (!enabled) {
      // Silent fail - no console log in production
      if (__DEV__) {
        console.log('FCM Permission not granted');
      }
      return;
    }
    
    // Get the token
    const token = await messaging().getToken();
    if (__DEV__) {
      console.log('📱 FCM Token obtained, length:', token.length);
    }
    
    // Send to backend
    const response = await apiService.updateUserFCMToken(userId, token, Platform.OS);
    
    // Check for error in response
    if (response.error) {
      if (__DEV__) {
        console.error('Failed to update FCM token:', response.detail);
      }
    } else if (response.status === 'fcm_token_updated' && __DEV__) {
      console.log('✅ FCM Token registered successfully');
    }
  } catch (error: any) {
    // Silent fail in production
    if (__DEV__) {
      console.error('Error registering FCM token:', error);
    }
  }
};

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // Check if app is in foreground
    const appState = AppState.currentState;
    const data = notification.request.content.data;
    
    // Show notification only if:
    // 1. App is in background/inactive
    // 2. OR it's a chat message and user is not in that chat screen
    // 3. OR it's a moment notification
    if (appState !== 'active') {
      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      };
    }
    
    // If app is active, check context
    if (data?.type === 'chat' && data?.senderId) {
      const currentRoute = NavigationService.getCurrentRoute();
      if (currentRoute?.name === 'Chat' && currentRoute?.params?.recipientId === data.senderId) {
        // User is already in this chat, don't show notification
        return {
          shouldShowAlert: false,
          shouldPlaySound: false,
          shouldSetBadge: false,
        };
      }
    }
    
    // ✅ NEW: Always show moment notifications
    if (data?.type === 'moment_star' || data?.type === 'moment_match' || data?.type === 'moment_notice') {
      return {
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      };
    }
    
    // Show notification for other cases
    return {
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    };
  },
});

function AppContent() {
  const isAuthenticated = useAppSelector(state => state.auth?.isAuthenticated ?? false);
  const userId = useAppSelector(state => state.auth?.user?.user_id);
  const appStateRef = useRef(AppState.currentState);
  const notificationListenerRef = useRef<any>();
  const responseListenerRef = useRef<any>();
  const unreadCountRef = useRef(0);
  const momentNotificationCountRef = useRef(0); // ✅ NEW
  const cryptoInitialized = useRef(false);

  useEffect(() => {
    // ✅ UPDATED: Silent encryption initialization
    const initEncryption = async () => {
      if (cryptoInitialized.current) {
        return;
      }

      try {
        // Check if we're in Expo Go - this is the only critical alert we keep
        const isExpoGo = NativeModules.ExponentConstants?.appOwnership === 'expo';
        if (isExpoGo && __DEV__) {
          console.error('⚠️ Running in Expo Go - Native modules will NOT work!');
          // Only show alert in development for Expo Go
          Alert.alert(
            '⚠️ Expo Go Detected',
            'Native encryption modules do not work in Expo Go.\n\nPlease use a development build:\nnpx expo run:ios',
            [{ text: 'OK' }]
          );
          return;
        }

        // Check encryption availability silently
        const isAvailable = encryptionService.isAvailable();
        
        if (__DEV__) {
          console.log('🔐 Encryption available:', isAvailable);
          console.log('🔐 Algorithm:', encryptionService.getAlgorithm());
        }
        
        // Run encryption test only in development, non-blocking
        if (__DEV__ && isAvailable) {
          // Run test asynchronously without blocking
          encryptionService.testEncryption().then((testResult) => {
            if (testResult) {
              console.log('✅ Encryption test passed!');
            } else {
              console.error('❌ Encryption test failed');
              // Run detailed debug test if available
              if (runDetailedCryptoTest) {
                runDetailedCryptoTest().catch(console.error);
              }
            }
          }).catch(console.error);
        }
        
        cryptoInitialized.current = true;
      } catch (error) {
        // Silent fail - encryption will work in degraded mode
        if (__DEV__) {
          console.error('💥 Failed to initialize encryption:', error);
        }
      }
    };

    // Initialize encryption without blocking app startup
    initEncryption();

    // Setup notifications
    const setupNotifications = async () => {
      const granted = await requestNotificationPermissions();
      
      if (__DEV__) {
        console.log('📱 Notification permissions:', granted ? 'Granted' : 'Denied');
      }
      
      if (!granted) {
        return;
      }

      // Handle notification received while app is running
      notificationListenerRef.current = Notifications.addNotificationReceivedListener(notification => {
        if (__DEV__) {
          console.log('📨 Notification received:', notification);
        }
        
        const data = notification.request.content.data;
        
        // Update badge count based on notification type
        if (data?.type === 'chat' || data?.type === 'message') {
          unreadCountRef.current += 1;
          updateTotalBadgeCount();
        } else if (data?.type === 'moment_star' || data?.type === 'moment_notice') {
          momentNotificationCountRef.current += 1;
          updateTotalBadgeCount();
        }
        
        // Cache user info for navigation
        if ((data?.type === 'chat' || data?.type === 'message') && data?.senderId && data?.senderDescriptor) {
          AsyncStorage.setItem(
            `user_${data.senderId}`,
            JSON.stringify({
              user_id: data.senderId,
              descriptor: data.senderDescriptor,
              cached_at: Date.now()
            })
          ).catch(() => {}); // Silent fail
        }
      });

      // Handle notification tap
      responseListenerRef.current = Notifications.addNotificationResponseReceivedListener(async response => {
        if (__DEV__) {
          console.log('👆 Notification tapped:', response);
        }
        
        const data = response.notification.request.content.data;
        
        // Handle different notification types
        if (data?.type === 'chat' && data?.senderId) {
          await handleChatNotificationTap(data.senderId, data.messageId);
        } else if (data?.type === 'message' && data?.sender_id) {
          await handleChatNotificationTap(data.sender_id, data.message_id);
        } else if (data?.type === 'reaction' || data?.type === 'note' || data?.type === 'mutual_note') {
          // Navigate to discover page
          setTimeout(() => {
            NavigationService.navigateToDiscover();
          }, 100);
        }
        // ✅ NEW: Handle moment notifications
        else if (data?.type === 'moment_star' || data?.type === 'moment_notice' || data?.type === 'moment_match') {
          // Navigate to moments tab
          setTimeout(() => {
            NavigationService.navigateToMoments();
          }, 100);
          
          // Clear moment notification count
          momentNotificationCountRef.current = 0;
          updateTotalBadgeCount();
        }
        // ✅ NEW: Handle moment dropped notification
        else if (data?.type === 'moment' && data?.momentId) {
          // Navigate to moments tab
          setTimeout(() => {
            NavigationService.navigateToMoments();
          }, 100);
        }
        
        // Reset appropriate badge counts when notification is tapped
        if (data?.type === 'chat' || data?.type === 'message') {
          unreadCountRef.current = Math.max(0, unreadCountRef.current - 1);
        }
        updateTotalBadgeCount();
      });
    };

    setupNotifications();

    // Handle app state changes
    const appStateSubscription = AppState.addEventListener('change', handleAppStateChange);

    // Load counts on startup
    loadInitialCounts();

    return () => {
      if (notificationListenerRef.current) {
        notificationListenerRef.current.remove();
      }
      if (responseListenerRef.current) {
        responseListenerRef.current.remove();
      }
      appStateSubscription.remove();
    };
  }, []);

  // ✅ NEW: Update total badge count
  const updateTotalBadgeCount = () => {
    const totalCount = unreadCountRef.current + momentNotificationCountRef.current;
    setBadgeCount(totalCount);
  };

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
      if (__DEV__) {
        console.log('📱 App came to foreground');
      }
      
      // Refresh WebSocket connection if needed
      if (isAuthenticated && userId && !websocketService.isConnected()) {
        await websocketService.connect(userId);
      }
      
      // Re-register FCM token
      if (isAuthenticated && userId) {
        await registerFCMToken(userId);
      }
      
      // Reload counts when app comes to foreground
      await loadInitialCounts();
    }
    
    appStateRef.current = nextAppState;
  };

  // ✅ UPDATED: Load both message and moment counts
  const loadInitialCounts = async () => {
    try {
      if (!isAuthenticated || !userId) return;
      
      // Get unread messages count
      const conversationsResponse = await apiService.getConversations(20);
      if (!conversationsResponse.error && conversationsResponse.conversations) {
        const totalUnread = conversationsResponse.conversations.reduce(
          (sum: number, conv: any) => sum + (conv.unread_count || 0),
          0
        );
        unreadCountRef.current = totalUnread;
      }
      
      // ✅ NEW: Get moment notifications count and sync with Redux
      const momentNotifications = await apiService.getMomentNotifications();
      if (!momentNotifications.error && momentNotifications.count !== undefined) {
        momentNotificationCountRef.current = momentNotifications.count;
        
        // UPDATED: Sync with Redux store
        store.dispatch(setMomentNotifications({
          count: momentNotifications.count,
          moments: momentNotifications.moments || []
        }));
      }
      
      updateTotalBadgeCount();
    } catch (error) {
      // Silent fail
      if (__DEV__) {
        console.error('Failed to load counts:', error);
      }
    }
  };

  const handleChatNotificationTap = async (senderId: string, messageId?: string) => {
    try {
      // First, try to get sender info from cache
      const cachedUser = await AsyncStorage.getItem(`user_${senderId}`);
      let descriptor = 'Unknown User';
      let conversationId = '';
      
      if (cachedUser) {
        const userData = JSON.parse(cachedUser);
        descriptor = userData.descriptor || descriptor;
      }
      
      // Generate conversation ID
      if (userId) {
        conversationId = [userId, senderId].sort().join('_');
      }
      
      // If we don't have descriptor, try to fetch from API
      if (descriptor === 'Unknown User') {
        try {
          const conversations = await apiService.getConversations(50);
          if (!conversations.error && conversations.conversations) {
            const conv = conversations.conversations.find(
              (c: any) => c.other_user.user_id === senderId
            );
            if (conv) {
              descriptor = conv.other_user.descriptor;
              conversationId = conv.conversation_id;
              
              // Cache for future use
              await AsyncStorage.setItem(
                `user_${senderId}`,
                JSON.stringify({
                  user_id: senderId,
                  descriptor: descriptor,
                  cached_at: Date.now()
                })
              ).catch(() => {}); // Silent fail
            }
          }
        } catch (error) {
          // Silent fail - use Unknown User
        }
      }
      
      // Navigate to chat with a small delay to ensure navigation is ready
      setTimeout(() => {
        NavigationService.navigateToChat(senderId, descriptor, conversationId);
      }, 100);
      
    } catch (error) {
      // Silent fail
      if (__DEV__) {
        console.error('Error navigating to chat:', error);
      }
    }
  };

  // WebSocket management
  useEffect(() => {
    const handleWebSocket = async () => {
      if (isAuthenticated && userId) {
        if (__DEV__) {
          console.log('🔌 Connecting WebSocket for user:', userId);
        }
        
        // Clean up old connection first
        if (websocketService.isConnected()) {
          websocketService.disconnect();
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        // Connect with proper user ID
        await websocketService.connect(userId);
        
        // Subscribe to WebSocket messages for notifications
        const checkForMessages = setInterval(() => {
          const state = store.getState();
          const notifications = (state as any).notifications?.notifications || []; // ✅ Fixed: notifications.notifications
          
          // Process new notifications
          notifications.forEach(async (notif: any) => {
            if (!notif.processed) {
              // Handle chat messages
              if (notif.type === 'message') {
                await showNotification({
                  title: notif.metadata?.senderDescriptor || 'New Message',
                  body: '🔐 New encrypted message',
                  data: {
                    type: 'message',
                    sender_id: notif.senderId,
                    message_id: notif.metadata?.messageId,
                    senderDescriptor: notif.metadata?.senderDescriptor
                  }
                });
                
                unreadCountRef.current += 1;
                updateTotalBadgeCount();
              }
              // ✅ NEW: Handle moment notifications
              else if (notif.type === 'moment_star') {
                await showNotification({
                  title: 'Someone noticed your moment! ⭐',
                  body: notif.message,
                  data: {
                    type: 'moment_star',
                    momentId: notif.metadata?.momentId
                  }
                });
                
                momentNotificationCountRef.current += 1;
                updateTotalBadgeCount();
              }
              // ✅ NEW: Handle moment match
              else if (notif.type === 'moment_match') {
                await showNotification({
                  title: notif.metadata?.isMutual ? '✨ Mutual moment match!' : '💕 Moment match!',
                  body: notif.message,
                  data: {
                    type: 'moment_match',
                    userId: notif.senderId,
                    userDescriptor: notif.metadata?.matchedUserDescriptor
                  }
                });
              }
              // ✅ NEW: Handle note notifications
              else if (notif.type === 'note' || notif.type === 'mutual_note') {
                await showNotification({
                  title: notif.type === 'mutual_note' ? '✨ Mutual note!' : 'Someone noted you ⭐',
                  body: notif.message,
                  data: {
                    type: notif.type,
                    senderId: notif.senderId
                  }
                });
              }
              
              // Mark as processed
              store.dispatch({
                type: 'notifications/markAsProcessed',
                payload: notif.id
              });
            }
          });
        }, 1000);
        
        return () => clearInterval(checkForMessages);
      } else if (!isAuthenticated) {
        if (__DEV__) {
          console.log('🔌 Disconnecting WebSocket (not authenticated)');
        }
        websocketService.disconnect();
      }
    };

    handleWebSocket();

    return () => {
      if (!isAuthenticated) {
        websocketService.disconnect();
      }
    };
  }, [isAuthenticated, userId]);

  // Monitor WebSocket connection health
  useEffect(() => {
    if (!isAuthenticated || !userId) return;

    const checkConnection = setInterval(async () => {
      if (!websocketService.isConnected() && appStateRef.current === 'active') {
        if (__DEV__) {
          console.log('🔄 WebSocket disconnected, attempting reconnect...');
        }
        await websocketService.connect(userId);
      }
    }, 5000);

    return () => clearInterval(checkConnection);
  }, [isAuthenticated, userId]);

  // FCM Token Registration
  useEffect(() => {
    if (isAuthenticated && userId) {
      // Register FCM token
      registerFCMToken(userId);
      
      // Listen for token refresh
      const unsubscribe = messaging().onTokenRefresh(async (newToken) => {
        if (__DEV__) {
          console.log('📱 FCM Token refreshed, length:', newToken.length);
        }
        try {
          const response = await apiService.updateUserFCMToken(userId, newToken, Platform.OS);
          if (response.error && __DEV__) {
            console.error('Failed to update refreshed FCM token:', response.detail);
          }
        } catch (error) {
          // Silent fail
          if (__DEV__) {
            console.error('Failed to update refreshed FCM token:', error);
          }
        }
      });
      
      return () => unsubscribe();
    }
  }, [isAuthenticated, userId]);

  // UPDATED: Listen to Redux state changes for moment notifications
  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      const state = store.getState();
      const reduxMomentCount = state.moments?.notificationCount || 0;
      
      // Sync local ref with Redux state
      if (momentNotificationCountRef.current !== reduxMomentCount) {
        momentNotificationCountRef.current = reduxMomentCount;
        updateTotalBadgeCount();
      }
    });

    return unsubscribe;
  }, []);

  return (
    <SafeAreaProvider>
      <AppNavigator />
      <StatusBar style="light" />
    </SafeAreaProvider>
  );
}

export default function App() {
  // NEW: Firebase config from .env (replace if needed)
  const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
    databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
    measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };

  // NEW: Initialize Firebase early
  useEffect(() => {
    initializeApp(firebaseConfig);
    if (__DEV__) {
      console.log('🔥 Firebase initialized');
    }
  }, []);

  // Log app startup info only in development
  useEffect(() => {
    if (__DEV__) {
      console.log('🚀 NOTAMY App starting...');
      console.log('📱 Platform:', Platform.OS);
      console.log('📱 Dev mode:', __DEV__);
      
      // Check for Expo Go immediately
      const isExpoGo = NativeModules.ExponentConstants?.appOwnership === 'expo';
      if (isExpoGo) {
        console.warn('⚠️ Running in Expo Go - Native modules will NOT work!');
      }
    }
  }, []);

  return (
    <Provider store={store}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <GlobalStatusBar />
        <AppContent />
      </GestureHandlerRootView>
    </Provider>
  );
}