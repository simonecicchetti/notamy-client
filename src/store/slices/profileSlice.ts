// store/slices/profileSlice.ts
import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import apiService from '@/services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  UserProfile,
  ProfileUpdateRequest,
  ApiError,
  Badge
} from '@/types/api';

// Extend UserProfile with additional client-side fields
interface ExtendedUserProfile extends UserProfile {
  // Additional fields specific to this app
  age?: number;
  height?: number;
  languages?: string[];
  last_trip?: string;
  todays_song?: string;
  badges?: Badge[];
  recent_activity?: {
    notes_today: number;
    last_note_time?: number;
    views_today: number;
    last_view_time?: number;
  };
}

// State interface specific to this slice
interface ProfileState {
  // Cache profili con logica di accesso
  cachedProfiles: {
    [userId: string]: {
      profile: ExtendedUserProfile;
      lastFetched: number;
      accessType: 'proximity' | 'mutual' | 'blocked';
      conversationId?: string; // Per tracking mutual
    };
  };
  
  // Tracking visibilità
  visibleProfiles: string[]; // User IDs attualmente visibili
  mutualProfiles: string[]; // User IDs con mutual connection
  blockedProfiles: string[]; // User IDs bloccati
  
  // UI state
  loading: boolean;
  error: string | null;
  
  // Social proof
  profileViews: {
    today: number;
    lastViewTime?: number;
  };
}

const initialState: ProfileState = {
  cachedProfiles: {},
  visibleProfiles: [],
  mutualProfiles: [],
  blockedProfiles: [],
  loading: false,
  error: null,
  profileViews: {
    today: 0,
  },
};

// Type guard for API errors
const isApiError = (response: any): response is ApiError => {
  return response?.error === true;
};

// Async thunks
export const fetchUserProfile = createAsyncThunk(
  'profile/fetchUser',
  async ({ userId, accessType }: { userId: string; accessType: 'proximity' | 'mutual' }) => {
    const response = await apiService.getUserProfile(userId);
    
    if (isApiError(response)) {
      throw new Error(response.detail);
    }
    
    return {
      userId,
      profile: response as UserProfile,
      accessType,
    };
  }
);

export const updateMyProfile = createAsyncThunk(
  'profile/updateMine',
  async (updates: ProfileUpdateRequest) => {
    const response = await apiService.updateUserProfile(updates);
    
    if (isApiError(response)) {
      throw new Error(response.detail);
    }
    
    return response;
  }
);

const profileSlice = createSlice({
  name: 'profile',
  initialState,
  reducers: {
    // Aggiungi profilo visibile (proximity)
    addVisibleProfile: (state, action: PayloadAction<string>) => {
      if (!state.visibleProfiles.includes(action.payload)) {
        state.visibleProfiles.push(action.payload);
      }
    },
    
    // Rimuovi profilo da visibili (fuori range)
    removeVisibleProfile: (state, action: PayloadAction<string>) => {
      state.visibleProfiles = state.visibleProfiles.filter(id => id !== action.payload);
      
      // Se non è mutual, rimuovi anche dalla cache
      if (!state.mutualProfiles.includes(action.payload)) {
        const cached = state.cachedProfiles[action.payload];
        if (cached?.accessType === 'proximity') {
          delete state.cachedProfiles[action.payload];
        }
      }
    },
    
    // Aggiungi mutual connection
    addMutualProfile: (state, action: PayloadAction<{ userId: string; conversationId: string }>) => {
      const { userId, conversationId } = action.payload;
      
      if (!state.mutualProfiles.includes(userId)) {
        state.mutualProfiles.push(userId);
      }
      
      // Aggiorna cache se esiste
      if (state.cachedProfiles[userId]) {
        state.cachedProfiles[userId].accessType = 'mutual';
        state.cachedProfiles[userId].conversationId = conversationId;
      }
    },
    
    // Blocca/rimuovi profilo
    blockProfile: (state, action: PayloadAction<string>) => {
      const userId = action.payload;
      
      // Aggiungi a blocked
      if (!state.blockedProfiles.includes(userId)) {
        state.blockedProfiles.push(userId);
      }
      
      // Rimuovi da visible e mutual
      state.visibleProfiles = state.visibleProfiles.filter(id => id !== userId);
      state.mutualProfiles = state.mutualProfiles.filter(id => id !== userId);
      
      // Marca come blocked in cache
      if (state.cachedProfiles[userId]) {
        state.cachedProfiles[userId].accessType = 'blocked';
      }
    },
    
    // Incrementa profile views
    incrementProfileView: (state) => {
      state.profileViews.today += 1;
      state.profileViews.lastViewTime = Date.now();
    },
    
    // Reset daily stats
    resetDailyStats: (state) => {
      state.profileViews.today = 0;
    },
    
    // Clear cache di profili non più necessari
    cleanupProfiles: (state) => {
      const now = Date.now();
      const ONE_HOUR = 60 * 60 * 1000;
      
      Object.keys(state.cachedProfiles).forEach(userId => {
        const cached = state.cachedProfiles[userId];
        
        // Mantieni sempre mutual e blocked
        if (cached.accessType === 'mutual' || cached.accessType === 'blocked') {
          return;
        }
        
        // Rimuovi proximity profiles non più visibili e vecchi
        if (!state.visibleProfiles.includes(userId) && 
            now - cached.lastFetched > ONE_HOUR) {
          delete state.cachedProfiles[userId];
        }
      });
    },
    
    // Update cached profile data
    updateCachedProfile: (state, action: PayloadAction<{
      userId: string;
      updates: Partial<ExtendedUserProfile>;
    }>) => {
      const { userId, updates } = action.payload;
      if (state.cachedProfiles[userId]) {
        state.cachedProfiles[userId].profile = {
          ...state.cachedProfiles[userId].profile,
          ...updates
        };
      }
    },
    
    // Clear error
    clearError: (state) => {
      state.error = null;
    },
  },
  
  extraReducers: (builder) => {
    builder
      .addCase(fetchUserProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchUserProfile.fulfilled, (state, action) => {
        const { userId, profile, accessType } = action.payload;
        
        state.cachedProfiles[userId] = {
          profile: profile as ExtendedUserProfile,
          lastFetched: Date.now(),
          accessType,
        };
        state.loading = false;
      })
      .addCase(fetchUserProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch profile';
      })
      
      // Update profile
      .addCase(updateMyProfile.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateMyProfile.fulfilled, (state, action) => {
        state.loading = false;
        // If updating own profile, update it in cache if present
        // This assumes the response includes the user_id
        const updatedProfile = action.payload as UserProfile;
        if (updatedProfile.user_id && state.cachedProfiles[updatedProfile.user_id]) {
          state.cachedProfiles[updatedProfile.user_id].profile = {
            ...state.cachedProfiles[updatedProfile.user_id].profile,
            ...updatedProfile
          };
        }
      })
      .addCase(updateMyProfile.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to update profile';
      });
  },
});

export const {
  addVisibleProfile,
  removeVisibleProfile,
  addMutualProfile,
  blockProfile,
  incrementProfileView,
  resetDailyStats,
  cleanupProfiles,
  updateCachedProfile,
  clearError,
} = profileSlice.actions;

// Selectors
export const selectProfileById = (userId: string) => (state: { profile: ProfileState }) => 
  state.profile.cachedProfiles[userId]?.profile;

export const selectCanAccessProfile = (userId: string) => (state: { profile: ProfileState }) => {
  // Blocked users cannot be accessed
  if (state.profile.blockedProfiles.includes(userId)) return false;
  
  // Check if visible (proximity) or mutual
  return state.profile.visibleProfiles.includes(userId) || 
         state.profile.mutualProfiles.includes(userId);
};

export const selectProfileAccessType = (userId: string) => (state: { profile: ProfileState }) => 
  state.profile.cachedProfiles[userId]?.accessType;

export const selectVisibleProfiles = (state: { profile: ProfileState }) => 
  state.profile.visibleProfiles;

export const selectMutualProfiles = (state: { profile: ProfileState }) => 
  state.profile.mutualProfiles;

export const selectProfileViews = (state: { profile: ProfileState }) => 
  state.profile.profileViews;

export const selectProfileLoading = (state: { profile: ProfileState }) => 
  state.profile.loading;

export const selectProfileError = (state: { profile: ProfileState }) => 
  state.profile.error;

// Export types
export type { ProfileState, ExtendedUserProfile };

export default profileSlice.reducer;