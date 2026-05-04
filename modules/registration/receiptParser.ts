import * as ImagePicker from 'expo-image-picker';
import { extractTextFromImage } from '../../services/googleVision';
import { parseExpenseWithAI } from '../../services/groqParser';
import { ParsedExpense } from './types';

export async function pickImage(): Promise<string | null> {
  const { status } = await ImagePicker.requestCameraPermissionsAsync();
  if (status !== 'granted') {
    console.warn('Camera permission not granted');
  }
  const libStatus = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (libStatus.status !== 'granted') {
     console.warn('Library permissions not granted');
  }

  const result = await ImagePicker.launchCameraAsync({
    mediaTypes: 'images',
    allowsEditing: true,
    quality: 0.8,
  });

  if (!result.canceled && result.assets && result.assets.length > 0) {
    return result.assets[0].uri;
  }
  return null;
}

export async function pickImageFromLibrary(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsEditing: true,
    quality: 0.8,
  });

  if (!result.canceled && result.assets && result.assets.length > 0) {
    return result.assets[0].uri;
  }
  return null;
}

export async function parseFromReceipt(
  useCamera: boolean = true,
  locationContext?: { city: string | null; address: string | null }
): Promise<ParsedExpense | null> {
  const imageUri = useCamera ? await pickImage() : await pickImageFromLibrary();
  
  if (!imageUri) return null;

  const text = await extractTextFromImage(imageUri);
  if (!text) {
    throw new Error('Impossibile leggere lo scontrino');
  }

  const expense = await parseExpenseWithAI(text, 'receipt', locationContext);

  console.log('\n--- 🧠 WOLLY SEMANTIC ENGINE REPORT ---');
  console.log('--- 👁️ CLOUD VISION (RAW INPUT) ---');
  console.log(text);
  console.log('--- 🤖 GROQ AI (PARSED RESULT) ---');
  console.log(JSON.stringify(expense, null, 2));
  console.log('---------------------------------------\n');

  return expense;
}
