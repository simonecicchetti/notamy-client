import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import * as Notifications from 'expo-notifications';
import { Notification as ApiNotification } from '@/types/api';

// Extend API notification with client-side fields
interface Notification extends ApiNotification {
  status: 'read' | 'unread';
  message: string; // Human-readable message derived from content
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
}

const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,
};

// Configure notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Async thunks
export const registerForPushNotifications = createAsyncThunk(
  'notifications/register',
  async () => {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      throw new Error('Push notification permissions not granted');
    }
    
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    return token;
  }
);

export const loadNotifications = createAsyncThunk(
  'notifications/load',
  async () => {
    // Here you would fetch from API
    // For now, return mock data
    const mockNotifications: Notification[] = [];
    return mockNotifications;
  }
);

export const markAsRead = createAsyncThunk(
  'notifications/markAsRead',
  async (notificationId: string) => {
    // Here you would update on API
    return notificationId;
  }
);

export const markAllAsRead = createAsyncThunk(
  'notifications/markAllAsRead',
  async () => {
    // Here you would update on API
    return true;
  }
);

// Slice
const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    addNotification: (state, action: PayloadAction<Notification>) => {
      state.notifications.unshift(action.payload);
      if (action.payload.status === 'unread') {
        state.unreadCount++;
      }
    },
    removeNotification: (state, action: PayloadAction<string>) => {
      const index = state.notifications.findIndex(n => n.id === action.payload);
      if (index >= 0) {
        if (state.notifications[index].status === 'unread') {
          state.unreadCount--;
        }
        state.notifications.splice(index, 1);
      }
    },
    updateUnreadCount: (state) => {
      state.unreadCount = state.notifications.filter(n => n.status === 'unread').length;
    },
    clearError: (state) => {
      state.error = null;
    },
    clearNotifications: (state) => { // NEW: Added this reducer for clearing all
      state.notifications = [];
      state.unreadCount = 0;
    },
  },
  extraReducers: (builder) => {
    // Register for push notifications
    builder
      .addCase(registerForPushNotifications.fulfilled, (state) => {
        state.error = null;
      })
      .addCase(registerForPushNotifications.rejected, (state, action) => {
        state.error = action.error.message || 'Failed to register for notifications';
      });
    
    // Load notifications
    builder
      .addCase(loadNotifications.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadNotifications.fulfilled, (state, action) => {
        state.loading = false;
        state.notifications = action.payload;
        state.unreadCount = action.payload.filter(n => n.status === 'unread').length;
      })
      .addCase(loadNotifications.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to load notifications';
      });
    
    // Mark as read
    builder
      .addCase(markAsRead.fulfilled, (state, action) => {
        const notification = state.notifications.find(n => n.id === action.payload);
        if (notification && notification.status === 'unread') {
          notification.status = 'read';
          state.unreadCount--;
        }
      });
    
    // Mark all as read
    builder
      .addCase(markAllAsRead.fulfilled, (state) => {
        state.notifications.forEach(n => {
          if (n.status === 'unread') {
            n.status = 'read';
          }
        });
        state.unreadCount = 0;
      });
  },
});

export const { 
  addNotification, 
  removeNotification, 
  updateUnreadCount, 
  clearError,
  clearNotifications // NEW: Exported the new action
} = notificationSlice.actions;

export default notificationSlice.reducer;