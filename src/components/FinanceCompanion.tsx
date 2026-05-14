import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path, G, Defs, LinearGradient, Stop } from 'react-native-svg';
import Animated, { 
  useAnimatedStyle, 
  withRepeat, 
  withTiming, 
  withSequence,
  useSharedValue,
  interpolateColor
} from 'react-native-reanimated';
import { MoodState } from '../services/moodEngine';
import { useTheme } from '../hooks/useTheme';

interface Props {
  mood: MoodState;
  message: string;
}

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedPath = Animated.createAnimatedComponent(Path);

import { soundEngine } from '../services/soundEngine';

export const FinanceCompanion = ({ mood, message }: Props) => {
  const { colors } = useTheme();
  const floatAnim = useSharedValue(0);
  const blinkAnim = useSharedValue(1);

  useEffect(() => {
    // Play emotional sound when mood changes
    if (mood === 'very_happy' || mood === 'happy') {
      soundEngine.play('char_happy');
    } else if (mood === 'worried' || mood === 'stressed') {
      soundEngine.play('char_worried');
    }
    
    floatAnim.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 2000 }),
        withTiming(0, { duration: 2000 })
      ),
      -1,
      true
    );

    const blinkInterval = setInterval(() => {
      blinkAnim.value = withSequence(
        withTiming(0, { duration: 100 }),
        withTiming(1, { duration: 100 })
      );
    }, 4000);

    return () => clearInterval(blinkInterval);
  }, []);

  const animatedBodyStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatAnim.value * -10 }]
  }));

  const animatedEyeStyle = useAnimatedStyle(() => ({
    transform: [{ scaleY: blinkAnim.value }]
  }));

  const getMoodColors = () => {
    switch (mood) {
      case 'very_happy': return [colors.primary, '#4ade80'];
      case 'happy': return [colors.primary, colors.secondary];
      case 'worried': return ['#facc15', '#eab308'];
      case 'stressed': return ['#f87171', '#ef4444'];
      default: return [colors.primary, colors.primary + '99'];
    }
  };

  const renderFace = () => {
    switch (mood) {
      case 'very_happy':
        return <Path d="M40 65 Q50 75 60 65" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />;
      case 'happy':
        return <Path d="M42 68 Q50 73 58 68" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />;
      case 'worried':
        return <Path d="M45 70 Q50 68 55 70" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" />;
      case 'stressed':
        return <Path d="M42 72 Q50 68 58 72" stroke="#fff" strokeWidth="3" fill="none" strokeLinecap="round" />;
      default:
        return <Path d="M45 70 H55" stroke="#fff" strokeWidth="2" strokeLinecap="round" />;
    }
  };

  const moodColors = getMoodColors();

  return (
    <View style={st.container}>
      <Animated.View style={[st.character, animatedBodyStyle]}>
        <Svg width="100" height="100" viewBox="0 0 100 100">
          <Defs>
            <LinearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={moodColors[0]} />
              <Stop offset="1" stopColor={moodColors[1]} />
            </LinearGradient>
          </Defs>
          {/* Body */}
          <Circle cx="50" cy="50" r="40" fill="url(#grad)" />
          
          {/* Eyes */}
          <AnimatedG style={animatedEyeStyle}>
            <Circle cx="35" cy="45" r="4" fill="#fff" />
            <Circle cx="65" cy="45" r="4" fill="#fff" />
          </AnimatedG>
          
          {/* Mouth */}
          {renderFace()}
          
          {/* Cheeks if happy */}
          {(mood === 'very_happy' || mood === 'happy') && (
            <G opacity="0.3">
              <Circle cx="30" cy="55" r="5" fill="#fff" />
              <Circle cx="70" cy="55" r="5" fill="#fff" />
            </G>
          )}
        </Svg>
      </Animated.View>
      <View style={[st.bubble, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[st.message, { color: colors.text }]}>{message}</Text>
      </View>
    </View>
  );
};

const st = StyleSheet.create({
  container: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginVertical: 20, 
    paddingHorizontal: 10 
  },
  character: { width: 100, height: 100, justifyContent: 'center', alignItems: 'center' },
  bubble: { 
    flex: 1, 
    marginLeft: 15, 
    padding: 15, 
    borderRadius: 20, 
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  message: { fontSize: 14, fontWeight: '600', lineHeight: 20 }
});
