import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Dimensions,
  Vibration,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../hooks/useTheme';

const { width } = Dimensions.get('window');

interface CalculatorModalProps {
  isVisible: boolean;
  onClose: () => void;
  onImport: (value: string) => void;
  initialValue?: string;
}

export const CalculatorModal: React.FC<CalculatorModalProps> = ({
  isVisible,
  onClose,
  onImport,
  initialValue = '',
}) => {
  const { colors, spacing, borderRadius } = useTheme();
  const [expression, setExpression] = useState('');
  const [result, setResult] = useState('0');

  useEffect(() => {
    if (isVisible) {
      setExpression(initialValue);
    }
  }, [isVisible]);

  useEffect(() => {
    calculateResult(expression);
  }, [expression]);

  const calculateResult = (exp: string) => {
    if (!exp) {
      setResult('0');
      return;
    }

    try {
      // Replace % with /100 for calculation
      let sanitizedExp = exp.replace(/%/g, '/100');
      
      // Basic math evaluation
      // Warning: Function constructor can be dangerous, but here it's restricted to math chars
      const mathChars = /^[0-9+\-*/.() ]+$/;
      
      // Clean up expression for eval (replace symbols if needed)
      // We'll use a safer approach for a production app, but for this demo:
      const safeExp = sanitizedExp.replace(/×/g, '*').replace(/÷/g, '/');
      
      if (mathChars.test(safeExp.replace(/[\(\)]/g, ''))) {
        // eslint-disable-next-line no-eval
        const evaluated = eval(safeExp);
        if (isFinite(evaluated)) {
          setResult(Number(evaluated.toFixed(2)).toString());
        }
      }
    } catch (e) {
      // Silent fail during live calculation
    }
  };

  const handlePress = (val: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }

    if (val === 'C') {
      setExpression('');
      setResult('0');
    } else if (val === 'DEL') {
      setExpression(prev => prev.slice(0, -1));
    } else if (val === '=') {
      setExpression(result);
    } else {
      setExpression(prev => prev + val);
    }
  };

  const handleImport = () => {
    if (Platform.OS !== 'web') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    onImport(result);
    onClose();
  };

  const CalcButton = ({ value, type = 'number', flex = 1 }: { value: string, type?: 'number' | 'operator' | 'action' | 'import', flex?: number }) => {
    let bgColor = colors.card;
    let textColor = colors.text;

    if (type === 'operator') {
      bgColor = colors.primaryContainer + '66';
      textColor = colors.primary;
    } else if (type === 'action') {
      bgColor = colors.error + '11';
      textColor = colors.error;
    } else if (type === 'import') {
      bgColor = colors.primary;
      textColor = '#fff';
    }

    return (
      <TouchableOpacity
        style={[styles.button, { backgroundColor: bgColor, flex, borderRadius: 20 }]}
        onPress={() => value === 'IMPORT' ? handleImport() : handlePress(value)}
      >
        {value === 'DEL' ? (
          <Ionicons name="backspace-outline" size={24} color={textColor} />
        ) : value === 'IMPORT' ? (
          <Ionicons name="checkmark-done" size={28} color={textColor} />
        ) : (
          <Text style={[styles.buttonText, { color: textColor }]}>{value}</Text>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={isVisible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          <View style={styles.header}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.display}>
            <Text style={[styles.expressionText, { color: colors.textSecondary }]} numberOfLines={1}>
              {expression || ' '}
            </Text>
            <Text style={[styles.resultText, { color: colors.text }]}>
              {result}
            </Text>
          </View>

          <View style={styles.pad}>
            <View style={styles.row}>
              <CalcButton value="C" type="action" />
              <CalcButton value="DEL" />
              <CalcButton value="%" type="operator" />
              <CalcButton value="÷" type="operator" />
            </View>
            <View style={styles.row}>
              <CalcButton value="7" />
              <CalcButton value="8" />
              <CalcButton value="9" />
              <CalcButton value="×" type="operator" />
            </View>
            <View style={styles.row}>
              <CalcButton value="4" />
              <CalcButton value="5" />
              <CalcButton value="6" />
              <CalcButton value="-" type="operator" />
            </View>
            <View style={styles.row}>
              <CalcButton value="1" />
              <CalcButton value="2" />
              <CalcButton value="3" />
              <CalcButton value="+" type="operator" />
            </View>
            <View style={styles.row}>
              <CalcButton value="." />
              <CalcButton value="0" />
              <CalcButton value="=" type="operator" />
              <CalcButton value="IMPORT" type="import" />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    maxHeight: '85%',
  },
  header: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
  },
  closeBtn: {
    position: 'absolute',
    right: 20,
    top: 10,
    padding: 8,
  },
  display: {
    paddingHorizontal: 24,
    paddingVertical: 20,
    alignItems: 'flex-end',
  },
  expressionText: {
    fontSize: 24,
    fontWeight: '500',
    marginBottom: 8,
  },
  resultText: {
    fontSize: 48,
    fontWeight: '800',
  },
  pad: {
    paddingHorizontal: 16,
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    height: (width - 64) / 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 22,
    fontWeight: '700',
  },
});
