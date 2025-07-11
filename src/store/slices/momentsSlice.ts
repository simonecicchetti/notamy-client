import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { 
  StarInfo, 
  MomentLocation, 
  MomentAuthor,
  MomentResponse,
  MomentNotification
} from '@/types/api';

// Extend MomentResponse with client-side fields
interface Moment extends MomentResponse {
  // Additional client-side fields
  distance?: number;
  is_nearby?: boolean;
}

// State interface specific to this slice
interface MomentsState {
  moments: Moment[];
  myMoments: Moment[];
  nearbyMoments: Moment[];
  notifications: MomentNotification[];
  notificationCount: number;
  loading: boolean;
  error: string | null;
  lastRefresh: number | null;
}

const initialState: MomentsState = {
  moments: [],
  myMoments: [],
  nearbyMoments: [],
  notifications: [],
  notificationCount: 0,
  loading: false,
  error: null,
  lastRefresh: null,
};

const momentsSlice = createSlice({
  name: 'moments',
  initialState,
  reducers: {
    // Set all moments (from API) - Updated to accept currentUserId
    setMoments: (state, action: PayloadAction<{ moments: Moment[]; currentUserId: string }>) => {
      const { moments, currentUserId } = action.payload;
      state.moments = moments;
      state.loading = false;
      state.error = null;
      state.lastRefresh = Date.now();
      
      // Separate my moments using both is_my_moment flag and author.user_id
      state.myMoments = moments.filter(m => 
        m.is_my_moment || 
        (m.author.user_id && m.author.user_id === currentUserId)
      );
      state.nearbyMoments = moments.filter(m => 
        !m.is_my_moment && 
        m.is_nearby && 
        (!m.author.user_id || m.author.user_id !== currentUserId)
      );
    },
    
    // Add a new nearby moment (from WebSocket)
    addNearbyMoment: (state, action: PayloadAction<Moment>) => {
      const moment = action.payload;
      
      // Check if moment already exists
      const existingIndex = state.moments.findIndex(m => m.id === moment.id);
      if (existingIndex === -1) {
        state.moments.unshift(moment);
        
        if (moment.is_nearby && !moment.is_my_moment) {
          state.nearbyMoments.unshift(moment);
        }
      }
    },
    
    // Update moment stars (when someone stars your moment)
    updateMomentStars: (state, action: PayloadAction<{
      momentId: string;
      totalStars: number;
      starSender?: {
        user_id: string;
        descriptor: string;
        timestamp: number;
      };
    }>) => {
      const { momentId, totalStars, starSender } = action.payload;
      
      const moment = state.moments.find(m => m.id === momentId);
      if (moment) {
        moment.star_count = totalStars;
        
        // Add star sender to stars_received if provided
        if (starSender && moment.stars_received) {
          const existingStar = moment.stars_received.find(s => s.user_id === starSender.user_id);
          if (!existingStar) {
            moment.stars_received.push({
              ...starSender,
              confirmed: false
            });
          }
        } else if (starSender && !moment.stars_received) {
          moment.stars_received = [{
            ...starSender,
            confirmed: false
          }];
        }
      }
      
      // Update in myMoments array too
      const myMoment = state.myMoments.find(m => m.id === momentId);
      if (myMoment) {
        myMoment.star_count = totalStars;
        if (starSender) {
          if (!myMoment.stars_received) {
            myMoment.stars_received = [];
          }
          const existingStar = myMoment.stars_received.find(s => s.user_id === starSender.user_id);
          if (!existingStar) {
            myMoment.stars_received.push({
              ...starSender,
              confirmed: false
            });
          }
        }
      }
    },
    
    // Update moment match status
    updateMomentMatch: (state, action: PayloadAction<{
      momentId: string;
      matchedUserId: string;
      matchedUserDescriptor: string;
      isMutual: boolean;
    }>) => {
      const { momentId, matchedUserId, isMutual } = action.payload;
      
      const moment = state.moments.find(m => m.id === momentId);
      if (moment) {
        moment.is_matched = true;
        moment.matched_with_me = true;
        
        // Add to confirmed matches
        if (!moment.confirmed_matches) {
          moment.confirmed_matches = [];
        }
        if (!moment.confirmed_matches.includes(matchedUserId)) {
          moment.confirmed_matches.push(matchedUserId);
        }
        
        // Update star confirmation status
        if (moment.stars_received) {
          const star = moment.stars_received.find(s => s.user_id === matchedUserId);
          if (star) {
            star.confirmed = true;
          }
        }
      }
      
      // Update in appropriate arrays
      const updateInArray = (array: Moment[]) => {
        const m = array.find(m => m.id === momentId);
        if (m) {
          m.is_matched = true;
          m.matched_with_me = true;
          if (!m.confirmed_matches) {
            m.confirmed_matches = [];
          }
          if (!m.confirmed_matches.includes(matchedUserId)) {
            m.confirmed_matches.push(matchedUserId);
          }
        }
      };
      
      updateInArray(state.myMoments);
      updateInArray(state.nearbyMoments);
    },
    
    // Mark moment as expired
    setMomentExpired: (state, action: PayloadAction<string>) => {
      const momentId = action.payload;
      
      const updateExpired = (moment: Moment | undefined) => {
        if (moment) {
          moment.is_expired = true;
          moment.status = 'expired';
          moment.can_star = false;
          moment.can_manage = false;
        }
      };
      
      updateExpired(state.moments.find(m => m.id === momentId));
      updateExpired(state.myMoments.find(m => m.id === momentId));
      updateExpired(state.nearbyMoments.find(m => m.id === momentId));
    },
    
    // Remove moment (deleted)
    removeMoment: (state, action: PayloadAction<string>) => {
      const momentId = action.payload;
      
      state.moments = state.moments.filter(m => m.id !== momentId);
      state.myMoments = state.myMoments.filter(m => m.id !== momentId);
      state.nearbyMoments = state.nearbyMoments.filter(m => m.id !== momentId);
    },
    
    // Add moment notification
    addMomentNotification: (state, action: PayloadAction<MomentNotification>) => {
      state.notifications.unshift(action.payload);
      state.notificationCount += 1;
    },
    
    // Set moment notifications (from API)
    setMomentNotifications: (state, action: PayloadAction<{
      count: number;
      moments: MomentNotification[];
    }>) => {
      state.notifications = action.payload.moments;
      state.notificationCount = action.payload.count;
    },
    
    // Clear notifications
    clearMomentNotifications: (state) => {
      state.notifications = [];
      state.notificationCount = 0;
    },
    
    // Update a single moment
    updateMoment: (state, action: PayloadAction<{
      momentId: string;
      updates: Partial<Moment>;
    }>) => {
      const { momentId, updates } = action.payload;
      
      const updateInArray = (array: Moment[]) => {
        const moment = array.find(m => m.id === momentId);
        if (moment) {
          Object.assign(moment, updates);
        }
      };
      
      updateInArray(state.moments);
      updateInArray(state.myMoments);
      updateInArray(state.nearbyMoments);
    },
    
    // Set loading state
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    
    // Set error
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.loading = false;
    },
    
    // Mark moment as starred by current user
    markMomentStarred: (state, action: PayloadAction<string>) => {
      const momentId = action.payload;
      
      const updateStarred = (moment: Moment | undefined) => {
        if (moment) {
          moment.i_starred = true;
          moment.can_star = false;
          moment.star_count += 1;
        }
      };
      
      updateStarred(state.moments.find(m => m.id === momentId));
      updateStarred(state.nearbyMoments.find(m => m.id === momentId));
    },
    
    // Confirm a star/match (for moment authors)
    confirmStar: (state, action: PayloadAction<{
      momentId: string;
      starUserId: string;
      isMatch: boolean;
    }>) => {
      const { momentId, starUserId, isMatch } = action.payload;
      
      const moment = state.moments.find(m => m.id === momentId);
      if (moment && moment.stars_received) {
        const star = moment.stars_received.find(s => s.user_id === starUserId);
        if (star) {
          star.confirmed = isMatch;
        }
        
        if (isMatch) {
          moment.is_matched = true;
          if (!moment.confirmed_matches) {
            moment.confirmed_matches = [];
          }
          if (!moment.confirmed_matches.includes(starUserId)) {
            moment.confirmed_matches.push(starUserId);
          }
        } else {
          // Remove star if denied
          moment.stars_received = moment.stars_received.filter(s => s.user_id !== starUserId);
          moment.star_count = Math.max(0, moment.star_count - 1);
        }
      }
      
      // Update in myMoments too
      const myMoment = state.myMoments.find(m => m.id === momentId);
      if (myMoment && myMoment.stars_received) {
        const star = myMoment.stars_received.find(s => s.user_id === starUserId);
        if (star) {
          star.confirmed = isMatch;
        }
        
        if (isMatch) {
          myMoment.is_matched = true;
          if (!myMoment.confirmed_matches) {
            myMoment.confirmed_matches = [];
          }
          if (!myMoment.confirmed_matches.includes(starUserId)) {
            myMoment.confirmed_matches.push(starUserId);
          }
        } else {
          myMoment.stars_received = myMoment.stars_received.filter(s => s.user_id !== starUserId);
          myMoment.star_count = Math.max(0, myMoment.star_count - 1);
        }
      }
    },
    
    // Update moment star count (simplified version for WebSocket updates)
    updateMomentStarCount: (state, action: PayloadAction<{
      momentId: string;
      starCount: number;
    }>) => {
      const { momentId, starCount } = action.payload;
      
      const updateCount = (moment: Moment | undefined) => {
        if (moment) {
          moment.star_count = starCount;
        }
      };
      
      updateCount(state.moments.find(m => m.id === momentId));
      updateCount(state.myMoments.find(m => m.id === momentId));
      updateCount(state.nearbyMoments.find(m => m.id === momentId));
    },
    
    // Update moment matched status
    updateMomentMatched: (state, action: PayloadAction<{
      momentId: string;
      matchedWithMe: boolean;
    }>) => {
      const { momentId, matchedWithMe } = action.payload;
      
      const updateMatched = (moment: Moment | undefined) => {
        if (moment) {
          moment.is_matched = true;
          moment.matched_with_me = matchedWithMe;
        }
      };
      
      updateMatched(state.moments.find(m => m.id === momentId));
      updateMatched(state.myMoments.find(m => m.id === momentId));
      updateMatched(state.nearbyMoments.find(m => m.id === momentId));
    },
    
    // Confirm moment match
    confirmMomentMatch: (state, action: PayloadAction<{
      momentId: string;
      starUserId: string;
    }>) => {
      const { momentId, starUserId } = action.payload;
      
      const confirmMatch = (moment: Moment | undefined) => {
        if (moment) {
          moment.is_matched = true;
          if (!moment.confirmed_matches) {
            moment.confirmed_matches = [];
          }
          if (!moment.confirmed_matches.includes(starUserId)) {
            moment.confirmed_matches.push(starUserId);
          }
          
          // Update star confirmation
          if (moment.stars_received) {
            const star = moment.stars_received.find(s => s.user_id === starUserId);
            if (star) {
              star.confirmed = true;
            }
          }
        }
      };
      
      confirmMatch(state.moments.find(m => m.id === momentId));
      confirmMatch(state.myMoments.find(m => m.id === momentId));
    },
    
    // Remove star (deny match)
    removeStar: (state, action: PayloadAction<{
      momentId: string;
      starUserId: string;
    }>) => {
      const { momentId, starUserId } = action.payload;
      
      const removeStarFromMoment = (moment: Moment | undefined) => {
        if (moment && moment.stars_received) {
          moment.stars_received = moment.stars_received.filter(s => s.user_id !== starUserId);
          moment.star_count = Math.max(0, moment.star_count - 1);
        }
      };
      
      removeStarFromMoment(state.moments.find(m => m.id === momentId));
      removeStarFromMoment(state.myMoments.find(m => m.id === momentId));
    },
    
    // Reset state
    resetMoments: () => initialState,
  },
});

// Export actions
export const {
  setMoments,
  addNearbyMoment,
  updateMomentStars,
  updateMomentMatch,
  setMomentExpired,
  removeMoment,
  addMomentNotification,
  setMomentNotifications,
  clearMomentNotifications,
  updateMoment,
  setLoading,
  setError,
  markMomentStarred,
  confirmStar,
  updateMomentStarCount,
  updateMomentMatched,
  confirmMomentMatch,
  removeStar,
  resetMoments,
} = momentsSlice.actions;

// Selectors
export const selectAllMoments = (state: { moments: MomentsState }) => state.moments.moments;
export const selectMyMoments = (state: { moments: MomentsState }) => state.moments.myMoments;
export const selectNearbyMoments = (state: { moments: MomentsState }) => state.moments.nearbyMoments;
export const selectMomentNotifications = (state: { moments: MomentsState }) => state.moments.notifications;
export const selectMomentNotificationCount = (state: { moments: MomentsState }) => state.moments.notificationCount;
export const selectMomentsLoading = (state: { moments: MomentsState }) => state.moments.loading;
export const selectMomentsError = (state: { moments: MomentsState }) => state.moments.error;
export const selectMomentById = (momentId: string) => (state: { moments: MomentsState }) => 
  state.moments.moments.find(m => m.id === momentId);

// Export types for use in other files
export type { Moment, MomentsState };

export default momentsSlice.reducer;