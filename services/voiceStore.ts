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
      let transcription = await transcribeAudio(uri);
      
      // FILTRO ALLUCINAZIONI E INPUT INCOMPLETI (1-2 parole)
      const words = transcription.trim().split(/\s+/);
      const isHallucination = !transcription || 
        transcription.trim() === "..." || 
        transcription.toLowerCase().includes("grazie.") ||
        transcription.toLowerCase().includes("sottotitoli");
      
      const isTooShort = words.length <= 2;

      if (isHallucination || isTooShort) {
        // Se è un'allucinazione o una frase troppo breve (1-2 parole), chiude senza disturbare
        voiceStore.close();
        return;
      }

      // Se arriviamo qui, abbiamo almeno 3 parole. Proviamo l'analisi AI.
      state = { ...state, qa: { question: transcription, answer: null } };
      notify();
      
      try {
        const { askAiChat } = require('./aiChat');
        const response = await askAiChat(transcription);
        
        // Se l'AI non ha capito nulla della richiesta (es: frase lunga senza senso)
        if (!response || response.text_response === "") {
          state = { 
            ...state, 
            qa: { 
              question: transcription, 
              answer: { intent: 'text', text_response: "Non ho capito la richiesta, prova a essere più specifico." } 
            } 
          };
          notify();
          setTimeout(() => voiceStore.close(), 3000);
          return;
        }

        state = { ...state, qa: { question: transcription, answer: response } };
      } catch (e) {
        console.error("AI Analysis Error:", e);
        state = { 
          ...state, 
          qa: { 
            question: transcription, 
            answer: { intent: 'text', text_response: "Si è verificato un errore nell'analisi AI." } 
          } 
        };
        setTimeout(() => voiceStore.close(), 3000);
      }
    } catch (e) {
      console.error("STT Process Error:", e);
      voiceStore.close();
    } finally {
      state = { ...state, isLoading: false };
      notify();
    }
  }
};
