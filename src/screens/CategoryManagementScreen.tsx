import React, { useState, useCallback, useEffect } from 'react';
import { 
  StyleSheet, Text, View, TouchableOpacity, 
  TextInput, Alert, KeyboardAvoidingView, Platform 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import DraggableFlatList, { 
  RenderItemParams, 
  ScaleDecorator 
} from 'react-native-draggable-flatlist';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../hooks/useTheme';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { 
  getCategories, addCategory, deleteCategory, updateCategoriesOrder 
} from '../services/database';
import { useNavigation } from '@react-navigation/native';

export const CategoryManagementScreen = () => {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [categories, setCategories] = useState<any[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [loading, setLoading] = useState(false);

  const loadCategories = useCallback(async () => {
    const all = await getCategories();
    setCategories(all.filter(c => c.type === type));
  }, [type]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const handleAdd = async () => {
    if (!newCatName.trim()) return;
    setLoading(true);
    try {
      await addCategory(newCatName.trim(), type);
      setNewCatName('');
      await loadCategories();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (e) {
      Alert.alert('Error', 'Failed to add category');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${name}"? Transactions using this category will become "Uncategorized".`,
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Delete', 
          style: 'destructive',
          onPress: async () => {
            await deleteCategory(id);
            await loadCategories();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        }
      ]
    );
  };

  const onDragEnd = async ({ data }: { data: any[] }) => {
    setCategories(data);
    // Persist reorder
    const allCats = await getCategories();
    const otherTypeCats = allCats.filter(c => c.type !== type);
    const newFullList = [...data, ...otherTypeCats];
    await updateCategoriesOrder(newFullList);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const renderItem = ({ item, drag, isActive }: RenderItemParams<any>) => {
    return (
      <ScaleDecorator>
        <TouchableOpacity
          onLongPress={drag}
          disabled={isActive}
          activeOpacity={0.9}
          style={[
            styles.rowItem,
            { 
              backgroundColor: isActive ? colors.primary + '20' : colors.card,
              borderColor: isActive ? colors.primary : colors.border + '22'
            }
          ]}
        >
          <View style={styles.rowContent}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primaryContainer + '33' }]}>
              <Ionicons 
                name={type === 'income' ? 'arrow-down-circle' : 'arrow-up-circle'} 
                size={20} 
                color={type === 'income' ? colors.income : colors.expense} 
              />
            </View>
            <Text style={[styles.catName, { color: colors.text }]}>{item.name}</Text>
          </View>
          
          <View style={styles.actions}>
            <TouchableOpacity 
              onPress={() => handleDelete(item.id, item.name)}
              style={styles.actionBtn}
            >
              <Ionicons name="trash-outline" size={20} color={colors.error} />
            </TouchableOpacity>
            <TouchableOpacity onLongPress={drag} delayLongPress={0} style={styles.dragHandle}>
              <Ionicons name="reorder-two" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </ScaleDecorator>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10, paddingBottom: 20 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Manage Categories</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.typeSwitcher}>
        {(['expense', 'income'] as const).map(t => (
          <TouchableOpacity 
            key={t}
            onPress={() => setType(t)}
            style={[
              styles.typeTab, 
              { borderBottomColor: type === t ? colors.primary : 'transparent' }
            ]}
          >
            <Text style={[
              styles.typeTabText, 
              { color: type === t ? colors.primary : colors.textSecondary }
            ]}>
              {t.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <DraggableFlatList
        data={categories}
        onDragEnd={onDragEnd}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        containerStyle={{ flex: 1 }}
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
      />

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <Card style={[styles.addCard, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, paddingBottom: insets.bottom + 10 }]}>
          <View style={styles.addInputRow}>
            <View style={[styles.inputBox, { backgroundColor: colors.background }]}>
              <TextInput
                placeholder={`New ${type} category...`}
                placeholderTextColor={colors.textSecondary + '66'}
                value={newCatName}
                onChangeText={setNewCatName}
                style={[styles.input, { color: colors.text }]}
              />
            </View>
            <TouchableOpacity 
              onPress={handleAdd}
              disabled={loading || !newCatName.trim()}
              style={[
                styles.addBtn, 
                { backgroundColor: colors.primary, opacity: (!newCatName.trim() || loading) ? 0.6 : 1 }
              ]}
            >
              <Ionicons name="add" size={28} color="white" />
            </TouchableOpacity>
          </View>
        </Card>
      </KeyboardAvoidingView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  typeSwitcher: { flexDirection: 'row', paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#eee' },
  typeTab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 3 },
  typeTabText: { fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  rowItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    padding: 12, 
    borderRadius: 16, 
    marginBottom: 12, 
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  rowContent: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  iconCircle: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  catName: { fontSize: 16, fontWeight: '700', marginLeft: 12 },
  actions: { flexDirection: 'row', alignItems: 'center' },
  actionBtn: { padding: 8, marginRight: 4 },
  dragHandle: { padding: 8 },
  addCard: { marginTop: 0, padding: 16, borderRadius: 0, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  addInputRow: { flexDirection: 'row', gap: 12 },
  inputBox: { flex: 1, height: 52, borderRadius: 16, paddingHorizontal: 16, justifyContent: 'center' },
  input: { fontSize: 15, fontWeight: '600' },
  addBtn: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
});
