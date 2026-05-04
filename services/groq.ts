export async function transcribeAudio(audioUri: string): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_GROQ_FINANCE_API;
  if (!apiKey) {
    console.warn('Missing Groq API Key (EXPO_PUBLIC_GROQ_FINANCE_API)');
    return '';
  }

  try {
    console.log(`[GroqWhisper] Transcribing audio from URI: ${audioUri.substring(0, 50)}...`);
    
    const formData = new FormData();
    formData.append('file', {
      uri: audioUri,
      type: 'audio/m4a',
      name: 'audio.m4a',
    } as any);
    
    formData.append('model', 'whisper-large-v3-turbo');
    formData.append('language', 'it');
    formData.append('response_format', 'text');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 secondi di timeout

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        // NON impostare Content-Type quando si usa FormData, lo fa fetch automaticamente con il boundary corretto
      },
      body: formData,
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    console.log(`[GroqWhisper] Response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      console.error(`Groq API Error: ${response.status} ${response.statusText}`);
      return '';
    }

    const text = await response.text();
    console.log(`[GroqWhisper] Transcription result: "${text.trim()}"`);
    return text.trim();
  } catch (error) {
    console.error('Error transcribing audio:', error);
    return '';
  }
}
