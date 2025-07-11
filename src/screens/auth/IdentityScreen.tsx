import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { theme, GRADIENTS } from '@/config/theme';
import apiService from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppDispatch } from '@/store';
import { setUser, setToken } from '@/store/slices/authSlice'; // ✅ Removed setAuthenticated
import websocketService from '@/services/websocket';
import firebaseAuthService from '@/services/firebase';
import * as Location from 'expo-location';
import { NavigationService } from '@/services/navigationService';

const { width, height } = Dimensions.get('window');

// Creative vibe generators
const vibeTemplates = {
  moods: ['Chaos', 'Zen', 'Social', 'Creative', 'Chill', 'Focused', 'Hyped', 'Curious'],
  activities: ['Mode', 'Vibes', 'Energy', 'Hours', 'Time', 'Life', 'Era', 'State'],
  prefixes: ['Seeking', 'Finding', 'Creating', 'Building', 'Chasing', 'Living', 'Being', 'Exploring'],
  suffixes: ['Adventure', 'Coffee', 'Friends', 'Ideas', 'Stories', 'Dreams', 'Magic', 'Wisdom'],
  creative: [
    'TouchingGrass', 'PlotTwistEnergy', 'MainCharacter', 'SideQuestMode',
    '404SocialSkills', 'NeedCoffeeASAP', 'LocalCryptid', 'DoomScrolling',
    'CreativeBlock', 'ProcrastinatingPro', 'NeedAdventure', 'TooManyTabs',
    'GoldenRetriever', 'CatPersonality', 'IntrovertMode', 'ExtrovertHours'
  ]
};

interface LocationCoords {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

export default function IdentityScreen() {
  const [descriptor, setDescriptor] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState<'checking' | 'granted' | 'denied'>('checking');
  const [isFocused, setIsFocused] = useState(false);
  
  // ONE-TIME entry animations only
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  
  // Pulse animations for radar
  const pulseAnim1 = useRef(new Animated.Value(0)).current;
  const pulseAnim2 = useRef(new Animated.Value(0)).current;
  const pulseAnim3 = useRef(new Animated.Value(0)).current;
  
  const isProcessing = useRef(false);
  const dispatch = useAppDispatch();

  useEffect(() => {
    // ONE-TIME entry animations - NO LOOPS
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(slideUpAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    // Minimal pulse animation for radar
    const createPulse = (anim: Animated.Value, delay: number) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(anim, {
              toValue: 1,
              duration: 2000,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
    };

    createPulse(pulseAnim1, 0).start();
    createPulse(pulseAnim2, 700).start();
    createPulse(pulseAnim3, 1400).start();

    checkLocationPermission();
  }, []);

  const checkLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationStatus(status === 'granted' ? 'granted' : 'denied');
      console.log('Location permission status:', status);
    } catch (error) {
      console.error('Error checking location permission:', error);
      setLocationStatus('denied');
    }
  };

  const getLocation = async (): Promise<LocationCoords | null> => {
    try {
      if (locationStatus !== 'granted') {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          Alert.alert(
            'Location Required',
            'Notamy needs your location to find people nearby. Please enable location access in settings.',
            [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Open Settings', onPress: () => Location.requestForegroundPermissionsAsync() }
            ]
          );
          return null;
        }
        setLocationStatus('granted');
      }

      console.log('Getting current location...');
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      console.log('Location obtained:', location.coords);
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || undefined,
      };
    } catch (error) {
      console.error('Error getting location:', error);
      
      Alert.alert(
        'Location Error',
        'Could not get your current location. Using approximate location.',
        [{ text: 'OK' }]
      );
      
      return null;
    }
  };

  const generateVibe = async () => {
    setIsGenerating(true);
    
    try {
      // TODO: Replace with actual Qwen API call
      // const response = await apiService.generateVibe();
      // setDescriptor(response.vibe);
      
      // For now, use creative local generation
      const random = Math.random();
      let vibe = '';
      
      if (random < 0.3) {
        // Mood + Activity format
        const mood = vibeTemplates.moods[Math.floor(Math.random() * vibeTemplates.moods.length)];
        const activity = vibeTemplates.activities[Math.floor(Math.random() * vibeTemplates.activities.length)];
        vibe = `${mood}${activity}`;
      } else if (random < 0.6) {
        // Prefix + Suffix format
        const prefix = vibeTemplates.prefixes[Math.floor(Math.random() * vibeTemplates.prefixes.length)];
        const suffix = vibeTemplates.suffixes[Math.floor(Math.random() * vibeTemplates.suffixes.length)];
        vibe = `${prefix}${suffix}`;
      } else {
        // Creative examples
        vibe = vibeTemplates.creative[Math.floor(Math.random() * vibeTemplates.creative.length)];
      }
      
      setDescriptor(vibe);
    } catch (error) {
      console.error('Failed to generate vibe:', error);
      // Fallback
      setDescriptor('CreativeMode' + Math.floor(Math.random() * 99));
    } finally {
      // Quick feedback
      setTimeout(() => setIsGenerating(false), 200);
    }
  };

  const handleContinue = async () => {
    if (descriptor.trim() && !isLoading && !isProcessing.current) {
      isProcessing.current = true;
      
      try {
        setIsLoading(true);
        
        const coords = await getLocation();
        const finalCoords = coords || {
          latitude: 0,
          longitude: 0,
        };
        
        console.log('Registering with location:', finalCoords);
        console.log('Registering anonymous user with vibe:', descriptor);
        
        const firebaseResult = await firebaseAuthService.registerAnonymousUser(
          descriptor.trim(),
          null, // ✅ No event_id needed
          finalCoords
        );
        
        console.log('Firebase registration successful:', firebaseResult);
        
        const serverResponse = await apiService.registerAnonymous({
          descriptor: descriptor.trim(),
          event_id: null, // ✅ Always null now
          location: finalCoords,
          firebase_uid: firebaseResult.uid,
          local_presence: 'unknown',
          mood: '',
          emoji: ''
        });
        
        console.log('Server registration response:', serverResponse);
        
        if (serverResponse && serverResponse.user_id && !serverResponse.error) {
          const userId = serverResponse.user_id;
          
          // Save to AsyncStorage
          await AsyncStorage.setItem('userId', userId);
          await AsyncStorage.setItem('userDescriptor', descriptor);
          await AsyncStorage.setItem('authToken', firebaseResult.token);
          
          // Update Redux store
          dispatch(setUser({
            id: userId,
            user_id: userId,
            descriptor: descriptor,
            badges: serverResponse.badges || [],
            location: finalCoords,
          }));

          dispatch(setToken(firebaseResult.token));
          // ✅ isAuthenticated is automatically set when user and token are present
          
          // Update location on server if available
          if (coords && coords.latitude !== 0 && coords.longitude !== 0) {
            try {
              await apiService.updateLocation(
                coords.latitude,
                coords.longitude,
                coords.accuracy
              );
              console.log('Initial location updated on server');
            } catch (error) {
              console.error('Failed to update initial location:', error);
              // Don't fail registration if location update fails
            }
          }
          
          console.log('Waiting for Redis sync before WebSocket connection...');
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          // Connect WebSocket
          try {
            await websocketService.connect(userId);
            console.log('WebSocket connected successfully');
          } catch (wsError) {
            console.error('WebSocket connection failed:', wsError);
          }
          
          console.log('Registration complete, navigating to main screen');
          
          // ✅ Use NavigationService for navigation
          NavigationService.resetToMain('Discover');
          
        } else {
          throw new Error(serverResponse.detail || 'Registration failed');
        }
        
      } catch (error: any) {
        console.error('Registration error:', error);
        Alert.alert(
          'Registration Failed',
          error.message || 'Unknown error occurred',
          [{ text: 'OK' }]
        );
      } finally {
        setIsLoading(false);
        isProcessing.current = false;
      }
    }
  };

  return (
    <View style={styles.container}>
      {/* Static gradient background */}
      <LinearGradient
        colors={GRADIENTS.dark.colors}
        style={StyleSheet.absoluteFillObject}
      />
      
      {/* Static gradient overlays - no animation */}
      <View style={styles.bgOverlay} />
      <View style={styles.gradientOrb1} />
      <View style={styles.gradientOrb2} />

      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView 
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.content}
        >
          <View style={styles.centerContent}>
            {/* Header with Pulse Radar */}
            <Animated.View 
              style={[
                styles.header,
                {
                  opacity: fadeAnim,
                  transform: [
                    { translateY: slideUpAnim },
                    { scale: scaleAnim },
                  ],
                }
              ]}
            >
              {/* Pulse Radar Icon */}
              <View style={styles.iconContainer}>
                <View style={styles.pulseRadar}>
                  {/* Center dot */}
                  <View style={styles.radarCenter} />
                  
                  {/* Pulse waves */}
                  <Animated.View 
                    style={[
                      styles.radarWave,
                      styles.radarWave1,
                      {
                        opacity: pulseAnim1.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.8, 0],
                        }),
                        transform: [{
                          scale: pulseAnim1.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.5, 1],
                          }),
                        }],
                      }
                    ]} 
                  />
                  <Animated.View 
                    style={[
                      styles.radarWave,
                      styles.radarWave2,
                      {
                        opacity: pulseAnim2.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.6, 0],
                        }),
                        transform: [{
                          scale: pulseAnim2.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.5, 1],
                          }),
                        }],
                      }
                    ]} 
                  />
                  <Animated.View 
                    style={[
                      styles.radarWave,
                      styles.radarWave3,
                      {
                        opacity: pulseAnim3.interpolate({
                          inputRange: [0, 1],
                          outputRange: [0.4, 0],
                        }),
                        transform: [{
                          scale: pulseAnim3.interpolate({
                            inputRange: [0, 1],
                            outputRange: [0.5, 1],
                          }),
                        }],
                      }
                    ]} 
                  />
                  
                  {/* Nearby dots */}
                  <View style={[styles.nearbyDot, styles.nearbyDot1]} />
                  <View style={[styles.nearbyDot, styles.nearbyDot2]} />
                  <View style={[styles.nearbyDot, styles.nearbyDot3]} />
                  <View style={[styles.nearbyDot, styles.nearbyDot4]} />
                </View>
              </View>
              
              <Text style={styles.title}>What's your vibe?</Text>
              <Text style={styles.subtitle}>
                How you're feeling right now, in one phrase
              </Text>
            </Animated.View>

            {/* Input Section */}
            <Animated.View 
              style={[
                styles.inputSection,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideUpAnim }],
                }
              ]}
            >
              <View 
                style={[
                  styles.inputContainer,
                  isFocused && styles.inputContainerFocused
                ]}
              >
                <TextInput
                  style={styles.input}
                  value={descriptor}
                  onChangeText={setDescriptor}
                  placeholder="Capture this moment..."
                  placeholderTextColor={theme.colors.textTertiary}
                  maxLength={20}
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!isLoading}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                />
                
                <TouchableOpacity 
                  style={styles.generateButton}
                  onPress={generateVibe}
                  disabled={isGenerating || isLoading}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={GRADIENTS.primary.colors}
                    style={[
                      styles.shuffleGradient,
                      isGenerating && styles.shuffleAnimating
                    ]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <View style={styles.shuffleIcon}>
                      <View style={styles.shuffleArrow1} />
                      <View style={styles.shuffleArrow2} />
                    </View>
                  </LinearGradient>
                </TouchableOpacity>
              </View>
              
              <Text style={styles.charCount}>
                {descriptor.length}/20
              </Text>
            </Animated.View>

            {/* Visual Preview - No label */}
            {descriptor && (
              <Animated.View 
                style={[
                  styles.previewContainer,
                  {
                    opacity: fadeAnim,
                  }
                ]}
              >
                <View style={styles.identityCard}>
                  <LinearGradient
                    colors={[
                      `hsl(${(descriptor.charCodeAt(0) * 3) % 360}, 70%, 50%)`,
                      `hsl(${(descriptor.charCodeAt(0) * 3 + 30) % 360}, 70%, 60%)`,
                    ]}
                    style={styles.avatarGradient}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                  >
                    <Text style={styles.avatarText}>
                      {descriptor.charAt(0).toUpperCase()}
                    </Text>
                  </LinearGradient>
                  
                  <View style={styles.liveBadge}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>live</Text>
                  </View>
                </View>
              </Animated.View>
            )}

            {/* Continue Button */}
            <Animated.View
              style={[
                styles.buttonWrapper,
                {
                  opacity: fadeAnim,
                  transform: [{ translateY: slideUpAnim }],
                }
              ]}
            >
              <TouchableOpacity 
                style={[
                  styles.continueButton,
                  (!descriptor.trim() || isLoading) && styles.continueButtonDisabled
                ]}
                onPress={handleContinue}
                disabled={!descriptor.trim() || isLoading}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={descriptor.trim() && !isLoading
                    ? GRADIENTS.primary.colors 
                    : [theme.colors.blackSurface, theme.colors.blackSurface]
                  }
                  style={styles.gradientButton}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {isLoading ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color={theme.colors.textPrimary} />
                      <Text style={styles.loadingText}>Setting up...</Text>
                    </View>
                  ) : (
                    <>
                      <Text style={styles.buttonText}>Set Vibe</Text>
                      {descriptor.trim() && (
                        <Ionicons name="arrow-forward" size={20} color={theme.colors.textPrimary} />
                      )}
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </View>
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
  content: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  
  // Background - static gradients
  bgOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.colors.black,
    opacity: 0.3,
  },
  gradientOrb1: {
    position: 'absolute',
    top: -width * 0.5,
    left: -width * 0.5,
    width: width,
    height: width,
    borderRadius: width * 0.5,
    backgroundColor: theme.colors.primary,
    opacity: 0.05,
  },
  gradientOrb2: {
    position: 'absolute',
    bottom: -width * 0.5,
    right: -width * 0.5,
    width: width * 0.8,
    height: width * 0.8,
    borderRadius: width * 0.4,
    backgroundColor: theme.colors.secondary,
    opacity: 0.03,
  },
  
  // Header
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xxxl * 1.5,
  },
  iconContainer: {
    marginBottom: theme.spacing.xl,
    width: 120,
    height: 120,
  },
  
  // Pulse Radar
  pulseRadar: {
    width: '100%',
    height: '100%',
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radarCenter: {
    width: 16,
    height: 16,
    backgroundColor: theme.colors.primary,
    borderRadius: 8,
    position: 'absolute',
    zIndex: 4,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 5,
  },
  radarWave: {
    position: 'absolute',
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: 50,
  },
  radarWave1: {
    width: 40,
    height: 40,
  },
  radarWave2: {
    width: 70,
    height: 70,
  },
  radarWave3: {
    width: 100,
    height: 100,
  },
  nearbyDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    backgroundColor: 'rgba(0, 212, 255, 0.4)',
    borderRadius: 3,
  },
  nearbyDot1: { top: 20, left: 30 },
  nearbyDot2: { top: 40, right: 25 },
  nearbyDot3: { bottom: 30, left: 20 },
  nearbyDot4: { bottom: 20, right: 35 },
  
  title: {
    fontSize: theme.typography.fontSize.hero,
    fontWeight: '300',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.sm,
    letterSpacing: theme.typography.letterSpacing.tight,
  },
  subtitle: {
    fontSize: theme.typography.fontSize.body,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: theme.spacing.lg,
    lineHeight: theme.typography.lineHeight.relaxed * theme.typography.fontSize.body,
  },
  
  // Input section
  inputSection: {
    width: '100%',
    marginBottom: theme.spacing.xxxl,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.blackElevated,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    overflow: 'hidden',
  },
  inputContainerFocused: {
    borderColor: 'rgba(0, 212, 255, 0.2)',
    backgroundColor: 'rgba(17, 17, 17, 0.8)',
  },
  input: {
    flex: 1,
    height: theme.layout.inputHeight,
    paddingHorizontal: theme.spacing.lg,
    fontSize: theme.typography.fontSize.message,
    color: theme.colors.textPrimary,
    letterSpacing: theme.typography.letterSpacing.normal,
  },
  generateButton: {
    padding: theme.spacing.md,
  },
  shuffleGradient: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shuffleAnimating: {
    transform: [{ rotate: '180deg' }],
  },
  shuffleIcon: {
    width: 20,
    height: 20,
    position: 'relative',
  },
  shuffleArrow1: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 12,
    height: 12,
    borderTopWidth: 2,
    borderRightWidth: 2,
    borderColor: theme.colors.black,
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
  },
  shuffleArrow2: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderBottomWidth: 2,
    borderLeftWidth: 2,
    borderColor: theme.colors.black,
    borderRadius: 2,
    transform: [{ rotate: '45deg' }],
  },
  charCount: {
    fontSize: theme.typography.fontSize.caption,
    color: theme.colors.textTertiary,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    letterSpacing: theme.typography.letterSpacing.wide,
  },
  
  // Preview
  previewContainer: {
    width: '100%',
    marginBottom: theme.spacing.xxxl,
  },
  identityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.lg,
  },
  avatarGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.black,
  },
  liveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 212, 255, 0.1)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  liveDot: {
    width: 6,
    height: 6,
    backgroundColor: theme.colors.primary,
    borderRadius: 3,
    // Simple opacity animation instead of complex animation
  },
  liveText: {
    fontSize: 12,
    color: theme.colors.primary,
    fontWeight: '500',
  },
  
  // Button
  buttonWrapper: {
    width: '100%',
    maxWidth: 280,
  },
  continueButton: {
    borderRadius: theme.borderRadius.pill,
    overflow: 'hidden',
  },
  continueButtonDisabled: {
    opacity: 0.5,
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.huge,
  },
  buttonText: {
    fontSize: theme.typography.fontSize.message,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.textPrimary,
    letterSpacing: theme.typography.letterSpacing.wide,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.sm,
  },
  loadingText: {
    fontSize: theme.typography.fontSize.body,
    color: theme.colors.textPrimary,
    letterSpacing: theme.typography.letterSpacing.normal,
  },
});