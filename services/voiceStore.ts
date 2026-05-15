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

  processVoiceInput: async (uri: string) => {
    state = { ...state, isLoading: true, qa: { question: "Trascrizione in corso...", answer: null } };
    notify();

    const processStartTime = Date.now();
    console.log("\n" + "=".repeat(60));
    console.log("🎤 [VOICE FLOW] INIZIO ELABORAZIONE VOCALE");

    try {
      console.log(`⏱️ [0ms] Avvio Trascrizione STT...`);
      const { transcribeAudio } = require('./stt');
      let transcription = await transcribeAudio(uri);
      const sttTime = Date.now() - processStartTime;
      console.log(`📝 [${sttTime}ms] Trascrizione: "${transcription}"`);
      
      const words = transcription.trim().split(/\s+/);
      const isHallucination = !transcription || 
        transcription.trim() === "..." || 
        transcription.toLowerCase().includes("grazie.") ||
        transcription.toLowerCase().includes("sottotitoli");
      
      const isTooShort = words.length <= 2;

      if (isHallucination || isTooShort) {
        console.log(`🛑 [${Date.now() - processStartTime}ms] ANNULLATO: Input troppo breve o silenzio.`);
        console.log("=".repeat(60) + "\n");
        voiceStore.close();
        return;
      }

      const { routeInput } = require('./inputRouter');
      const route = routeInput(transcription);
      console.log(`🛤️ [${Date.now() - processStartTime}ms] Routing deciso: ${route.toUpperCase()}`);

      if (route === 'expense') {
        state = { ...state, qa: { question: transcription, answer: { intent: 'text', text_response: "Sto registrando la tua spesa..." } } };
        notify();
        
        try {
          const { parseExpenseWithAI } = require('./groqParser');
          console.log(`🧠 [${Date.now() - processStartTime}ms] Contatto Groq per parsing spesa...`);
          
          // STRICT TIMEOUT: Previene il caricamento infinito se Groq si blocca
          const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout 15s superato")), 15000));
          const parsed = await Promise.race([parseExpenseWithAI(transcription, 'voice'), timeoutPromise]) as any;
          
          const totalTime = Date.now() - processStartTime;
          console.log(`✅ [${totalTime}ms] PARSING COMPLETATO!`);
          console.log(`🗣️ DOMANDA: "${transcription}"`);
          console.log(`🤖 AZIONE: Registrazione Spesa (€${parsed.amount} in ${parsed.category_key})`);
          console.log("=".repeat(60) + "\n");
          
          voiceStore.close();
          const { router } = require('expo-router');
          router.push({
            pathname: '/expense-detail',
            params: { data: JSON.stringify(parsed) }
          });
        } catch (err: any) {
          console.error(`❌ [${Date.now() - processStartTime}ms] ERRORE PARSING:`, err.message);
          state = { ...state, qa: { question: transcription, answer: { intent: 'text', text_response: "Errore o timeout nel parsing della spesa." } } };
          notify();
          setTimeout(() => voiceStore.close(), 3000);
        }
        return;
      }

      state = { ...state, qa: { question: transcription, answer: null } };
      notify();
      
      try {
        const { askAiChat, aiChatStore } = require('./aiChat');
        console.log(`🧠 [${Date.now() - processStartTime}ms] Contatto Groq per Analisi AI (con ${aiChatStore.history.length} messaggi di contesto)...`);
        
        // STRICT TIMEOUT per AI Chat
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout 15s superato")), 15000));
        
        // Passiamo l'history attuale per mantenere il contesto ("e ieri?")
        const response = await Promise.race([askAiChat(transcription, aiChatStore.history), timeoutPromise]) as any;
        
        const totalTime = Date.now() - processStartTime;
        console.log(`✅ [${totalTime}ms] ANALISI COMPLETATA!`);
        console.log(`🗣️ DOMANDA: "${transcription}"`);
        console.log(`🤖 RISPOSTA: "${response?.text_response || 'Nessuna risposta'}"`);
        console.log("=".repeat(60) + "\n");
        
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

        // Salviamo nello storico globale così l'AI si ricorderà il contesto per la prossima domanda
        aiChatStore.history.push({ role: 'user', content: transcription });
        aiChatStore.history.push({ role: 'assistant', content: response.text_response });

        state = { ...state, qa: { question: transcription, answer: response } };
      } catch (e: any) {
        console.error(`❌ [${Date.now() - processStartTime}ms] ERRORE AI CHAT:`, e.message);
        state = { 
          ...state, 
          qa: { 
            question: transcription, 
            answer: { intent: 'text', text_response: "Si è verificato un errore o un timeout nell'analisi AI." } 
          } 
        };
        setTimeout(() => voiceStore.close(), 3000);
      }
    } catch (e: any) {
      console.error(`❌ [${Date.now() - processStartTime}ms] ERRORE GLOBALE VOCE:`, e.message);
      voiceStore.close();
    } finally {
      state = { ...state, isLoading: false };
      notify();
    }
  }
};
