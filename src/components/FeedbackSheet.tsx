import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Modal, 
  TouchableOpacity, 
  TextInput, 
  ScrollView, 
  KeyboardAvoidingView, 
  Platform,
  ActivityIndicator,
  Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { Card } from './Card';
import { Button } from './Button';
import { feedbackService, FeedbackType } from '../services/feedbackService';

interface FeedbackSheetProps {
  isVisible: boolean;
  onClose: () => void;
}

type Step = 'type' | 'input' | 'method' | 'success';

export const FeedbackSheet: React.FC<FeedbackSheetProps> = ({ isVisible, onClose }) => {
  const { colors, spacing, typography, borderRadius } = useTheme();
  const [step, setStep] = useState<Step>('type');
  const [type, setType] = useState<FeedbackType>('general');
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    if (isVisible) {
      setStep('type');
      setMessage('');
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      fadeAnim.setValue(0);
    }
  }, [isVisible]);

  const handleSelectType = (selectedType: FeedbackType) => {
    setType(selectedType);
    setMessage(feedbackService.getTemplate(selectedType));
    setStep('input');
  };

  const handleSend = async (method: 'email' | 'whatsapp') => {
    setIsSending(true);
    try {
      let success = false;
      if (method === 'email') {
        success = await feedbackService.sendEmail(type, message);
      } else {
        success = await feedbackService.sendWhatsApp(type, message);
      }
      
      if (success) {
        setStep('success');
        setTimeout(() => {
          onClose();
        }, 2500);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSending(false);
    }
  };

  const renderStep = () => {
    switch (step) {
      case 'type':
        return (
          <View>
            <Text style={[styles.title, { color: colors.text }]}>How can we help?</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Choose a category to get started.</Text>
            
            <View style={styles.optionsGrid}>
              <OptionCard 
                icon="bug-outline" 
                title="Report a Bug" 
                color={colors.error}
                onPress={() => handleSelectType('bug')}
              />
              <OptionCard 
                icon="bulb-outline" 
                title="Suggestion" 
                color={colors.primary}
                onPress={() => handleSelectType('suggestion')}
              />
              <OptionCard 
                icon="chatbubble-outline" 
                title="General Feedback" 
                color={colors.income}
                onPress={() => handleSelectType('general')}
              />
            </View>
          </View>
        );
      case 'input':
        return (
          <View>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => setStep('type')}>
                <Ionicons name="arrow-back" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.title, { color: colors.text, marginLeft: 16 }]}>Tell us more</Text>
            </View>
            
            <TextInput
              style={[styles.input, { 
                backgroundColor: colors.background, 
                color: colors.text,
                borderColor: colors.border + '33',
                height: 200
              }]}
              multiline
              autoFocus
              placeholder="Your feedback here..."
              placeholderTextColor={colors.textSecondary}
              value={message}
              onChangeText={setMessage}
              textAlignVertical="top"
            />
            
            <Button 
              title="Next" 
              onPress={() => setStep('method')}
              style={{ marginTop: 20 }}
              disabled={!message.trim()}
            />
          </View>
        );
      case 'method':
        return (
          <View>
            <View style={styles.header}>
              <TouchableOpacity onPress={() => setStep('input')}>
                <Ionicons name="arrow-back" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={[styles.title, { color: colors.text, marginLeft: 16 }]}>Choose method</Text>
            </View>
            
            <View style={styles.methodList}>
              <TouchableOpacity 
                style={[styles.methodCard, { backgroundColor: colors.background }]}
                onPress={() => handleSend('email')}
                disabled={isSending}
              >
                <View style={[styles.methodIcon, { backgroundColor: '#EA433515' }]}>
                  <Ionicons name="mail" size={24} color="#EA4335" />
                </View>
                <View style={{ flex: 1, marginLeft: 16 }}>
                  <Text style={[styles.methodTitle, { color: colors.text }]}>Email</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Open your mail app</Text>
                </View>
                {isSending ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />}
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.methodCard, { backgroundColor: colors.background }]}
                onPress={() => handleSend('whatsapp')}
                disabled={isSending}
              >
                <View style={[styles.methodIcon, { backgroundColor: '#25D36615' }]}>
                  <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
                </View>
                <View style={{ flex: 1, marginLeft: 16 }}>
                  <Text style={[styles.methodTitle, { color: colors.text }]}>WhatsApp</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Quick chat with support</Text>
                </View>
                {isSending ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />}
              </TouchableOpacity>
            </View>
          </View>
        );
      case 'success':
        return (
          <View style={styles.successContainer}>
            <View style={[styles.successIcon, { backgroundColor: colors.income + '15' }]}>
              <Ionicons name="checkmark-circle" size={64} color={colors.income} />
            </View>
            <Text style={[styles.title, { color: colors.text, marginTop: 24 }]}>Thank you!</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary, textAlign: 'center' }]}>
              Your feedback helps us make GreenMoney better for everyone. 💚
            </Text>
          </View>
        );
    }
  };

  const OptionCard = ({ icon, title, color, onPress }: any) => (
    <TouchableOpacity 
      style={[styles.optionCard, { backgroundColor: colors.background, borderColor: color + '33' }]}
      onPress={onPress}
    >
      <View style={[styles.optionIcon, { backgroundColor: color + '15' }]}>
        <Ionicons name={icon} size={28} color={color} />
      </View>
      <Text style={[styles.optionTitle, { color: colors.text }]}>{title}</Text>
    </TouchableOpacity>
  );

  return (
    <Modal visible={isVisible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.overlay}
      >
        <TouchableOpacity style={styles.dismiss} onPress={onClose} />
        <Card style={[styles.sheet, { backgroundColor: colors.card }]}>
          <View style={[styles.handle, { backgroundColor: colors.border + '33' }]} />
          <Animated.View style={{ opacity: fadeAnim }}>
            {renderStep()}
          </Animated.View>
        </Card>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  dismiss: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    paddingTop: 12,
    minHeight: 400,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    marginBottom: 24,
  },
  optionsGrid: {
    gap: 12,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
  },
  optionIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  input: {
    borderRadius: 20,
    padding: 20,
    fontSize: 16,
    borderWidth: 1,
  },
  methodList: {
    gap: 12,
  },
  methodCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 20,
  },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  successIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
  }
});
