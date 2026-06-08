import { supabase } from './supabase';

let activeAbortController: AbortController | null = null;

export async function transcribeAudio(uri: string): Promise<string> {
  // Abort any pending transcription request
  if (activeAbortController) {
    console.log('[stt] Aborting previous pending transcription request...');
    activeAbortController.abort();
    activeAbortController = null;
  }

  console.log("🎙️ Start transcription for:", uri);

  const MAX_RETRIES = 3;
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    attempt++;
    let isTimeout = false;
    const controller = new AbortController();
    activeAbortController = controller;
    
    // 30 seconds timeout per attempt (more robust for mobile connections/heavy server load)
    const timeoutId = setTimeout(() => {
      isTimeout = true;
      console.warn(`⚠️ Groq STT Request timed out on attempt ${attempt}!`);
      controller.abort();
    }, 30000);

    try {
      const formData = new FormData();
      formData.append('file', {
        uri: uri,
        type: 'audio/x-m4a', // Standard M4A MIME type
        name: 'recording.m4a',
      } as any);
      formData.append('model', 'whisper-large-v3-turbo');
      formData.append('language', 'it');

      console.log(`⏳ Sending request to Groq API (Attempt ${attempt}/${MAX_RETRIES})...`);
      
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
        if (response.status === 429 || response.status === 503) {
          const { handleAiResponseError } = await import('./aiErrorHandler');
          handleAiResponseError(response.status, errorText);
          throw new Error('BUDGET_LIMIT');
        }
        throw new Error(`Groq STT Error: Status ${response.status} - ${errorText}`);
      }

      const responseJson = await response.json();

      // Clear reference since we are done
      if (activeAbortController === controller) {
        activeAbortController = null;
      }

      console.log("📝 Transcription result:", responseJson.text);
      return responseJson.text;

    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error(`❌ Attempt ${attempt}/${MAX_RETRIES} failed:`, err.message || err);

      const isBudgetLimit = err.message === 'BUDGET_LIMIT';
      const wasCancelled = err.name === 'AbortError' && !isTimeout;
      if (wasCancelled || attempt >= MAX_RETRIES || isBudgetLimit) {
        // Clear reference if this call failed/finished
        if (activeAbortController === controller) {
          activeAbortController = null;
        }
        if (isTimeout) {
          throw new Error('Timeout');
        }
        throw err;
      }
      
      // Wait before retrying (exponential backoff: 1s, 2s)
      const delay = attempt * 1000;
      console.log(`⏳ Waiting ${delay}ms before next attempt...`);
      await new Promise(res => setTimeout(res, delay));
    }
  }
  
  throw new Error('Transcription failed after maximum retries');
}
