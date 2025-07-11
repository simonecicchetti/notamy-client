// src/store/slices/usersSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { NearbyUser as ApiNearbyUser } from '@/types/api';

// Extend API NearbyUser with client-side fields
interface NearbyUser extends ApiNearbyUser {
  id: string; // Add id for client-side tracking
  hasProfile?: boolean; // Indica se ha un profilo completo
  isMutual?: boolean;
  isNoted?: boolean;
  status: 'online' | 'offline';
  
  // Additional profile fields (if hasProfile is true)
  age?: number;
  height?: number;
  languages?: string[];
  last_trip?: string;
  todays_song?: string;
  lastSeen?: string; // ISO timestamp
}

interface UsersState {
  nearbyUsers: NearbyUser[];
  onlineCount: number;
  loading: boolean;
  error: string | null;
  lastUpdated: string | null; // ISO timestamp
}

const initialState: UsersState = {
  nearbyUsers: [],
  onlineCount: 0,
  loading: false,
  error: null,
  lastUpdated: null,
};

const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    // Update all nearby users
    updateNearbyUsers: (state, action: PayloadAction<NearbyUser[]>) => {
      state.nearbyUsers = action.payload;
      state.onlineCount = action.payload.filter(user => user.status === 'online').length;
      state.lastUpdated = new Date().toISOString();
      state.error = null;
    },
    
    // Set loading state
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    
    // Set error state
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.loading = false;
    },
    
    // Update mutual status for a specific user
    setUserMutual: (state, action: PayloadAction<{ userId: string; isMutual: boolean }>) => {
      const user = state.nearbyUsers.find(u => u.id === action.payload.userId || u.user_id === action.payload.userId);
      if (user) {
        user.isMutual = action.payload.isMutual;
      }
    },
    
    // Update noted status for a specific user
    setUserNoted: (state, action: PayloadAction<{ userId: string; isNoted: boolean }>) => {
      const user = state.nearbyUsers.find(u => u.id === action.payload.userId || u.user_id === action.payload.userId);
      if (user) {
        user.isNoted = action.payload.isNoted;
      }
    },
    
    // Update user status (online/offline)
    updateUserStatus: (state, action: PayloadAction<{ userId: string; status: 'online' | 'offline' }>) => {
      const user = state.nearbyUsers.find(u => u.id === action.payload.userId || u.user_id === action.payload.userId);
      if (user) {
        user.status = action.payload.status;
        user.lastSeen = new Date().toISOString();
        
        // Recalculate online count
        state.onlineCount = state.nearbyUsers.filter(u => u.status === 'online').length;
      }
    },
    
    // Update distance for a specific user
    updateUserDistance: (state, action: PayloadAction<{ userId: string; distance: number }>) => {
      const user = state.nearbyUsers.find(u => u.id === action.payload.userId || u.user_id === action.payload.userId);
      if (user) {
        user.distance = action.payload.distance;
      }
    },
    
    // Add or update a single user
    upsertUser: (state, action: PayloadAction<NearbyUser>) => {
      const existingIndex = state.nearbyUsers.findIndex(u => 
        u.id === action.payload.id || u.user_id === action.payload.user_id
      );
      
      if (existingIndex !== -1) {
        // Update existing user
        state.nearbyUsers[existingIndex] = action.payload;
      } else {
        // Add new user
        state.nearbyUsers.push(action.payload);
      }
      
      // Recalculate online count
      state.onlineCount = state.nearbyUsers.filter(u => u.status === 'online').length;
      state.lastUpdated = new Date().toISOString();
    },
    
    // Remove a user
    removeUser: (state, action: PayloadAction<string>) => {
      state.nearbyUsers = state.nearbyUsers.filter(u => 
        u.id !== action.payload && u.user_id !== action.payload
      );
      state.onlineCount = state.nearbyUsers.filter(u => u.status === 'online').length;
    },
    
    // Update user profile data
    updateUserProfile: (state, action: PayloadAction<{ userId: string; profile: Partial<NearbyUser> }>) => {
      const user = state.nearbyUsers.find(u => 
        u.id === action.payload.userId || u.user_id === action.payload.userId
      );
      if (user) {
        Object.assign(user, action.payload.profile);
        user.hasProfile = true;
      }
    },
    
    // Sort users by distance
    sortUsersByDistance: (state) => {
      state.nearbyUsers.sort((a, b) => a.distance - b.distance);
    },
    
    // Clear all users
    clearUsers: (state) => {
      state.nearbyUsers = [];
      state.onlineCount = 0;
      state.lastUpdated = null;
      state.error = null;
    },
    
    // Update online count manually (useful for quick updates)
    setOnlineCount: (state, action: PayloadAction<number>) => {
      state.onlineCount = action.payload;
    },
  },
});

export const { 
  updateNearbyUsers, 
  setLoading,
  setError,
  setUserMutual,
  setUserNoted,
  updateUserStatus,
  updateUserDistance,
  upsertUser,
  removeUser,
  updateUserProfile,
  sortUsersByDistance,
  clearUsers,
  setOnlineCount
} = usersSlice.actions;

// Selectors
export const selectNearbyUsers = (state: { users: UsersState }) => state.users.nearbyUsers;
export const selectOnlineUsers = (state: { users: UsersState }) => 
  state.users.nearbyUsers.filter(user => user.status === 'online');
export const selectMutualUsers = (state: { users: UsersState }) => 
  state.users.nearbyUsers.filter(user => user.isMutual);
export const selectNotedUsers = (state: { users: UsersState }) => 
  state.users.nearbyUsers.filter(user => user.isNoted);
export const selectUsersWithProfile = (state: { users: UsersState }) => 
  state.users.nearbyUsers.filter(user => user.hasProfile);
export const selectUserById = (userId: string) => (state: { users: UsersState }) =>
  state.users.nearbyUsers.find(user => user.id === userId || user.user_id === userId);

export default usersSlice.reducer;