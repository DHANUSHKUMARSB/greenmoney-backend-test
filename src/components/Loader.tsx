import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, View, StyleSheet, Text, Animated } from 'react-native';
import { useTheme } from '../hooks/useTheme';

interface LoaderProps {
  message?: string;
}

export const Loader: React.FC<LoaderProps> = ({ message }) => {
  const { colors, spacing, borderRadius } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <View style={[styles.indicatorContainer, { backgroundColor: colors.primary + '10', borderRadius: borderRadius.xl }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
        
        {message && (
          <View style={styles.messageContainer}>
            <Text style={[styles.message, { color: colors.text, marginBottom: spacing.xs }]}>
              {message}
            </Text>
            <View style={[styles.progressBar, { backgroundColor: colors.primary + '20' }]}>
              <Animated.View 
                style={[
                  styles.progressFill, 
                  { 
                    backgroundColor: colors.primary,
                    width: '30%', // Simulated progress for visual feel
                  }
                ]} 
              />
            </View>
          </View>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 40,
  },
  indicatorContainer: {
    padding: 24,
    marginBottom: 24,
  },
  messageContainer: {
    alignItems: 'center',
    width: '100%',
  },
  message: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  progressBar: {
    height: 4,
    width: 140,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
});
