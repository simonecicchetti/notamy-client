import { configureStore } from '@reduxjs/toolkit';
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import authReducer from './slices/authSlice';
import chatReducer from './slices/chatSlice';
import notificationReducer from './slices/notificationSlice';
import uiReducer from './slices/uiSlice';
import usersReducer from './slices/usersSlice';
import momentsReducer from './slices/momentsSlice';
import profileReducer from './slices/profileSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    chat: chatReducer,
    notifications: notificationReducer,
    ui: uiReducer,
    users: usersReducer,
    moments: momentsReducer,
    profile: profileReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // Ignore these action types
        ignoredActions: [
          'auth/setUser',
          'moments/setMoments',
          'moments/addNearbyMoment',
          'moments/updateMomentStars',
          'moments/updateMomentMatch',
          'profile/fetchUser/fulfilled',
          'profile/updateMine/fulfilled',
          'profile/addMutualProfile',
          'profile/incrementProfileView',
        ],
        // Ignore these field paths in all actions
        ignoredActionPaths: [
          'payload.timestamp',
          'payload.user',
          'payload.created_at',
          'payload.expires_at',
          'payload.moments',
          'payload.profile',
          'payload.lastFetched',
          'payload.lastViewTime',
        ],
        // Ignore these paths in the state
        ignoredPaths: [
          'auth.user',
          'moments.moments',
          'moments.myMoments',
          'moments.nearbyMoments',
          'moments.notifications',
          'profile.cachedProfiles',
          'profile.profileViews.lastViewTime',
        ],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Typed hooks
export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;