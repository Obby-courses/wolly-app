import React, { useState, useEffect } from 'react';
import {
  StyleSheet, View, Pressable, Text, Platform,
  useWindowDimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SHADOWS, TYPOGRAPHY } from '../constants/Theme';

interface CustomKeyboardProps {
  value: string;
  onChangeText: (text: string) => void;
  selection: { start: number; end: number };
  onSelectionChange: (sel: { start: number; end: number }) => void;
  onSubmit: () => void;
}

// Dizionario di termini finanziari e parole comuni in Italiano/Inglese per l'autocorrezione
const DICTIONARY = [
  'spesa', 'spese', 'entrate', 'entrata', 'abbonamento', 'abbonamenti', 'impostazioni', 'statistiche', 'grafico',
  'soldi', 'conto', 'carta', 'bancomat', 'credito', 'debito', 'categoria', 'transazione', 'transazioni',
  'casa', 'cibo', 'viaggi', 'lavoro', 'bollette', 'bolletta', 'investimento', 'investimenti', 'risparmio',
  'risparmi', 'budget', 'finanze', 'mensile', 'settimanale', 'annuale', 'wolly', 'ciao', 'aiuto', 'grazie',
  'quanto', 'come', 'perché', 'quando', 'dove', 'chi', 'che', 'cosa', 'salva', 'elimina', 'modifica',
  'nuovo', 'nuova', 'aggiungi', 'inserisci', 'visualizza'
];

// Algoritmo di calcolo distanza di Levenshtein per correzione di refusi
function getLevenshteinDistance(a: string, b: string): number {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // sostituzione
          matrix[i][j - 1] + 1,     // inserimento
          matrix[i - 1][j] + 1      // cancellazione
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

export default function CustomKeyboard({
  value,
  onChangeText,
  selection,
  onSelectionChange,
  onSubmit,
}: CustomKeyboardProps) {
  const { width: screenWidth } = useWindowDimensions();
  const [mode, setMode] = useState<'letters' | 'numbers'>('letters');
  const [isShiftActive, setIsShiftActive] = useState(false);

  // Tiene traccia dell'ultima correzione per permettere il Revert su Backspace
  const [lastCorrection, setLastCorrection] = useState<{
    original: string;
    corrected: string;
    index: number;
  } | null>(null);

  // Estrae le informazioni sulla parola correntemente digitata dal cursore
  const getCurrentWordInfo = () => {
    const { start } = selection;
    if (start === 0) return { word: '', start: 0, end: 0 };

    // Trova l'ultimo spazio prima del cursore
    const lastSpaceIndex = value.lastIndexOf(' ', start - 1);
    const wordStart = lastSpaceIndex === -1 ? 0 : lastSpaceIndex + 1;
    const word = value.slice(wordStart, start);
    return { word, start: wordStart, end: start };
  };

  const wordInfo = getCurrentWordInfo();

  // Genera suggerimenti basati sulla parola corrente
  const getSuggestions = (word: string): string[] => {
    if (!word || word.length < 2) return [];
    const w = word.toLowerCase();

    // 1. Corrispondenza per prefisso (es. "spe" -> "spesa")
    const prefixMatches = DICTIONARY.filter(dictWord => dictWord.startsWith(w));

    // 2. Corrispondenza per distanza di Levenshtein (es. "spsa" -> "spesa")
    const distanceMatches = DICTIONARY.filter(dictWord => {
      if (dictWord.startsWith(w)) return false; // già catturata
      const dist = getLevenshteinDistance(w, dictWord);
      return dist <= 2; // tolleranza massima di 2 errori di battitura
    });

    return [...prefixMatches, ...distanceMatches].slice(0, 3);
  };

  const activeSuggestions = getSuggestions(wordInfo.word);

  const applySuggestion = (suggestion: string) => {
    const { start, end, word } = getCurrentWordInfo();
    
    // Sostituisce la parola digitata con il suggerimento + uno spazio
    const newValue = value.slice(0, start) + suggestion + ' ' + value.slice(end);
    const newCursorPos = start + suggestion.length + 1;

    onChangeText(newValue);
    onSelectionChange({ start: newCursorPos, end: newCursorPos });
    
    // Memorizza per un eventuale ripristino con Backspace
    setLastCorrection({
      original: word,
      corrected: suggestion,
      index: start,
    });
  };

  const handleKeyPress = (char: string) => {
    const { start, end } = selection;
    let newValue = '';
    let newCursorPos = 0;

    const actualChar = isShiftActive ? char.toUpperCase() : char.toLowerCase();
    setIsShiftActive(false);

    if (start === end) {
      newValue = value.slice(0, start) + actualChar + value.slice(start);
      newCursorPos = start + 1;
    } else {
      newValue = value.slice(0, start) + actualChar + value.slice(end);
      newCursorPos = start + 1;
    }

    onChangeText(newValue);
    onSelectionChange({ start: newCursorPos, end: newCursorPos });
    setLastCorrection(null);
  };

  const handleBackspace = () => {
    const { start, end } = selection;
    
    // REVERT DELL'AUTOCORREZIONE: Se l'utente preme backspace subito dopo aver inserito lo spazio autocorretto
    if (lastCorrection && start === lastCorrection.index + lastCorrection.corrected.length + 1) {
      const { original, corrected, index } = lastCorrection;
      const newValue = value.slice(0, index) + original + value.slice(start);
      const newCursorPos = index + original.length;
      
      onChangeText(newValue);
      onSelectionChange({ start: newCursorPos, end: newCursorPos });
      setLastCorrection(null);
      return;
    }

    let newValue = '';
    let newCursorPos = 0;

    if (start === 0 && end === 0) return;

    if (start === end) {
      newValue = value.slice(0, start - 1) + value.slice(start);
      newCursorPos = Math.max(0, start - 1);
    } else {
      newValue = value.slice(0, start) + value.slice(end);
      newCursorPos = start;
    }

    onChangeText(newValue);
    onSelectionChange({ start: newCursorPos, end: newCursorPos });
    setLastCorrection(null);
  };

  const handleSpace = () => {
    // Se c'è un suggerimento di autocorrezione valido, premendo spazio viene applicato automaticamente
    if (activeSuggestions.length > 0) {
      applySuggestion(activeSuggestions[0]);
    } else {
      // Spazio normale
      const { start, end } = selection;
      let newValue = '';
      let newCursorPos = 0;

      if (start === end) {
        newValue = value.slice(0, start) + ' ' + value.slice(start);
        newCursorPos = start + 1;
      } else {
        newValue = value.slice(0, start) + ' ' + value.slice(end);
        newCursorPos = start + 1;
      }

      onChangeText(newValue);
      onSelectionChange({ start: newCursorPos, end: newCursorPos });
      setLastCorrection(null);
    }
  };

  // Riga 1, 2, 3 per Lettere
  const lettersRow1 = ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'];
  const lettersRow2 = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'];
  const lettersRow3 = ['z', 'x', 'c', 'v', 'b', 'n', 'm'];

  // Riga 1, 2, 3 per Numeri
  const numbersRow1 = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
  const numbersRow2 = ['-', '/', ':', ';', '(', ')', '€', '&', '@', '"'];
  const numbersRow3 = ['.', ',', '?', '!', "'"];

  const renderKey = (label: string, onPress: () => void, isSpecial = false, flexValue = 1) => {
    return (
      <Pressable
        key={label}
        onPress={onPress}
        style={({ pressed }) => [
          styles.key,
          isSpecial ? styles.specialKey : styles.standardKey,
          pressed && styles.keyPressed,
          { flex: flexValue }
        ]}
      >
        <Text style={[
          styles.keyText,
          isSpecial && styles.specialKeyText
        ]}>
          {label}
        </Text>
      </Pressable>
    );
  };

  // Renderizza la barra delle parole suggerite (autocorrezione stile Apple)
  const renderSuggestionBar = () => {
    let left = '';
    let center = '';
    let right = '';
    let hasSuggestions = false;

    if (activeSuggestions.length === 1) {
      center = activeSuggestions[0];
      left = '?';
      right = '.';
      hasSuggestions = true;
    } else if (activeSuggestions.length === 2) {
      center = activeSuggestions[0];
      left = activeSuggestions[1];
      right = '.';
      hasSuggestions = true;
    } else if (activeSuggestions.length >= 3) {
      center = activeSuggestions[0];
      left = activeSuggestions[1];
      right = activeSuggestions[2];
      hasSuggestions = true;
    } else {
      // Default scorciatoie se non ci sono parole da correggere
      left = '?';
      center = '.';
      right = ',';
    }

    return (
      <View style={styles.suggestionBar}>
        {/* Suggestion 1 */}
        <Pressable
          style={styles.suggestionSlot}
          onPress={() => hasSuggestions ? applySuggestion(left) : handleKeyPress(left)}
        >
          <Text style={[styles.suggestionText, hasSuggestions && styles.suggestedWordText]}>
            {hasSuggestions ? `"${left}"` : left}
          </Text>
        </Pressable>

        <View style={styles.suggestionDivider} />

        {/* Suggestion 2 (Centrale: l'autocorrezione principale) */}
        <Pressable
          style={styles.suggestionSlot}
          onPress={() => hasSuggestions ? applySuggestion(center) : handleKeyPress(center)}
        >
          <Text style={[
            styles.suggestionText,
            styles.bestSuggestionText,
            hasSuggestions && { color: '#007AFF', fontFamily: TYPOGRAPHY.fontBold }
          ]}>
            {hasSuggestions ? `"${center}"` : center}
          </Text>
        </Pressable>

        <View style={styles.suggestionDivider} />

        {/* Suggestion 3 */}
        <Pressable
          style={styles.suggestionSlot}
          onPress={() => hasSuggestions ? applySuggestion(right) : handleKeyPress(right)}
        >
          <Text style={[styles.suggestionText, hasSuggestions && styles.suggestedWordText]}>
            {hasSuggestions ? `"${right}"` : right}
          </Text>
        </Pressable>
      </View>
    );
  };

  return (
    <View style={styles.keyboardContainer}>
      {/* ─── SUGGESTION BAR (AUTOCORRECT) ────────────────────────────────────── */}
      {renderSuggestionBar()}

      {mode === 'letters' ? (
        // ─── LAYOUT LETTERE ──────────────────────────────────────────────────
        <View style={styles.rowsWrapper}>
          {/* Riga 1 */}
          <View style={styles.row}>
            {lettersRow1.map((char) =>
              renderKey(
                isShiftActive ? char.toUpperCase() : char,
                () => handleKeyPress(char)
              )
            )}
          </View>

          {/* Riga 2 */}
          <View style={[styles.row, { paddingHorizontal: 12 }]}>
            {lettersRow2.map((char) =>
              renderKey(
                isShiftActive ? char.toUpperCase() : char,
                () => handleKeyPress(char)
              )
            )}
          </View>

          {/* Riga 3 */}
          <View style={styles.row}>
            {/* Tasto Shift */}
            <Pressable
              onPress={() => setIsShiftActive(!isShiftActive)}
              style={({ pressed }) => [
                styles.key,
                styles.specialKey,
                isShiftActive && styles.shiftActiveKey,
                pressed && styles.keyPressed,
                { flex: 1.3 }
              ]}
            >
              <Ionicons
                name={isShiftActive ? "arrow-up" : "arrow-up-outline"}
                size={18}
                color={isShiftActive ? '#FFFFFF' : '#1C1C1E'}
              />
            </Pressable>

            {lettersRow3.map((char) =>
              renderKey(
                isShiftActive ? char.toUpperCase() : char,
                () => handleKeyPress(char)
              )
            )}

            {/* Tasto Backspace */}
            <Pressable
              onPress={handleBackspace}
              style={({ pressed }) => [
                styles.key,
                styles.specialKey,
                pressed && styles.keyPressed,
                { flex: 1.3 }
              ]}
            >
              <Ionicons name="backspace-outline" size={18} color="#1C1C1E" />
            </Pressable>
          </View>

          {/* Riga 4 */}
          <View style={styles.row}>
            {/* Switch Numeri */}
            <Pressable
              onPress={() => setMode('numbers')}
              style={({ pressed }) => [
                styles.key,
                styles.specialKey,
                pressed && styles.keyPressed,
                { flex: 1.5 }
              ]}
            >
              <Text style={styles.specialKeyText}>.?123</Text>
            </Pressable>

            {/* Tasto Spazio */}
            <Pressable
              onPress={handleSpace}
              style={({ pressed }) => [
                styles.key,
                styles.standardKey,
                pressed && styles.keyPressed,
                { flex: 5 }
              ]}
            >
              {activeSuggestions.length > 0 ? (
                <Text style={[styles.keyText, { fontSize: 13, color: '#8E8E93', fontFamily: TYPOGRAPHY.fontBold }]}>
                  {activeSuggestions[0]}
                </Text>
              ) : (
                <Text style={styles.keyText}>spazio</Text>
              )}
            </Pressable>

            {/* Tasto Invia */}
            <Pressable
              onPress={onSubmit}
              style={({ pressed }) => [
                styles.key,
                styles.sendKey,
                pressed && styles.sendKeyPressed,
                { flex: 1.5 }
              ]}
            >
              <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      ) : (
        // ─── LAYOUT NUMERI / SIMBOLI ─────────────────────────────────────────
        <View style={styles.rowsWrapper}>
          {/* Riga 1 */}
          <View style={styles.row}>
            {numbersRow1.map((char) =>
              renderKey(char, () => handleKeyPress(char))
            )}
          </View>

          {/* Riga 2 */}
          <View style={styles.row}>
            {numbersRow2.map((char) =>
              renderKey(char, () => handleKeyPress(char))
            )}
          </View>

          {/* Riga 3 */}
          <View style={styles.row}>
            {/* Switch Lettere */}
            <Pressable
              onPress={() => setMode('letters')}
              style={({ pressed }) => [
                styles.key,
                styles.specialKey,
                pressed && styles.keyPressed,
                { flex: 1.5 }
              ]}
            >
              <Text style={styles.specialKeyText}>ABC</Text>
            </Pressable>

            {numbersRow3.map((char) =>
              renderKey(char, () => handleKeyPress(char))
            )}

            {/* Tasto Backspace */}
            <Pressable
              onPress={handleBackspace}
              style={({ pressed }) => [
                styles.key,
                styles.specialKey,
                pressed && styles.keyPressed,
                { flex: 1.5 }
              ]}
            >
              <Ionicons name="backspace-outline" size={18} color="#1C1C1E" />
            </Pressable>
          </View>

          {/* Riga 4 */}
          <View style={styles.row}>
            {/* Spazio */}
            <Pressable
              onPress={handleSpace}
              style={({ pressed }) => [
                styles.key,
                styles.standardKey,
                pressed && styles.keyPressed,
                { flex: 5 }
              ]}
            >
              <Text style={styles.keyText}>spazio</Text>
            </Pressable>

            {/* Tasto Invia */}
            <Pressable
              onPress={onSubmit}
              style={({ pressed }) => [
                styles.key,
                styles.sendKey,
                pressed && styles.sendKeyPressed,
                { flex: 1.5 }
              ]}
            >
              <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: {
    backgroundColor: '#F2F2F7',
    borderTopWidth: 1,
    borderTopColor: '#E5E5EA',
    paddingTop: 5,
    paddingBottom: 4,
    paddingHorizontal: 3,
    width: '100%',
  },
  rowsWrapper: {
    width: '100%',
    gap: 8, // Ridotto gap verticale tra le righe di tasti (era 12)
    marginTop: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 4, // Ridotto gap orizzontale tra i tasti (era 6)
    width: '100%',
    paddingHorizontal: 1,
  },
  key: {
    height: 40, // Altezza tasti compatta
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.soft,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.12,
        shadowRadius: 1,
      },
      android: {
        elevation: 1,
      }
    })
  },
  standardKey: {
    backgroundColor: '#FFFFFF',
  },
  specialKey: {
    backgroundColor: '#D1D1D6',
  },
  shiftActiveKey: {
    backgroundColor: '#007AFF',
  },
  sendKey: {
    backgroundColor: '#007AFF',
  },
  keyPressed: {
    backgroundColor: '#E5E5EA',
  },
  sendKeyPressed: {
    backgroundColor: '#0056B3',
  },
  keyText: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: 16,
    color: '#1C1C1E',
  },
  specialKeyText: {
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: 13,
    color: '#1C1C1E',
  },

  // ─── SUGGESTION BAR (AUTOCORRECT) STYLES ─────────────────────────────────
  suggestionBar: {
    flexDirection: 'row',
    height: 38,
    backgroundColor: '#E5E5EA',
    borderRadius: 6,
    marginHorizontal: 3,
    alignItems: 'center',
  },
  suggestionSlot: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  suggestionDivider: {
    width: 1,
    height: 20,
    backgroundColor: '#D1D1D6',
  },
  suggestionText: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: 14,
    color: '#8E8E93',
  },
  bestSuggestionText: {
    color: '#1C1C1E',
    fontFamily: TYPOGRAPHY.fontFamily,
  },
  suggestedWordText: {
    color: '#1C1C1E',
    fontFamily: TYPOGRAPHY.fontFamily,
  },
});
