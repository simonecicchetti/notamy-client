// src/screens/auth/OnboardingScreen.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '@/navigation/AppNavigator';
import { theme, GRADIENTS } from '@/config/theme';

const { width, height } = Dimensions.get('window');

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Onboarding'>;

export default function OnboardingScreen() {
  const navigation = useNavigation<NavigationProp>();
  
  const handleGetStarted = () => {
    navigation.navigate('Identity');
  };

  return (
    <View style={styles.container}>
      {/* Static gradient background */}
      <LinearGradient
        colors={GRADIENTS.dark.colors}
        style={StyleSheet.absoluteFillObject}
      />
      
      {/* Regular Onboarding Content */}
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* Logo */}
          <View style={styles.logoContainer}>
            <View style={styles.logoGlass}>
              <LinearGradient
                colors={GRADIENTS.primary.colors}
                style={styles.logoBorder}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              />
              <View style={styles.logoInner}>
                <View style={styles.nShape}>
                  <View style={styles.nBarLeft} />
                  <View style={styles.nBarDiagonal} />
                  <View style={styles.nBarRight} />
                </View>
              </View>
            </View>
          </View>
          
          {/* App name and tagline */}
          <View style={styles.textContainer}>
            <Text style={styles.appName}>notamy</Text>
            <Text style={styles.tagline}>Connect invisibly, impact visibly</Text>
          </View>

          {/* Get Started button */}
          <TouchableOpacity 
            style={styles.buttonWrapper}
            onPress={handleGetStarted}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={GRADIENTS.primary.colors}
              style={styles.gradientButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              <Text style={styles.buttonText}>Get Started</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.black,
  },
  
  safeArea: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  
  // Logo styles
  logoContainer: {
    marginBottom: theme.spacing.huge * 2,
  },
  logoGlass: {
    width: 140,
    height: 140,
    borderRadius: theme.borderRadius.xxl + 6,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.blackElevated,
  },
  logoBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: theme.borderRadius.xxl + 6,
    opacity: 0.8,
  },
  logoInner: {
    width: 136,
    height: 136,
    borderRadius: theme.borderRadius.xxl + 4,
    backgroundColor: theme.colors.black,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  nShape: {
    width: 80,
    height: 80,
    position: 'relative',
  },
  nBarLeft: {
    position: 'absolute',
    width: 12,
    height: 80,
    left: 0,
    backgroundColor: theme.colors.primary,
    borderRadius: 3,
  },
  nBarRight: {
    position: 'absolute',
    width: 12,
    height: 80,
    right: 0,
    backgroundColor: theme.colors.primaryLight,
    borderRadius: 3,
  },
  nBarDiagonal: {
    position: 'absolute',
    width: 90,
    height: 12,
    top: 34,
    left: -5,
    backgroundColor: theme.colors.secondary,
    borderRadius: 3,
    transform: [{ rotate: '-35deg' }],
  },
  
  // Text content
  textContainer: {
    alignItems: 'center',
    marginBottom: theme.spacing.huge * 2,
  },
  appName: {
    fontSize: theme.typography.fontSize.display,
    fontWeight: '200',
    color: theme.colors.textPrimary,
    letterSpacing: theme.typography.letterSpacing.tight,
    marginBottom: theme.spacing.sm,
  },
  tagline: {
    fontSize: theme.typography.fontSize.body,
    color: theme.colors.textSecondary,
    letterSpacing: theme.typography.letterSpacing.normal,
  },
  
  // Button
  buttonWrapper: {
    borderRadius: theme.borderRadius.pill,
    overflow: 'hidden',
  },
  gradientButton: {
    paddingVertical: theme.spacing.lg,
    paddingHorizontal: theme.spacing.huge * 2,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: theme.typography.fontSize.message,
    fontWeight: theme.typography.fontWeight.semibold,
    color: theme.colors.textPrimary,
    letterSpacing: theme.typography.letterSpacing.wide,
  },
});