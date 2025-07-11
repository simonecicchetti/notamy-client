// src/store/slices/uiSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface UIState {
  isLoading: boolean;
  loadingMessage: string | null;
  error: string | null;
  success: string | null;
  activeTab: string;
  activeZone: string | null;
  theme: 'light' | 'dark' | 'auto';
  language: string;
  showOnboarding: boolean;
  modals: {
    isProfileModalOpen: boolean;
    isChatModalOpen: boolean;
    isMomentModalOpen: boolean; // ✅ Rinominato da isEventModalOpen
    isSettingsModalOpen: boolean;
  };
  bottomSheet: {
    isOpen: boolean;
    content: 'nearby' | 'badges' | 'zones' | 'moments' | null; // ✅ Aggiunto 'moments'
  };
}

const initialState: UIState = {
  isLoading: false,
  loadingMessage: null,
  error: null,
  success: null,
  activeTab: 'discover',
  activeZone: null,
  theme: 'auto',
  language: 'en',
  showOnboarding: true,
  modals: {
    isProfileModalOpen: false,
    isChatModalOpen: false,
    isMomentModalOpen: false, // ✅ Rinominato
    isSettingsModalOpen: false,
  },
  bottomSheet: {
    isOpen: false,
    content: null,
  },
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setLoading: (state, action: PayloadAction<{ isLoading: boolean; message?: string }>) => {
      state.isLoading = action.payload.isLoading;
      state.loadingMessage = action.payload.message || null;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
      state.isLoading = false;
      state.loadingMessage = null;
    },
    setSuccess: (state, action: PayloadAction<string | null>) => {
      state.success = action.payload;
    },
    clearMessages: (state) => {
      state.error = null;
      state.success = null;
    },
    setActiveTab: (state, action: PayloadAction<string>) => {
      state.activeTab = action.payload;
    },
    setActiveZone: (state, action: PayloadAction<string | null>) => {
      state.activeZone = action.payload;
    },
    setTheme: (state, action: PayloadAction<'light' | 'dark' | 'auto'>) => {
      state.theme = action.payload;
    },
    setLanguage: (state, action: PayloadAction<string>) => {
      state.language = action.payload;
    },
    setShowOnboarding: (state, action: PayloadAction<boolean>) => {
      state.showOnboarding = action.payload;
    },
    openModal: (state, action: PayloadAction<keyof UIState['modals']>) => {
      state.modals[action.payload] = true;
    },
    closeModal: (state, action: PayloadAction<keyof UIState['modals']>) => {
      state.modals[action.payload] = false;
    },
    closeAllModals: (state) => {
      Object.keys(state.modals).forEach(key => {
        state.modals[key as keyof UIState['modals']] = false;
      });
    },
    openBottomSheet: (state, action: PayloadAction<'nearby' | 'badges' | 'zones' | 'moments'>) => {
      state.bottomSheet.isOpen = true;
      state.bottomSheet.content = action.payload;
    },
    closeBottomSheet: (state) => {
      state.bottomSheet.isOpen = false;
      state.bottomSheet.content = null;
    },
  },
});

export const {
  setLoading,
  setError,
  setSuccess,
  clearMessages,
  setActiveTab,
  setActiveZone,
  setTheme,
  setLanguage,
  setShowOnboarding,
  openModal,
  closeModal,
  closeAllModals,
  openBottomSheet,
  closeBottomSheet,
} = uiSlice.actions;

export default uiSlice.reducer;