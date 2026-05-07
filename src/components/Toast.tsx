import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export interface ToastRef {
  show: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const Toast = forwardRef<ToastRef>((_, ref) => {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'success' | 'error' | 'info'>('info');
  const opacity = useState(new Animated.Value(0))[0];

  useImperativeHandle(ref, () => ({
    show: (msg, t = 'info') => {
      setMessage(msg);
      setType(t);
      setVisible(true);
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.delay(3000),
        Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start(() => setVisible(false));
    },
  }));

  if (!visible) return null;

  const getIcon = () => {
    switch (type) {
      case 'success': return <Ionicons name="checkmark-circle" size={20} color="#fff" />;
      case 'error': return <Ionicons name="alert-circle" size={20} color="#fff" />;
      default: return <Ionicons name="information-circle" size={20} color="#fff" />;
    }
  };

  const getBgColor = () => {
    switch (type) {
      case 'success': return '#4CAF50';
      case 'error': return '#F44336';
      default: return '#2196F3';
    }
  };

  return (
    <Animated.View style={[styles.container, { opacity, backgroundColor: getBgColor() }]}>
      {getIcon()}
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    zIndex: 9999,
  },
  text: {
    color: '#fff',
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
  },
});
