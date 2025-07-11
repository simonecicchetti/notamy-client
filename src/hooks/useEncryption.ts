// src/hooks/useEncryption.ts
/**
 * Hook per gestire lo stato della crittografia in una conversazione
 *
 * Utilizzato per:
 * - Mostrare l'icona del lucchetto nell'UI (verde se crittografato, grigio altrimenti)
 * - Verificare se le chiavi sono state confermate manualmente dall'utente
 * - Fornire uno stato di caricamento per evitare flash nell'UI
 *
 * Zero-friction approach:
 * - Non blocca mai l'UI
 * - Aggiorna lo stato in background
 * - Gestisce automaticamente i cambiamenti di stato
 */
import { useState, useEffect, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import encryptionService from '@/services/encryptionService';
import secureKeyService from '@/services/secureKeyService';

interface EncryptionState {
  isReady: boolean;          // Hook ha finito di caricare lo stato
  hasEncryption: boolean;    // Conversazione ha crittografia attiva
  isVerified: boolean;       // Utente ha verificato manualmente le chiavi
  sessionId: string | null;  // ID della sessione corrente se esiste
  canEncrypt: boolean;       // Se il servizio può crittografare ora
}

/**
 * Hook per monitorare lo stato della crittografia di una conversazione
 * @param conversationId - ID della conversazione o del destinatario
 * @returns Stato corrente della crittografia
 */
export function useEncryption(conversationId: string): EncryptionState {
  // Stati iniziali ottimistici per evitare flash nell'UI
  const [isReady, setIsReady] = useState(false);
  const [hasEncryption, setHasEncryption] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [canEncrypt, setCanEncrypt] = useState(encryptionService.canEncrypt());
  
  /**
   * Controlla lo stato della crittografia per la conversazione
   * Non-blocking e gestisce tutti gli errori silenziosamente
   */
  const checkEncryptionStatus = useCallback(async () => {
    try {
      // 1. Verifica se il servizio di crittografia è disponibile
      const serviceAvailable = encryptionService.isAvailable();
      setCanEncrypt(serviceAvailable);
      
      if (!conversationId) {
        setIsReady(true);
        return;
      }
      
      // 2. Controlla se abbiamo metadati della chat salvati
      const sessionData = await AsyncStorage.getItem(`@chat_meta_${conversationId}`);
      
      if (sessionData) {
        const parsed = JSON.parse(sessionData);
        const currentSessionId = parsed.sessionId;
        
        if (currentSessionId) {
          setSessionId(currentSessionId);
          
          // 3. Verifica se la sessione è valida (non scaduta e con chiave)
          const isValid = await encryptionService.isSessionValid(currentSessionId);
          setHasEncryption(isValid);
          
          // Se la sessione non è più valida, potremmo volerla pulire
          if (!isValid && parsed.sessionId) {
            // Opzionale: pulisci i metadati non validi
            await AsyncStorage.removeItem(`@chat_meta_${conversationId}`);
            setSessionId(null);
          }
        }
      }
      
      // 4. Controlla se l'utente ha verificato manualmente le chiavi
      // Questa è una feature opzionale per utenti security-conscious
      const verifiedStatus = await AsyncStorage.getItem(`verified_${conversationId}`);
      setIsVerified(verifiedStatus === 'true');
      
    } catch (error) {
      // Log solo in development per debugging
      if (__DEV__) {
        console.warn('Failed to check encryption status:', error);
      }
      // Non mostrare errori all'utente - fail silently
    } finally {
      // Sempre segnala che il check è completo
      setIsReady(true);
    }
  }, [conversationId]);
  
  // Effect principale per il check iniziale
  useEffect(() => {
    checkEncryptionStatus();
  }, [conversationId, checkEncryptionStatus]);
  
  // Effect per monitorare cambiamenti al servizio di crittografia
  useEffect(() => {
    // Ricontrolla periodicamente se il servizio diventa disponibile
    const interval = setInterval(() => {
      const available = encryptionService.isAvailable();
      if (available !== canEncrypt) {
        setCanEncrypt(available);
        // Se il servizio è diventato disponibile, ricontrolla tutto
        if (available && !hasEncryption) {
          checkEncryptionStatus();
        }
      }
    }, 5000); // Check ogni 5 secondi
    
    return () => clearInterval(interval);
  }, [canEncrypt, hasEncryption, checkEncryptionStatus]);
  
  /**
   * Metodo pubblico per forzare un refresh dello stato
   * Utile dopo operazioni che modificano la crittografia
   */
  const refresh = useCallback(() => {
    setIsReady(false);
    checkEncryptionStatus();
  }, [checkEncryptionStatus]);
  
  return {
    isReady,
    hasEncryption,
    isVerified,
    sessionId,
    canEncrypt,
    // Esponi anche il metodo refresh per uso esterno
    refresh
  } as EncryptionState & { refresh: () => void };
}

/**
 * Hook helper per gestire l'icona di crittografia nell'header
 * Fornisce tutto il necessario per mostrare lo stato visuale
 */
export function useEncryptionIcon(conversationId: string) {
  const { hasEncryption, isVerified, canEncrypt } = useEncryption(conversationId);
  
  // Determina quale icona mostrare
  const iconName = hasEncryption ? 'lock-closed' : 'lock-open-outline';
  
  // Determina il colore dell'icona
  const iconColor = hasEncryption
    ? (isVerified ? '#10b981' : '#22c55e') // Verde scuro se verificato, verde normale se solo crittografato
    : '#6b7280'; // Grigio se non crittografato
  
  // Tooltip text per l'utente
  const tooltipText = hasEncryption
    ? (isVerified ? 'End-to-end encrypted & verified' : 'End-to-end encrypted')
    : (canEncrypt ? 'Not encrypted yet' : 'Encryption not available');
  
  return {
    iconName,
    iconColor,
    tooltipText,
    isEncrypted: hasEncryption,
    isVerified
  };
}

/**
 * Hook per gestire la verifica delle chiavi
 * Separato perché è un'azione opzionale dell'utente
 */
export function useKeyVerification(conversationId: string, recipientId: string) {
  const { isVerified, refresh } = useEncryption(conversationId) as any;
  
  const verifyKeys = useCallback(async () => {
    try {
      await AsyncStorage.setItem(`verified_${recipientId}`, 'true');
      // Refresh lo stato dopo la verifica
      if (refresh) refresh();
      return true;
    } catch (error) {
      console.error('Failed to verify keys:', error);
      return false;
    }
  }, [recipientId, refresh]);
  
  const unverifyKeys = useCallback(async () => {
    try {
      await AsyncStorage.removeItem(`verified_${recipientId}`);
      if (refresh) refresh();
      return true;
    } catch (error) {
      console.error('Failed to unverify keys:', error);
      return false;
    }
  }, [recipientId, refresh]);
  
  return {
    isVerified,
    verifyKeys,
    unverifyKeys
  };
}
