import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Modal, TextInput, Pressable, Animated, PanResponder, BackHandler } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { getTransactions, getCategories, getAccounts, insertTransaction, TransactionInput } from '../services/database';
import { useCurrency } from '../hooks/useCurrency';
import { soundEngine } from '../services/soundEngine';
import { Swipeable, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAppStore } from '../store';


const ITEM_HEIGHT = 90; // Approximate height of each transaction item

export const BulkImportReviewScreen = () => {
  const { colors, spacing, typography, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { format } = useCurrency();
  const { setActiveTab } = useAppStore();

  
  const initialTransactions = route.params?.transactions || [];
  const initialDupesRemoved = route.params?.duplicatesRemoved || 0;

  const [items, setItems] = useState<any[]>(initialTransactions.map((tx: any, idx: number) => ({ 
    ...tx, 
    id: `new-${idx}-${Date.now()}`, 
    isSelected: false 
  })));
  
  const [categories, setCategories] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [importStats, setImportStats] = useState({ total: 0, income: 0, expense: 0, duplicates: initialDupesRemoved });

  // Filter & Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [sortField, setSortField] = useState<'date' | 'amount' | 'category'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [showSortModal, setShowSortModal] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);

  // Drag Selection State
  const [isDragSelecting, setIsDragSelecting] = useState(false);
  const dragStartIndex = useRef<number | null>(null);
  const lastSelectedIndex = useRef<number | null>(null);
  const scrollY = useRef(0);
  const listOffsetTop = useRef(0);

  // Edit Modal State
  const [editingItem, setEditingItem] = useState<any | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  // Handle back button when complete
  useEffect(() => {
    if (isComplete) {
      const onBackPress = () => {
        // Force navigate to main instead of going back to review list
        handleFinish();
        return true;
      };
      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      navigation.setOptions({ gestureEnabled: false }); // Disable iOS swipe back
      return () => subscription.remove();
    }
  }, [isComplete]);

  const handleFinish = () => {
    setActiveTab(0);
    navigation.reset({
      index: 0,
      routes: [{ name: 'Main' }],
    });
  };

  const loadData = async () => {
    const [cats, accs] = await Promise.all([
      getCategories(),
      getAccounts()
    ]);
    setCategories(cats);
    setAccounts(accs);
  };

  const filteredItems = useMemo(() => {
    let result = items.filter(item => {
      const matchesSearch = item.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           item.amount.toString().includes(searchQuery) ||
                           item.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesType = filterType === 'all' || item.type === filterType;
      return matchesSearch && matchesType;
    });

    result.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'date') comparison = new Date(a.date).getTime() - new Date(b.date).getTime();
      else if (sortField === 'amount') comparison = a.amount - b.amount;
      else if (sortField === 'category') comparison = a.category.localeCompare(b.category);
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return result;
  }, [items, searchQuery, filterType, sortField, sortOrder]);

  const handleToggle = (id: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, isSelected: !item.isSelected } : item));
    soundEngine.play('tap');
  };

  const handleDelete = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
    soundEngine.play('delete_confirmed');
  };

  const bulkDelete = () => {
    const selectedCount = items.filter(i => i.isSelected).length;
    Alert.alert('Bulk Delete', `Remove ${selectedCount} selected transactions?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        setItems(prev => prev.filter(i => !i.isSelected));
        soundEngine.play('delete_confirmed');
      }}
    ]);
  };

  // Drag Selection Logic
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => isDragSelecting,
      onMoveShouldSetPanResponder: () => isDragSelecting,
      onPanResponderMove: (evt, gestureState) => {
        if (!isDragSelecting || dragStartIndex.current === null) return;

        const currentY = evt.nativeEvent.pageY - listOffsetTop.current + scrollY.current;
        const currentIndex = Math.floor(currentY / ITEM_HEIGHT);
        
        if (currentIndex >= 0 && currentIndex < filteredItems.length && currentIndex !== lastSelectedIndex.current) {
          lastSelectedIndex.current = currentIndex;
          updateRangeSelection(dragStartIndex.current, currentIndex);
        }
      },
      onPanResponderRelease: () => {
        setIsDragSelecting(false);
        dragStartIndex.current = null;
        lastSelectedIndex.current = null;
      },
    })
  ).current;

  const updateRangeSelection = (start: number, end: number) => {
    const min = Math.min(start, end);
    const max = Math.max(start, end);
    const visibleIdsInRange = new Set(filteredItems.slice(min, max + 1).map(i => i.id));
    
    setItems(prev => prev.map(item => {
      if (visibleIdsInRange.has(item.id)) {
        return { ...item, isSelected: true };
      }
      return item;
    }));
    soundEngine.play('tap');
  };

  const startDragSelect = (index: number) => {
    setIsDragSelecting(true);
    dragStartIndex.current = index;
    lastSelectedIndex.current = index;
    handleToggle(filteredItems[index].id);
  };

  const toggleSelectAll = () => {
    const allVisibleSelected = filteredItems.length > 0 && filteredItems.every(i => i.isSelected);
    const visibleIds = new Set(filteredItems.map(i => i.id));
    
    setItems(prev => prev.map(item => {
      if (visibleIds.has(item.id)) {
        return { ...item, isSelected: !allVisibleSelected };
      }
      return item;
    }));
  };

  const handleSaveEdit = (updated: any) => {
    setItems(prev => prev.map(item => item.id === updated.id ? updated : item));
    setEditingItem(null);
    soundEngine.play('tap');
  };

  const handleImport = async () => {
    if (items.length === 0) {
      Alert.alert('No Items', 'No transactions available to import.');
      return;
    }
    
    Alert.alert(
      'Confirm Import', 
      `Import all ${items.length} transactions shown in the review?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Import All', onPress: () => executeImport(items) }
      ]
    );
  };

  const executeImport = async (allAvailable: any[]) => {
    setIsImporting(true);
    try {
      const defaultAccount = accounts.find(a => a.name.toLowerCase() === 'cash') || accounts[0];
      if (!defaultAccount) throw new Error('No account found. Please create an account first.');

      let income = 0;
      let expense = 0;

      for (const item of allAvailable) {
        let cat = categories.find(c => c.name.toLowerCase() === item.category.toLowerCase() && c.type === item.type);
        if (!cat) cat = categories.find(c => c.type === item.type) || categories[0];

        const tx: TransactionInput = {
          amount: item.amount,
          type: item.type,
          categoryId: cat?.id,
          accountId: defaultAccount.id,
          date: new Date(item.date).toISOString(),
          note: item.description
        };

        await insertTransaction(tx);
        if (item.type === 'income') income += item.amount;
        else expense += item.amount;
      }

      setImportStats({ total: allAvailable.length, income, expense, duplicates: initialDupesRemoved });
      setIsComplete(true);
      soundEngine.play('success');
    } catch (error: any) {
      Alert.alert('Import Failed', error.message || 'An error occurred during import.');
    } finally {
      setIsImporting(false);
    }
  };

  const renderSwipeBackground = () => {
    return (
      <View style={[styles.swipeDeleteBtn, { backgroundColor: colors.error }]}>
        <Ionicons name="trash" size={24} color="#fff" />
      </View>
    );
  };

  if (isComplete) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center', padding: 40 }]}>
        <View style={[styles.successCircle, { backgroundColor: colors.primary }]}>
          <Ionicons name="checkmark" size={60} color="#fff" />
        </View>
        <Text style={[styles.successTitle, { color: colors.text }]}>Import Complete!</Text>
        <Card style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <Text style={{ color: colors.textSecondary }}>Total Imported</Text>
            <Text style={{ color: colors.text, fontWeight: '700' }}>{importStats.total} items</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={{ color: colors.error }}>Duplicates Removed</Text>
            <Text style={{ color: colors.error, fontWeight: '700' }}>{importStats.duplicates} items</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={{ color: colors.income }}>Total Income</Text>
            <Text style={{ color: colors.income, fontWeight: '700' }}>+{format(importStats.income)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={{ color: colors.expense }}>Total Expenses</Text>
            <Text style={{ color: colors.expense, fontWeight: '700' }}>-{format(importStats.expense)}</Text>
          </View>
        </Card>
        <Button 
          title="Back to Dashboard" 
          onPress={handleFinish} 
          style={{ width: '100%', marginTop: 32 }} 
        />
      </View>
    );
  }

  const selectedForDeleteCount = items.filter(i => i.isSelected).length;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <View 
        style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + spacing.m }]}
        {...panResponder.panHandlers}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>Final Review</Text>
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{items.length} unique transactions ready</Text>
          </View>
        </View>

        <View style={styles.controls}>
          <View style={[styles.searchBar, { backgroundColor: colors.card }]}>
            <Ionicons name="search" size={18} color={colors.textSecondary} />
            <TextInput 
              placeholder="Search items..." 
              placeholderTextColor={colors.textSecondary}
              style={[styles.searchInput, { color: colors.text }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>

          <View style={styles.actionToolbar}>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <TouchableOpacity onPress={() => setShowSortModal(true)}>
                <Ionicons name="swap-vertical" size={22} color={colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowFilterModal(true)}>
                <Ionicons name="funnel" size={22} color={colors.primary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={styles.selectAllBtn} onPress={toggleSelectAll}>
              <Ionicons 
                name={filteredItems.length > 0 && filteredItems.every(i => i.isSelected) ? "checkbox" : "square-outline"} 
                size={22} 
                color={colors.primary} 
              />
              <Text style={{ color: colors.text, fontWeight: '700', marginLeft: 8 }}>Select to Delete</Text>
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView 
          contentContainerStyle={styles.scrollContent} 
          showsVerticalScrollIndicator={false}
          scrollEnabled={!isDragSelecting}
          onScroll={(e) => { scrollY.current = e.nativeEvent.contentOffset.y; }}
          scrollEventThrottle={16}
          onLayout={(e) => { listOffsetTop.current = e.nativeEvent.layout.y; }}
        >
          {filteredItems.map((item, index) => (
            <Swipeable 
              key={item.id} 
              renderRightActions={renderSwipeBackground}
              renderLeftActions={renderSwipeBackground}
              onSwipeableOpen={() => handleDelete(item.id)}
              containerStyle={styles.swipeContainer}
              enabled={!isDragSelecting}
            >
              <TouchableOpacity 
                activeOpacity={0.8}
                onPress={() => setEditingItem(item)}
                onLongPress={() => startDragSelect(index)}
                delayLongPress={300}
                style={[
                  styles.txItem, 
                  { 
                    backgroundColor: colors.card,
                    borderColor: item.isSelected ? colors.error : 'transparent',
                    borderWidth: 2,
                    height: ITEM_HEIGHT - 12 // Adjusting for margin
                  }
                ]}
              >
                <View style={styles.txMain}>
                  <View style={[styles.iconBox, { backgroundColor: item.type === 'income' ? colors.income + '22' : colors.expense + '22' }]}>
                    <Ionicons 
                      name={item.type === 'income' ? 'arrow-down' : 'arrow-up'} 
                      size={20} 
                      color={item.type === 'income' ? colors.income : colors.expense} 
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={[styles.txDesc, { color: colors.text }]} numberOfLines={1}>{item.description}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{item.date} • {item.category}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.txAmount, { color: item.type === 'income' ? colors.income : colors.expense }]}>
                      {item.type === 'income' ? '+' : '-'}{format(item.amount)}
                    </Text>
                  </View>
                </View>
                
                <View style={styles.itemSelection}>
                  <TouchableOpacity style={styles.actionBtn} onPress={() => handleToggle(item.id)}>
                    <Ionicons 
                      name={item.isSelected ? "checkbox" : "square-outline"} 
                      size={24} 
                      color={item.isSelected ? colors.error : colors.textSecondary} 
                    />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            </Swipeable>
          ))}
          {filteredItems.length === 0 && (
            <View style={{ alignItems: 'center', marginTop: 40 }}>
              <Ionicons name="search-outline" size={48} color={colors.textSecondary + '44'} />
              <Text style={{ color: colors.textSecondary, marginTop: 12 }}>No matching transactions</Text>
            </View>
          )}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 20, backgroundColor: colors.background }]}>
          {selectedForDeleteCount > 0 ? (
            <TouchableOpacity 
              style={[styles.bulkDeleteSticky, { backgroundColor: colors.error + '15' }]} 
              onPress={bulkDelete}
            >
              <Ionicons name="trash" size={20} color={colors.error} />
              <Text style={{ color: colors.error, fontWeight: '800', marginLeft: 8 }}>DELETE ({selectedForDeleteCount})</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.footerStats}>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{items.length} Ready</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 11 }}>Review & Import All</Text>
            </View>
          )}
          <Button 
            title={`Import All (${items.length})`} 
            onPress={handleImport} 
            loading={isImporting}
            style={{ flex: 1, marginLeft: 20 }}
          />
        </View>

        {/* Edit Modal */}
        <Modal visible={!!editingItem} animationType="slide" transparent={true}>
          <View style={styles.modalOverlay}>
            <Card style={styles.editCard}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Edit Transaction</Text>
                <TouchableOpacity onPress={() => setEditingItem(null)}>
                  <Ionicons name="close" size={24} color={colors.text} />
                </TouchableOpacity>
              </View>
              
              {editingItem && (
                <ScrollView>
                  <Text style={styles.inputLabel}>Description</Text>
                  <TextInput 
                    style={[styles.modalInput, { backgroundColor: colors.background, color: colors.text }]}
                    value={editingItem.description}
                    onChangeText={txt => setEditingItem({ ...editingItem, description: txt })}
                  />

                  <Text style={styles.inputLabel}>Amount</Text>
                  <TextInput 
                    style={[styles.modalInput, { backgroundColor: colors.background, color: colors.text }]}
                    value={editingItem.amount.toString()}
                    keyboardType="numeric"
                    onChangeText={txt => setEditingItem({ ...editingItem, amount: parseFloat(txt) || 0 })}
                  />

                  <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
                  <TextInput 
                    style={[styles.modalInput, { backgroundColor: colors.background, color: colors.text }]}
                    value={editingItem.date}
                    onChangeText={txt => setEditingItem({ ...editingItem, date: txt })}
                  />

                  <Text style={styles.inputLabel}>Category</Text>
                  <TextInput 
                    style={[styles.modalInput, { backgroundColor: colors.background, color: colors.text }]}
                    value={editingItem.category}
                    onChangeText={txt => setEditingItem({ ...editingItem, category: txt })}
                  />

                  <View style={{ flexDirection: 'row', gap: 12, marginTop: 24 }}>
                    <Button 
                      title="Cancel" 
                      onPress={() => setEditingItem(null)} 
                      variant="outline" 
                      style={{ flex: 1 }} 
                    />
                    <Button 
                      title="Save Changes" 
                      onPress={() => handleSaveEdit(editingItem)} 
                      style={{ flex: 1 }} 
                    />
                  </View>
                </ScrollView>
              )}
            </Card>
          </View>
        </Modal>

        {/* Sort Modal */}
        <Modal visible={showSortModal} animationType="fade" transparent={true}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowSortModal(false)}>
            <Card style={styles.modalCard}>
              <Text style={[styles.modalTitle, { color: colors.text, marginBottom: 16 }]}>Sort By</Text>
              {([
                { key: 'date', label: 'Date' },
                { key: 'amount', label: 'Amount' },
                { key: 'category', label: 'Category' }
              ] as const).map(s => (
                <TouchableOpacity 
                  key={s.key} 
                  style={styles.modalOption} 
                  onPress={() => { setSortField(s.key); setShowSortModal(false); soundEngine.play('tap'); }}
                >
                  <Text style={{ color: sortField === s.key ? colors.primary : colors.text, fontWeight: sortField === s.key ? '700' : '400' }}>{s.label}</Text>
                  {sortField === s.key && <Ionicons name="checkmark" size={20} color={colors.primary} />}
                </TouchableOpacity>
              ))}
              <View style={styles.modalDivider} />
              <TouchableOpacity 
                style={styles.modalOption} 
                onPress={() => { setSortOrder(p => p === 'asc' ? 'desc' : 'asc'); setShowSortModal(false); soundEngine.play('tap'); }}
              >
                <Text style={{ color: colors.text }}>{sortOrder === 'asc' ? 'Ascending' : 'Descending'}</Text>
                <Ionicons name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'} size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </Card>
          </Pressable>
        </Modal>

        {/* Filter Modal */}
        <Modal visible={showFilterModal} animationType="slide" transparent={true}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowFilterModal(false)}>
            <Card style={styles.filterModal}>
              <View style={styles.modalHeader}>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Filters</Text>
                <TouchableOpacity onPress={() => setShowFilterModal(false)}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
              </View>
              
              <Text style={styles.inputLabel}>Transaction Type</Text>
              <View style={styles.chipRow}>
                {(['all', 'income', 'expense'] as const).map(t => (
                  <TouchableOpacity 
                    key={t} 
                    style={[styles.modalChip, { backgroundColor: filterType === t ? colors.primary : colors.background }]} 
                    onPress={() => setFilterType(t)}
                  >
                    <Text style={{ color: filterType === t ? '#fff' : colors.textSecondary, fontWeight: '600' }}>{t.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Button title="Apply Filters" onPress={() => setShowFilterModal(false)} style={{ marginTop: 32 }} />
            </Card>
          </Pressable>
        </Modal>
      </View>
    </GestureHandlerRootView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 12 },
  backBtn: { padding: 8, marginRight: 12 },
  title: { fontSize: 24, fontWeight: '800' },
  controls: { paddingHorizontal: 20, marginBottom: 16 },
  searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, height: 44, borderRadius: 12, marginBottom: 16 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 14 },
  actionToolbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectAllBtn: { flexDirection: 'row', alignItems: 'center' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
  swipeContainer: { marginBottom: 12 },
  txItem: { padding: 16, borderRadius: 20 },
  txMain: { flexDirection: 'row', alignItems: 'center' },
  iconBox: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  txDesc: { fontSize: 15, fontWeight: '700' },
  txAmount: { fontSize: 16, fontWeight: '800' },
  itemSelection: { position: 'absolute', top: -6, right: -6, zIndex: 10 },
  actionBtn: { padding: 4 },
  footer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  footerStats: { alignItems: 'flex-start' },
  bulkDeleteSticky: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  swipeDeleteBtn: { width: '100%', justifyContent: 'center', alignItems: 'flex-end', paddingRight: 30, borderRadius: 20, height: '100%' },
  successCircle: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  successTitle: { fontSize: 28, fontWeight: '900', marginBottom: 24 },
  summaryCard: { width: '100%', padding: 24 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  editCard: { width: '100%', padding: 24, borderRadius: 30 },
  modalCard: { width: '90%', padding: 24, borderRadius: 20 },
  filterModal: { width: '100%', padding: 24, borderTopLeftRadius: 30, borderTopRightRadius: 30, position: 'absolute', bottom: -20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  modalOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  modalDivider: { height: 1, backgroundColor: '#f0f0f0', marginVertical: 8 },
  inputLabel: { fontSize: 12, fontWeight: '700', color: '#9E9E9E', marginBottom: 8, marginTop: 16 },
  modalInput: { padding: 12, borderRadius: 12, fontSize: 15 },
  chipRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  modalChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
});
