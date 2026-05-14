import React, { useState } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, Modal, 
  FlatList, Pressable 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useTheme } from '../hooks/useTheme';
import { Card } from './Card';

interface Option {
  label: string;
  value: any;
  icon?: string;
}

interface SelectProps {
  label?: string;
  value: any;
  options: Option[];
  onValueChange: (value: any) => void;
  placeholder?: string;
  style?: any;
}

export const Select = ({ label, value, options, onValueChange, placeholder = 'Select an option', style }: SelectProps) => {
  const { colors, spacing, isDark } = useTheme();
  const [modalVisible, setModalVisible] = useState(false);

  const selectedOption = options.find(opt => opt.value === value);

  const renderItem = ({ item }: { item: Option }) => {
    const isSelected = item.value === value;
    return (
      <TouchableOpacity 
        style={[
          styles.optionItem, 
          isSelected && { backgroundColor: colors.primary + '10' }
        ]}
        onPress={() => {
          onValueChange(item.value);
          setModalVisible(false);
        }}
      >
        <View style={styles.optionContent}>
          {item.icon && (
            <Ionicons 
              name={item.icon as any} 
              size={20} 
              color={isSelected ? colors.primary : colors.textSecondary} 
              style={{ marginRight: 12 }}
            />
          )}
          <Text style={[
            styles.optionLabel, 
            { color: isSelected ? colors.primary : colors.text }
          ]}>
            {item.label}
          </Text>
        </View>
        {isSelected && (
          <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={[styles.label, { color: colors.textSecondary }]}>{label}</Text>}
      
      <TouchableOpacity 
        activeOpacity={0.7}
        onPress={() => setModalVisible(true)}
      >
        <Card variant="tonal" style={styles.trigger}>
          <View style={styles.triggerContent}>
            <Text style={[
              styles.triggerText, 
              { color: selectedOption ? colors.text : colors.textSecondary }
            ]}>
              {selectedOption ? selectedOption.label : placeholder}
            </Text>
            <Ionicons name="chevron-down" size={18} color={colors.textSecondary} />
          </View>
        </Card>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable 
            style={StyleSheet.absoluteFill} 
            onPress={() => setModalVisible(false)} 
          >
            <BlurView intensity={20} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          </Pressable>
          
          <Card style={[styles.sheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>
                {label || 'Select Option'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={options}
              keyExtractor={(item) => item.value.toString()}
              renderItem={renderItem}
              contentContainerStyle={{ paddingBottom: 40 }}
              showsVerticalScrollIndicator={false}
            />
          </Card>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { width: '100%', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  trigger: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: 'transparent' },
  triggerContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  triggerText: { fontSize: 16, fontWeight: '600' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  sheet: { width: '100%', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, borderTopWidth: 1, maxHeight: '80%' },
  handle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 20, opacity: 0.3 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  sheetTitle: { fontSize: 20, fontWeight: '800' },
  closeBtn: { padding: 4 },
  optionItem: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingVertical: 14, 
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 4,
  },
  optionContent: { flexDirection: 'row', alignItems: 'center' },
  optionLabel: { fontSize: 16, fontWeight: '700' },
});
