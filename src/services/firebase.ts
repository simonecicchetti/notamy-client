// src/services/firebase.ts
import { auth } from '@/config/firebase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from './api';
import firebase from 'firebase/compat/app';

// Type definitions for Compat SDK
type User = firebase.User;
type Unsubscribe = firebase.Unsubscribe;

// Interface for location coordinates
interface LocationCoords {
  latitude: number;
  longitude: number;
  accuracy?: number;
}

class FirebaseAuthService {
  private currentUser: User | null = null;
  private authListenerUnsubscribe: Unsubscribe | null = null;

  constructor() {
    this.initializeAuthListener();
  }

  /**
   * Initialize the auth listener
   */
  initializeAuthListener() {
    try {
      this.authListenerUnsubscribe = auth.onAuthStateChanged((user) => {
        console.log('Auth state changed:', user?.uid || 'null');
        this.currentUser = user;
        if (user) {
          this.saveUserToStorage(user);
        } else {
          this.clearUserFromStorage();
        }
      });
      console.log('Auth listener setup successfully');
    } catch (error) {
      console.error('Error setting up auth listener:', error);
    }
  }

  /**
   * Register a new anonymous user with a descriptor and optional location
   */
  async registerAnonymousUser(
    descriptor: string, 
    eventId?: string | null,
    location?: LocationCoords | null
  ) {
    try {
      console.log('Registering anonymous user with descriptor:', descriptor);
      console.log('With location:', location);
      
      // Step 1: Sign in anonymously with Firebase
      const userCredential = await auth.signInAnonymously();
      const user = userCredential.user;
      
      if (!user) {
        throw new Error('Failed to create anonymous user');
      }

      // Update the display name with the descriptor
      await user.updateProfile({
        displayName: descriptor
      });
      
      // Get the ID token
      const token = await user.getIdToken();
      
      // Save to AsyncStorage
      await AsyncStorage.setItem('authToken', token);
      await AsyncStorage.setItem('userId', user.uid);
      await AsyncStorage.setItem('userDescriptor', descriptor);
      
      console.log('Firebase anonymous user created:', user.uid);
      
      // Step 2: Register with Notamy backend
      // IMPORTANTE: Ora usiamo il formato corretto per registerAnonymous
      const registrationData = {
        descriptor: descriptor,
        event_id: eventId || null,
        location: location || {
          latitude: 0,
          longitude: 0
        },
        firebase_uid: user.uid, // IMPORTANTE: Passa l'UID Firebase!
        local_presence: 'unknown',
        mood: '',
        emoji: ''
      };
      
      console.log('Registering with backend using data:', registrationData);
      
      // CORRETTO: Usa registerAnonymous invece di registerUser
      const backendResponse = await apiService.registerAnonymous(registrationData);
      
      if (backendResponse.error) {
        throw new Error(backendResponse.detail || 'Backend registration failed');
      }
      
      console.log('Registration response:', backendResponse);
      console.log('Notamy backend registration successful');
      
      // Se abbiamo la location con coordinate reali, salviamola
      if (location && location.latitude !== 0 && location.longitude !== 0) {
        await AsyncStorage.setItem('userLocation', JSON.stringify(location));
      }
      
      return {
        uid: user.uid,
        token,
        descriptor,
        user,
        location
      };
    } catch (error: any) {
      console.error('Error registering anonymous user:', error);
      
      // Se è un errore di user già esistente, proviamo a fare login
      if (error.message?.includes('User already exists') || error.message?.includes('already registered')) {
        console.log('User already exists, attempting to recover session...');
        try {
          // Get current user o prova a fare sign in di nuovo
          const currentUser = this.getCurrentUser();
          if (currentUser) {
            const token = await currentUser.getIdToken();
            
            // Aggiorna il descriptor se necessario
            if (currentUser.displayName !== descriptor) {
              await currentUser.updateProfile({
                displayName: descriptor
              });
            }
            
            // Aggiorna AsyncStorage
            await AsyncStorage.setItem('authToken', token);
            await AsyncStorage.setItem('userId', currentUser.uid);
            await AsyncStorage.setItem('userDescriptor', descriptor);
            
            return {
              uid: currentUser.uid,
              token,
              descriptor,
              user: currentUser,
              location
            };
          }
        } catch (loginError) {
          console.error('Failed to recover existing user session:', loginError);
        }
      }
      
      throw new Error(error.message || 'Failed to register user');
    }
  }

  /**
   * Update user location on the backend
   */
  async updateUserLocation(location: LocationCoords) {
    try {
      if (!this.currentUser) {
        throw new Error('No authenticated user');
      }

      // Update location on the backend
      const response = await apiService.updateLocation(
        location.latitude,
        location.longitude,
        location.accuracy
      );

      if (response.error) {
        throw new Error(response.detail || 'Failed to update location');
      }

      // Save to AsyncStorage
      await AsyncStorage.setItem('userLocation', JSON.stringify(location));
      
      console.log('User location updated successfully');
      return response;
    } catch (error: any) {
      console.error('Error updating user location:', error);
      throw error;
    }
  }

  /**
   * Get saved user location from AsyncStorage
   */
  async getSavedLocation(): Promise<LocationCoords | null> {
    try {
      const locationStr = await AsyncStorage.getItem('userLocation');
      if (locationStr) {
        return JSON.parse(locationStr);
      }
      return null;
    } catch (error) {
      console.error('Error getting saved location:', error);
      return null;
    }
  }

  /**
   * Get current user
   */
  getCurrentUser(): User | null {
    return this.currentUser;
  }

  /**
   * Get current user's ID token
   */
  async getIdToken(): Promise<string | null> {
    if (!this.currentUser) {
      return null;
    }
    
    try {
      return await this.currentUser.getIdToken();
    } catch (error) {
      console.error('Error getting ID token:', error);
      return null;
    }
  }

  /**
   * Refresh the ID token
   */
  async refreshToken(): Promise<string | null> {
    if (!this.currentUser) {
      return null;
    }
    
    try {
      const token = await this.currentUser.getIdToken(true);
      // Update token in AsyncStorage
      await AsyncStorage.setItem('authToken', token);
      return token;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return null;
    }
  }

  /**
   * Sign out the current user
   */
  async signOut() {
    try {
      await auth.signOut();
      await this.clearUserFromStorage();
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    return !!this.currentUser;
  }

  /**
   * Get user data from AsyncStorage
   */
  async getUserData() {
    try {
      const [userId, descriptor, locationStr] = await AsyncStorage.multiGet([
        'userId',
        'userDescriptor',
        'userLocation'
      ]);
      
      let location = null;
      if (locationStr[1]) {
        try {
          location = JSON.parse(locationStr[1]);
        } catch (e) {
          console.error('Error parsing location:', e);
        }
      }
      
      return {
        userId: userId[1],
        descriptor: descriptor[1],
        location
      };
    } catch (error) {
      console.error('Error getting user data:', error);
      return null;
    }
  }

  /**
   * Save user info to AsyncStorage
   */
  private async saveUserToStorage(user: User) {
    try {
      await AsyncStorage.setItem('userId', user.uid);
      if (user.displayName) {
        await AsyncStorage.setItem('userDescriptor', user.displayName);
      }
    } catch (error) {
      console.error('Error saving user to storage:', error);
    }
  }

  /**
   * Clear user info from AsyncStorage
   */
  private async clearUserFromStorage() {
    try {
      await AsyncStorage.multiRemove([
        'authToken', 
        'userId', 
        'userDescriptor',
        'userLocation'
      ]);
    } catch (error) {
      console.error('Error clearing user from storage:', error);
    }
  }

  /**
   * Wait for auth to be ready
   */
  async waitForAuth(): Promise<User | null> {
    return new Promise((resolve) => {
      const unsubscribe = auth.onAuthStateChanged((user) => {
        unsubscribe();
        resolve(user);
      });
    });
  }

  /**
   * Check and refresh token if needed
   */
  async checkAndRefreshToken(): Promise<string | null> {
    try {
      if (!this.currentUser) {
        return null;
      }

      // Get current token
      const token = await this.currentUser.getIdToken();
      
      // Decode token to check expiration
      const tokenPayload = JSON.parse(atob(token.split('.')[1]));
      const expirationTime = tokenPayload.exp * 1000; // Convert to milliseconds
      const currentTime = Date.now();
      
      // If token expires in less than 5 minutes, refresh it
      if (expirationTime - currentTime < 5 * 60 * 1000) {
        console.log('Token expiring soon, refreshing...');
        return await this.refreshToken();
      }
      
      return token;
    } catch (error) {
      console.error('Error checking token:', error);
      return null;
    }
  }

  /**
   * Cleanup method
   */
  cleanup() {
    if (this.authListenerUnsubscribe) {
      this.authListenerUnsubscribe();
      this.authListenerUnsubscribe = null;
    }
  }
}

export default new FirebaseAuthService();