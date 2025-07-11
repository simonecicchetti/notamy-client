// src/components/GlobalStatusBar.tsx
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';

interface GlobalStatusBarProps {
  style?: 'light' | 'dark' | 'auto';
  backgroundColor?: string;
  translucent?: boolean;
  hidden?: boolean;
  animated?: boolean;
}

export default function GlobalStatusBar({
  style = 'light',
  backgroundColor = 'transparent',
  translucent = Platform.OS === 'android',
  hidden = false,
  animated = true,
}: GlobalStatusBarProps) {
  return (
    <StatusBar 
      style={style}
      backgroundColor={backgroundColor}
      translucent={translucent}
      hidden={hidden}
      animated={animated}
    />
  );
}

// Hook per cambiare StatusBar dinamicamente in specifici screen
export function useExpoStatusBar(props: GlobalStatusBarProps) {
  // Con Expo StatusBar, puoi semplicemente renderizzare un nuovo componente
  // che sovrascriverà le impostazioni globali
  return <StatusBar {...props} />;
}