/**
 * stt.ts
 * Speech-to-Text service using Groq Whisper.
 */

export async function transcribeAudio(uri: string): Promise<string> {
  const apiKey = process.env.EXPO_PUBLIC_GROQ_FINANCE_API;
  if (!apiKey) throw new Error('Missing Groq API Key (EXPO_PUBLIC_GROQ_FINANCE_API)');

  console.log("🎙️ Start transcription for:", uri);

  try {
    const formData = new FormData();
    // In React Native, per caricare un file dobbiamo passarlo in questo formato
    formData.append('file', {
      uri: uri,
      type: 'audio/m4a',
      name: 'recording.m4a',
    } as any);
    formData.append('model', 'whisper-large-v3'); // Il modello Whisper più potente su Groq
    formData.append('language', 'it');           // Forziamo l'italiano per precisione

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        // Note: fetch handles Content-Type for FormData automatically
      },
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`Groq STT Error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    console.log("📝 Transcription result:", data.text);
    return data.text;
  } catch (err) {
    console.error('Failed to transcribe audio:', err);
    throw err;
  }
}
