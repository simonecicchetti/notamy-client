// src/screens/main/ProfileScreen.tsx
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  Linking,
  Easing,
  Modal,
  PanResponder,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { theme, GRADIENTS, getUserGradient } from '@/config/theme';
import { sharedStyles, AVATAR_SIZES, getAvatarStyle, getAvatarTextStyle } from '@/config/sharedStyles';
import { useAppSelector, useAppDispatch } from '@/store';
import { logout } from '@/store/slices/authSlice';
import { clearMoments } from '@/store/slices/momentsSlice';
import { clearNotifications } from '@/store/slices/notificationSlice'; // FIXED: Changed to singular "notificationSlice"
import { clearConversations } from '@/store/slices/chatSlice';
import apiService from '@/services/api';
import { 
  UserProfile as ProfileData,
  Badge 
} from '@/types/api';
import websocketService from '@/services/websocket';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { CommonActions } from '@react-navigation/native';

const { width } = Dimensions.get('window');
const PHOTO_SIZE = (width - 72) / 3;

interface ProfileScreenProps {
  navigation: any;
  route?: {
    params?: {
      userId?: string;  // Se presente, mostra profilo di altro utente
      descriptor?: string;
    };
  };
}

interface NotedUser {
  sent: boolean;
  received: boolean;
  mutual: boolean;
  timestamp: number;
}

export default function ProfileScreen({ navigation, route }: ProfileScreenProps) {
  const currentUser = useAppSelector(state => state.auth?.user);
  const dispatch = useAppDispatch();
  
  // Determina se stiamo visualizzando il nostro profilo o quello di un altro
  const viewingUserId = route?.params?.userId;
  const isOwnProfile = !viewingUserId || viewingUserId === currentUser?.user_id;
  
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Profile data
  const [profileData, setProfileData] = useState<ProfileData>({
    descriptor: isOwnProfile ? currentUser?.descriptor || '' : route?.params?.descriptor || '',
  });
  
  // Photo viewer states
  const [photoViewerVisible, setPhotoViewerVisible] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  
  // NEW: Note user state
  const [notedUsers, setNotedUsers] = useState<{[userId: string]: NotedUser}>({});
  const [notingUser, setNotingUser] = useState(false);
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.95)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const activityFadeAnim = useRef(new Animated.Value(0)).current; // NEW: For social proof

  useEffect(() => {
    // Entry animations
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
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
    
    // Floating animation
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
    
    // Badge pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    ).start();
    
    loadProfile();
    loadNotedStatus();
  }, [viewingUserId]);

  // NEW: Animate social proof when it appears
  useEffect(() => {
    if (profileData.recent_activity && 
        (profileData.recent_activity.notes_today > 0 || profileData.recent_activity.views_today > 0)) {
      Animated.timing(activityFadeAnim, {
        toValue: 1,
        duration: 600,
        delay: 500,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }).start();
    }
  }, [profileData.recent_activity]);

  // NEW: Listen for profile view events (only for own profile)
  useEffect(() => {
    if (isOwnProfile) {
      const handleProfileView = (data: any) => {
        console.log('Profile view event received:', data);
        
        // Update view counter in real-time
        setProfileData(prev => ({
          ...prev,
          recent_activity: {
            ...prev.recent_activity,
            notes_today: prev.recent_activity?.notes_today || 0,
            views_today: (prev.recent_activity?.views_today || 0) + 1,
            last_view_time: Date.now()
          }
        }));
        
        // Trigger animation to highlight the update
        Animated.sequence([
          Animated.timing(activityFadeAnim, {
            toValue: 1.2,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(activityFadeAnim, {
            toValue: 1,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
      };
      
      // Register listener
      websocketService.on('profile_view', handleProfileView);
      
      // Cleanup
      return () => {
        websocketService.off('profile_view', handleProfileView);
      };
    }
  }, [isOwnProfile]);

  // NEW: Send profile view event when viewing someone else's profile
  useEffect(() => {
    // When viewing someone else's profile, send the event
    if (!isOwnProfile && viewingUserId && profileData.user_id) {
      // Small delay to avoid spam
      const timer = setTimeout(() => {
        websocketService.send({
          type: 'profile_view',
          viewed_user_id: viewingUserId,
          timestamp: Date.now()
        });
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [isOwnProfile, viewingUserId, profileData.user_id]);

  // NEW: Load noted status
  const loadNotedStatus = async () => {
    try {
      const savedNotes = await AsyncStorage.getItem('notedUsers');
      if (savedNotes) {
        setNotedUsers(JSON.parse(savedNotes));
      }
    } catch (error) {
      console.error('Failed to load noted status:', error);
    }
  };

  const loadProfile = async () => {
    try {
      setLoading(true);
      
      if (isOwnProfile) {
        // Carica il proprio profilo
        
        // Prima carica da cache locale per risposta immediata
        const cachedProfile = await AsyncStorage.getItem('userProfile');
        if (cachedProfile) {
          const cached: ProfileData = JSON.parse(cachedProfile);
          setProfileData(prev => ({ ...prev, ...cached }));
        }
        
        // Poi aggiorna dal server
        const serverProfile = await apiService.getUserProfile(currentUser?.user_id || '');
        if (!serverProfile.error) {
          setProfileData(serverProfile);
          // Aggiorna cache
          await AsyncStorage.setItem('userProfile', JSON.stringify(serverProfile));
        }
      } else {
        // Carica profilo di altro utente (solo dal server)
        const otherProfile = await apiService.getUserProfile(viewingUserId);
        if (!otherProfile.error) {
          setProfileData(otherProfile);
        } else {
          Alert.alert('Error', 'Failed to load user profile');
          navigation.goBack();
        }
      }
      
    } catch (error) {
      console.error('Failed to load profile:', error);
      if (!isOwnProfile) {
        navigation.goBack();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      // Prepara i dati da salvare
      const updateData = {
        descriptor: profileData.descriptor,
        age: profileData.age,
        height: profileData.height,
        last_trip: profileData.last_trip,
        todays_song: profileData.todays_song,
        languages: profileData.languages,
        bio: profileData.bio,
        // photos gestite separatamente con upload
      };
      
      // Salva sul server
      const result = await apiService.updateUserProfile(updateData);
      
      if (!result.error) {
        // Aggiorna cache locale
        await AsyncStorage.setItem('userProfile', JSON.stringify(profileData));
        
        // Aggiorna descriptor se cambiato
        if (profileData.descriptor !== currentUser?.descriptor) {
          await AsyncStorage.setItem('userDescriptor', profileData.descriptor || '');
        }
        
        setIsEditing(false);
        Alert.alert('Success', 'Profile updated! ✨');
      } else {
        Alert.alert('Error', result.detail || 'Failed to save profile');
      }
      
    } catch (error) {
      console.error('Failed to save profile:', error);
      Alert.alert('Error', 'Failed to save profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              
              // Disconnect websocket
              websocketService.disconnect();
              
              // Clear Redux state
              dispatch(logout());
              dispatch(clearMoments());
              dispatch(clearNotifications());
              dispatch(clearConversations());
              
              // Clear SOLO i dati di sessione, NON il profilo
              await AsyncStorage.multiRemove([
                'userToken',
                'userId',
                'authToken',
                'notedUsers',
                'cached_moments',
                'cached_moments_expiry',
                // NON rimuovere 'userProfile' e 'userDescriptor'
              ]);
              
              // Reset navigation
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{ name: 'Onboarding' }],
                })
              );
            } catch (error) {
              console.error('Sign out error:', error);
              Alert.alert('Error', 'Failed to sign out. Please try again.');
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const pickImage = async (index: number) => {
    if (!isOwnProfile || !isEditing) return;
    
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your photos');
      return;
    }
    
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    
    if (!result.canceled && result.assets[0]) {
      try {
        // Create form data
        const formData = new FormData();
        formData.append('file', {
          uri: result.assets[0].uri,
          type: 'image/jpeg',
          name: 'photo.jpg'
        } as any);
        
        const uploadResult = await apiService.uploadProfilePhoto(formData, index);
        
        if (!uploadResult.error) {
          // Update local state
          const newPhotos = [...(profileData.photos || [])];
          newPhotos[index] = uploadResult.photo_url;
          setProfileData(prev => ({ ...prev, photos: newPhotos }));
        }
      } catch (error) {
        console.error('Failed to upload photo:', error);
        Alert.alert('Error', 'Failed to upload photo');
      }
    }
  };

  const removePhoto = (index: number) => {
    if (!isOwnProfile || !isEditing) return;
    
    Alert.alert(
      'Remove Photo',
      'Are you sure you want to remove this photo?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await apiService.removeProfilePhoto(index);
              if (!result.error) {
                const newPhotos = [...(profileData.photos || [])];
                newPhotos.splice(index, 1);
                setProfileData(prev => ({ ...prev, photos: newPhotos }));
              }
            } catch (error) {
              console.error('Failed to remove photo:', error);
            }
          }
        }
      ]
    );
  };

  // Handle YouTube search for song - FREE & SIMPLE!
  const handleYouTubePress = () => {
    if (!profileData.todays_song) return;
    
    // Create YouTube search URL
    // User writes "Song Name - Artist" and we search it on YouTube
    const searchQuery = encodeURIComponent(profileData.todays_song);
    const youtubeUrl = `https://www.youtube.com/results?search_query=${searchQuery}`;
    
    // Opens in YouTube app if installed, otherwise in browser
    Linking.openURL(youtubeUrl);
  };

  // NEW: Handle note user (same logic as DiscoverScreen)
  const handleNoteUser = async () => {
    if (!profileData.user_id || notedUsers[profileData.user_id]?.sent || notingUser) return;
    
    try {
      setNotingUser(true);
      
      // Optimistic update
      setNotedUsers(prev => ({
        ...prev,
        [profileData.user_id!]: {
          ...prev[profileData.user_id!],
          sent: true,
          timestamp: Date.now()
        }
      }));

      const result = await apiService.sendNote(profileData.user_id, {
        timestamp: Date.now()
      });
      
      if (!result.error) {
        // Update state with result
        setNotedUsers(prev => {
          const currentUserNotes = prev[profileData.user_id!] || { sent: false, received: false, mutual: false, timestamp: 0 };
          const isMutual = result.is_mutual || (currentUserNotes.received && currentUserNotes.sent);
          
          const updatedNotes = {
            ...prev,
            [profileData.user_id!]: { 
              sent: true, 
              received: currentUserNotes.received || false,
              mutual: isMutual,
              timestamp: Date.now() 
            }
          };
          
          // Save persistently
          AsyncStorage.setItem('notedUsers', JSON.stringify(updatedNotes)).catch(err =>
            console.error('Failed to save noted users:', err)
          );
          
          return updatedNotes;
        });
        
        Alert.alert(
          'Noted! ⭐',
          `You noted ${profileData.descriptor}. If they note you back, you'll match!`,
          [{ text: 'OK' }]
        );
      } else {
        // Rollback on error
        setNotedUsers(prev => {
          const currentNotes = prev[profileData.user_id!] || { sent: false, received: false, mutual: false, timestamp: 0 };
          return {
            ...prev,
            [profileData.user_id!]: { ...currentNotes, sent: false }
          };
        });
        
        Alert.alert('Error', 'Failed to send note. Please try again.');
      }
    } catch (error) {
      console.error('Note failed:', error);
      
      // Rollback
      setNotedUsers(prev => {
        const currentNotes = prev[profileData.user_id!] || { sent: false, received: false, mutual: false, timestamp: 0 };
        return {
          ...prev,
          [profileData.user_id!]: { ...currentNotes, sent: false }
        };
      });
      
      Alert.alert('Error', 'Network error. Please try again.');
    } finally {
      setNotingUser(false);
    }
  };

  // Funzioni helper
  const getInitial = () => {
    return (profileData.descriptor || 'N').charAt(0).toUpperCase();
  };

  const getAvatarGradient = () => {
    return getUserGradient(profileData.descriptor || 'Notamy');
  };

  const renderLanguageTags = () => {
    const langs = profileData.languages || [];
    if (langs.length === 0) return <Text style={styles.fieldValue}>Not specified</Text>;
    
    return (
      <View style={styles.languageTags}>
        {langs.map((lang, index) => (
          <LinearGradient
            key={index}
            colors={GRADIENTS.primary.colors}
            style={styles.languageTag}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Text style={styles.languageTagText}>{lang}</Text>
          </LinearGradient>
        ))}
      </View>
    );
  };

  // Helper to format time ago
  const formatTimeAgo = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return 'today';
  };

  // Photo Viewer Component
  const PhotoViewer = () => {
    const photos = profileData.photos || [];
    const translateX = useRef(new Animated.Value(0)).current;
    const [currentIndex, setCurrentIndex] = useState(selectedPhotoIndex);

    useEffect(() => {
      setCurrentIndex(selectedPhotoIndex);
    }, [selectedPhotoIndex]);

    // Gesture handler per swipe tra foto
    const panResponder = useRef(
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) => {
          return Math.abs(gestureState.dx) > 20;
        },
        onPanResponderMove: Animated.event(
          [null, { dx: translateX }],
          { useNativeDriver: true }
        ),
        onPanResponderRelease: (_, gestureState) => {
          const { dx, vx } = gestureState;
          
          if (dx > 100 || vx > 0.5) {
            // Swipe right - previous photo
            if (currentIndex > 0) {
              Animated.spring(translateX, {
                toValue: width,
                useNativeDriver: true,
              }).start(() => {
                setCurrentIndex(currentIndex - 1);
                translateX.setValue(0);
              });
            } else {
              // Bounce back
              Animated.spring(translateX, {
                toValue: 0,
                useNativeDriver: true,
              }).start();
            }
          } else if (dx < -100 || vx < -0.5) {
            // Swipe left - next photo
            if (currentIndex < photos.length - 1) {
              Animated.spring(translateX, {
                toValue: -width,
                useNativeDriver: true,
              }).start(() => {
                setCurrentIndex(currentIndex + 1);
                translateX.setValue(0);
              });
            } else {
              // Bounce back
              Animated.spring(translateX, {
                toValue: 0,
                useNativeDriver: true,
              }).start();
            }
          } else {
            // Return to center
            Animated.spring(translateX, {
              toValue: 0,
              useNativeDriver: true,
            }).start();
          }
        },
      })
    ).current;

    return (
      <Modal
        visible={photoViewerVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setPhotoViewerVisible(false)}
      >
        <View style={styles.photoViewerContainer}>
          {/* Background overlay */}
          <TouchableOpacity 
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setPhotoViewerVisible(false)}
          >
            <View style={styles.photoViewerOverlay} />
          </TouchableOpacity>

          {/* Close button */}
          <SafeAreaView style={styles.photoViewerHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setPhotoViewerVisible(false)}
            >
              <Ionicons name="close" size={30} color="white" />
            </TouchableOpacity>
            
            {/* Photo counter */}
            <View style={styles.photoCounter}>
              <Text style={styles.photoCounterText}>
                {currentIndex + 1} / {photos.length}
              </Text>
            </View>
          </SafeAreaView>

          {/* Photo display with swipe */}
          <Animated.View
            style={[
              styles.photoViewerContent,
              {
                transform: [{ translateX }],
              },
            ]}
            {...panResponder.panHandlers}
          >
            <Image
              source={{ uri: photos[currentIndex] }}
              style={styles.fullScreenPhoto}
              resizeMode="contain"
            />
          </Animated.View>

          {/* Dot indicators */}
          <View style={styles.photoIndicators}>
            {photos.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.photoDot,
                  index === currentIndex && styles.photoDotActive,
                ]}
              />
            ))}
          </View>
        </View>
      </Modal>
    );
  };

  if (loading && !profileData.descriptor) {
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

  const isUserNoted = profileData.user_id ? notedUsers[profileData.user_id]?.sent : false;

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={GRADIENTS.dark.colors}
        style={StyleSheet.absoluteFillObject}
      />
      
      {/* Floating elements */}
      <Animated.View
        style={[
          styles.floatingOrb1,
          {
            transform: [
              {
                translateY: floatAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -30],
                }),
              },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.floatingOrb2,
          {
            transform: [
              {
                translateY: floatAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 20],
                }),
              },
            ],
          },
        ]}
      />
      
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContent}
          >
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
              {/* Back button se non è il proprio profilo */}
              {!isOwnProfile && (
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => navigation.goBack()}
                  activeOpacity={0.8}
                >
                  <Ionicons name="arrow-back" size={24} color={theme.colors.textPrimary} />
                </TouchableOpacity>
              )}
              
              <Text style={[styles.title, !isOwnProfile && styles.titleCentered]}>
                {isOwnProfile ? 'Profile' : profileData.descriptor}
              </Text>
              
              {/* Edit button solo per proprio profilo */}
              {isOwnProfile && (
                <TouchableOpacity
                  style={[
                    styles.editButton,
                    isEditing && styles.editButtonActive,
                  ]}
                  onPress={() => isEditing ? handleSave() : setIsEditing(true)}
                  activeOpacity={0.8}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color={isEditing ? theme.colors.black : theme.colors.primary} />
                  ) : isEditing ? (
                    <LinearGradient
                      colors={GRADIENTS.primary.colors}
                      style={styles.editButtonGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                    >
                      <Text style={styles.editButtonTextActive}>Save</Text>
                    </LinearGradient>
                  ) : (
                    <Text style={styles.editButtonText}>Edit</Text>
                  )}
                </TouchableOpacity>
              )}
            </Animated.View>

            {/* Avatar Section */}
            <Animated.View
              style={[
                styles.avatarSection,
                {
                  opacity: fadeAnim,
                  transform: [{ scale: scaleAnim }],
                },
              ]}
            >
              <View style={styles.avatarContainer}>
                <View style={styles.avatarWrapper}>
                  <LinearGradient
                    colors={getAvatarGradient()}
                    style={styles.avatarGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={styles.avatarInner}>
                      <Text style={styles.avatarText}>{getInitial()}</Text>
                    </View>
                  </LinearGradient>
                </View>
                {isOwnProfile && isEditing && (
                  <TouchableOpacity
                    style={styles.avatarEditIcon}
                    activeOpacity={0.8}
                  >
                    <LinearGradient
                      colors={GRADIENTS.primary.colors}
                      style={styles.avatarEditIconGradient}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                    >
                      <Ionicons name="camera" size={16} color={theme.colors.black} />
                    </LinearGradient>
                  </TouchableOpacity>
                )}
              </View>

              {isOwnProfile && isEditing ? (
                <TextInput
                  style={styles.descriptorInput}
                  value={profileData.descriptor}
                  onChangeText={(text) => setProfileData(prev => ({ ...prev, descriptor: text }))}
                  placeholder="Your vibe..."
                  placeholderTextColor={theme.colors.textMuted}
                  maxLength={20}
                />
              ) : (
                <Text style={styles.descriptor}>{profileData.descriptor}</Text>
              )}

              {/* Badges */}
              {profileData.badges && profileData.badges.length > 0 && (
                <View style={styles.badgeRow}>
                  {profileData.badges.map((badge, index) => (
                    <Animated.View
                      key={badge.id}
                      style={[
                        styles.badge,
                        index === 0 && {
                          transform: [{ scale: pulseAnim }],
                        },
                      ]}
                    >
                      <Text style={styles.badgeIcon}>{badge.icon}</Text>
                      <Text style={styles.badgeText}>{badge.name}</Text>
                    </Animated.View>
                  ))}
                </View>
              )}
            </Animated.View>

            {/* Stats Section */}
            {profileData.stats && (
              <Animated.View
                style={[
                  styles.statsContainer,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                  },
                ]}
              >
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>{profileData.stats.moments}</Text>
                  <Text style={styles.statLabel}>Moments</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>{profileData.stats.mutuals}</Text>
                  <Text style={styles.statLabel}>Mutuals</Text>
                </View>
                <View style={styles.statCard}>
                  <Text style={styles.statNumber}>{profileData.stats.stars}</Text>
                  <Text style={styles.statLabel}>Stars</Text>
                </View>
              </Animated.View>
            )}

            {/* NEW: Updated Social Proof Section with Views */}
            {isOwnProfile && profileData.recent_activity && 
             (profileData.recent_activity.notes_today > 0 || profileData.recent_activity.views_today > 0) && (
              <Animated.View
                style={[
                  styles.socialProofContainer,
                  {
                    opacity: activityFadeAnim,
                    transform: [{
                      translateY: activityFadeAnim.interpolate({
                        inputRange: [0, 1],
                        outputRange: [20, 0],
                      }),
                    }],
                  },
                ]}
              >
                <LinearGradient
                  colors={['rgba(147, 51, 234, 0.1)', 'rgba(225, 29, 72, 0.1)']}
                  style={styles.socialProofGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <View style={styles.socialProofContent}>
                    <Text style={styles.socialProofEmoji}>🌟</Text>
                    <View style={styles.socialProofText}>
                      {profileData.recent_activity.notes_today > 0 && (
                        <Text style={styles.socialProofMain}>
                          {profileData.recent_activity.notes_today} {profileData.recent_activity.notes_today === 1 ? 'person' : 'people'} noticed you today
                        </Text>
                      )}
                      {profileData.recent_activity.views_today > 0 && (
                        <Text style={[
                          styles.socialProofMain,
                          profileData.recent_activity.notes_today > 0 && styles.socialProofSecondary
                        ]}>
                          {profileData.recent_activity.views_today} profile {profileData.recent_activity.views_today === 1 ? 'view' : 'views'} today
                        </Text>
                      )}
                      {(profileData.recent_activity.last_note_time || profileData.recent_activity.last_view_time) && (
                        <Text style={styles.socialProofTime}>
                          Last activity {formatTimeAgo(
                            Math.max(
                              profileData.recent_activity.last_note_time || 0,
                              profileData.recent_activity.last_view_time || 0
                            )
                          )}
                        </Text>
                      )}
                    </View>
                  </View>
                </LinearGradient>
              </Animated.View>
            )}

            {/* NEW: Note User Button for other profiles */}
            {!isOwnProfile && (
              <Animated.View
                style={[
                  styles.profileActions,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                  },
                ]}
              >
                <TouchableOpacity
                  style={[
                    styles.noteButton,
                    isUserNoted && styles.noteButtonDisabled,
                  ]}
                  onPress={handleNoteUser}
                  disabled={isUserNoted || notingUser}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={isUserNoted ? [theme.colors.blackSurface, theme.colors.blackSurface] : GRADIENTS.secondary.colors}
                    style={styles.noteButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    {notingUser ? (
                      <ActivityIndicator size="small" color={theme.colors.textPrimary} />
                    ) : (
                      <>
                        <Ionicons 
                          name={isUserNoted ? "star" : "star-outline"} 
                          size={20} 
                          color={isUserNoted ? theme.colors.textSecondary : theme.colors.black} 
                        />
                        <Text style={[
                          styles.noteButtonText,
                          isUserNoted && styles.noteButtonTextDisabled,
                        ]}>
                          {isUserNoted ? 'Noted' : 'Note User'}
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* Photos Section */}
            <Animated.View
              style={[
                styles.section,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <Text style={styles.sectionTitle}>Photos</Text>
              <View style={styles.photosGrid}>
                {[0, 1, 2].map((index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.photoSlot}
                    onPress={() => {
                      if (isOwnProfile && isEditing) {
                        pickImage(index);
                      } else if (profileData.photos?.[index]) {
                        // View photo fullscreen
                        setSelectedPhotoIndex(index);
                        setPhotoViewerVisible(true);
                      }
                    }}
                    onLongPress={() => profileData.photos?.[index] && isOwnProfile && removePhoto(index)}
                    activeOpacity={0.8}
                    disabled={!isOwnProfile && !profileData.photos?.[index]}
                  >
                    {profileData.photos?.[index] ? (
                      <>
                        <Image
                          source={{ uri: profileData.photos[index] }}
                          style={styles.photo}
                        />
                        {isOwnProfile && isEditing && (
                          <View style={styles.photoOverlay}>
                            <Ionicons name="camera" size={20} color="white" />
                          </View>
                        )}
                        {/* Tap indicator when not editing */}
                        {!isEditing && (
                          <View style={styles.photoTapIndicator}>
                            <Ionicons name="expand" size={16} color="white" />
                          </View>
                        )}
                      </>
                    ) : (
                      <View style={styles.emptyPhoto}>
                        {isOwnProfile && isEditing ? (
                          <>
                            <Ionicons name="add-circle-outline" size={32} color={theme.colors.textMuted} />
                            <Text style={styles.addPhotoText}>Add</Text>
                          </>
                        ) : (
                          <Ionicons name="image-outline" size={24} color={theme.colors.textMuted} />
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.View>

            {/* Info Section */}
            <Animated.View
              style={[
                styles.section,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideAnim }],
                },
              ]}
            >
              <Text style={styles.sectionTitle}>About {isOwnProfile ? 'Me' : ''}</Text>

              {/* Bio Card */}
              {(profileData.bio || (isOwnProfile && isEditing)) && (
                <View style={styles.infoCard}>
                  <View style={styles.infoField}>
                    <Text style={styles.fieldLabel}>Bio</Text>
                    {isOwnProfile && isEditing ? (
                      <TextInput
                        style={[styles.fieldInput, styles.bioInput]}
                        value={profileData.bio || ''}
                        onChangeText={(text) => setProfileData(prev => ({ ...prev, bio: text }))}
                        placeholder="Tell us about yourself..."
                        placeholderTextColor={theme.colors.textMuted}
                        multiline
                        numberOfLines={3}
                        maxLength={150}
                      />
                    ) : (
                      <Text style={styles.fieldValue}>
                        {profileData.bio || 'No bio yet'}
                      </Text>
                    )}
                  </View>
                </View>
              )}

              {/* Age & Height Card */}
              {((profileData.age || profileData.height) || (isOwnProfile && isEditing)) && (
                <View style={styles.infoCard}>
                  <View style={styles.infoRow}>
                    <View style={styles.infoField}>
                      <Text style={styles.fieldLabel}>Age</Text>
                      {isOwnProfile && isEditing ? (
                        <TextInput
                          style={styles.fieldInput}
                          value={profileData.age?.toString() || ''}
                          onChangeText={(text) => setProfileData(prev => ({ 
                            ...prev, 
                            age: text ? parseInt(text) : undefined 
                          }))}
                          placeholder="--"
                          placeholderTextColor={theme.colors.textMuted}
                          keyboardType="numeric"
                          maxLength={2}
                        />
                      ) : (
                        <Text style={styles.fieldValue}>{profileData.age || '--'}</Text>
                      )}
                    </View>
                    
                    <View style={styles.infoField}>
                      <Text style={styles.fieldLabel}>Height</Text>
                      {isOwnProfile && isEditing ? (
                        <View style={styles.heightInput}>
                          <TextInput
                            style={styles.fieldInput}
                            value={profileData.height?.toString() || ''}
                            onChangeText={(text) => setProfileData(prev => ({ 
                              ...prev, 
                              height: text ? parseInt(text) : undefined 
                            }))}
                            placeholder="--"
                            placeholderTextColor={theme.colors.textMuted}
                            keyboardType="numeric"
                            maxLength={3}
                          />
                          <Text style={styles.heightUnit}>cm</Text>
                        </View>
                      ) : (
                        <Text style={styles.fieldValue}>
                          {profileData.height ? `${profileData.height} cm` : '--'}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              )}

              {/* Last Trip Card */}
              {(profileData.last_trip || (isOwnProfile && isEditing)) && (
                <View style={styles.infoCard}>
                  <View style={styles.infoField}>
                    <Text style={styles.fieldLabel}>Last Adventure</Text>
                    {isOwnProfile && isEditing ? (
                      <TextInput
                        style={[styles.fieldInput, styles.fullWidthInput]}
                        value={profileData.last_trip || ''}
                        onChangeText={(text) => setProfileData(prev => ({ ...prev, last_trip: text }))}
                        placeholder="Where did you go?"
                        placeholderTextColor={theme.colors.textMuted}
                        maxLength={30}
                      />
                    ) : (
                      <Text style={styles.fieldValue}>
                        {profileData.last_trip ? `${profileData.last_trip} 🌍` : 'No trips yet'}
                      </Text>
                    )}
                  </View>
                </View>
              )}

              {/* Today's Song Card */}
              {(profileData.todays_song || (isOwnProfile && isEditing)) && (
                <View style={styles.infoCard}>
                  <View style={styles.infoField}>
                    <Text style={styles.fieldLabel}>Today's Song</Text>
                    {isOwnProfile && isEditing ? (
                      <TextInput
                        style={[styles.fieldInput, styles.fullWidthInput]}
                        value={profileData.todays_song || ''}
                        onChangeText={(text) => setProfileData(prev => ({ ...prev, todays_song: text }))}
                        placeholder="What's playing today?"
                        placeholderTextColor={theme.colors.textMuted}
                        maxLength={50}
                      />
                    ) : (
                      <TouchableOpacity
                        onPress={profileData.todays_song ? handleYouTubePress : undefined}
                        disabled={!profileData.todays_song}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          styles.fieldValue,
                          profileData.todays_song && styles.clickableSong
                        ]}>
                          {profileData.todays_song ? `🎵 ${profileData.todays_song}` : 'No song today'}
                          {profileData.todays_song && (
                            <Text style={styles.youtubeIcon}> ▶</Text>
                          )}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}

              {/* Languages Card */}
              {((profileData.languages && profileData.languages.length > 0) || (isOwnProfile && isEditing)) && (
                <View style={styles.infoCard}>
                  <View style={styles.infoField}>
                    <Text style={styles.fieldLabel}>Languages</Text>
                    {isOwnProfile && isEditing ? (
                      <TextInput
                        style={[styles.fieldInput, styles.fullWidthInput]}
                        value={profileData.languages?.join(', ') || ''}
                        onChangeText={(text) => setProfileData(prev => ({ 
                          ...prev, 
                          languages: text.split(',').map(l => l.trim()).filter(Boolean)
                        }))}
                        placeholder="English, Spanish..."
                        placeholderTextColor={theme.colors.textMuted}
                        maxLength={50}
                      />
                    ) : (
                      renderLanguageTags()
                    )}
                  </View>
                </View>
              )}
            </Animated.View>

            {/* Action Buttons - Solo per proprio profilo */}
            {isOwnProfile && (
              <Animated.View
                style={[
                  styles.actions,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={() => Linking.openURL('https://notamy.app/terms')}
                  activeOpacity={0.8}
                >
                  <View style={styles.actionButtonContent}>
                    <Ionicons name="document-text-outline" size={20} color={theme.colors.textSecondary} />
                    <Text style={styles.actionButtonText}>Terms and Conditions</Text>
                    <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
                  </View>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.actionButton}
                  onPress={handleSignOut}
                  activeOpacity={0.8}
                >
                  <View style={styles.actionButtonContent}>
                    <Ionicons name="log-out-outline" size={20} color={theme.colors.error} />
                    <Text style={[styles.actionButtonText, styles.signOutText]}>Sign Out</Text>
                    <Ionicons name="chevron-forward" size={20} color={theme.colors.textMuted} />
                  </View>
                </TouchableOpacity>
              </Animated.View>
            )}

            {/* Chat button per profili altrui con mutual */}
            {!isOwnProfile && notedUsers[profileData.user_id || '']?.mutual && (
              <Animated.View
                style={[
                  styles.actions,
                  {
                    opacity: fadeAnim,
                    transform: [{ translateY: slideAnim }],
                  },
                ]}
              >
                <TouchableOpacity
                  style={styles.chatButton}
                  onPress={() => {
                    navigation.navigate('Chat', {
                      recipientId: profileData.user_id,
                      recipientDescriptor: profileData.descriptor,
                    });
                  }}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={GRADIENTS.primary.colors}
                    style={styles.chatButtonGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                  >
                    <Ionicons name="chatbubble-outline" size={20} color={theme.colors.black} />
                    <Text style={styles.chatButtonText}>Start Chat</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </Animated.View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>

      {/* Photo Viewer */}
      <PhotoViewer />
    </View>
  );
}

const styles = StyleSheet.create({
  // Base containers
  container: sharedStyles.container,
  loadingContainer: sharedStyles.loadingContainer,
  safeArea: sharedStyles.safeArea,
  keyboardView: sharedStyles.keyboardView,
  scrollContent: sharedStyles.scrollContent,
  
  // Floating orbs
  floatingOrb1: {
    position: 'absolute',
    top: '10%',
    right: '-30%',
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width * 0.4,
    backgroundColor: theme.colors.primaryLight,
    opacity: 0.03,
  },
  floatingOrb2: {
    position: 'absolute',
    bottom: '20%',
    left: '-40%',
    width: width * 0.6,
    height: width * 0.6,
    borderRadius: width * 0.3,
    backgroundColor: theme.colors.secondary,
    opacity: 0.02,
  },
  
  // Header
  header: {
    ...sharedStyles.screenHeader,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.md,
  },
  title: {
    ...sharedStyles.screenTitle,
    flex: 1,
  },
  titleCentered: {
    textAlign: 'center',
    marginRight: 40, // Per bilanciare il back button
  },
  backButton: sharedStyles.backButton,
  editButton: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.borderRadius.pill,
    backgroundColor: theme.colors.blackElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  editButtonActive: {
    padding: 0,
    borderWidth: 0,
  },
  editButtonGradient: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
  },
  editButtonText: {
    fontSize: theme.typography.fontSize.body,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.primary,
  },
  editButtonTextActive: {
    fontSize: theme.typography.fontSize.body,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.black,
  },
  
  // Avatar Section
  avatarSection: {
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: theme.spacing.lg,
  },
  avatarWrapper: {
    ...getAvatarStyle('huge'),
    padding: 3,
  },
  avatarGradient: {
    width: '100%',
    height: '100%',
    borderRadius: 60,
    padding: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInner: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: theme.colors.black,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  avatarText: getAvatarTextStyle('huge'),
  avatarEditIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderRadius: 18,
    overflow: 'hidden',
  },
  avatarEditIconGradient: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  descriptor: {
    fontSize: theme.typography.fontSize.title,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
    letterSpacing: -0.5,
  },
  descriptorInput: {
    fontSize: theme.typography.fontSize.title,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.md,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.primary,
    paddingVertical: theme.spacing.xs,
    paddingHorizontal: theme.spacing.lg,
    minWidth: 150,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  badge: sharedStyles.badge,
  badgeIcon: {
    fontSize: 16,
  },
  badgeText: sharedStyles.badgeText,
  
  // Stats
  statsContainer: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
    paddingHorizontal: theme.spacing.xl,
    marginBottom: theme.spacing.xl,
  },
  statCard: {
    flex: 1,
    backgroundColor: theme.colors.blackElevated,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 28,
    fontWeight: '300',
    color: theme.colors.primary,
    marginBottom: theme.spacing.xxs,
  },
  statLabel: {
    fontSize: theme.typography.fontSize.micro,
    color: theme.colors.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  
  // NEW: Social Proof
  socialProofContainer: {
    paddingHorizontal: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
  },
  socialProofGradient: {
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(147, 51, 234, 0.2)',
  },
  socialProofContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    gap: theme.spacing.sm,
  },
  socialProofEmoji: {
    fontSize: 20,
  },
  socialProofText: {
    flex: 1,
  },
  socialProofMain: {
    fontSize: theme.typography.fontSize.body,
    color: theme.colors.textPrimary,
    fontWeight: theme.typography.fontWeight.medium,
  },
  socialProofSecondary: {
    fontSize: theme.typography.fontSize.caption,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  socialProofTime: {
    fontSize: theme.typography.fontSize.caption,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  
  // NEW: Profile Actions
  profileActions: {
    paddingHorizontal: theme.spacing.xl,
    marginBottom: theme.spacing.lg,
  },
  noteButton: {
    borderRadius: theme.borderRadius.pill,
    overflow: 'hidden',
  },
  noteButtonDisabled: {
    opacity: 0.7,
  },
  noteButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xl,
  },
  noteButtonText: {
    fontSize: theme.typography.fontSize.body,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.black,
  },
  noteButtonTextDisabled: {
    color: theme.colors.textSecondary,
  },
  
  // Photos
  photosGrid: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  photoSlot: {
    width: PHOTO_SIZE,
    height: PHOTO_SIZE,
    borderRadius: theme.borderRadius.lg,
    overflow: 'hidden',
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  photoOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPhoto: {
    width: '100%',
    height: '100%',
    backgroundColor: theme.colors.blackElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xxs,
  },
  addPhotoText: {
    fontSize: theme.typography.fontSize.micro,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
  },
  
  // Photo tap indicator
  photoTapIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.8,
  },
  
  // Info Cards
  infoCard: {
    ...sharedStyles.card,
    marginBottom: theme.spacing.sm,
  },
  infoRow: {
    flexDirection: 'row',
    gap: theme.spacing.lg,
  },
  infoField: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: theme.typography.fontSize.micro,
    color: theme.colors.textTertiary,
    marginBottom: theme.spacing.xs,
    letterSpacing: theme.typography.letterSpacing.wider,
    textTransform: 'uppercase',
  },
  fieldValue: {
    fontSize: theme.typography.fontSize.body,
    color: theme.colors.textPrimary,
    fontWeight: theme.typography.fontWeight.medium,
  },
  fieldInput: {
    fontSize: theme.typography.fontSize.body,
    color: theme.colors.textPrimary,
    fontWeight: theme.typography.fontWeight.medium,
    backgroundColor: 'transparent',
    borderWidth: 0,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.primary,
    borderRadius: 0,
    paddingHorizontal: 0,
    minHeight: 'auto',
    paddingVertical: theme.spacing.xs,
  },
  bioInput: {
    minHeight: 60,
    textAlignVertical: 'top',
  },
  fullWidthInput: {
    width: '100%',
  },
  heightInput: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: theme.spacing.xs,
  },
  heightUnit: {
    fontSize: theme.typography.fontSize.caption,
    color: theme.colors.textSecondary,
  },
  
  // YouTube clickable song styles
  clickableSong: {
    color: theme.colors.primary,
    textDecorationLine: 'underline',
  },
  youtubeIcon: {
    color: '#FF0000', // YouTube red
    fontSize: 14,
  },
  
  // Language Tags
  languageTags: {
    flexDirection: 'row',
    gap: theme.spacing.xs,
    flexWrap: 'wrap',
  },
  languageTag: {
    paddingHorizontal: theme.spacing.sm,
    paddingVertical: theme.spacing.xxs,
    borderRadius: theme.borderRadius.sm,
  },
  languageTagText: {
    fontSize: theme.typography.fontSize.caption,
    color: theme.colors.black,
    fontWeight: theme.typography.fontWeight.semibold,
  },
  
  // Actions
  actions: {
    paddingHorizontal: theme.spacing.xl,
    gap: theme.spacing.xs,
    marginBottom: theme.spacing.xl,
  },
  actionButton: {
    ...sharedStyles.card,
    overflow: 'hidden',
  },
  actionButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.lg,
    gap: theme.spacing.md,
  },
  actionButtonText: {
    flex: 1,
    fontSize: theme.typography.fontSize.body,
    color: theme.colors.textPrimary,
  },
  signOutText: {
    color: theme.colors.error,
  },
  
  // Chat button
  chatButton: {
    borderRadius: theme.borderRadius.pill,
    overflow: 'hidden',
    marginHorizontal: theme.spacing.xl,
  },
  chatButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.lg,
  },
  chatButtonText: {
    fontSize: theme.typography.fontSize.body,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.black,
  },
  
  // Photo viewer styles
  photoViewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  photoViewerOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  photoViewerHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: theme.spacing.xl,
    paddingTop: theme.spacing.lg,
  },
  closeButton: sharedStyles.closeButton,
  photoCounter: {
    position: 'absolute',
    top: theme.spacing.lg,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  photoCounterText: {
    color: 'white',
    fontSize: theme.typography.fontSize.body,
    fontWeight: theme.typography.fontWeight.medium,
  },
  photoViewerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenPhoto: {
    width: width,
    height: '80%',
  },
  photoIndicators: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: theme.spacing.xs,
  },
  photoDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  photoDotActive: {
    backgroundColor: 'white',
  },
});