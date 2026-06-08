import { supabase } from './supabase';

let activeAbortController: AbortController | null = null;

export async function transcribeAudio(audioUri: string): Promise<string> {
  // Abort any pending transcription request
  if (activeAbortController) {
    console.log('[GroqWhisper] Aborting previous pending transcription request...');
    activeAbortController.abort();
    activeAbortController = null;
  }

  const MAX_RETRIES = 3;
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    attempt++;
    let isTimeout = false;
    const controller = new AbortController();
    activeAbortController = controller;

    const timeoutId = setTimeout(() => {
      isTimeout = true;
      console.warn(`[GroqWhisper] Request timed out on attempt ${attempt}!`);
      controller.abort();
    }, 30000); // 30 seconds timeout per attempt (more robust for mobile connections)

    try {
      console.log(`[GroqWhisper] Transcribing audio from URI (Attempt ${attempt}/${MAX_RETRIES}): ${audioUri.substring(0, 50)}...`);
      
      const formData = new FormData();
      formData.append('file', {
        uri: audioUri,
        type: 'audio/x-m4a', // Standard M4A MIME type
        name: 'audio.m4a',
      } as any);
      
      formData.append('model', 'whisper-large-v3-turbo');
      formData.append('language', 'it');
      formData.append('response_format', 'text');

      // Use direct fetch to Supabase Edge Function to securely call Groq Whisper
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token || process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
      const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';

      const response = await fetch(`${supabaseUrl}/functions/v1/wolly-ai-gateway?action=transcribe`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'apikey': anonKey,
        },
        body: formData,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Groq STT Edge Function Error:`, errorText);
        if (response.status === 429 || response.status === 503) {
          const { handleAiResponseError } = await import('./aiErrorHandler');
          handleAiResponseError(response.status, errorText);
          throw new Error('BUDGET_LIMIT');
        }
        throw new Error(`Groq STT Edge Function Error`);
      }

      if (activeAbortController === controller) {
        activeAbortController = null;
      }

      const text = await response.text();
      console.log(`[GroqWhisper] Transcription result: "${text.trim()}"`);
      return text.trim();

    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error(`[GroqWhisper] Attempt ${attempt}/${MAX_RETRIES} failed:`, error.message || error);

      const isBudgetLimit = error.message === 'BUDGET_LIMIT';
      const wasCancelled = error.name === 'AbortError' && !isTimeout;
      if (wasCancelled || attempt >= MAX_RETRIES || isBudgetLimit) {
        if (activeAbortController === controller) {
          activeAbortController = null;
        }
        return '';
      }
      
      // Wait before retrying (exponential backoff: 1s, 2s)
      const delay = attempt * 1000;
      console.log(`[GroqWhisper] Waiting ${delay}ms before next attempt...`);
      await new Promise(res => setTimeout(res, delay));
    }
  }

  return '';
}
