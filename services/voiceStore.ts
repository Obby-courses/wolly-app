/**
 * voiceStore.ts
 * Shared singleton store for voice recording state.
 * Prevents the "Only one Recording" error by centralising recording lifecycle.
 */
import { Audio } from 'expo-av';
import type { AiChatResponse } from './aiChat';

type Listener = () => void;

export interface QaResult {
  question: string;
  answer: AiChatResponse | null;
}

interface VoiceState {
  isOpen: boolean;
  isRecording: boolean;
  isLoading: boolean;
  isSlidingToCancel: boolean;
  recording: Audio.Recording | null;
  recordingStartTime: number;
  qa: QaResult | null;
  triggerScreen?: string;
}

let state: VoiceState = {
  isOpen: false,
  isRecording: false,
  isLoading: false,
  isSlidingToCancel: false,
  recording: null,
  recordingStartTime: 0,
  qa: null,
};

const listeners = new Set<Listener>();

function notify() {
  listeners.forEach(l => l());
}

// Module-level lock for active recording promise to handle quick tap/release race conditions
let activeRecordingPromise: Promise<Audio.Recording | null> | null = null;

export const voiceStore = {
  getState: () => ({ ...state }),

  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  open: () => {
    state = { ...state, isOpen: true };
    notify();
  },

  close: () => {
    state = { ...state, isOpen: false, qa: null, isLoading: false };
    notify();
  },

  setQa: (qa: QaResult | null) => {
    state = { ...state, qa };
    notify();
  },

  setIsSlidingToCancel: (v: boolean) => {
    state = { ...state, isSlidingToCancel: v };
    notify();
  },

  setIsLoading: (v: boolean) => {
    state = { ...state, isLoading: v };
    notify();
  },

  startRecording: async (triggerScreen?: string) => {
    // Reset state before starting
    if (state.isRecording || state.recording) {
      try {
        if (state.recording) await state.recording.stopAndUnloadAsync();
      } catch (_) {}
    }
    
    state = { 
      ...state, 
      recording: null, 
      isRecording: true, // Set to true immediately for instantaneous UI feedback
      isOpen: true,
      isLoading: false, 
      qa: null,
      recordingStartTime: Date.now(),
      triggerScreen: triggerScreen || '/'
    };
    notify();

    activeRecordingPromise = (async () => {
      try {
        // Essential Safeguard: Ensure microphone permission is requested dynamically
        const permission = await Audio.requestPermissionsAsync();
        if (permission.status !== 'granted') {
          throw new Error('Microphone permission not granted');
        }

        await Audio.setAudioModeAsync({
          allowsRecordingIOS: true,
          playsInSilentModeIOS: true,
        });

        const { recording } = await Audio.Recording.createAsync(
          Audio.RecordingOptionsPresets.HIGH_QUALITY
        );

        // If user already released the button or cancelled while we were initializing, cleanup immediately
        if (!state.isOpen && !state.isRecording) {
          console.log('[voiceStore] Recording resolved after button release/cancel, unloading...');
          await recording.stopAndUnloadAsync();
          return null;
        }

        state = {
          ...state,
          recording,
          isRecording: true,
          recordingStartTime: Date.now(),
        };
        notify();
        return recording;
      } catch (err) {
        console.error('[voiceStore] startRecording promise failed:', err);
        state = { ...state, recording: null, isRecording: false, isOpen: false };
        notify();
        return null;
      }
    })();

    await activeRecordingPromise;
  },

  stopAndGetUri: async (): Promise<{ uri: string | null; duration: number } | null> => {
    // Wait for the recording to finish initializing if it's still running
    if (activeRecordingPromise) {
      await activeRecordingPromise;
    }

    if (!state.recording) {
      console.log('[voiceStore] stopAndGetUri failed: no active recording after initialization');
      return null;
    }

    const duration = Date.now() - state.recordingStartTime;
    const rec = state.recording;

    state = { ...state, isRecording: false, recording: null };
    notify();

    try {
      await rec.stopAndUnloadAsync();
      const uri = rec.getURI();
      return { uri, duration };
    } catch (err) {
      console.error('[voiceStore] stopAndGetUri failed:', err);
      return null;
    } finally {
      activeRecordingPromise = null;
    }
  },

  cancelRecording: async () => {
    // Wait for the recording to finish initializing before cancelling
    if (activeRecordingPromise) {
      try { await activeRecordingPromise; } catch (_) {}
    }

    const rec = state.recording;
    state = {
      ...state,
      isRecording: false,
      isSlidingToCancel: false,
      recording: null,
    };
    notify();

    if (rec) {
      try { await rec.stopAndUnloadAsync(); } catch (_) {}
    }
    activeRecordingPromise = null;
  },

  /**
   * Avvia la pipeline vocale modulare.
   * Questo metodo è un thin wrapper: delega tutto a voiceProcessor.ts.
   * voiceStore rimane responsabile solo dello stato e del lifecycle audio.
   */
  processVoiceInput: async (uri: string) => {
    try {
      const { processVoiceInput } = require('./voice/voiceProcessor');
      await processVoiceInput(uri);
    } catch (err: any) {
      console.error('[voiceStore] Errore critico nella pipeline vocale:', err.message);
      voiceStore.close();
    } finally {
      // Garantisce che isLoading sia sempre resettato anche in caso di crash
      state = { ...state, isLoading: false };
      notify();
    }
  }
};
