// src/services/navigationService.ts
import { createNavigationContainerRef } from '@react-navigation/native';
import { StackActions } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

export const NavigationService = {
  navigate: (name: string, params?: any) => {
    if (navigationRef.isReady()) {
      navigationRef.navigate(name as never, params as never);
    }
  },

  push: (name: string, params?: any) => {
    if (navigationRef.isReady()) {
      navigationRef.dispatch(StackActions.push(name, params));
    }
  },

  goBack: () => {
    if (navigationRef.isReady()) {
      navigationRef.goBack();
    }
  },

  navigateToChat: (recipientId: string, recipientDescriptor: string, conversationId?: string) => {
    if (navigationRef.isReady()) {
      // If conversationId not provided, generate it
      const finalConversationId = conversationId || `conv_${recipientId}`;
      
      // Get current route
      const currentRoute = navigationRef.getCurrentRoute();
      
      // If already in MainTabs stack, just push Chat
      if (currentRoute?.name === 'Discover' || 
          currentRoute?.name === 'Moments' ||  // ✅ Updated from 'Events'
          currentRoute?.name === 'Messages' || 
          currentRoute?.name === 'Profile') {
        
        navigationRef.navigate('Chat' as never, {
          recipientId,
          recipientDescriptor,
          conversationId: finalConversationId
        } as never);
      } else {
        // Navigate to MainTabs first, then to Chat
        navigationRef.navigate('MainTabs' as never, {
          screen: 'Messages'
        } as never);
        
        setTimeout(() => {
          navigationRef.navigate('Chat' as never, {
            recipientId,
            recipientDescriptor,
            conversationId: finalConversationId
          } as never);
        }, 100);
      }
    }
  },

  navigateToDiscover: () => {
    if (navigationRef.isReady()) {
      navigationRef.navigate('MainTabs' as never, {
        screen: 'Discover'
      } as never);
    }
  },

  // ✅ NEW: Navigate to Moments tab
  navigateToMoments: () => {
    if (navigationRef.isReady()) {
      navigationRef.navigate('MainTabs' as never, {
        screen: 'Moments'
      } as never);
    }
  },

  // ✅ NEW: Navigate to Moments with auto-open drop modal
  navigateToDropMoment: () => {
    if (navigationRef.isReady()) {
      navigationRef.navigate('MainTabs' as never, {
        screen: 'Moments',
        params: {
          openDropModal: true
        }
      } as never);
    }
  },

  // ✅ NEW: Navigate to Messages tab (useful after moment match)
  navigateToMessages: () => {
    if (navigationRef.isReady()) {
      navigationRef.navigate('MainTabs' as never, {
        screen: 'Messages'
      } as never);
    }
  },

  // ✅ NEW: Navigate to chat from moment match
  navigateFromMomentMatch: (matchedUserId: string, matchedUserDescriptor: string) => {
    if (navigationRef.isReady()) {
      // First navigate to Messages tab
      navigationRef.navigate('MainTabs' as never, {
        screen: 'Messages'
      } as never);
      
      // Then open the chat after a small delay
      setTimeout(() => {
        NavigationService.navigateToChat(matchedUserId, matchedUserDescriptor);
      }, 300);
    }
  },

  isReady: () => navigationRef.isReady(),

  getCurrentRoute: () => {
    if (navigationRef.isReady()) {
      return navigationRef.getCurrentRoute();
    }
    return null;
  },

  // Helper to check if user is in a specific chat
  isInChat: (recipientId: string): boolean => {
    const currentRoute = navigationRef.getCurrentRoute();
    return currentRoute?.name === 'Chat' && 
           currentRoute?.params?.recipientId === recipientId;
  },

  // ✅ NEW: Helper to check if user is in Moments screen
  isInMoments: (): boolean => {
    const currentRoute = navigationRef.getCurrentRoute();
    return currentRoute?.name === 'Moments';
  },

  // ✅ NEW: Helper to check current tab
  getCurrentTab: (): string | null => {
    const currentRoute = navigationRef.getCurrentRoute();
    if (currentRoute?.name === 'Discover' || 
        currentRoute?.name === 'Moments' || 
        currentRoute?.name === 'Messages' || 
        currentRoute?.name === 'Profile') {
      return currentRoute.name;
    }
    return null;
  },

  // ✅ NEW: Navigate with reset (useful for auth flows)
  resetToMain: (initialTab: 'Discover' | 'Moments' | 'Messages' | 'Profile' = 'Discover') => {
    if (navigationRef.isReady()) {
      navigationRef.reset({
        index: 0,
        routes: [{
          name: 'MainTabs' as never,
          params: {
            screen: initialTab
          } as never
        }]
      });
    }
  },

  // Navigate to Identity screen (for re-auth)
  navigateToIdentity: () => {
    if (navigationRef.isReady()) {
      navigationRef.reset({
        index: 0,
        routes: [{ name: 'Identity' as never }]
      });
    }
  }
};

// ✅ Export types for better type safety
export type NavigationServiceType = typeof NavigationService;