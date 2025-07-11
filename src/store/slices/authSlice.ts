// src/store/slices/authSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AuthState {
  user: {
    // STANDARDIZED: Only use user_id everywhere
    user_id: string;
    descriptor: string;
    badges?: string[];
    
    // Basic profile fields
    emoji?: string;
    bio?: string;
    photos?: string[];
    age?: number;
    height?: number;
    languages?: string[];
    last_trip?: string;
    todays_song?: string;
    stats?: {
      moments: number;
      mutuals: number;
      stars: number;
    };
  } | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  token: null,
  isAuthenticated: false,
  loading: false,
  error: null,
};

export const checkAuthStatus = createAsyncThunk(
  'auth/checkStatus',
  async () => {
    const token = await AsyncStorage.getItem('authToken');
    const userId = await AsyncStorage.getItem('userId');
    const userDescriptor = await AsyncStorage.getItem('userDescriptor');
    
    // Try to load cached user profile
    let userProfile = null;
    try {
      const profileData = await AsyncStorage.getItem('userProfile');
      if (profileData) {
        userProfile = JSON.parse(profileData);
      }
    } catch (error) {
      console.warn('Failed to load cached profile');
    }
    
    return { 
      hasToken: !!token, 
      userId,
      userDescriptor,
      userProfile,
      token
    };
  }
);

export const signOutUser = createAsyncThunk(
  'auth/signOut',
  async () => {
    // Clear all auth-related data
    await AsyncStorage.multiRemove([
      'authToken',
      'userId',
      'userDescriptor',
      'userProfile'
    ]);
    
    // Clear encryption keys (imported from encryptionService)
    const { default: encryptionService } = await import('@/services/encryptionService');
    await encryptionService.deleteAllStoredKeys();
    
    // Clear secure key storage
    const { default: secureKeyService } = await import('@/services/secureKeyService');
    await secureKeyService.clearAll();
  }
);

// Save user profile to AsyncStorage
export const saveUserProfile = createAsyncThunk(
  'auth/saveProfile',
  async (profile: Partial<AuthState['user']>) => {
    if (profile) {
      await AsyncStorage.setItem('userProfile', JSON.stringify(profile));
    }
    return profile;
  }
);

// Load user profile from AsyncStorage
export const loadUserProfile = createAsyncThunk(
  'auth/loadProfile',
  async () => {
    const profileData = await AsyncStorage.getItem('userProfile');
    return profileData ? JSON.parse(profileData) : null;
  }
);

// Save auth credentials
export const saveAuthCredentials = createAsyncThunk(
  'auth/saveCredentials',
  async ({ token, user }: { token: string; user: AuthState['user'] }) => {
    if (!user) throw new Error('User data required');
    
    await AsyncStorage.multiSet([
      ['authToken', token],
      ['userId', user.user_id],
      ['userDescriptor', user.descriptor],
      ['userProfile', JSON.stringify(user)]
    ]);
    
    return { token, user };
  }
);

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setMockAuth: (state, action: PayloadAction<boolean>) => {
      state.isAuthenticated = action.payload;
      if (action.payload) {
        state.token = 'mock-token';
        // Create mock user with standardized user_id
        state.user = {
          user_id: 'mock-user-123',
          descriptor: 'Mock User',
          badges: ['tester']
        };
      } else {
        state.token = null;
        state.user = null;
      }
    },
    setUser: (state, action: PayloadAction<AuthState['user']>) => {
      state.user = action.payload;
    },
    setToken: (state, action: PayloadAction<string | null>) => {
      state.token = action.payload;
      state.isAuthenticated = !!action.payload;
    },
    // Update user profile action
    updateUserProfile: (state, action: PayloadAction<Partial<AuthState['user']>>) => {
      if (state.user) {
        state.user = { ...state.user, ...action.payload };
        // Save to AsyncStorage in background
        AsyncStorage.setItem('userProfile', JSON.stringify(state.user)).catch(console.warn);
      }
    },
    // Update user stats
    updateUserStats: (state, action: PayloadAction<Partial<AuthState['user']['stats']>>) => {
      if (state.user) {
        state.user.stats = {
          ...state.user.stats,
          ...action.payload
        };
      }
    },
    // Add photo to user profile
    addUserPhoto: (state, action: PayloadAction<string>) => {
      if (state.user) {
        if (!state.user.photos) {
          state.user.photos = [];
        }
        state.user.photos.push(action.payload);
      }
    },
    // Remove photo from user profile
    removeUserPhoto: (state, action: PayloadAction<number>) => {
      if (state.user && state.user.photos) {
        state.user.photos.splice(action.payload, 1);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Check auth status
      .addCase(checkAuthStatus.pending, (state) => {
        state.loading = true;
      })
      .addCase(checkAuthStatus.fulfilled, (state, action) => {
        state.loading = false;
        const { hasToken, userId, userDescriptor, userProfile, token } = action.payload;
        
        if (hasToken && userId) {
          state.isAuthenticated = true;
          state.token = token || 'existing-token';
          
          // Reconstruct user from stored data
          state.user = userProfile || {
            user_id: userId,
            descriptor: userDescriptor || 'User',
          };
        } else {
          state.isAuthenticated = false;
          state.token = null;
          state.user = null;
        }
      })
      .addCase(checkAuthStatus.rejected, (state) => {
        state.loading = false;
        state.isAuthenticated = false;
        state.token = null;
        state.user = null;
      })
      
      // Sign out
      .addCase(signOutUser.fulfilled, (state) => {
        state.user = null;
        state.token = null;
        state.isAuthenticated = false;
        state.error = null;
      })
      
      // Save credentials
      .addCase(saveAuthCredentials.fulfilled, (state, action) => {
        state.token = action.payload.token;
        state.user = action.payload.user;
        state.isAuthenticated = true;
      })
      
      // Save profile
      .addCase(saveUserProfile.fulfilled, (state, action) => {
        if (state.user && action.payload) {
          state.user = { ...state.user, ...action.payload };
        }
      })
      
      // Load profile
      .addCase(loadUserProfile.fulfilled, (state, action) => {
        if (action.payload && state.user) {
          state.user = { ...state.user, ...action.payload };
        }
      });
  },
});

export const { 
  clearError, 
  setMockAuth, 
  setUser, 
  setToken,
  updateUserProfile,
  updateUserStats,
  addUserPhoto,
  removeUserPhoto
} = authSlice.actions;

// Selectors
export const selectUser = (state: { auth: AuthState }) => state.auth.user;
export const selectUserId = (state: { auth: AuthState }) => state.auth.user?.user_id;
export const selectIsAuthenticated = (state: { auth: AuthState }) => state.auth.isAuthenticated;
export const selectAuthToken = (state: { auth: AuthState }) => state.auth.token;

export default authSlice.reducer;