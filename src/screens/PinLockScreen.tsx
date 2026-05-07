import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppStore } from '../store';
import { useTheme } from '../hooks/useTheme';
import { typography, spacing } from '../utils/theme';

export const PinLockScreen = ({ onUnlock }: { onUnlock: () => void }) => {
  const { colors } = useTheme();
  const { pin } = useAppStore();
  const [input, setInput] = useState('');

  const handlePress = (num: string) => {
    if (input.length < 4) {
      const newInput = input + num;
      setInput(newInput);
      
      if (newInput.length === 4) {
        if (newInput === pin) {
          onUnlock();
        } else {
          Alert.alert('Error', 'Incorrect PIN. Please try again.');
          setInput('');
        }
      }
    }
  };

  const handleDelete = () => {
    setInput(prev => prev.slice(0, -1));
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <Ionicons name="lock-closed" size={48} color={colors.primary} />
        <Text style={[styles.title, { color: colors.text }]}>App Locked</Text>
        <Text style={{ color: colors.textSecondary }}>Enter PIN to continue</Text>
      </View>

      <View style={styles.dotsRow}>
        {[1, 2, 3, 4].map(i => (
          <View 
            key={i} 
            style={[
              styles.dot, 
              { 
                borderColor: colors.primary, 
                backgroundColor: input.length >= i ? colors.primary : 'transparent' 
              }
            ]} 
          />
        ))}
      </View>

      <View style={styles.keypad}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
          <TouchableOpacity 
            key={num} 
            style={[styles.key, { backgroundColor: colors.card }]} 
            onPress={() => handlePress(num.toString())}
          >
            <Text style={[styles.keyText, { color: colors.text }]}>{num}</Text>
          </TouchableOpacity>
        ))}
        <View style={styles.keyPlaceholder} />
        <TouchableOpacity 
          style={[styles.key, { backgroundColor: colors.card }]} 
          onPress={() => handlePress('0')}
        >
          <Text style={[styles.keyText, { color: colors.text }]}>0</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.key, { backgroundColor: 'transparent' }]} 
          onPress={handleDelete}
        >
          <Ionicons name="backspace-outline" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  title: {
    ...typography.title,
    marginTop: spacing.m,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: spacing.m,
    marginBottom: spacing.xxl * 2,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.l,
    width: '80%',
  },
  key: {
    width: 70,
    height: 70,
    borderRadius: 35,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyPlaceholder: {
    width: 70,
    height: 70,
  },
  keyText: {
    fontSize: 24,
    fontWeight: 'bold',
  }
});
