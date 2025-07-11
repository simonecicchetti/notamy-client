// src/navigation/AppNavigator.tsx
import React, { memo } from 'react';
import { 
  NavigationContainer, 
  DefaultTheme,
  NavigationContainerRef 
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path, Circle, Rect, G, Line } from 'react-native-svg';
import { useAppSelector } from '@/store';
import { navigationRef } from '@/services/navigationService';
import { theme, GRADIENTS } from '@/config/theme';
import { RootStackParamList, MainTabParamList } from '@/types/navigation';

// Import screens
import OnboardingScreen from '@/screens/auth/OnboardingScreen';
import IdentityScreen from '@/screens/auth/IdentityScreen';
import DiscoverScreen from '@/screens/main/DiscoverScreen';
import MomentsScreen from '@/screens/main/MomentsScreen';
import ProfileScreen from '@/screens/main/ProfileScreen';
import ChatListScreen from '@/screens/chat/ChatListScreen';
import ChatScreen from '@/screens/chat/ChatScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

// Device dimensions for responsive design
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// Android specific constants - MIGLIORATI
const ANDROID_CONSTANTS = {
  TAB_BAR_BASE_HEIGHT: 56, // Material Design standard
  TAB_BAR_PADDING_BUTTON_NAV: 8, // Per navigazione a bottoni
  TAB_BAR_PADDING_GESTURE_NAV: 0, // Per gesture navigation
  GESTURE_NAV_THRESHOLD: 24, // Soglia per rilevare gesture navigation
  SAFE_AREA_BOTTOM_OFFSET: 0, // Offset aggiuntivo se necessario
  MAX_TAB_BAR_HEIGHT: 90,
  MIN_TAB_BAR_HEIGHT: 56,
  ICON_SIZE: 28,
  ICON_CONTAINER_SIZE: 56,
};

// iOS specific constants
const IOS_CONSTANTS = {
  TAB_BAR_BASE_HEIGHT: 49, // iOS standard
  TAB_BAR_PADDING_BASE: 0,
  ICON_SIZE: 30,
  ICON_CONTAINER_SIZE: 60,
};

// Custom navigation theme
const navigationTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: theme.colors.primary,
    background: theme.colors.black,
    card: theme.colors.blackElevated,
    text: theme.colors.textPrimary,
    border: theme.colors.border,
    notification: theme.colors.primary,
  },
  fonts: {
    regular: {
      fontFamily: theme.typography.fontFamily.regular,
      fontWeight: '400' as const,
    },
    medium: {
      fontFamily: theme.typography.fontFamily.medium,
      fontWeight: '500' as const,
    },
    bold: {
      fontFamily: theme.typography.fontFamily.bold,
      fontWeight: '700' as const,
    },
    heavy: {
      fontFamily: theme.typography.fontFamily.bold,
      fontWeight: '800' as const,
    },
  },
};

// Dynamic icon size based on platform
const ICON_SIZE = Platform.select({
  ios: String(IOS_CONSTANTS.ICON_SIZE),
  android: String(ANDROID_CONSTANTS.ICON_SIZE),
  default: "28",
});

// NOTAMY N Icon - Icona principale
const MomentsIcon = memo(({ color, focused }: { color: string; focused: boolean }) => (
  <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
    {/* N Logo - stile Notamy con gradiente */}
    <G>
      {/* Barra sinistra */}
      <Path 
        d="M6 18V6" 
        stroke={focused ? theme.colors.notamy.cyan : color} 
        strokeWidth={focused ? "3" : "2"} 
        strokeLinecap="round"
      />
      
      {/* Barra destra */}
      <Path 
        d="M18 18V6" 
        stroke={focused ? theme.colors.notamy.purple : color} 
        strokeWidth={focused ? "3" : "2"} 
        strokeLinecap="round"
      />
      
      {/* Barra diagonale */}
      <Path 
        d="M6 6L18 18" 
        stroke={focused ? theme.colors.notamy.cyanDeep : color} 
        strokeWidth={focused ? "3" : "2"} 
        strokeLinecap="round"
      />
      
      {/* Piccolo effetto glow quando focused */}
      {focused && (
        <>
          <Circle cx="6" cy="6" r="2" fill={theme.colors.notamy.cyan} opacity="0.3"/>
          <Circle cx="18" cy="18" r="2" fill={theme.colors.notamy.purple} opacity="0.3"/>
        </>
      )}
    </G>
  </Svg>
));
MomentsIcon.displayName = 'MomentsIcon';

// Chat Icon - Stile minimalista Notamy
const MessagesIcon = memo(({ color, focused }: { color: string; focused: boolean }) => (
  <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
    {/* Chat bubble con stile geometrico */}
    <G>
      {/* Parte superiore del bubble - cyan */}
      <Path 
        d="M12 3C7.02944 3 3 7.02944 3 12C3 14 3.7 15.8 4.8 17.3L3 21L7 19.2C8.4 20.3 10.1 21 12 21C16.9706 21 21 16.9706 21 12C21 7.02944 16.9706 3 12 3Z" 
        stroke={focused ? theme.colors.notamy.cyan : color} 
        strokeWidth={focused ? "2.5" : "1.8"} 
        fill="none"
        strokeLinejoin="round"
      />
      
      {/* Effetto gradient simulato con path aggiuntivi quando focused */}
      {focused && (
        <>
          {/* Parte inferiore - purple accent */}
          <Path 
            d="M7 19.2C8.4 20.3 10.1 21 12 21C16.9706 21 21 16.9706 21 12" 
            stroke={theme.colors.notamy.purple} 
            strokeWidth="2.5" 
            fill="none"
            strokeLinejoin="round"
            opacity="0.7"
          />
          
          {/* Coda del messaggio - cyan deep */}
          <Path 
            d="M4.8 17.3L3 21L7 19.2" 
            stroke={theme.colors.notamy.cyanDeep} 
            strokeWidth="2.5" 
            fill="none"
            strokeLinejoin="round"
          />
          
          {/* Tre puntini dentro il bubble */}
          <Circle cx="8" cy="12" r="1" fill={theme.colors.notamy.cyan}/>
          <Circle cx="12" cy="12" r="1" fill={theme.colors.notamy.cyanDeep}/>
          <Circle cx="16" cy="12" r="1" fill={theme.colors.notamy.purple}/>
        </>
      )}
    </G>
  </Svg>
));
MessagesIcon.displayName = 'MessagesIcon';

// T Icon per Discover - Design geometrico come la N
const DiscoverIcon = memo(({ color, focused }: { color: string; focused: boolean }) => (
  <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
    {/* T Logo - stile geometrico Notamy */}
    <G>
      {/* Barra orizzontale superiore - cyan */}
      <Path 
        d="M4 6H20" 
        stroke={focused ? theme.colors.notamy.cyan : color} 
        strokeWidth={focused ? "3" : "2"} 
        strokeLinecap="round"
      />
      
      {/* Barra verticale centrale */}
      {focused ? (
        <>
          {/* Parte superiore - cyan deep */}
          <Path 
            d="M12 6V12" 
            stroke={theme.colors.notamy.cyanDeep} 
            strokeWidth="3" 
            strokeLinecap="round"
          />
          {/* Parte inferiore - purple */}
          <Path 
            d="M12 12V18" 
            stroke={theme.colors.notamy.purple} 
            strokeWidth="3" 
            strokeLinecap="round"
          />
        </>
      ) : (
        <Path 
          d="M12 6V18" 
          stroke={color} 
          strokeWidth="2" 
          strokeLinecap="round"
        />
      )}
      
      {/* Piccoli accenti decorativi quando focused */}
      {focused && (
        <>
          {/* Punti agli angoli della T */}
          <Circle cx="4" cy="6" r="2" fill={theme.colors.notamy.cyan} opacity="0.4"/>
          <Circle cx="20" cy="6" r="2" fill={theme.colors.notamy.cyanDeep} opacity="0.4"/>
          <Circle cx="12" cy="18" r="2" fill={theme.colors.notamy.purple} opacity="0.4"/>
        </>
      )}
    </G>
  </Svg>
));
DiscoverIcon.displayName = 'DiscoverIcon';

// Profile Icon - Stile geometrico pulito
const ProfileIcon = memo(({ color, focused }: { color: string; focused: boolean }) => (
  <Svg width={ICON_SIZE} height={ICON_SIZE} viewBox="0 0 24 24" fill="none">
    {/* User Icon geometrico */}
    <G>
      {/* Testa - forma esagonale stilizzata */}
      {focused ? (
        <>
          {/* Lato sinistro - cyan */}
          <Path 
            d="M12 2L7 7V12" 
            stroke={theme.colors.notamy.cyan} 
            strokeWidth="2.5" 
            fill="none"
            strokeLinejoin="round"
          />
          {/* Lato destro - purple */}
          <Path 
            d="M12 2L17 7V12" 
            stroke={theme.colors.notamy.purple} 
            strokeWidth="2.5" 
            fill="none"
            strokeLinejoin="round"
          />
          {/* Base esagono - cyan deep */}
          <Path 
            d="M7 12L12 17L17 12" 
            stroke={theme.colors.notamy.cyanDeep} 
            strokeWidth="2.5" 
            fill="none"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <Path 
          d="M12 2L17 7V12L12 17L7 12V7L12 2Z" 
          stroke={color} 
          strokeWidth="1.8" 
          fill="none"
          strokeLinejoin="round"
        />
      )}
      
      {/* Corpo - base triangolare */}
      {focused ? (
        <>
          {/* Lato sinistro corpo - cyan */}
          <Path 
            d="M5 22L12 16" 
            stroke={theme.colors.notamy.cyan} 
            strokeWidth="2.5" 
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Lato destro corpo - purple */}
          <Path 
            d="M12 16L19 22" 
            stroke={theme.colors.notamy.purple} 
            strokeWidth="2.5" 
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : (
        <Path 
          d="M5 22L12 16L19 22" 
          stroke={color} 
          strokeWidth="1.8" 
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      
      {/* Punto centrale quando focused */}
      {focused && (
        <Circle cx="12" cy="9.5" r="1.5" fill={theme.colors.notamy.cyanDeep}/>
      )}
    </G>
  </Svg>
));
ProfileIcon.displayName = 'ProfileIcon';

// Pre-calculate icon color for performance
const getIconColor = (focused: boolean, defaultColor: string) => 
  focused ? theme.colors.textPrimary : defaultColor;

// Memoized Tab Icon Component
const TabIcon = memo(({ 
  routeName,
  focused, 
  color,
  badge 
}: { 
  routeName: string;
  focused: boolean; 
  color: string;
  badge?: number;
}) => {
  const iconColor = getIconColor(focused, color);
  
  const renderIcon = () => {
    switch (routeName) {
      case 'Moments':
        return <MomentsIcon color={iconColor} focused={focused} />;
      case 'Messages':
        return <MessagesIcon color={iconColor} focused={focused} />;
      case 'Discover':
        return <DiscoverIcon color={iconColor} focused={focused} />;
      case 'Profile':
        return <ProfileIcon color={iconColor} focused={focused} />;
      default:
        return null;
    }
  };

  return (
    <View style={styles.iconContainer}>
      {focused ? (
        <LinearGradient
          colors={[
            `${theme.colors.notamy.cyan}26`, // 15% opacity in hex
            `${theme.colors.notamy.purple}0D`  // 5% opacity in hex
          ]}
          style={styles.iconGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          {renderIcon()}
        </LinearGradient>
      ) : (
        <View style={styles.iconDefault}>
          {renderIcon()}
        </View>
      )}
      
      {badge !== undefined && badge > 0 && (
        <View style={styles.badge}>
          <LinearGradient
            colors={[theme.colors.notamy.cyan, theme.colors.notamy.purple]}
            style={styles.badgeGradient}
          >
            <Text style={styles.badgeText}>
              {badge > 99 ? '99+' : badge}
            </Text>
          </LinearGradient>
        </View>
      )}
    </View>
  );
});
TabIcon.displayName = 'TabIcon';

// Main tab navigator with optimized styling
function MainTabs() {
  const insets = useSafeAreaInsets();
  const unreadMessages = useAppSelector(state => 
    state?.chat?.conversations?.reduce((acc: number, conv: any) => 
      acc + (conv.unreadCount || 0), 0
    ) || 0
  );

  const momentNotifications = useAppSelector(state => 
    state?.notifications?.notifications?.filter(
      (n: any) => n.type === 'moment_star' || n.type === 'moment_notice'
    ).length || 0
  );

  // MIGLIORATO: Calcolo altezza tab bar
  const getTabBarHeight = () => {
    if (Platform.OS === 'ios') {
      // iOS: usa altezza standard + safe area
      const baseHeight = IOS_CONSTANTS.TAB_BAR_BASE_HEIGHT;
      const bottomInset = insets.bottom;
      return baseHeight + bottomInset;
    } else {
      // Android: altezza fissa + gestione safe area
      const baseHeight = ANDROID_CONSTANTS.TAB_BAR_BASE_HEIGHT;
      
      // Rileva il tipo di navigazione
      const hasGestureNavigation = insets.bottom >= ANDROID_CONSTANTS.GESTURE_NAV_THRESHOLD;
      
      if (hasGestureNavigation) {
        // Per gesture navigation, aggiungi l'inset bottom
        return baseHeight + insets.bottom;
      } else {
        // Per button navigation, usa solo l'altezza base
        return baseHeight;
      }
    }
  };

  // MIGLIORATO: Padding bottom più preciso
  const getTabBarPaddingBottom = () => {
    if (Platform.OS === 'ios') {
      // iOS gestisce automaticamente con safe area
      return 0;
    } else {
      // Android: padding basato sul tipo di navigazione
      const hasGestureNavigation = insets.bottom >= ANDROID_CONSTANTS.GESTURE_NAV_THRESHOLD;
      
      if (hasGestureNavigation) {
        // Con gesture navigation, il padding è già gestito dall'altezza
        return ANDROID_CONSTANTS.TAB_BAR_PADDING_GESTURE_NAV;
      } else {
        // Con button navigation, aggiungi un piccolo padding
        return ANDROID_CONSTANTS.TAB_BAR_PADDING_BUTTON_NAV;
      }
    }
  };

  // NUOVO: Padding top per evitare sovrapposizioni
  const getTabBarPaddingTop = () => {
    return Platform.select({
      ios: 8,
      android: 4, // Ridotto per Android
    }) || 8;
  };

  // DEBUG info in development
  if (__DEV__) {
    console.log('Tab Bar Debug:', {
      platform: Platform.OS,
      insetsBottom: insets.bottom,
      tabBarHeight: getTabBarHeight(),
      paddingBottom: getTabBarPaddingBottom(),
      hasGestureNav: insets.bottom >= ANDROID_CONSTANTS.GESTURE_NAV_THRESHOLD,
    });
  }

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color }) => {
          let badge = undefined;
          if (route.name === 'Messages') {
            badge = unreadMessages;
          } else if (route.name === 'Moments' && momentNotifications > 0) {
            badge = momentNotifications;
          }
          
          return (
            <TabIcon 
              routeName={route.name}
              focused={focused} 
              color={color}
              badge={badge}
            />
          );
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textTertiary,
        tabBarShowLabel: false,
        tabBarItemStyle: {
          paddingVertical: Platform.select({
            ios: 0,
            android: 2, // Ridotto per Android
          }),
        },
        tabBarHitSlop: { 
          top: 10, 
          bottom: 10, 
          left: 10, 
          right: 10 
        },
        tabBarStyle: {
          backgroundColor: theme.colors.blackElevated,
          borderTopColor: theme.colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
          height: getTabBarHeight(),
          paddingBottom: getTabBarPaddingBottom(),
          paddingTop: getTabBarPaddingTop(),
          paddingHorizontal: 0,
          elevation: 8, // Ombra per Android
          shadowColor: theme.colors.black,
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.1,
          shadowRadius: 3,
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
        },
        headerShown: false,
        tabBarHideOnKeyboard: Platform.OS === 'android',
        // IMPORTANTE: Rimuovi sceneContainerStyle per evitare padding extra
      })}
      // IMPORTANTE: Aggiungi safeAreaInsets false per gestirlo manualmente
      safeAreaInsets={{
        bottom: 0, // Gestiamo noi il bottom inset
      }}
    >
      {/* RIORDINATO COME RICHIESTO */}
      <Tab.Screen 
        name="Moments"
        component={MomentsScreen}
        options={{
          unmountOnBlur: false,
        }}
      />
      <Tab.Screen 
        name="Messages" 
        component={ChatListScreen}
        options={{
          unmountOnBlur: false,
        }}
      />
      <Tab.Screen 
        name="Discover" 
        component={DiscoverScreen}
        options={{
          unmountOnBlur: false,
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{
          unmountOnBlur: false,
        }}
      />
    </Tab.Navigator>
  );
}

// Root navigator with optimized transitions
export default function AppNavigator() {
  const isAuthenticated = useAppSelector(state => state?.auth?.isAuthenticated || false);
  const hasUser = useAppSelector(state => state?.auth?.user !== null || false);
  
  if (__DEV__) {
    console.log('AppNavigator - Redux State:', { isAuthenticated, hasUser });
  }

  return (
    <NavigationContainer 
      ref={navigationRef}
      theme={navigationTheme}
    >
      <Stack.Navigator 
        screenOptions={{ 
          headerShown: false,
          animation: Platform.select({
            ios: 'default',
            android: 'fade',
          }),
          animationDuration: Platform.select({
            ios: 250,
            android: 150,
          }),
          contentStyle: {
            backgroundColor: theme.colors.black,
          },
          navigationBarHidden: true,
          // Android specific
          ...Platform.select({
            android: {
              animationTypeForReplace: 'pop',
              statusBarAnimation: 'fade',
              navigationBarColor: theme.colors.blackElevated, // Colore navigation bar
            },
          }),
        }}
      >
        {!isAuthenticated ? (
          <Stack.Group>
            <Stack.Screen 
              name="Onboarding" 
              component={OnboardingScreen}
              options={{ 
                animation: 'fade',
                animationDuration: 200,
              }}
            />
            <Stack.Screen 
              name="Identity" 
              component={IdentityScreen}
              options={{ 
                animation: Platform.select({
                  ios: 'fade_from_bottom',
                  android: 'slide_from_bottom',
                }),
                presentation: Platform.select({
                  ios: 'modal',
                  android: 'card',
                }),
                animationDuration: 200,
              }}
            />
          </Stack.Group>
        ) : (
          <Stack.Group>
            <Stack.Screen 
              name="MainTabs" 
              component={MainTabs}
              options={{ 
                animation: 'fade',
              }}
            />
            <Stack.Screen 
              name="Chat" 
              component={ChatScreen}
              options={{ 
                animation: Platform.select({
                  ios: 'slide_from_right',
                  android: 'fade_from_bottom',
                }),
                presentation: 'card',
              }}
            />
          </Stack.Group>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

// Styles
const styles = StyleSheet.create({
  iconContainer: {
    width: Platform.select({
      ios: IOS_CONSTANTS.ICON_CONTAINER_SIZE,
      android: ANDROID_CONSTANTS.ICON_CONTAINER_SIZE,
    }),
    height: Platform.select({
      ios: IOS_CONSTANTS.ICON_CONTAINER_SIZE,
      android: ANDROID_CONSTANTS.ICON_CONTAINER_SIZE,
    }),
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Platform.select({
      ios: IOS_CONSTANTS.ICON_CONTAINER_SIZE / 2,
      android: ANDROID_CONSTANTS.ICON_CONTAINER_SIZE / 2,
    }),
  },
  iconDefault: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    top: Platform.select({ ios: 8, android: 4 }),
    right: Platform.select({ ios: 8, android: 4 }),
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    overflow: 'hidden',
  },
  badgeGradient: {
    flex: 1,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: theme.typography.fontWeight.bold,
    color: theme.colors.textPrimary,
  },
});