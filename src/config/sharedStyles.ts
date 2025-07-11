// src/config/sharedStyles.ts
import { StyleSheet, Platform } from 'react-native';
import { theme } from './theme';

// Avatar size constants
export const AVATAR_SIZES = {
  tiny: 32,    // Notifications, small badges
  small: 44,   // Moments, compact lists
  medium: 52,  // Chat list, discover
  large: 80,   // User cards, featured
  huge: 120,   // Profile screen
} as const;

// Common dimensions
export const DIMENSIONS = {
  headerHeight: 64,
  tabBarHeight: 56,
  inputHeight: 60,
  buttonHeight: 52,
  maxContentWidth: 500,
  screenPadding: 20,
  cardPadding: 16,
} as const;

// Shared component styles
export const sharedStyles = StyleSheet.create({
  // ==========================================
  // CONTAINERS
  // ==========================================
  
  // Screen container
  container: {
    flex: 1,
    backgroundColor: theme.colors.black,
  },
  
  safeArea: {
    flex: 1,
  },
  
  keyboardView: {
    flex: 1,
  },
  
  scrollContent: {
    paddingBottom: 100,
  },
  
  // ==========================================
  // HEADERS
  // ==========================================
  
  // Standard screen header with glass effect
  screenHeader: {
    backgroundColor: theme.colors.overlay.dark,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    paddingVertical: 16,
  },
  
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: DIMENSIONS.screenPadding,
    maxWidth: DIMENSIONS.maxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  
  // Back button
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.blackElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // ==========================================
  // TYPOGRAPHY
  // ==========================================
  
  // Screen titles
  screenTitle: {
    fontSize: 34,
    fontWeight: '100',
    letterSpacing: -1,
    color: theme.colors.textPrimary,
  },
  
  screenSubtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginTop: 4,
    letterSpacing: 0.3,
  },
  
  sectionTitle: {
    fontSize: theme.typography.fontSize.message,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
    letterSpacing: theme.typography.letterSpacing.wide,
  },
  
  // ==========================================
  // CARDS
  // ==========================================
  
  // Standard opaque card
  card: {
    backgroundColor: theme.colors.blackElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.xl,
    padding: DIMENSIONS.cardPadding,
  },
  
  // Transparent glass card
  cardTransparent: {
    backgroundColor: theme.colors.blackElevated + 'CC',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.xl,
    padding: DIMENSIONS.cardPadding,
    ...Platform.select({
      ios: {
        // iOS only - backdrop blur would go here if supported
      },
    }),
  },
  
  // Interactive card (hover/press states)
  cardInteractive: {
    backgroundColor: theme.colors.blackElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.xl,
    padding: DIMENSIONS.cardPadding,
    marginBottom: theme.spacing.sm,
  },
  
  // ==========================================
  // AVATARS
  // ==========================================
  
  avatarTiny: {
    width: AVATAR_SIZES.tiny,
    height: AVATAR_SIZES.tiny,
    borderRadius: AVATAR_SIZES.tiny / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  avatarSmall: {
    width: AVATAR_SIZES.small,
    height: AVATAR_SIZES.small,
    borderRadius: AVATAR_SIZES.small / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  avatarMedium: {
    width: AVATAR_SIZES.medium,
    height: AVATAR_SIZES.medium,
    borderRadius: AVATAR_SIZES.medium / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  avatarLarge: {
    width: AVATAR_SIZES.large,
    height: AVATAR_SIZES.large,
    borderRadius: AVATAR_SIZES.large / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  avatarHuge: {
    width: AVATAR_SIZES.huge,
    height: AVATAR_SIZES.huge,
    borderRadius: AVATAR_SIZES.huge / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Avatar text styles
  avatarTextTiny: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.black,
    textTransform: 'uppercase',
  },
  
  avatarTextSmall: {
    fontSize: 18,
    fontWeight: '600',
    color: theme.colors.black,
    textTransform: 'uppercase',
  },
  
  avatarTextMedium: {
    fontSize: 22,
    fontWeight: '600',
    color: theme.colors.black,
    textTransform: 'uppercase',
    letterSpacing: -0.5,
  },
  
  avatarTextLarge: {
    fontSize: 32,
    fontWeight: '600',
    color: theme.colors.black,
    textTransform: 'uppercase',
    letterSpacing: -1,
  },
  
  avatarTextHuge: {
    fontSize: 48,
    fontWeight: '600',
    color: theme.colors.black,
    textTransform: 'uppercase',
    letterSpacing: -1.5,
  },
  
  // Online indicator
  onlineIndicator: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: theme.colors.success,
    borderWidth: 2,
    borderColor: theme.colors.blackElevated,
  },
  
  onlineIndicatorLarge: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
  },
  
  // ==========================================
  // BUTTONS
  // ==========================================
  
  // Icon button (44x44)
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: 'hidden',
  },
  
  iconButtonGradient: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Primary button with gradient
  primaryButton: {
    borderRadius: theme.borderRadius.pill,
    overflow: 'hidden',
  },
  
  primaryButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
    minHeight: DIMENSIONS.buttonHeight,
  },
  
  primaryButtonText: {
    fontSize: theme.typography.fontSize.body,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.black,
    letterSpacing: theme.typography.letterSpacing.wide,
  },
  
  // Secondary button (bordered)
  secondaryButton: {
    borderRadius: theme.borderRadius.pill,
    backgroundColor: theme.colors.blackElevated,
    borderWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.sm,
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.xl,
    minHeight: DIMENSIONS.buttonHeight,
  },
  
  secondaryButtonText: {
    fontSize: theme.typography.fontSize.body,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.textPrimary,
    letterSpacing: theme.typography.letterSpacing.wide,
  },
  
  // Disabled state
  buttonDisabled: {
    opacity: 0.5,
  },
  
  // ==========================================
  // INPUTS
  // ==========================================
  
  textInput: {
    backgroundColor: theme.colors.blackSurface,
    borderRadius: theme.borderRadius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border,
    padding: theme.spacing.md,
    fontSize: theme.typography.fontSize.body,
    color: theme.colors.textPrimary,
    minHeight: DIMENSIONS.inputHeight,
  },
  
  textInputFocused: {
    borderColor: theme.colors.primary,
  },
  
  textInputMultiline: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  
  // ==========================================
  // LISTS
  // ==========================================
  
  listContainer: {
    flex: 1,
  },
  
  listContent: {
    paddingHorizontal: DIMENSIONS.screenPadding,
    paddingBottom: 100,
    maxWidth: DIMENSIONS.maxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  
  // ==========================================
  // EMPTY STATES
  // ==========================================
  
  emptyState: {
    alignItems: 'center',
    paddingTop: 120,
    paddingHorizontal: 40,
  },
  
  emptyIcon: {
    marginBottom: 32,
  },
  
  emptyTitle: {
    fontSize: 24,
    fontWeight: '300',
    color: theme.colors.textPrimary,
    marginBottom: 12,
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  
  emptyText: {
    fontSize: 16,
    color: theme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  
  // ==========================================
  // LOADING STATES
  // ==========================================
  
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  
  loadingText: {
    marginTop: theme.spacing.md,
    fontSize: theme.typography.fontSize.body,
    color: theme.colors.textSecondary,
  },
  
  // ==========================================
  // MODALS
  // ==========================================
  
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
  },
  
  modalContent: {
    backgroundColor: theme.colors.blackElevated,
    borderTopLeftRadius: theme.borderRadius.xxl,
    borderTopRightRadius: theme.borderRadius.xxl,
    padding: theme.spacing.xl,
    paddingBottom: theme.spacing.xxxl,
    borderTopWidth: 1,
    borderTopColor: theme.colors.border,
  },
  
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  
  modalTitle: {
    fontSize: theme.typography.fontSize.title,
    fontWeight: theme.typography.fontWeight.medium,
    color: theme.colors.textPrimary,
    letterSpacing: theme.typography.letterSpacing.tight,
  },
  
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.blackSurface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  
  // ==========================================
  // BADGES
  // ==========================================
  
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing.xs,
    backgroundColor: theme.colors.blackElevated,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    borderRadius: theme.borderRadius.pill,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  
  badgeText: {
    fontSize: theme.typography.fontSize.caption,
    color: theme.colors.textSecondary,
    fontWeight: theme.typography.fontWeight.medium,
  },
  
  // Notification badge
  notificationBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  
  notificationBadgeText: {
    fontSize: 12,
    color: theme.colors.black,
    fontWeight: '700',
  },
});

// ==========================================
// HELPER FUNCTIONS
// ==========================================

// Get avatar style by size
export const getAvatarStyle = (size: keyof typeof AVATAR_SIZES) => {
  const sizeMap = {
    tiny: sharedStyles.avatarTiny,
    small: sharedStyles.avatarSmall,
    medium: sharedStyles.avatarMedium,
    large: sharedStyles.avatarLarge,
    huge: sharedStyles.avatarHuge,
  };
  return sizeMap[size];
};

// Get avatar text style by size
export const getAvatarTextStyle = (size: keyof typeof AVATAR_SIZES) => {
  const sizeMap = {
    tiny: sharedStyles.avatarTextTiny,
    small: sharedStyles.avatarTextSmall,
    medium: sharedStyles.avatarTextMedium,
    large: sharedStyles.avatarTextLarge,
    huge: sharedStyles.avatarTextHuge,
  };
  return sizeMap[size];
};

// Shadow styles (use sparingly for performance)
export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  small: {
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  medium: {
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  large: {
    shadowColor: theme.colors.black,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 8,
  },
  // Colored glow effect
  glow: (color: string, intensity: number = 0.3) => ({
    shadowColor: color,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: intensity,
    shadowRadius: 12,
    elevation: 0,
  }),
};

// Common animation configs (instant as per theme)
export const animations = {
  instant: {
    duration: theme.animation.instant,
    useNativeDriver: true,
  },
  // Spring for when animation is needed
  spring: {
    ...theme.animation.spring.instant,
    useNativeDriver: true,
  },
};

// Layout helpers
export const layout = {
  centered: {
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  row: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  spaceBetween: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
  },
  absolute: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
};

// Export everything
export default {
  ...sharedStyles,
  getAvatarStyle,
  getAvatarTextStyle,
  shadows,
  animations,
  layout,
  AVATAR_SIZES,
  DIMENSIONS,
};