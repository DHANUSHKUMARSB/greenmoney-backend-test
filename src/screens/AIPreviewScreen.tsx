import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, LayoutAnimation, UIManager, Platform
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { typography, spacing } from '../utils/theme';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { getCategories, getAccounts, insertTransaction, TransactionInput } from '../services/database';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental)
  UIManager.setLayoutAnimationEnabledExperimental(true);

const CAT_COLORS: Record<string, string> = {
  Food: '#FF7043', Transport: '#42A5F5', Shopping: '#AB47BC', Salary: '#66BB6A',
  Transfer: '#78909C', Bills: '#FFA726', Health: '#EF5350', Education: '#29B6F6',
  Entertainment: '#EC407A', ATM: '#8D6E63',
};
const catColor = (n?: string) => n ? (CAT_COLORS[n] || '#78909C') : '#9E9E9E';
const TODAY = new Date().toISOString().split('T')[0];

// ─── Transaction Row ─────────────────────────────────────────────────────────
const TransactionRow = ({ tx, index, categories, colors, selectMode, isSelected, onUpdate, onRemove, onToggleSelect }: {
  tx: any; index: number; categories: any[]; colors: any;
  selectMode: boolean; isSelected: boolean;
  onUpdate: (i: number, f: string, v: any) => void;
  onRemove: (i: number) => void;
  onToggleSelect: (i: number) => void;
}) => {
  const [expanded, setExpanded] = useState(false);
  const isIncome = tx.type === 'income';
  const aColor   = isIncome ? '#4CAF50' : '#F44336';
  const cc       = catColor(tx.category);

  return (
    <Card style={{ marginBottom: spacing.s, padding: 0, overflow: 'hidden', borderWidth: isSelected ? 2 : 0, borderColor: isSelected ? colors.primary : 'transparent' }}>
      <View style={{ flexDirection: 'row' }}>
        <View style={{ width: 4, backgroundColor: aColor, borderRadius: 4 }} />
        {selectMode && (
          <TouchableOpacity onPress={() => onToggleSelect(index)} style={{ justifyContent: 'center', alignItems: 'center', paddingLeft: spacing.m }}>
            <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.primary, backgroundColor: isSelected ? colors.primary : 'transparent', justifyContent: 'center', alignItems: 'center' }}>
              {isSelected && <Ionicons name="checkmark" size={13} color="#fff" />}
            </View>
          </TouchableOpacity>
        )}
        <View style={{ flex: 1, padding: spacing.m }}>
          <TouchableOpacity onPress={() => selectMode ? onToggleSelect(index) : setExpanded(!expanded)} activeOpacity={0.8}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flex: 1, marginRight: spacing.s }}>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }} numberOfLines={1}>{tx.description || 'Transaction'}</Text>
                <View style={{ alignSelf: 'flex-start', marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: cc + '22' }}>
                  <Text style={{ color: cc, fontSize: 11, fontWeight: '600' }}>{tx.category || 'Uncategorized'}</Text>
                </View>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ color: aColor, fontWeight: '700', fontSize: 16 }}>{isIncome ? '+' : '-'}₹{Number(tx.amount).toLocaleString('en-IN')}</Text>
                {!selectMode && <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={14} color={colors.textSecondary} style={{ marginTop: 4 }} />}
              </View>
            </View>
          </TouchableOpacity>

          {expanded && !selectMode && (
            <View style={{ marginTop: spacing.m, borderTopWidth: 1, borderTopColor: colors.border + '44', paddingTop: spacing.m }}>
              <Text style={{ color: colors.textSecondary, fontSize: 11, marginBottom: 4 }}>Description</Text>
              <TextInput style={{ borderWidth: 1, borderRadius: 8, paddingHorizontal: spacing.m, paddingVertical: spacing.s, fontSize: 14, color: colors.text, borderColor: colors.border }}
                value={tx.description} onChangeText={v => onUpdate(index, 'description', v)} placeholderTextColor={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary, fontSize: 11, marginBottom: 4, marginTop: spacing.s }}>Amount</Text>
              <TextInput style={{ borderWidth: 1, borderRadius: 8, paddingHorizontal: spacing.m, paddingVertical: spacing.s, fontSize: 14, color: colors.text, borderColor: colors.border }}
                value={tx.amount.toString()} onChangeText={v => onUpdate(index, 'amount', v)} keyboardType="numeric" placeholderTextColor={colors.textSecondary} />
              <Text style={{ color: colors.textSecondary, fontSize: 11, marginBottom: 4, marginTop: spacing.s }}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: spacing.s }}>
                {categories.map(cat => (
                  <TouchableOpacity key={cat.id} onPress={() => onUpdate(index, 'category', cat.name)}
                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginRight: 8, backgroundColor: tx.category === cat.name ? catColor(cat.name) : catColor(cat.name) + '22' }}>
                    <Text style={{ color: tx.category === cat.name ? '#fff' : catColor(cat.name), fontWeight: '600', fontSize: 12 }}>{cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <TouchableOpacity onPress={() => onUpdate(index, 'type', isIncome ? 'expense' : 'income')}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.m, paddingVertical: spacing.xs, borderRadius: 16, backgroundColor: isIncome ? '#4CAF5022' : '#F4433622' }}>
                  <Ionicons name={isIncome ? 'arrow-up-circle' : 'arrow-down-circle'} size={16} color={aColor} />
                  <Text style={{ color: aColor, fontWeight: '700', marginLeft: 6 }}>{tx.type.toUpperCase()}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => onRemove(index)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="trash-outline" size={18} color="#F44336" />
                  <Text style={{ color: '#F44336', marginLeft: 4, fontSize: 13 }}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Card>
  );
};

// ─── Date Accordion Group ────────────────────────────────────────────────────
const DateGroup = ({ date, txList, categories, colors, selectMode, selectedIndexes, onUpdate, onRemove, onToggleSelect }: any) => {
  const [open, setOpen] = useState(true);
  const groupIncome  = txList.filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + Number(t.amount), 0);
  const groupExpense = txList.filter((t: any) => t.type !== 'income').reduce((s: number, t: any) => s + Number(t.amount), 0);

  const prettyDate = (() => {
    try { return new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }); }
    catch { return date; }
  })();

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(p => !p);
  };

  return (
    <View style={{ marginBottom: spacing.s }}>
      {/* Accordion header */}
      <TouchableOpacity onPress={toggle}
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing.s, paddingHorizontal: spacing.m, borderRadius: 10, backgroundColor: colors.card }}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14 }}>{prettyDate}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{txList.length} transaction{txList.length !== 1 ? 's' : ''}</Text>
        </View>
        <View style={{ alignItems: 'flex-end', marginRight: spacing.s }}>
          {groupIncome  > 0 && <Text style={{ color: '#4CAF50', fontSize: 12, fontWeight: '600' }}>+₹{groupIncome.toLocaleString('en-IN')}</Text>}
          {groupExpense > 0 && <Text style={{ color: '#F44336', fontSize: 12, fontWeight: '600' }}>-₹{groupExpense.toLocaleString('en-IN')}</Text>}
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
      </TouchableOpacity>

      {/* Accordion body */}
      {open && (
        <View style={{ paddingTop: spacing.s }}>
          {txList.map((tx: any) => (
            <TransactionRow key={tx._originalIndex} tx={tx} index={tx._originalIndex}
              categories={categories} colors={colors}
              selectMode={selectMode} isSelected={selectedIndexes.has(tx._originalIndex)}
              onUpdate={onUpdate} onRemove={onRemove} onToggleSelect={onToggleSelect}
            />
          ))}
        </View>
      )}
    </View>
  );
};

// ─── Main Screen ─────────────────────────────────────────────────────────────
export const AIPreviewScreen = () => {
  const { colors }  = useTheme();
  const insets      = useSafeAreaInsets();
  const navigation  = useNavigation<any>();
  const route       = useRoute<any>();

  const [transactions, setTransactions] = useState<any[]>(route.params?.transactions || []);
  const [categories, setCategories]     = useState<any[]>([]);
  const [accounts, setAccounts]         = useState<any[]>([]);
  const [isSaving, setIsSaving]         = useState(false);
  const [selectMode, setSelectMode]     = useState(false);
  const [selectedIndexes, setSelectedIndexes] = useState<Set<number>>(new Set());

  useEffect(() => {
    Promise.all([getCategories(), getAccounts()]).then(([cats, accs]) => { setCategories(cats); setAccounts(accs); });
  }, []);

  const byDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    transactions.forEach((tx, i) => {
      const d = tx.date || TODAY;
      if (!map[d]) map[d] = [];
      map[d].push({ ...tx, _originalIndex: i });
    });
    return map;
  }, [transactions]);

  const sortedDates = useMemo(() => Object.keys(byDate).sort((a, b) => b.localeCompare(a)), [byDate]);

  const toggleIndex = (i: number) => setSelectedIndexes(prev => {
    const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n;
  });
  const allSelected = transactions.length > 0 && transactions.every((_, i) => selectedIndexes.has(i));
  const selectAll   = () => setSelectedIndexes(new Set(transactions.map((_, i) => i)));
  const deselectAll = () => setSelectedIndexes(new Set());

  const deleteSelected = () => {
    if (!selectedIndexes.size) return;
    Alert.alert('Delete Selected', `Remove ${selectedIndexes.size} transaction${selectedIndexes.size > 1 ? 's' : ''}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => {
        setTransactions(prev => prev.filter((_, i) => !selectedIndexes.has(i)));
        setSelectedIndexes(new Set()); setSelectMode(false);
      }},
    ]);
  };

  const updateTransaction = (i: number, f: string, v: any) =>
    setTransactions(prev => { const u = [...prev]; u[i] = { ...u[i], [f]: v }; return u; });

  const removeTransaction = (i: number) =>
    setTransactions(prev => prev.filter((_, idx) => idx !== i));

  const handleConfirm = async () => {
    if (!accounts.length) { Alert.alert('Error', 'No accounts found.'); return; }
    setIsSaving(true);
    try {
      const aid = accounts[0].id;
      for (const tx of transactions) {
        const mc = categories.find(c => c.name.toLowerCase() === (tx.category || '').toLowerCase());
        await insertTransaction({ amount: parseFloat(tx.amount) || 0, type: tx.type === 'income' ? 'income' : 'expense', categoryId: mc?.id || null, accountId: aid, date: tx.date || TODAY, note: tx.description } as TransactionInput);
      }
      Alert.alert('Saved!', `${transactions.length} transactions imported.`, [{ text: 'Done', onPress: () => navigation.navigate('Main') }]);
    } catch { Alert.alert('Error', 'Failed to save.'); }
    finally { setIsSaving(false); }
  };

  const totalIncome  = transactions.filter(t => t.type === 'income').reduce((s, t) => s + Number(t.amount), 0);
  const totalExpense = transactions.filter(t => t.type !== 'income').reduce((s, t) => s + Number(t.amount), 0);

  return (
    <View style={[st.container, { backgroundColor: colors.background, paddingTop: insets.top + spacing.m }]}>
      {/* Header */}
      <View style={st.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: spacing.xs }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[{ ...typography.header, fontSize: 20 }, { color: colors.text, flex: 1, marginLeft: spacing.xs }]}>Review Transactions</Text>
        <TouchableOpacity onPress={() => { setSelectMode(p => !p); setSelectedIndexes(new Set()); }}
          style={[st.selToggle, { backgroundColor: selectMode ? colors.primary : colors.primary + '22' }]}>
          <Ionicons name={selectMode ? 'close' : 'checkbox-outline'} size={18} color={selectMode ? '#fff' : colors.primary} />
          <Text style={{ color: selectMode ? '#fff' : colors.primary, fontSize: 13, fontWeight: '600', marginLeft: 4 }}>{selectMode ? 'Cancel' : 'Select'}</Text>
        </TouchableOpacity>
      </View>

      {/* Summary bar */}
      {transactions.length > 0 && (
        <View style={[st.summaryBar, { backgroundColor: colors.card }]}>
          <View style={st.summaryItem}><Text style={{ color: colors.textSecondary, fontSize: 11 }}>Found</Text><Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{transactions.length}</Text></View>
          <View style={st.summaryItem}><Text style={{ color: colors.textSecondary, fontSize: 11 }}>Income</Text><Text style={{ color: '#4CAF50', fontWeight: '700', fontSize: 16 }}>+₹{totalIncome.toLocaleString('en-IN')}</Text></View>
          <View style={st.summaryItem}><Text style={{ color: colors.textSecondary, fontSize: 11 }}>Expense</Text><Text style={{ color: '#F44336', fontWeight: '700', fontSize: 16 }}>-₹{totalExpense.toLocaleString('en-IN')}</Text></View>
        </View>
      )}

      {/* Bulk selection toolbar */}
      {selectMode && transactions.length > 0 && (
        <View style={[st.toolbar, { backgroundColor: colors.card }]}>
          <TouchableOpacity onPress={allSelected ? deselectAll : selectAll} style={[st.selBtn, { borderColor: colors.primary }]}>
            <Ionicons name={allSelected ? 'checkbox' : 'square-outline'} size={18} color={colors.primary} />
            <Text style={{ color: colors.primary, marginLeft: 6, fontWeight: '600', fontSize: 13 }}>{allSelected ? 'Deselect All' : 'Select All'}</Text>
          </TouchableOpacity>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{selectedIndexes.size} selected</Text>
          <TouchableOpacity onPress={deleteSelected} disabled={!selectedIndexes.size} style={[st.delBtn, { opacity: selectedIndexes.size ? 1 : 0.35 }]}>
            <Ionicons name="trash" size={16} color="#fff" />
            <Text style={{ color: '#fff', marginLeft: 6, fontWeight: '700', fontSize: 13 }}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView showsVerticalScrollIndicator={false}>
        {transactions.length === 0 ? (
          <View style={st.empty}>
            <Ionicons name="document-text-outline" size={64} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, marginTop: spacing.m, textAlign: 'center' }}>No transactions extracted.</Text>
          </View>
        ) : sortedDates.map(date => (
          <DateGroup key={date} date={date} txList={byDate[date]}
            categories={categories} colors={colors}
            selectMode={selectMode} selectedIndexes={selectedIndexes}
            onUpdate={updateTransaction} onRemove={removeTransaction} onToggleSelect={toggleIndex}
          />
        ))}
        <View style={{ height: 120 }} />
      </ScrollView>

      {transactions.length > 0 && !selectMode && (
        <View style={[st.footer, { backgroundColor: colors.background }]}>
          <Button title={isSaving ? 'Saving...' : `Save All ${transactions.length} Transactions`} onPress={handleConfirm} disabled={isSaving} />
        </View>
      )}
    </View>
  );
};

const st = StyleSheet.create({
  container:   { flex: 1, padding: spacing.m },
  headerRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.m, marginTop: spacing.s },
  selToggle:   { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.m, paddingVertical: 6, borderRadius: 20 },
  summaryBar:  { flexDirection: 'row', borderRadius: 12, padding: spacing.m, marginBottom: spacing.m },
  summaryItem: { flex: 1, alignItems: 'center' },
  toolbar:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 12, padding: spacing.m, marginBottom: spacing.m },
  selBtn:      { flexDirection: 'row', alignItems: 'center', borderWidth: 1, paddingHorizontal: spacing.m, paddingVertical: 6, borderRadius: 20 },
  delBtn:      { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F44336', paddingHorizontal: spacing.m, paddingVertical: 6, borderRadius: 20 },
  empty:       { alignItems: 'center', paddingVertical: spacing.xl * 2 },
  footer:      { paddingVertical: spacing.s },
});
