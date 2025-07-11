// src/components/chat/EncryptionStatus.tsx
import React from 'react';
import { TouchableOpacity, StyleSheet, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/config/theme';
import * as Haptics from 'expo-haptics';

interface Props {
  sessionId: string;
  recipientId: string;
  publicKey?: string;
  theirPublicKey?: string;
  isVerified: boolean;
  onVerify: () => void;
}

/**
 * Zero-friction encryption status indicator
 * - Shows a simple lock icon in the header
 * - Green = encrypted, Gray = not encrypted
 * - Shield = verified (optional feature)
 * - No modals, no fingerprints, no interruptions
 */
export default function EncryptionStatus({
  sessionId,
  recipientId,
  publicKey,
  theirPublicKey,
  isVerified,
  onVerify
}: Props) {
  const handlePress = () => {
    // Haptic feedback
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Simple toggle verification without any UI interruption
    onVerify();
  };

  // Determine encryption state
  const isEncrypted = !!(publicKey && theirPublicKey && sessionId);
  
  // Zero-friction: don't show anything if not encrypted
  // This avoids alarming users unnecessarily
  if (!isEncrypted) {
    return null;
  }

  // Choose icon based on state
  const iconName = isVerified ? 'shield-checkmark' : 'lock-closed';
  const iconSize = isVerified ? 16 : 14;
  const iconColor = theme.colors.success;

  return (
    <TouchableOpacity
      onPress={handlePress}
      style={styles.container}
      activeOpacity={0.7}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Ionicons 
        name={iconName as any} 
        size={iconSize} 
        color={iconColor} 
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
});