// src/types/navigation.ts
import { NavigatorScreenParams } from '@react-navigation/native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';

/**
 * Root Stack Navigator
 * Gestisce la navigazione principale dell'app
 */
export type RootStackParamList = {
  // Auth screens
  Onboarding: undefined;
  Identity: undefined;
  
  // Main app con tab navigation
  Main: NavigatorScreenParams<MainTabParamList>;
  
  // Chat screen (fuori dai tab per full screen experience)
  Chat: {
    recipientId: string;
    recipientDescriptor: string;
    conversationId: string;
  };
};

/**
 * Main Tab Navigator
 * Bottom tabs per la navigazione principale
 */
export type MainTabParamList = {
  // Scopri utenti vicini
  Discover: undefined;
  
  // ✅ Moments - sostituisce Events
  Moments: {
    openDropModal?: boolean; // Opzionale: apre direttamente il modal per droppare un moment
  } | undefined;
  
  // Lista conversazioni chat
  Messages: undefined;
  
  // Profilo utente
  Profile: undefined;
};

/**
 * Screen Props Types
 * Tipizzazione per i props di navigazione di ogni schermata
 */

// Root Stack screen props
export type RootStackScreenProps<T extends keyof RootStackParamList> = 
  NativeStackScreenProps<RootStackParamList, T>;

// Main Tab screen props  
export type MainTabScreenProps<T extends keyof MainTabParamList> = 
  BottomTabScreenProps<MainTabParamList, T>;

/**
 * Composite Types
 * Props types specifici per ogni schermata
 */

// Auth screens
export type OnboardingScreenProps = RootStackScreenProps<'Onboarding'>;
export type IdentityScreenProps = RootStackScreenProps<'Identity'>;

// Chat screen (stack)
export type ChatScreenProps = RootStackScreenProps<'Chat'>;

// Tab screens
export type DiscoverScreenProps = MainTabScreenProps<'Discover'>;
export type MomentsScreenProps = MainTabScreenProps<'Moments'>; // ✅ Rinominato da EventsScreenProps
export type MessagesScreenProps = MainTabScreenProps<'Messages'>;
export type ProfileScreenProps = MainTabScreenProps<'Profile'>;

/**
 * Navigation Helper Types
 * Types utili per la navigazione programmatica
 */

// Union type di tutte le route
export type AllRoutes = keyof RootStackParamList | keyof MainTabParamList;

// Helper per ottenere i parametri di una route
export type RouteParams<T extends AllRoutes> = 
  T extends keyof RootStackParamList 
    ? RootStackParamList[T]
    : T extends keyof MainTabParamList
    ? MainTabParamList[T]
    : never;

/**
 * Global Navigation Types
 * Estende i tipi di React Navigation per type safety globale
 */
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

/**
 * Navigation State Types
 * Utili per gestire lo stato della navigazione
 */
export type NavigationState = {
  currentRoute: AllRoutes | null;
  previousRoute: AllRoutes | null;
  isAuthenticated: boolean;
  activeTab: keyof MainTabParamList | null;
};

/**
 * Deep Link Types
 * Per gestire deep linking nell'app
 */
export type DeepLinkParams = {
  chat: {
    userId: string;
  };
  moment: {
    momentId: string;
  };
  profile: {
    userId?: string;
  };
};

/**
 * Modal Types
 * Per modal che possono essere aperti da qualsiasi schermata
 */
export type ModalParams = {
  dropMoment: {
    prefillText?: string;
    prefillArea?: string;
  };
  reportUser: {
    userId: string;
    descriptor: string;
  };
  settings: undefined;
};

/**
 * Navigation Actions Types
 * Per azioni di navigazione complesse
 */
export type NavigationActions = {
  navigateToChat: (params: RootStackParamList['Chat']) => void;
  navigateToMoments: (params?: MainTabParamList['Moments']) => void;
  navigateToProfile: (userId?: string) => void;
  goBack: () => void;
  resetToMain: (tab?: keyof MainTabParamList) => void;
};

/**
 * Route Config Type
 * Configurazione per ogni route
 */
export type RouteConfig = {
  name: AllRoutes;
  requiresAuth: boolean;
  tabBarVisible?: boolean;
  headerShown?: boolean;
  gestureEnabled?: boolean;
};

/**
 * Export all types for convenience
 */
export type {
  NavigatorScreenParams, // Re-export for convenience
};