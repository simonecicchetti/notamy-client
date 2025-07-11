// src/screens/main/MomentsScreen.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Animated,
  RefreshControl,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Modal,
  FlatList,
  Dimensions,
  Easing,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme, GRADIENTS } from '@/config/theme';
import { sharedStyles, AVATAR_SIZES, getAvatarStyle } from '@/config/sharedStyles';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { MainTabParamList } from '@/types/navigation';
import { useAppSelector, useAppDispatch } from '@/store';
import { RootState } from '@/store';
import { 
  selectAllMoments, 
  selectMomentNotificationCount,
  setMoments,
  markMomentStarred,
  updateMomentMatched,
  removeMoment,
  updateMomentStarCount,
  confirmMomentMatch as confirmMomentMatchAction,
  removeStar
} from '@/store/slices/momentsSlice';
import apiService from '@/services/api';
import { 
  MomentResponse, 
  StarInfo, 
  MomentRequest 
} from '@/types/api';
import websocketService from '@/services/websocket';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

// Constants
const CACHE_KEY = 'cached_moments';
const CACHE_EXPIRY_KEY = 'cached_moments_expiry';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minuti
const MAX_VISIBLE_STARS = 5; // Massimo stelle visibili prima di "and X more"
const TIME_UPDATE_INTERVAL = 60000; // 1 minuto

type Props = BottomTabScreenProps<MainTabParamList, 'Moments'>;

export default function MomentsScreen({ navigation }: Props) {
  const dispatch = useAppDispatch();
  const currentUser = useAppSelector(state => state.auth?.user);
  const currentUserId = currentUser?.user_id || currentUser?.id;
  const notifications = useAppSelector((state: RootState) => state.notifications.notifications);
  const moments = useAppSelector(selectAllMoments);
  const notificationCount = useAppSelector(selectMomentNotificationCount);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [dropModalVisible, setDropModalVisible] = useState(false);
  const [momentDescription, setMomentDescription] = useState('');
  const [locationHint, setLocationHint] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [timeKey, setTimeKey] = useState(0); // Per forzare re-render del tempo
  
  // Enhanced animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const notificationSlide = useRef(new Animated.Value(-100)).current;
  const dropButtonScale = useRef(new Animated.Value(1)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  
  // Refs per cleanup
  const timeUpdateInterval = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    // Smooth entry animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
    
    // Floating animation for background elements
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 3000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();
    
    // Load moments with cache
    loadMomentsWithCache();
    
    // Setup time update interval
    timeUpdateInterval.current = setInterval(() => {
      setTimeKey(prev => prev + 1); // Forza re-render
    }, TIME_UPDATE_INTERVAL);
    
    // WebSocket listeners
    const handleMomentStarred = (data: any) => {
      if (data.moment_author_id === currentUserId) {
        dispatch(updateMomentStarCount({
          momentId: data.moment_id,
          starCount: data.total_stars || 1
        }));
        showNotificationBanner();
      }
    };
    
    const handleMomentMatched = (data: any) => {
      dispatch(updateMomentMatched({
        momentId: data.moment_id,
        matchedWithMe: data.matched_user_id === currentUserId
      }));
    };
    
    const handleMomentDropped = (data: any) => {
      if (data.author_id !== currentUserId) {
        loadMomentsWithCache();
      }
    };
    
    const handleMomentDeleted = (data: any) => {
      dispatch(removeMoment(data.moment_id));
    };
    
    websocketService.on('moment_starred', handleMomentStarred);
    websocketService.on('moment_matched', handleMomentMatched);
    websocketService.on('moment_dropped', handleMomentDropped);
    websocketService.on('moment_deleted', handleMomentDeleted);
    
    return () => {
      websocketService.off('moment_starred', handleMomentStarred);
      websocketService.off('moment_matched', handleMomentMatched);
      websocketService.off('moment_dropped', handleMomentDropped);
      websocketService.off('moment_deleted', handleMomentDeleted);
      
      // Cleanup interval
      if (timeUpdateInterval.current) {
        clearInterval(timeUpdateInterval.current);
      }
    };
  }, [currentUserId, dispatch]);
  
  useEffect(() => {
    if (notificationCount > 0) {
      showNotificationBanner();
    }
  }, [notificationCount]);
  
  const showNotificationBanner = () => {
    Animated.sequence([
      Animated.timing(notificationSlide, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.back(1.5)),
        useNativeDriver: true,
      }),
      Animated.delay(5000),
      Animated.timing(notificationSlide, {
        toValue: -100,
        duration: 300,
        easing: Easing.in(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  };
  
  const handleDropButtonPressIn = () => {
    Animated.spring(dropButtonScale, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };
  
  const handleDropButtonPressOut = () => {
    Animated.spring(dropButtonScale, {
      toValue: 1,
      friction: 3,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };
  
  /**
   * Carica moments con cache locale per risposta immediata
   */
  const loadMomentsWithCache = async () => {
    try {
      // Prima mostra cached moments se disponibili
      const cachedData = await AsyncStorage.getItem(CACHE_KEY);
      const cacheExpiry = await AsyncStorage.getItem(CACHE_EXPIRY_KEY);
      
      if (cachedData && cacheExpiry) {
        const expiryTime = parseInt(cacheExpiry);
        if (Date.now() < expiryTime) {
          // Cache valida, usa i dati cached
          const cachedMoments = JSON.parse(cachedData);
          dispatch(setMoments({
            moments: cachedMoments,
            currentUserId: currentUserId || ''
          }));
          setLoading(false); // Mostra subito i dati cached
        }
      }
      
      // Poi carica fresh data dal server
      await loadMoments(false); // false = non è refresh manuale
      
    } catch (error) {
      console.error('Failed to load cached moments:', error);
      // Continua con caricamento normale
      await loadMoments(false);
    }
  };
  
  /**
   * Carica moments dal server con gestione location migliorata
   */
  const loadMoments = async (isManualRefresh: boolean = true) => {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      let coords = null;
      
      if (status === 'granted') {
        try {
          // Prova prima con alta accuratezza
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });
          coords = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
        } catch (locError) {
          console.log('High accuracy location failed, trying last known...');
          
          // Fallback a ultima posizione conosciuta
          try {
            const lastKnown = await Location.getLastKnownPositionAsync();
            if (lastKnown) {
              coords = {
                latitude: lastKnown.coords.latitude,
                longitude: lastKnown.coords.longitude,
              };
            }
          } catch (lastKnownError) {
            console.log('Last known location also failed');
          }
        }
      }
      
      // Chiama API con o senza coordinate
      const response = await apiService.getMoments(coords || undefined, 1000, 50);
      
      if (!response.error && Array.isArray(response)) {
        // Salva in cache
        await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(response));
        await AsyncStorage.setItem(CACHE_EXPIRY_KEY, (Date.now() + CACHE_DURATION).toString());
        
        dispatch(setMoments({
          moments: response,
          currentUserId: currentUserId || ''
        }));
      } else if (response.error && response.status === 401) {
        navigation.navigate('Identity' as any);
      } else {
        dispatch(setMoments({
          moments: [],
          currentUserId: currentUserId || ''
        }));
      }
    } catch (error) {
      console.error('Failed to load moments:', error);
      
      // Se non è manual refresh e abbiamo dati cached, mantienili
      if (!isManualRefresh) {
        const cachedData = await AsyncStorage.getItem(CACHE_KEY);
        if (cachedData) {
          return; // Mantieni i dati cached
        }
      }
      
      dispatch(setMoments({
        moments: [],
        currentUserId: currentUserId || ''
      }));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  
  const handleRefresh = () => {
    setRefreshing(true);
    loadMoments(true); // true = refresh manuale
  };
  
  const formatTimeLeft = useCallback((expiresAt: number): string => {
    const now = Date.now() / 1000;
    const diff = expiresAt - now;
    
    if (diff <= 0) return 'Expired';
    
    const hours = Math.floor(diff / 3600);
    const minutes = Math.floor((diff % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }, []);
  
  const formatTimeAgo = useCallback((timestamp: number): string => {
    const now = Date.now() / 1000;
    const diff = now - timestamp;
    
    const minutes = Math.floor(diff / 60);
    const hours = Math.floor(diff / 3600);
    
    if (hours > 0) {
      return `${hours}h ago`;
    }
    return `${minutes}m ago`;
  }, []);
  
  const getTimeUrgency = useCallback((expiresAt: number): boolean => {
    const now = Date.now() / 1000;
    const diff = expiresAt - now;
    const minutes = Math.floor(diff / 60);
    return minutes < 60;
  }, []);
  
  const handleSendStar = async (moment: MomentResponse) => {
    try {
      const result = await apiService.sendStar(moment.id);
      
      if (!result.error) {
        dispatch(markMomentStarred(moment.id));
        
        Alert.alert(
          'Star Sent! ⭐',
          'They\'ll be notified. If they confirm, you\'ll match!',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Error', result.detail || 'Failed to send star');
      }
    } catch (error) {
      console.error('Failed to send star:', error);
      Alert.alert('Error', 'Network error. Please try again.');
    }
  };
  
  const handleConfirmMatch = async (momentId: string, starUserId: string, starDescriptor: string) => {
    Alert.alert(
      'Confirm Match?',
      `Do you want to confirm ${starDescriptor} as a match?`,
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Deny',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await apiService.confirmMomentMatch(momentId, starUserId, false);
              if (!result.error) {
                dispatch(removeStar({ momentId, starUserId }));
                Alert.alert('Star Denied', 'The star has been removed.');
              }
            } catch (error) {
              console.error('Failed to deny match:', error);
              Alert.alert('Error', 'Failed to process. Please try again.');
            }
          }
        },
        {
          text: 'Confirm',
          onPress: async () => {
            try {
              const result = await apiService.confirmMomentMatch(momentId, starUserId, true);
              if (!result.error) {
                dispatch(confirmMomentMatchAction({ momentId, starUserId }));
                
                if (result.is_mutual) {
                  Alert.alert(
                    '✨ Mutual Match!',
                    `You and ${starDescriptor} can now chat!`,
                    [
                      { text: 'Start Chat', onPress: () => navigation.navigate('Messages' as any) },
                      { text: 'Later' }
                    ]
                  );
                } else {
                  Alert.alert(
                    'Match Confirmed! 💫',
                    `You matched with ${starDescriptor}. You can now chat!`,
                    [{ text: 'OK' }]
                  );
                }
              }
            } catch (error) {
              console.error('Failed to confirm match:', error);
              Alert.alert('Error', 'Failed to confirm match. Please try again.');
            }
          }
        }
      ]
    );
  };
  
  const handleDropMoment = async () => {
    if (!momentDescription.trim()) {
      Alert.alert('Missing Info', 'Please describe who you noticed.');
      return;
    }
    
    setSubmitting(true);
    
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      let coords = null;
      
      if (status === 'granted') {
        try {
          const location = await Location.getCurrentPositionAsync({});
          coords = {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          };
        } catch (error) {
          // Location failed, continua senza
          console.log('Location failed for moment drop:', error);
        }
      }
      
      const momentData: MomentRequest = {
        description: momentDescription.trim(),
        area: locationHint.trim() || undefined,
        location: coords || undefined,
      };
      
      const result = await apiService.dropMoment(momentData);
      
      if (!result.error) {
        setDropModalVisible(false);
        setMomentDescription('');
        setLocationHint('');
        
        Alert.alert(
          'Moment Dropped! 💫',
          'Your moment will be visible for 3 hours. If they recognize themselves, you\'ll match!',
          [{ text: 'OK' }]
        );
        
        // Refresh moments
        loadMomentsWithCache();
      } else {
        Alert.alert('Error', result.detail || 'Failed to drop moment');
      }
    } catch (error) {
      console.error('Failed to drop moment:', error);
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };
  
  const getAvatarGradient = (descriptor: string): string[] => {
    const gradients = [
      GRADIENTS.primary.colors,
      GRADIENTS.secondary.colors,
      GRADIENTS.accent.colors,
      ['#ffab00', '#ffd740'], // Amber
      ['#00b0ff', '#40c4ff'], // Light Blue
    ];
    
    let hash = 0;
    for (let i = 0; i < descriptor.length; i++) {
      hash = ((hash << 5) - hash) + descriptor.charCodeAt(i);
      hash = hash & hash;
    }
    
    return gradients[Math.abs(hash) % gradients.length];
  };
  
  const renderMoment = ({ item, index }: { item: MomentResponse; index: number }) => {
    // Key con timeKey per forzare re-render del tempo
    const timeLeft = formatTimeLeft(item.expires_at);
    const isUrgent = getTimeUrgency(item.expires_at);
    
    const cardAnim = useRef(new Animated.Value(0)).current;
    
    useEffect(() => {
      Animated.timing(cardAnim, {
        toValue: 1,
        duration: 400,
        delay: index * 100,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }, []);
    
    return (
      <Animated.View
        key={`${item.id}-${timeKey}`} // Include timeKey per re-render
        style={[
          {
            opacity: cardAnim,
            transform: [
              {
                translateY: cardAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [20, 0],
                }),
              },
            ],
          },
        ]}
      >
        <TouchableOpacity
          style={[
            styles.momentCard,
            item.is_matched && styles.momentCardMatched,
            item.is_expired && styles.momentCardExpired,
          ]}
          activeOpacity={0.9}
        >
          {/* Matched indicator */}
          {item.is_matched && (
            <View style={styles.matchedIndicator}>
              <Text style={styles.matchedText}>✨ Matched!</Text>
            </View>
          )}
          
          {/* Author Header */}
          <View style={styles.momentHeader}>
            <View style={styles.authorInfo}>
              <View style={styles.avatarContainer}>
                <LinearGradient
                  colors={getAvatarGradient(item.author.descriptor)}
                  style={styles.avatarGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {item.author.descriptor.charAt(0).toUpperCase()}
                  </Text>
                </View>
              </View>
              
              <View style={styles.authorText}>
                <Text style={styles.descriptor}>
                  {item.author.emoji && `${item.author.emoji} `}
                  {item.author.descriptor}
                </Text>
                <Text style={styles.timeAgo}>{formatTimeAgo(item.created_at)}</Text>
              </View>
            </View>
            
            {!item.is_expired && (
              <View style={[
                styles.timeBadge,
                isUrgent && styles.timeBadgeUrgent,
              ]}>
                <Text style={[
                  styles.timeLeft,
                  isUrgent && styles.timeLeftUrgent,
                ]}>
                  {timeLeft}
                </Text>
              </View>
            )}
          </View>
          
          {/* Description */}
          <Text style={styles.momentDescription}>{item.description}</Text>
          
          {/* Location */}
          {item.location.area && (
            <View style={styles.locationRow}>
              <Ionicons name="location" size={14} color={theme.colors.textTertiary} />
              <Text style={styles.locationText}>{item.location.area}</Text>
            </View>
          )}
          
          {/* Stars Management for Own Moments - Con pagination */}
          {item.can_manage && item.stars_received && item.stars_received.length > 0 && (
            <View style={styles.starsManagement}>
              <Text style={styles.starsTitle}>People who starred ({item.star_count}):</Text>
              
              {/* Mostra solo le prime MAX_VISIBLE_STARS */}
              {item.stars_received.slice(0, MAX_VISIBLE_STARS).map((star: StarInfo) => (
                <TouchableOpacity
                  key={star.user_id}
                  style={styles.starItem}
                  onPress={() => handleConfirmMatch(item.id, star.user_id, star.descriptor)}
                  disabled={star.confirmed}
                >
                  <Text style={styles.starDescriptor}>
                    {star.descriptor}
                  </Text>
                  {star.confirmed ? (
                    <Text style={styles.starConfirmed}>✅ Matched</Text>
                  ) : (
                    <Text style={styles.starPending}>Tap to confirm</Text>
                  )}
                </TouchableOpacity>
              ))}
              
              {/* Mostra "and X more" se ci sono più stelle */}
              {item.stars_received.length > MAX_VISIBLE_STARS && (
                <View style={styles.moreStarsContainer}>
                  <Text style={styles.moreStarsText}>
                    and {item.stars_received.length - MAX_VISIBLE_STARS} more...
                  </Text>
                </View>
              )}
            </View>
          )}
          
          {/* Actions */}
          {!item.is_expired && !item.is_my_moment && (
            <View style={styles.momentActions}>
              {item.matched_with_me ? (
                <TouchableOpacity
                  style={styles.chatButton}
                  onPress={() => navigation.navigate('Messages' as any)}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={GRADIENTS.accent.colors}
                    style={styles.actionButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={styles.chatButtonText}>Start Chat</Text>
                    <Text style={styles.actionIcon}>💬</Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.starButton, !item.can_star && styles.starButtonDisabled]}
                  onPress={() => item.can_star && handleSendStar(item)}
                  disabled={!item.can_star}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={item.i_starred ? [theme.colors.blackSurface, theme.colors.blackSurface] : GRADIENTS.secondary.colors}
                    style={styles.actionButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Text style={[
                      styles.starButtonText,
                      item.i_starred && styles.starButtonTextDisabled,
                    ]}>
                      {item.i_starred ? 'Star sent!' : "That's me!"}
                    </Text>
                    <Text style={styles.actionIcon}>{item.i_starred ? '✨' : '⭐'}</Text>
                  </LinearGradient>
                </TouchableOpacity>
              )}
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    );
  };
  
  if (loading) {
    return (
      <View style={[styles.container, styles.loadingContainer]}>
        <LinearGradient
          colors={GRADIENTS.dark.colors}
          style={StyleSheet.absoluteFillObject}
        />
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }
  
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={GRADIENTS.dark.colors}
        style={StyleSheet.absoluteFillObject}
      />
      
      {/* Floating background elements */}
      <Animated.View
        style={[
          styles.floatingElement,
          {
            transform: [
              {
                translateY: floatAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -20],
                }),
              },
            ],
          },
        ]}
      />
      
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <Animated.View
          style={[
            styles.header,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.title}>Moments</Text>
            </View>
            
            <Animated.View
              style={{
                transform: [{ scale: dropButtonScale }],
              }}
            >
              <TouchableOpacity
                style={styles.dropButton}
                onPress={() => setDropModalVisible(true)}
                onPressIn={handleDropButtonPressIn}
                onPressOut={handleDropButtonPressOut}
                activeOpacity={0.9}
              >
                <LinearGradient
                  colors={GRADIENTS.secondary.colors}
                  style={styles.dropButtonGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="add" size={28} color={theme.colors.black} />
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Animated.View>
        
        {/* Notice Alert */}
        {notificationCount > 0 && (
          <Animated.View
            style={[
              styles.noticeAlert,
              {
                transform: [{ translateY: notificationSlide }],
              },
            ]}
          >
            <View style={styles.noticeContent}>
              <Animated.Text
                style={[
                  styles.noticeEmoji,
                  {
                    transform: [
                      {
                        scale: floatAnim.interpolate({
                          inputRange: [0, 0.5, 1],
                          outputRange: [1, 1.2, 1],
                        }),
                      },
                    ],
                  },
                ]}
              >
                ⭐
              </Animated.Text>
              <Text style={styles.noticeText}>
                {notificationCount} {notificationCount === 1 ? 'person' : 'people'} noticed you!
              </Text>
            </View>
          </Animated.View>
        )}
        
        {/* Moments List */}
        <Animated.View
          style={[
            styles.listContainer,
            {
              opacity: fadeAnim,
            },
          ]}
        >
          <FlatList
            data={moments}
            renderItem={renderMoment}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={handleRefresh}
                tintColor={theme.colors.primary}
              />
            }
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            removeClippedSubviews={true}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={10}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                {/* Notamy Logo */}
                <View style={styles.logoContainer}>
                  <View style={styles.logoGlass}>
                    <LinearGradient
                      colors={GRADIENTS.primary.colors}
                      style={styles.logoBorder}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    />
                    <View style={styles.logoInner}>
                      <View style={styles.nShape}>
                        <View style={styles.nBarLeft} />
                        <View style={styles.nBarDiagonal} />
                        <View style={styles.nBarRight} />
                      </View>
                    </View>
                  </View>
                </View>
                <Text style={styles.emptyText}>No moments yet</Text>
                <Text style={styles.emptySubtext}>Drop one when you notice someone!</Text>
              </View>
            }
          />
        </Animated.View>
        
        {/* Drop Moment Modal */}
        <Modal
          visible={dropModalVisible}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setDropModalVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalContainer}
          >
            <TouchableOpacity
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setDropModalVisible(false)}
            />
            
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Drop a Moment</Text>
                <TouchableOpacity
                  onPress={() => setDropModalVisible(false)}
                  style={styles.closeButton}
                >
                  <Ionicons name="close" size={24} color={theme.colors.textPrimary} />
                </TouchableOpacity>
              </View>
              
              <TextInput
                style={styles.descriptionInput}
                placeholder="Describe who caught your eye... Be specific but respectful 💕"
                placeholderTextColor={theme.colors.textMuted}
                multiline
                numberOfLines={4}
                value={momentDescription}
                onChangeText={setMomentDescription}
                maxLength={200}
              />
              
              <TextInput
                style={styles.locationInput}
                placeholder="Where? (optional) - 'near the fountain', 'red building'..."
                placeholderTextColor={theme.colors.textMuted}
                value={locationHint}
                onChangeText={setLocationHint}
                maxLength={50}
                returnKeyType="done"
              />
              
              <TouchableOpacity
                style={[
                  styles.submitButton,
                  (!momentDescription.trim() || submitting) && styles.submitButtonDisabled,
                ]}
                onPress={handleDropMoment}
                disabled={!momentDescription.trim() || submitting}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={
                    momentDescription.trim() && !submitting
                      ? GRADIENTS.secondary.colors
                      : [theme.colors.blackSurface, theme.colors.blackSurface]
                  }
                  style={styles.submitGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {submitting ? (
                    <ActivityIndicator size="small" color={theme.colors.textPrimary} />
                  ) : (
                    <>
                      <Text style={styles.submitText}>Drop Moment</Text>
                      <Text style={styles.submitIcon}>💫</Text>
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
              
              <Text style={styles.disclaimer}>
                Moments expire in 3 hours • Be kind & respectful
              </Text>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Base containers
  container: sharedStyles.container,
  loadingContainer: sharedStyles.loadingContainer,
  safeArea: sharedStyles.safeArea,
  
  // Floating background element
  floatingElement: {
    position: 'absolute',
    top: '20%',
    left: '-50%',
    width: '200%',
    height: '60%',
    backgroundColor: theme.colors.primary,
    opacity: 0.03,
    borderRadius: 999,
    transform: [{ rotate: '-15deg' }],
  },
  
  // Header - with background
  header: {
    ...sharedStyles.screenHeader,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  headerContent: sharedStyles.headerContent,
  title: sharedStyles.screenTitle,
  
  // Drop button - enhanced
  dropButton: {
    borderRadius: 26,
    overflow: 'hidden',
  },
  dropButtonGradient: {
    width: 52,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  // Notice Alert - glass effect
  noticeAlert: {
    position: 'absolute',
    top: 100,
    left: theme.spacing.xl,
    right: theme.spacing.xl,
    zIndex: 100,
  },
  noticeContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
    backgroundColor: theme.colors.blackElevated,
    borderWidth: 1,
    borderColor: theme.colors.secondary + '30',
    borderRadius: theme.borderRadius.pill,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
  },
  noticeEmoji: {
    fontSize: 20,
  },
  noticeText: {
    fontSize: theme.typography.fontSize.body,
    color: theme.colors.textPrimary,
    fontWeight: theme.typography.fontWeight.medium,
  },
  
  // List
  listContainer: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingBottom: theme.spacing.huge * 2,
  },
  
  // Moment Card - using card style from sharedStyles
  momentCard: {
    ...sharedStyles.card,
    marginBottom: theme.spacing.sm,
    position: 'relative',
    overflow: 'hidden',
  },
  momentCardMatched: {
    borderColor: theme.colors.success + '50',
    backgroundColor: theme.colors.blackElevated + 'EE',
  },
  momentCardExpired: {
    opacity: 0.5,
  },
  matchedIndicator: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: theme.colors.success + '20',
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xxs,
    borderWidth: 1,
    borderColor: theme.colors.success + '30',
  },
  matchedText: {
    fontSize: theme.typography.fontSize.micro,
    color: theme.colors.success,
    fontWeight: theme.typography.fontWeight.medium,
  },
  momentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: theme.spacing.md,
  },
  authorInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    padding: 2,
    position: 'relative',
  },
  avatarGradient: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 22,
    opacity: 0.8,
  },
  avatar: {
    ...getAvatarStyle('small'),
    backgroundColor: theme.colors.black,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  avatarText: sharedStyles.avatarTextSmall,
  authorText: {
    gap: theme.spacing.xxs,
  },
  descriptor: {
    fontSize: theme.typography.fontSize.body,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.textPrimary,
    letterSpacing: theme.typography.letterSpacing.tight,
  },
  timeAgo: {
    fontSize: theme.typography.fontSize.micro,
    color: theme.colors.textMuted,
    letterSpacing: theme.typography.letterSpacing.wide,
  },
  timeBadge: {
    backgroundColor: theme.colors.blackSurface,
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xxs,
    borderRadius: theme.borderRadius.md,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  timeBadgeUrgent: {
    borderColor: theme.colors.error + '50',
    backgroundColor: theme.colors.error + '10',
  },
  timeLeft: {
    fontSize: theme.typography.fontSize.micro,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.fontWeight.medium,
  },
  timeLeftUrgent: {
    color: theme.colors.error,
  },
  momentDescription: {
    fontSize: theme.typography.fontSize.body,
    color: theme.colors.textSecondary,
    lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.body,
    marginBottom: theme.spacing.md,
    letterSpacing: theme.typography.letterSpacing.normal,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xxs,
    marginBottom: theme.spacing.md,
    opacity: 0.7,
  },
  locationText: {
    fontSize: theme.typography.fontSize.caption,
    color: theme.colors.textTertiary,
  },
  
  // Stars management section
  starsManagement: {
    marginTop: theme.spacing.md,
    paddingTop: theme.spacing.md,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  starsTitle: {
    fontSize: theme.typography.fontSize.caption,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.sm,
    fontWeight: theme.typography.fontWeight.medium,
  },
  starItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    backgroundColor: theme.colors.blackSurface,
    borderRadius: theme.borderRadius.sm,
    marginBottom: theme.spacing.xs,
  },
  starDescriptor: {
    fontSize: theme.typography.fontSize.body,
    color: theme.colors.textPrimary,
    fontWeight: theme.typography.fontWeight.medium,
  },
  starConfirmed: {
    fontSize: theme.typography.fontSize.caption,
    color: theme.colors.success,
  },
  starPending: {
    fontSize: theme.typography.fontSize.caption,
    color: theme.colors.primary,
  },
  
  // New styles for pagination
  moreStarsContainer: {
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.sm,
    alignItems: 'center',
  },
  moreStarsText: {
    fontSize: theme.typography.fontSize.caption,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
  },
  
  momentActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  starButton: {
    borderRadius: theme.borderRadius.pill,
    overflow: 'hidden',
  },
  starButtonDisabled: {
    opacity: 0.7,
  },
  chatButton: {
    borderRadius: theme.borderRadius.pill,
    overflow: 'hidden',
  },
  actionButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xl,
  },
  starButtonText: {
    fontSize: theme.typography.fontSize.body,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.textPrimary,
    letterSpacing: theme.typography.letterSpacing.wide,
  },
  starButtonTextDisabled: {
    color: theme.colors.textSecondary,
  },
  chatButtonText: {
    fontSize: theme.typography.fontSize.body,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.black,
    letterSpacing: theme.typography.letterSpacing.wide,
  },
  actionIcon: {
    fontSize: 18,
  },
  
  // Empty State
  emptyState: sharedStyles.emptyState,
  emptyText: {
    ...sharedStyles.emptyTitle,
    marginBottom: theme.spacing.sm,
  },
  emptySubtext: {
    ...sharedStyles.emptyText,
    opacity: 0.7,
  },
  
  // Logo styles for empty state
  logoContainer: {
    marginBottom: theme.spacing.xxxl,
  },
  logoGlass: {
    width: 80,
    height: 80,
    borderRadius: 40,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.blackElevated,
  },
  logoBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 40,
    opacity: 0.8,
  },
  logoInner: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: theme.colors.black,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  nShape: {
    width: 40,
    height: 40,
    position: 'relative',
  },
  nBarLeft: {
    position: 'absolute',
    width: 6,
    height: 40,
    left: 0,
    backgroundColor: theme.colors.primary,
    borderRadius: 2,
  },
  nBarRight: {
    position: 'absolute',
    width: 6,
    height: 40,
    right: 0,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: 2,
  },
  nBarDiagonal: {
    position: 'absolute',
    width: 45,
    height: 6,
    top: 17,
    left: -2.5,
    backgroundColor: theme.colors.secondary,
    borderRadius: 2,
    transform: [{ rotate: '-35deg' }],
  },
  
  // Modal - using sharedStyles
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalOverlay: sharedStyles.modalOverlay,
  modalContent: sharedStyles.modalContent,
  modalHeader: sharedStyles.modalHeader,
  modalTitle: sharedStyles.modalTitle,
  closeButton: sharedStyles.closeButton,
  descriptionInput: {
    ...sharedStyles.textInputMultiline,
    marginBottom: theme.spacing.lg,
  },
  locationInput: {
    ...sharedStyles.textInput,
    marginBottom: theme.spacing.xl,
    height: 50,
  },
  submitButton: {
    borderRadius: theme.borderRadius.pill,
    overflow: 'hidden',
    marginBottom: theme.spacing.md,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.lg,
  },
  submitText: {
    fontSize: theme.typography.fontSize.body,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.textPrimary,
    letterSpacing: theme.typography.letterSpacing.wide,
  },
  submitIcon: {
    fontSize: 20,
  },
  disclaimer: {
    fontSize: theme.typography.fontSize.micro,
    color: theme.colors.textMuted,
    textAlign: 'center',
    letterSpacing: theme.typography.letterSpacing.wide,
    opacity: 0.7,
  },
});