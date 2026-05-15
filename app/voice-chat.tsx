/**
 * voice-chat.tsx — DEPRECATED
 * La logica vocale è ora gestita da VoiceChatOverlay + voiceStore.
 * Questa schermata non viene più navigata.
 */
import { useEffect } from 'react';
import { useRouter } from 'expo-router';

export default function VoiceChatPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/');
  }, []);
  return null;
}
