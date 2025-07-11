// src/config/theme.ts
export const theme = {
  colors: {
    // Base colors - Pure blacks (no transparency calculations)
    black: '#000000',
    blackElevated: '#0A0A0A',
    blackSurface: '#121212',
    
    // Borders - Minimal transparency for performance
    border: '#1A1A1A',              // Solid color instead of rgba
    borderHover: '#2A2A2A',         // Solid color instead of rgba
    borderActive: '#3A3A3A',        // Solid color instead of rgba
    
    // Text colors - Opaque colors for faster rendering
    textPrimary: '#FFFFFF',
    textSecondary: '#E0E0E0',       // Solid instead of rgba
    textTertiary: '#999999',        // Solid instead of rgba
    textMuted: '#666666',           // Solid instead of rgba
    
    // Brand colors - Notamy palette (unchanged)
    primary: '#00b4a6',
    primaryDark: '#008f84',
    primaryLight: '#00d9ff',
    
    secondary: '#ff6b6b',
    secondaryLight: '#ff8787',
    
    accent: '#00e676',
    success: '#00e676',
    warning: '#ffab00',
    error: '#ff5252',
    
    // Simplified gradients - 2 colors max for performance
    gradients: {
      primary: ['#00b4a6', '#00d9ff'],
      secondary: ['#ff6b6b', '#ff8787'],
      dark: ['#000000', '#0A0A0A'],    // Reduced from 3 to 2 colors
      accent: ['#00e676', '#69f0ae'],  // Added accent gradient
    },
    
    // Simplified overlays - use sparingly
    overlay: {
      light: '#0A0A0A',               // Solid dark instead of rgba white
      medium: '#141414',              // Solid dark instead of rgba white
      heavy: '#1F1F1F',               // Solid dark instead of rgba white
      dark: '#000000CC',              // Only this one needs transparency
    },
  },
  
  // Spacing - unchanged, already optimized
  spacing: {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
    xxxl: 40,
    huge: 48,
  },
  
  // Border radius - simplified
  borderRadius: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 20,
    xxl: 24,
    pill: 28,
    round: 9999,
  },
  
  typography: {
    // System fonts only - fastest rendering
    fontFamily: {
      regular: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      medium: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      semibold: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      bold: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif',
    },
    
    // Font sizes - unchanged
    fontSize: {
      micro: 12,
      caption: 14,
      body: 17,
      message: 18,
      subtitle: 20,
      title: 24,
      hero: 32,
      display: 48,
    },
    
    // Font weights - use numeric for better performance
    fontWeight: {
      light: 300,
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
    
    // Line heights - simplified
    lineHeight: {
      tight: 1.25,
      normal: 1.5,
      relaxed: 1.6,
      loose: 1.75,
    },
    
    // Letter spacing - reduced options
    letterSpacing: {
      tight: -0.3,
      normal: 0,
      wide: 0.5,
      wider: 1,
    },
  },
  
  // NO SHADOWS - Major performance boost
  shadows: {
    none: {
      shadowColor: 'transparent',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
    // All other shadows removed - use borders instead
  },
  
  // INSTANT animations - no delays
  animation: {
    instant: 0,        // Everything instant
    fast: 0,           // No animations
    normal: 0,         // No animations
    slow: 0,           // No animations
    verySlow: 0,       // No animations
    
    // Spring animations - ultra stiff for instant response
    spring: {
      instant: {
        damping: 1000,    // No bounce
        stiffness: 1000,  // Instant
        mass: 0.1,        // Light
        useNativeDriver: true,
      },
    },
  },
  
  // Layout constants - unchanged
  layout: {
    headerHeight: 64,
    tabBarHeight: 56,
    inputHeight: 60,
    buttonHeight: 60,
    messageMaxWidth: '85%',
    screenPadding: 16,
    cardPadding: 20,
    minimumTouchTarget: 48,
  },
};

// Helper functions - PERFORMANCE OPTIMIZED

// Pre-calculate gradients to avoid runtime computation
export const GRADIENTS = {
  primary: { colors: theme.colors.gradients.primary, start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
  secondary: { colors: theme.colors.gradients.secondary, start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
  dark: { colors: theme.colors.gradients.dark, start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
  accent: { colors: theme.colors.gradients.accent, start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
};

// Memoized user gradients
const USER_GRADIENTS = [
  ['#00b4a6', '#00d9ff'],    // Teal-Cyan
  ['#ff6b6b', '#ff8787'],    // Coral
  ['#00e676', '#69f0ae'],    // Green
  ['#ffab00', '#ffd740'],    // Amber
  ['#00b0ff', '#40c4ff'],    // Light Blue
];

// Fast hash function for user gradient
export const getUserGradient = (name: string): string[] => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) - hash) + name.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return USER_GRADIENTS[Math.abs(hash) % USER_GRADIENTS.length];
};

// Simplified font size getter
export const getOptimalFontSize = (textLength: number): number => {
  if (textLength < 50) return theme.typography.fontSize.message;
  return theme.typography.fontSize.body;
};

// NO glass effects - use solid backgrounds with borders instead
export const createCardStyle = () => ({
  backgroundColor: theme.colors.blackElevated,
  borderWidth: 1,
  borderColor: theme.colors.border,
  borderRadius: theme.borderRadius.lg,
});

// Semantic color tokens - SIMPLIFIED
export const tokens = {
  // Backgrounds
  screenBackground: theme.colors.black,
  cardBackground: theme.colors.blackElevated,
  modalBackground: theme.colors.blackSurface,
  
  // Text
  textDefault: theme.colors.textPrimary,
  textSubtle: theme.colors.textSecondary,
  textPlaceholder: theme.colors.textTertiary,
  textDisabled: theme.colors.textMuted,
  
  // Interactive
  buttonPrimary: theme.colors.primary,
  buttonSecondary: theme.colors.secondary,
  buttonSuccess: theme.colors.success,
  buttonDanger: theme.colors.error,
  
  // Messages - solid colors instead of gradients for performance
  messageOutgoing: theme.colors.primary,
  messageIncoming: theme.colors.blackElevated,
  messageVoice: theme.colors.secondary,
  
  // Status
  online: theme.colors.success,
  offline: theme.colors.textTertiary,
  typing: theme.colors.primary,
  
  // Borders
  divider: theme.colors.border,
  inputBorder: theme.colors.border,
  inputBorderFocus: theme.colors.primary,
};

// Performance tips for implementation:
// 1. Use FlatList instead of ScrollView
// 2. Enable removeClippedSubviews on lists
// 3. Use getItemLayout when possible
// 4. Avoid inline styles
// 5. Use React.memo for components
// 6. Disable all Animated values when not needed
// 7. Use InteractionManager.runAfterInteractions for heavy operations

export default theme;