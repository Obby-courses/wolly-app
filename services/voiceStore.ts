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
    state = { ...state, isOpen: false, qa: null };
    notify();
  },

  setQa: (qa: QaResult | null) => {
    state = { ...state, qa };
    if (qa) {
      // Quando arriva una risposta, resettiamo o cancelliamo timer di inattività?
      // Forse meglio lasciarla visibile finché l'utente non interagisce.
    }
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
    if (state.isRecording || state.recording) {
      try {
        if (state.recording) await state.recording.stopAndUnloadAsync();
      } catch (_) {}
      state = { ...state, recording: null, isRecording: false };
    }

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
        qa: null, // Reset QA when starting new recording
      };
      notify();
    } catch (err) {
      console.error('[voiceStore] startRecording failed:', err);
      state = { ...state, recording: null, isRecording: false };
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

  processVoiceInput: async (uri: string) => {
    state = { ...state, isLoading: true, qa: { question: "Trascrizione in corso...", answer: null } };
    notify();

    try {
      // 1. Trascrizione STT
      const { transcribeAudio } = require('./stt');
      const transcription = await transcribeAudio(uri);
      
      if (!transcription || transcription.trim().length === 0) {
        state = { ...state, qa: { question: "Non ho capito, puoi ripetere?", answer: null } };
        notify();
        setTimeout(() => voiceStore.close(), 2000);
        return;
      }

      // 2. Analisi AI
      state = { ...state, qa: { question: transcription, answer: null } };
      notify();
      
      const { askAiChat } = require('./aiChat');
      const response = await askAiChat(transcription);
      
      state = { ...state, qa: { question: transcription, answer: response } };
    } catch (e) {
      console.error("STT/AI Flow Error:", e);
      state = { ...state, qa: { question: "Errore nella trascrizione", answer: null } };
      setTimeout(() => voiceStore.close(), 2000);
    } finally {
      state = { ...state, isLoading: false };
      notify();
    }
  }
};
