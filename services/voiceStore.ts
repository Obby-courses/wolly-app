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

  startRecording: async () => {
    // Reset state before starting
    if (state.isRecording || state.recording) {
      try {
        if (state.recording) await state.recording.stopAndUnloadAsync();
      } catch (_) {}
    }
    
    state = { 
      ...state, 
      recording: null, 
      isRecording: false, 
      isLoading: false, 
      qa: null 
    };
    notify();

    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      state = {
        ...state,
        recording,
        isRecording: true,
        recordingStartTime: Date.now(),
        isOpen: true,
      };
      notify();
    } catch (err) {
      console.error('[voiceStore] startRecording failed:', err);
      state = { ...state, recording: null, isRecording: false, isOpen: false };
      notify();
    }
  },

  stopAndGetUri: async (): Promise<{ uri: string | null; duration: number } | null> => {
    if (!state.recording) return null;
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
    }
  },

  cancelRecording: async () => {
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
