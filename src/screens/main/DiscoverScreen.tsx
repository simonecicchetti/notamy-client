// src/screens/main/DiscoverScreen.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import apiService from '@/services/api';
import websocketService from '@/services/websocket';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSelector } from 'react-redux';
import { RootState } from '@/store';
import { theme, GRADIENTS } from '@/config/theme';
import { sharedStyles, AVATAR_SIZES, getAvatarStyle } from '@/config/sharedStyles';
import { NearbyUser as ApiNearbyUser, Coordinates } from '@/types/api';

// Constants
const { width, height } = Dimensions.get('window');
const LOCATION_UPDATE_INTERVAL = 15000; // 15 secondi
const USER_CACHE_DURATION = 30000; // 30 secondi
const TOAST_DURATION = 2500; // 2.5 secondi
const MAX_NOTE_DISTANCE = 200; // metri massimi per poter notare qualcuno

// Nota: Usiamo direttamente theme.colors invece di ridefinirli
// Solo gold è custom per le stelle mutual (potrebbe essere aggiunto al tema)
const GOLD_COLOR = '#FFB800';
const GOLD_GLOW = 'rgba(255, 184, 0, 0.3)';

// Client-side transformed user representation
interface TransformedNearbyUser {
  id: string;
  descriptor: string;
  distance: number;
  bearing_degrees?: number;
  status: 'online' | 'offline';
  zone?: string;
  event_id?: string;
  badges?: string[];
  location?: Coordinates;
}

// Client-side interfaces
interface NotedUser {
  sent: boolean;
  received: boolean;
  mutual: boolean;
  timestamp: number;
}

interface ToastProps { 
  message: string; 
  visible: boolean; 
  isMutual?: boolean;
}

/**
 * Toast Component - Notifica centrale animata
 * Mostra feedback visivo per azioni come note inviate/ricevute
 */
const Toast = React.memo(({ message, visible, isMutual }: ToastProps) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    if (visible) {
      // Animazione di entrata
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Animazione di uscita
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fadeAnim, scaleAnim]);

  return (
    <Animated.View 
      style={[
        styles.toast,
        {
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }],
        },
      ]}
      pointerEvents="none"
    >
      <View style={[
        styles.toastContent,
        isMutual && styles.toastMutual
      ]}>
        <Text style={styles.toastText}>{message}</Text>
      </View>
    </Animated.View>
  );
});
Toast.displayName = 'Toast';

/**
 * DiscoverScreen - Schermata principale per scoprire utenti nelle vicinanze
 * Gestisce localizzazione, note tra utenti e interazioni social
 */
export default function DiscoverScreen({ navigation }: any) {
  // State management
  const [nearbyUsers, setNearbyUsers] = useState<TransformedNearbyUser[]>([]);
  const [userCache, setUserCache] = useState<{ [key: string]: { user: TransformedNearbyUser; lastSeen: number } }>({});
  const [descriptorHistory, setDescriptorHistory] = useState<{ [key: string]: string[] }>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [locationPermission, setLocationPermission] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<Coordinates | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  // State per tracking delle note inviate/ricevute
  const [notedUsers, setNotedUsers] = useState<{[userId: string]: NotedUser}>({});
  
  // State per Toast notifications
  const [toastMessage, setToastMessage] = useState('');
  const [showToast, setShowToast] = useState(false);
  const [toastMutual, setToastMutual] = useState(false);
  
  // Refs per gestire cleanup e animazioni
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const locationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const isMountedRef = useRef(true);
  
  // Redux state
  const notifications = useSelector((state: RootState) => state.notifications.notifications);
  const lastNotificationRef = useRef<string | null>(null);

  /**
   * Inizializzazione al mount del componente
   */
  useEffect(() => {
    isMountedRef.current = true;
    initializeScreen();
    
    // Animazione fade-in iniziale
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // Cleanup al unmount
    return () => {
      isMountedRef.current = false;
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
        locationIntervalRef.current = null;
      }
    };
  }, []);

  /**
   * Listener per notifiche di reazioni (wave)
   */
  useEffect(() => {
    if (notifications.length > 0) {
      const lastNotification = notifications[notifications.length - 1];
      
      if (lastNotification.type === 'reaction' && 
          lastNotification.id !== lastNotificationRef.current &&
          lastNotification.metadata?.reaction) {
        
        lastNotificationRef.current = lastNotification.id;
        
        const senderDescriptor = lastNotification.metadata.senderDescriptor || 'Someone';
        const reaction = lastNotification.metadata.reaction;
        
        Alert.alert(
          `${reaction} Received!`,
          `${senderDescriptor} waved at you!`,
          [
            { 
              text: 'Wave Back', 
              onPress: () => {
                const sender = nearbyUsers.find(u => u.id === lastNotification.senderId);
                if (sender) {
                  handleUserInteraction(sender);
                } else {
                  handleWaveBack(lastNotification.senderId, senderDescriptor);
                }
              }
            },
            { text: 'OK', style: 'default' }
          ],
          { cancelable: true }
        );
      }
    }
  }, [notifications, nearbyUsers]);

  /**
   * WebSocket listener per note ricevute
   * Gestisce notifiche real-time quando qualcuno ci nota
   */
  useEffect(() => {
    const handleNoteReceived = async (data: any) => {
      if (data.type === 'user_noted' && isMountedRef.current) {
        const senderId = data.sender_id;
        
        setNotedUsers(prev => {
          const currentNoted = prev[senderId] || { sent: false, received: false, mutual: false, timestamp: 0 };
          const isMutual = currentNoted.sent || false;
          
          const updatedNotes = {
            ...prev,
            [senderId]: {
              ...currentNoted,
              received: true,
              mutual: isMutual,
              timestamp: data.timestamp || Date.now()
            }
          };
          
          // Salva persistente in AsyncStorage
          AsyncStorage.setItem('notedUsers', JSON.stringify(updatedNotes)).catch(err => 
            console.error('Failed to save noted users:', err)
          );
          
          // Notifica appropriata basata sullo stato
          if (isMutual && !currentNoted.mutual) {
            showToastMessage('✨ Mutual note!', true);
          } else if (!isMutual) {
            const sender = nearbyUsers.find(u => u.id === senderId);
            showToastMessage(`${sender?.descriptor || 'Someone'} noted you ⭐`, false);
          }
          
          return updatedNotes;
        });
      }
    };
    
    websocketService.on('user_noted', handleNoteReceived);
    
    return () => {
      websocketService.off('user_noted', handleNoteReceived);
    };
  }, [nearbyUsers]);

  /**
   * Gestione aggiornamenti periodici della posizione
   * FIX: Memory leak corretto con cleanup appropriato
   */
  useEffect(() => {
    if (locationPermission && isMountedRef.current) {
      // Aggiornamento iniziale
      updateLocationAndLoadUsers();
      
      // Setup interval per aggiornamenti periodici
      locationIntervalRef.current = setInterval(() => {
        if (isMountedRef.current) {
          updateLocationAndLoadUsers();
        }
      }, LOCATION_UPDATE_INTERVAL);
    }
    
    // Cleanup function
    return () => {
      if (locationIntervalRef.current) {
        clearInterval(locationIntervalRef.current);
        locationIntervalRef.current = null;
      }
    };
  }, [locationPermission]);

  /**
   * Mostra toast notification con auto-hide
   */
  const showToastMessage = useCallback((message: string, isMutual: boolean) => {
    if (!isMountedRef.current) return;
    
    setToastMessage(message);
    setToastMutual(isMutual);
    setShowToast(true);
    
    setTimeout(() => {
      if (isMountedRef.current) {
        setShowToast(false);
      }
    }, TOAST_DURATION);
  }, []);

  /**
   * Inizializza lo schermo caricando dati salvati e controllando permessi
   */
  const initializeScreen = async () => {
    try {
      // Carica ID utente corrente
      const userId = await AsyncStorage.getItem('userId');
      setCurrentUserId(userId);
      
      // Carica note salvate precedentemente
      const savedNotes = await AsyncStorage.getItem('notedUsers');
      if (savedNotes) {
        try {
          setNotedUsers(JSON.parse(savedNotes));
        } catch (err) {
          console.error('Failed to parse saved notes:', err);
        }
      }
      
      // Controlla permessi localizzazione
      await checkLocationPermission();
    } catch (error) {
      console.error('Failed to initialize screen:', error);
    }
  };

  /**
   * Verifica e richiede permessi di localizzazione
   */
  const checkLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status === 'granted') {
        setLocationPermission(true);
      } else {
        Alert.alert(
          'Location Required',
          'Notamy needs location access to find people near you.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Open Settings', onPress: () => Location.requestForegroundPermissionsAsync() }
          ]
        );
      }
    } catch (error) {
      console.error('Error checking location permission:', error);
      setLocationPermission(false);
    }
  };

  /**
   * Calcola distanza tra due coordinate usando formula Haversine
   * @returns Distanza in metri
   */
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Raggio della Terra in metri
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  };

  /**
   * Aggiorna posizione corrente e carica utenti vicini
   * Usa strategia di fallback per accuratezza posizione
   */
  const updateLocationAndLoadUsers = async () => {
    if (!isMountedRef.current) return;
    
    try {
      // Ottieni posizione con alta accuratezza
      let location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 0,
      });

      // Fallback a network location se GPS non è accurato
      if (location.coords.accuracy && location.coords.accuracy > 50) {
        const networkLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        
        if (networkLocation.coords.accuracy && networkLocation.coords.accuracy < location.coords.accuracy) {
          location = networkLocation;
        }
      }
      
      const newLocation = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      };
      
      setCurrentLocation(newLocation);

      // Aggiorna posizione sul server
      const updateResult = await apiService.updateLocation(
        location.coords.latitude,
        location.coords.longitude,
        location.coords.accuracy || undefined
      );
      
      if (updateResult.error) {
        console.error('❌ Location update failed:', updateResult.detail);
      } else {
        console.log('✅ Location updated successfully');
        await loadNearbyUsers(newLocation);
      }
    } catch (error) {
      console.error('Failed to update location:', error);
      // Carica utenti con ultima posizione nota
      await loadNearbyUsers(currentLocation);
    }
  };

  /**
   * Carica utenti vicini dal server
   * Implementa caching intelligente per utenti offline
   */
  const loadNearbyUsers = async (userLocation?: Coordinates | null) => {
    if (!isMountedRef.current) return;
    
    const locationToUse = userLocation || currentLocation;
    
    try {
      const response = await apiService.getNearbyUsers(500, 50); // 500m raggio, max 50 utenti
      
      if (__DEV__) {
        console.log('📍 Nearby users response:', {
          userCount: response.users?.length || 0,
          realtimeCount: response.realtime_count,
          timestamp: new Date().toISOString()
        });
      }
      
      // Gestione errori autenticazione
      if (response.error) {
        if (response.error === 'authentication_failed' || response.status === 401) {
          navigation.navigate('Identity');
        }
        setNearbyUsers([]);
        return;
      }
      
      const usersArray = Array.isArray(response.users) ? response.users : [];
      
      // Filtra e trasforma utenti
      const users = usersArray
        .filter((user: any) => {
          return user && 
                 (user.user_id || user.id) && 
                 (user.user_id || user.id) !== currentUserId &&
                 user.descriptor && 
                 user.descriptor.trim() !== '';
        })
        .map((user: any) => {
          const userId = user.user_id || user.id;
          const expectedDescriptor = user.descriptor || 'Unknown';
          
          // Gestisce descriptors temporanei generati dal server
          let finalDescriptor = expectedDescriptor;
          
          if (expectedDescriptor.startsWith('User_') && expectedDescriptor.length === 13) {
            // Cerca descriptor valido in cache o history
            const cachedUser = userCache[userId];
            const historyDescriptors = descriptorHistory[userId] || [];
            
            if (cachedUser && cachedUser.user.descriptor && !cachedUser.user.descriptor.startsWith('User_')) {
              finalDescriptor = cachedUser.user.descriptor;
            } else if (historyDescriptors.length > 0) {
              const validDescriptor = historyDescriptors.find(d => !d.startsWith('User_'));
              if (validDescriptor) {
                finalDescriptor = validDescriptor;
              }
            }
          }
          
          // Calcola distanza reale se possibile
          let distance = user.distance_meters || user.distance || 0;
          
          if (locationToUse && user.location) {
            const calculatedDistance = calculateDistance(
              locationToUse.latitude,
              locationToUse.longitude,
              user.location.latitude,
              user.location.longitude
            );
            
            // Usa distanza calcolata se differenza significativa
            if (Math.abs(distance - calculatedDistance) > 10) {
              distance = calculatedDistance;
            }
          }
          
          return {
            id: userId,
            descriptor: finalDescriptor,
            distance: Math.round(distance),
            bearing_degrees: user.bearing_degrees || 0,
            status: user.active ? 'online' : 'offline',
            zone: user.local_presence || user.zone || 'unknown',
            event_id: user.event_id,
            badges: user.badges || [],
            location: user.location
          };
        })
        .filter((user: TransformedNearbyUser) => user.id && user.id !== currentUserId);
      
      // Ordina per distanza
      users.sort((a, b) => a.distance - b.distance);
      
      // Aggiorna history dei descriptors
      users.forEach(user => {
        const history = descriptorHistory[user.id] || [];
        if (!history.includes(user.descriptor)) {
          setDescriptorHistory(prev => ({
            ...prev,
            [user.id]: [...(prev[user.id] || []), user.descriptor]
          }));
        }
      });
      
      // Gestione cache intelligente
      const now = Date.now();
      const newCache = { ...userCache };
      
      // Aggiorna cache con nuovi dati
      users.forEach(user => {
        newCache[user.id] = { user, lastSeen: now };
      });
      
      // Combina utenti online con cache degli offline recenti
      const allUsers: TransformedNearbyUser[] = [];
      
      Object.entries(newCache).forEach(([userId, cached]) => {
        if (now - cached.lastSeen < USER_CACHE_DURATION) {
          const currentUser = users.find(u => u.id === userId);
          if (currentUser) {
            allUsers.push(currentUser);
          } else {
            // Mantieni utente in cache ma marcalo come offline
            allUsers.push({ ...cached.user, status: 'offline' });
          }
        } else {
          // Rimuovi dalla cache se troppo vecchio
          delete newCache[userId];
        }
      });
      
      // Ordina: online prima, poi per distanza
      allUsers.sort((a, b) => {
        if (a.status === 'online' && b.status === 'offline') return -1;
        if (a.status === 'offline' && b.status === 'online') return 1;
        return a.distance - b.distance;
      });
      
      setUserCache(newCache);
      setNearbyUsers(allUsers);
      
    } catch (error) {
      console.error('Failed to load nearby users:', error);
      setNearbyUsers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  /**
   * Gestisce pull-to-refresh
   */
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    updateLocationAndLoadUsers();
  }, []);

  /**
   * Verifica se l'utente può essere notato
   * Regole: non già notato, online, entro distanza massima
   */
  const canNoteUser = (user: TransformedNearbyUser): boolean => {
    if (notedUsers[user.id]?.sent) return false;
    if (user.status !== 'online') return false;
    if (user.distance > MAX_NOTE_DISTANCE) return false;
    return true;
  };

  /**
   * Gestisce l'invio di una nota a un utente
   * Implementa optimistic UI update con rollback su errore
   */
  const handleNoteUser = async (targetUser: TransformedNearbyUser) => {
    if (!canNoteUser(targetUser) || !isMountedRef.current) return;
    
    try {
      // Optimistic update - mostra immediatamente come inviato
      setNotedUsers(prev => ({
        ...prev,
        [targetUser.id]: {
          ...prev[targetUser.id],
          sent: true,
          timestamp: Date.now()
        }
      }));

      // Feedback immediato
      showToastMessage('Noted ⭐', false);

      // Chiamata API
      const result = await apiService.sendNote(targetUser.id, {
        location: currentLocation,
        distance: targetUser.distance,
        timestamp: Date.now()
      });
      
      if (!result.error && isMountedRef.current) {
        // Aggiorna stato con risultato reale
        setNotedUsers(prev => {
          const currentUserNotes = prev[targetUser.id] || { sent: false, received: false, mutual: false, timestamp: 0 };
          const isMutual = result.is_mutual || (currentUserNotes.received && currentUserNotes.sent);
          
          const updatedNotes = {
            ...prev,
            [targetUser.id]: { 
              sent: true, 
              received: currentUserNotes.received || false,
              mutual: isMutual,
              timestamp: Date.now() 
            }
          };
          
          // Salva persistente
          AsyncStorage.setItem('notedUsers', JSON.stringify(updatedNotes)).catch(err =>
            console.error('Failed to save noted users:', err)
          );
          
          // Notifica se è mutual
          if (isMutual && !currentUserNotes.mutual) {
            showToastMessage('✨ Mutual note!', true);
          }
          
          return updatedNotes;
        });
      } else {
        // Rollback su errore
        if (isMountedRef.current) {
          setNotedUsers(prev => {
            const currentNotes = prev[targetUser.id] || { sent: false, received: false, mutual: false, timestamp: 0 };
            return {
              ...prev,
              [targetUser.id]: { ...currentNotes, sent: false }
            };
          });
          
          showToastMessage('Failed to note', false);
        }
      }
    } catch (error) {
      console.error('Note failed:', error);
      
      // Rollback su errore di rete
      if (isMountedRef.current) {
        setNotedUsers(prev => {
          const currentNotes = prev[targetUser.id] || { sent: false, received: false, mutual: false, timestamp: 0 };
          return {
            ...prev,
            [targetUser.id]: { ...currentNotes, sent: false }
          };
        });
        
        showToastMessage('Network error', false);
      }
    }
  };

  /**
   * Gestisce interazioni wave/saluto
   */
  const handleUserInteraction = async (targetUser: TransformedNearbyUser) => {
    try {
      if (__DEV__) {
        console.log(`👋 Sending wave to ${targetUser.descriptor} (${targetUser.id})`);
      }
      
      const result = await apiService.sendReaction(targetUser.id, 'wave');
      
      if (!result.error) {
        Alert.alert(
          '👋 Sent!',
          `Waved at ${targetUser.descriptor}`,
          [{ text: 'OK', style: 'default' }],
          { cancelable: true }
        );
      } else {
        Alert.alert(
          'Error',
          result.detail?.detail || 'Could not send reaction. Please try again.',
          [{ text: 'OK', style: 'default' }]
        );
      }
    } catch (error) {
      console.error('Interaction failed:', error);
      Alert.alert(
        'Error',
        'Network error. Please check your connection.',
        [{ text: 'OK', style: 'default' }]
      );
    }
  };

  /**
   * Gestisce risposta a un wave ricevuto
   */
  const handleWaveBack = async (userId: string, userDescriptor: string) => {
    try {
      if (__DEV__) {
        console.log(`👋 Waving back to ${userDescriptor} (${userId})`);
      }
      
      const result = await apiService.sendReaction(userId, 'wave');
      
      if (!result.error) {
        Alert.alert(
          '👋 Sent!',
          `Waved back at ${userDescriptor}`,
          [{ text: 'OK', style: 'default' }],
          { cancelable: true }
        );
      } else {
        Alert.alert(
          'Error',
          'Could not send wave back. Please try again.',
          [{ text: 'OK', style: 'default' }]
        );
      }
    } catch (error) {
      Alert.alert(
        'Error',
        'Network error. Please check your connection.',
        [{ text: 'OK', style: 'default' }]
      );
    }
  };

  /**
   * Naviga alla schermata chat con utente
   */
  const handleChat = useCallback(async (user: TransformedNearbyUser) => {
    const conversationId = currentUserId && currentUserId < user.id 
      ? `${currentUserId}_${user.id}`
      : `${user.id}_${currentUserId}`;
    
    navigation.navigate('Chat', { 
      recipientId: user.id,
      recipientDescriptor: user.descriptor,
      conversationId: conversationId
    });
  }, [currentUserId, navigation]);

  /**
   * Converte distanza in etichetta user-friendly
   */
  const getProximityLabel = (meters: number): string => {
    if (meters < 50) return 'right here';
    if (meters < 150) return 'very close';
    if (meters < 300) return 'nearby';
    return 'around';
  };

  /**
   * UserCard Component - Card per singolo utente
   * Gestisce visualizzazione e interazioni
   * MODIFICATO: Avatar e nome ora navigano al profilo
   */
  const UserCard = React.memo(({ user }: { user: TransformedNearbyUser }) => {
    const noted = notedUsers[user.id];
    const canNote = canNoteUser(user);
    const isMutual = noted?.mutual;
    const initial = user.descriptor.charAt(0).toUpperCase();
    
    // Genera colore unico basato sul descriptor
    const hue = (user.descriptor.charCodeAt(0) * 137) % 360;
    
    // Funzione per navigare al profilo
    const navigateToProfile = () => {
      navigation.navigate('Profile', {
        userId: user.id,
        descriptor: user.descriptor
      });
    };
    
    return (
      <TouchableOpacity 
        style={[
          styles.userCard,
          isMutual && styles.userCardMutual
        ]}
        onPress={() => {
          if (isMutual) {
            handleChat(user);
          }
        }}
        activeOpacity={0.8}
      >
        <View style={styles.userCardContent}>
          <View style={styles.userLeft}>
            {/* Avatar con gradiente unico - ORA CLICCABILE */}
            <TouchableOpacity 
              style={styles.avatarContainer}
              onPress={navigateToProfile}
              activeOpacity={0.7}
            >
              <LinearGradient
                colors={[
                  `hsl(${hue}, 70%, 50%)`,
                  `hsl(${hue + 30}, 70%, 60%)`,
                ]}
                style={[
                  styles.avatar,
                  user.status === 'online' && styles.avatarOnlineLayered
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Text style={styles.avatarText}>{initial}</Text>
              </LinearGradient>
              
              {/* Indicatore stato offline */}
              {user.status !== 'online' && (
                <View style={[styles.statusDot, styles.statusOffline]} />
              )}
            </TouchableOpacity>
            
            {/* Info utente - ORA CLICCABILE */}
            <TouchableOpacity 
              style={styles.userInfo}
              onPress={navigateToProfile}
              activeOpacity={0.7}
            >
              <Text style={styles.userName}>{user.descriptor}</Text>
              <View style={styles.userMeta}>
                <Ionicons name="location" size={14} color={theme.colors.primary} style={styles.locationIcon} />
                <Text style={styles.proximity}>{getProximityLabel(user.distance)}</Text>
                
                {/* Indicatori stelle per note */}
                {noted && (
                  <View style={[
                    styles.stars,
                    isMutual && styles.starsMutual
                  ]}>
                    {isMutual ? (
                      <>
                        <Ionicons name="star" size={20} color={GOLD_COLOR} style={styles.starMutualFirst} />
                        <Ionicons name="star" size={20} color={GOLD_COLOR} style={styles.starMutualSecond} />
                      </>
                    ) : noted.received ? (
                      <Ionicons name="star" size={18} color={GOLD_COLOR} style={styles.starReceived} />
                    ) : noted.sent ? (
                      <Ionicons name="star" size={18} color={theme.colors.primary} style={styles.starSent} />
                    ) : null}
                  </View>
                )}
              </View>
            </TouchableOpacity>
          </View>
          
          {/* Bottoni azione */}
          <View style={styles.actions}>
            {/* Bottone chat se mutual */}
            {isMutual && (
              <TouchableOpacity 
                style={styles.actionBtn}
                onPress={(e) => {
                  e.stopPropagation();
                  handleChat(user);
                }}
                activeOpacity={0.7}
              >
                <LinearGradient
                  colors={GRADIENTS.primary.colors}
                  style={styles.actionBtnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="chatbubble" size={20} color={theme.colors.textPrimary} />
                </LinearGradient>
              </TouchableOpacity>
            )}
            
            {/* Bottone nota */}
            <TouchableOpacity 
              style={[
                styles.actionBtn,
                !canNote && styles.actionBtnDisabled
              ]}
              onPress={(e) => {
                e.stopPropagation();
                if (canNote) {
                  handleNoteUser(user);
                }
              }}
              activeOpacity={0.7}
              disabled={!canNote}
            >
              {noted?.sent || noted?.received ? (
                <LinearGradient
                  colors={GRADIENTS.primary.colors}
                  style={styles.actionBtnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="star" size={20} color={theme.colors.textPrimary} />
                </LinearGradient>
              ) : (
                <View style={[
                  styles.actionBtnGradient,
                  styles.actionBtnDefault
                ]}>
                  <Ionicons name="star" size={20} color="white" />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    );
  });
  UserCard.displayName = 'UserCard';

  // Rendering states
  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Scanning the ether...</Text>
        </View>
      </View>
    );
  }

  if (!locationPermission) {
    return (
      <View style={styles.container}>
        <View style={styles.emptyState}>
          <View style={styles.emptyIcon}>
            <Ionicons name="location-outline" size={50} color={theme.colors.black} />
          </View>
          <Text style={styles.emptyTitle}>Location Access Required</Text>
          <Text style={styles.emptyText}>Enable location to discover people nearby</Text>
          <TouchableOpacity 
            style={styles.enableLocationButton}
            onPress={checkLocationPermission}
            activeOpacity={0.8}
          >
            <Text style={styles.enableLocationText}>Enable Location</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Main render
  return (
    <View style={styles.container}>
      {/* Background gradient mesh */}
      <View style={styles.bgMesh} />
      
      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <Animated.View 
          style={[
            styles.header,
            { opacity: fadeAnim }
          ]}
        >
          <View style={styles.headerContent}>
            <View>
              <Text style={styles.title}>Discover</Text>
              <Text style={styles.subtitle}>
                <Text style={styles.onlineCount}>{nearbyUsers.filter(u => u.status === 'online').length}</Text> online • within 500m
              </Text>
            </View>
            <TouchableOpacity 
              style={styles.refreshBtn} 
              onPress={onRefresh}
              activeOpacity={0.7}
            >
              <Ionicons name="refresh" size={20} color={theme.colors.primary} />
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Main content con pull-to-refresh */}
        <ScrollView 
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={theme.colors.primary}
            />
          }
          contentContainerStyle={styles.scrollContent}
        >
          <Animated.View 
            style={[
              styles.content,
              { opacity: fadeAnim }
            ]}
          >
            {nearbyUsers.length === 0 ? (
              // Empty state
              <View style={styles.emptyState}>
                <View style={styles.emptyIcon}>
                  <Ionicons name="checkmark-circle" size={50} color={theme.colors.black} />
                </View>
                <Text style={styles.emptyTitle}>The void is quiet</Text>
                <Text style={styles.emptyText}>Move around to discover others</Text>
              </View>
            ) : (
              // Lista utenti
              <View style={styles.usersGrid}>
                {nearbyUsers.map((user) => (
                  <UserCard key={user.id} user={user} />
                ))}
              </View>
            )}
          </Animated.View>
        </ScrollView>
      </SafeAreaView>

      {/* Toast Component per notifiche */}
      <Toast message={toastMessage} visible={showToast} isMutual={toastMutual} />
    </View>
  );
}

// Styles
const styles = StyleSheet.create({
  // Base containers
  container: sharedStyles.container,
  safeArea: sharedStyles.safeArea,
  
  // Background
  bgMesh: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.5,
    backgroundColor: theme.colors.black,
  },
  
  // Header
  header: {
    backgroundColor: theme.colors.overlay.dark,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    paddingVertical: theme.spacing.md,
  },
  headerContent: sharedStyles.headerContent,
  title: sharedStyles.screenTitle,
  subtitle: sharedStyles.screenSubtitle,
  onlineCount: {
    color: theme.colors.primary,
    fontWeight: '500',
  },
  
  // Refresh button
  refreshBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.colors.blackElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Content area
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    padding: theme.spacing.md,
    paddingBottom: 100,
    maxWidth: 500,
    width: '100%',
    alignSelf: 'center',
  },
  
  // Grid utenti
  usersGrid: {
    gap: theme.spacing.sm,
  },
  
  // User card
  userCard: {
    ...sharedStyles.cardInteractive,
    padding: theme.spacing.md,
    marginBottom: theme.spacing.sm,
  },
  userCardMutual: {
    borderColor: GOLD_GLOW,
    backgroundColor: theme.colors.blackElevated,
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
  
  // Effetto layered depth per avatar online
  avatarOnlineLayered: {
    transform: [{ translateY: -3 }],
    shadowColor: theme.colors.success,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 15,
    borderWidth: 3,
    borderColor: theme.colors.success,
  },
  
  avatarText: sharedStyles.avatarTextMedium,
  statusDot: {
    ...sharedStyles.onlineIndicator,
    backgroundColor: theme.colors.success,
  },
  statusOffline: {
    backgroundColor: theme.colors.textMuted,
  },
  
  // Info utente
  userInfo: {
    flex: 1,
    minWidth: 0,
  },
  userName: {
    fontSize: theme.typography.fontSize.body,
    fontWeight: '500',
    color: theme.colors.textPrimary,
    marginBottom: theme.spacing.xxs,
    letterSpacing: -0.2,
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
  },
  locationIcon: {
    opacity: 0.6,
  },
  proximity: {
    fontSize: theme.typography.fontSize.small,
    color: theme.colors.primaryLight,
    fontWeight: '500',
  },
  stars: {
    flexDirection: 'row',
    gap: 3,
    marginLeft: theme.spacing.xs,
  },
  
  // Stelle con effetti spettacolari per mutual
  starsMutual: {
    backgroundColor: 'rgba(255, 184, 0, 0.1)',
    borderRadius: 15,
    paddingHorizontal: theme.spacing.xs,
    paddingVertical: 2,
    marginLeft: theme.spacing.sm,
  },
  
  starMutualFirst: {
    shadowColor: GOLD_COLOR,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 8,
    elevation: 8,
    marginRight: -4,
  },
  
  starMutualSecond: {
    shadowColor: GOLD_COLOR,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 6,
    marginLeft: -4,
  },
  
  starReceived: {
    shadowColor: GOLD_COLOR,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 6,
  },
  
  starSent: {
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 4,
    elevation: 3,
  },
  
  // Bottoni azione
  actions: {
    flexDirection: 'row',
    gap: theme.spacing.sm,
  },
  actionBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  actionBtnDisabled: {
    opacity: 0.3,
  },
  actionBtnGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionBtnDefault: {
    backgroundColor: theme.colors.blackSurface,
    borderRadius: 22,
    width: 44,
    height: 44,
    borderWidth: 2,
    borderColor: theme.colors.border,
  },
  
  // Toast notifiche centrale
  toast: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -150,
    marginTop: -30,
    width: 300,
  },
  toastContent: {
    backgroundColor: theme.colors.blackSurface,
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: 50,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    alignItems: 'center',
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.8,
    shadowRadius: 32,
    elevation: 10,
  },
  toastMutual: {
    borderColor: GOLD_COLOR,
    backgroundColor: 'rgba(255, 184, 0, 0.05)',
  },
  toastText: {
    color: theme.colors.textPrimary,
    fontSize: theme.typography.fontSize.medium,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  
  // Empty state
  emptyState: sharedStyles.emptyState,
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.xl,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.6,
    shadowRadius: 60,
    elevation: 20,
  },
  emptyTitle: sharedStyles.emptyTitle,
  emptyText: sharedStyles.emptyText,
  
  // Loading state
  loading: sharedStyles.loadingContainer,
  loadingText: sharedStyles.loadingText,
  
  // Enable location button
  enableLocationButton: {
    marginTop: theme.spacing.xl,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: theme.spacing.xl,
    paddingVertical: theme.spacing.md,
    borderRadius: 50,
  },
  enableLocationText: {
    color: theme.colors.black,
    fontSize: theme.typography.fontSize.body,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});