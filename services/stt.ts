/**
 * stt.ts
 * Speech-to-Text service using Groq Whisper.
 */

let activeAbortController: AbortController | null = null;

export async function transcribeAudio(uri: string): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_GROQ_FINANCE_API;
  if (!apiKey) throw new Error('Missing Groq API Key (EXPO_PUBLIC_GROQ_FINANCE_API)');

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
      
      const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      console.log(`📥 Received response from Groq. Status: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Groq STT Error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      // Clear reference since we are done
      if (activeAbortController === controller) {
        activeAbortController = null;
      }

      const data = await response.json();
      console.log("📝 Transcription result:", data.text);
      return data.text;

    } catch (err: any) {
      clearTimeout(timeoutId);
      console.error(`❌ Attempt ${attempt}/${MAX_RETRIES} failed:`, err.message || err);

      const wasCancelled = err.name === 'AbortError' && !isTimeout;
      if (wasCancelled || attempt >= MAX_RETRIES) {
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
