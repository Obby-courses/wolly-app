import React, { useState } from 'react';
import {
  StyleSheet, View, Pressable, Text, Platform,
  Dimensions, useWindowDimensions
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

  const handleKeyPress = (char: string) => {
    const { start, end } = selection;
    let newValue = '';
    let newCursorPos = 0;

    // Se shift è attivo una sola volta, lo disattiviamo dopo la digitazione
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
  };

  const handleBackspace = () => {
    const { start, end } = selection;
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
  };

  const handleSpace = () => {
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

  return (
    <View style={styles.keyboardContainer}>
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
          <View style={[styles.row, { paddingHorizontal: 15 }]}>
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
                size={20}
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
              <Ionicons name="backspace-outline" size={20} color="#1C1C1E" />
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
              <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
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
              <Ionicons name="backspace-outline" size={20} color="#1C1C1E" />
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
              <Ionicons name="arrow-up" size={20} color="#FFFFFF" />
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
    paddingTop: 8,
    paddingBottom: 6,
    paddingHorizontal: 4,
    width: '100%',
  },
  rowsWrapper: {
    width: '100%',
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    width: '100%',
    paddingHorizontal: 2,
  },
  key: {
    height: 42,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    ...SHADOWS.soft,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
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
    fontSize: 18,
    color: '#1C1C1E',
  },
  specialKeyText: {
    fontFamily: TYPOGRAPHY.fontBold,
    fontSize: 14,
    color: '#1C1C1E',
  },
});
