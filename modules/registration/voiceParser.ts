import { Audio } from 'expo-av';
import { transcribeAudio } from '../../services/groq';
import { parseExpenseWithAI } from '../../services/groqParser';
import { ParsedExpense } from './types';

export async function startRecording(): Promise<Audio.Recording> {
  try {
    const permission = await Audio.requestPermissionsAsync();
    if (permission.status !== 'granted') {
      throw new Error('Permesso microfono non concesso. Controlla le impostazioni del telefono.');
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    return recording;
  } catch (error) {
    console.error('Failed to start recording', error);
    throw error;
  }
}

export async function stopRecording(recording: Audio.Recording): Promise<string> {
  try {
    await recording.stopAndUnloadAsync();
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
    });
    const uri = recording.getURI();
    if (!uri) throw new Error('No URI found for recording');
    return uri;
  } catch (error) {
    console.error('Failed to stop recording', error);
    throw error;
  }
}

export async function parseFromVoice(audioUri: string): Promise<ParsedExpense> {
  const text = await transcribeAudio(audioUri);
  if (!text) {
    throw new Error('Impossibile trascrivere il file audio');
  }
  
  const expense = await parseExpenseWithAI(text, 'voice');
  return expense;
}
