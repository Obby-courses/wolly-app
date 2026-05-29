export async function transcribeAudio(audioUri: string): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_GROQ_FINANCE_API;
  if (!apiKey) {
    console.warn('Missing Groq API Key (EXPO_PUBLIC_GROQ_FINANCE_API)');
    return '';
  }

  const MAX_RETRIES = 3;
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    attempt++;
    let isTimeout = false;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      isTimeout = true;
      console.warn(`[GroqWhisper] Request timed out on attempt ${attempt}!`);
      controller.abort();
    }, 15000); // 15 seconds timeout per attempt

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

      const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
        body: formData,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      console.log(`[GroqWhisper] Response status: ${response.status} ${response.statusText}`);

      if (!response.ok) {
        console.error(`Groq API Error: ${response.status} ${response.statusText}`);
        throw new Error(`Groq API Error status ${response.status}`);
      }

      const text = await response.text();
      console.log(`[GroqWhisper] Transcription result: "${text.trim()}"`);
      return text.trim();

    } catch (error: any) {
      clearTimeout(timeoutId);
      console.error(`[GroqWhisper] Attempt ${attempt}/${MAX_RETRIES} failed:`, error.message || error);

      if (attempt >= MAX_RETRIES) {
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
