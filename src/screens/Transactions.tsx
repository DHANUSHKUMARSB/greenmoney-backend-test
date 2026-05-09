import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, TextInput, Pressable, Animated } from 'react-native';
import { Calendar } from 'react-native-calendars';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { getTransactions, deleteTransaction, getCategories, getAccounts } from '../services/database';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { useCurrency } from '../hooks/useCurrency';
import { SyncConflictModal } from '../components/SyncConflictModal';
import { syncEvents } from '../services/syncEvents';
import { useViewContextStore } from '../store/viewContextStore';
import { useSortStore } from '../store/sortStore';
import { syncEngine } from '../services/syncEngine';

const TODAY = new Date().toISOString().split('T')[0];

const CAT_COLORS: Record<string, string> = {
  Food: '#FF7043', Transport: '#42A5F5', Shopping: '#AB47BC', Salary: '#66BB6A',
  Transfer: '#78909C', Bills: '#FFA726', Health: '#EF5350', Education: '#29B6F6',
  Entertainment: '#EC407A', ATM: '#8D6E63',
};
const catColor = (n?: string) => n ? (CAT_COLORS[n] || '#78909C') : '#9E9E9E';

type ViewMode = 'daily' | 'calendar' | 'monthly' | 'annually';

// ─── Reusable Transaction Card ────────────────────────────────────────────────
const TxCard = ({ item, selectMode, selectedIds, toggleId, singleDelete, colors, format, typography, spacing, borderRadius }: any) => {
  const isIncome = item.type === 'income';
  const isSel    = selectedIds.has(item.id);
  const navigation = useNavigation<any>();

  const getSyncIcon = () => {
    switch (item.sync_status) {
      case 'pending': return <Ionicons name="cloud-upload" size={14} color="#FFA726" />;
      case 'synced': return <Ionicons name="checkmark-circle" size={14} color={colors.success} />;
      case 'failed': return <Ionicons name="alert-circle" size={14} color={colors.error} />;
      case 'conflict': return <Ionicons name="warning" size={14} color="#AB47BC" />;
      default: return null;
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() => selectMode ? toggleId(item.id) : navigation.navigate('AddTransaction', { transactionId: item.id })}
      onLongPress={() => !selectMode && toggleId(item.id)}
      style={[
        st.txCard, 
        { 
          backgroundColor: isSel ? colors.primaryContainer : colors.card,
          borderRadius: borderRadius.l,
          padding: spacing.m,
        }
      ]}
    >
      <View style={[st.iconCircle, { backgroundColor: isIncome ? colors.income + '15' : colors.expense + '15' }]}>
        <Ionicons 
          name={isIncome ? 'arrow-down' : 'arrow-up'} 
          size={20} 
          color={isIncome ? colors.income : colors.expense} 
        />
      </View>

      <View style={{ flex: 1, marginLeft: spacing.m }}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={[st.txTitle, { color: colors.text }]} numberOfLines={1}>
            {item.note || item.category_name || 'Transaction'}
          </Text>
          <View style={{ marginLeft: spacing.xs }}>{getSyncIcon()}</View>
        </View>
        <Text style={[st.txDate, { color: colors.textSecondary }]}>
          {item.category_name || 'Uncategorized'} • {item.account_name || 'Cash'}
        </Text>
      </View>

      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[st.txAmount, { color: isIncome ? colors.income : colors.expense }]}>
          {isIncome ? '+' : '-'}{format(item.amount)}
        </Text>
        {item.recurring_id && (
          <Ionicons name="repeat" size={14} color={colors.primary} style={{ marginTop: 2 }} />
        )}
      </View>

      {selectMode && (
        <View style={[st.selectionCircle, { borderColor: colors.primary, backgroundColor: isSel ? colors.primary : 'transparent' }]}>
          {isSel && <Ionicons name="checkmark" size={12} color="#fff" />}
        </View>
      )}
    </TouchableOpacity>
  );
};

// ─── Monthly group header ─────────────────────────────────────────────────────
const DayGroup = ({ date, txList, isYearly, format, colors, spacing, typography, isCollapsed, onToggle, ...props }: any) => {
  const prettyDate = (() => {
    try { 
      if (isYearly) return new Date(date + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      return new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }); 
    }
    catch { return date; }
  })();
  const income  = txList.filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + t.amount, 0);
  const expense = txList.filter((t: any) => t.type !== 'income').reduce((s: number, t: any) => s + t.amount, 0);

  return (
    <View style={{ marginBottom: spacing.m }}>
      <TouchableOpacity onPress={onToggle} activeOpacity={0.8} style={st.groupHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Text style={[st.groupTitle, { color: colors.textSecondary }]}>{prettyDate}</Text>
        </View>
        <View style={{ flexDirection: 'row' }}>
          {income  > 0 && <Text style={[st.groupSummary, { color: colors.income }]}>+{format(income)}</Text>}
          {expense > 0 && <Text style={[st.groupSummary, { color: colors.expense, marginLeft: 8 }]}>-{format(expense)}</Text>}
        </View>
      </TouchableOpacity>
      {!isCollapsed && txList.map((item: any) => <TxCard key={item.id} item={item} format={format} colors={colors} spacing={spacing} typography={typography} {...props} />)}
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export const TransactionsScreen = () => {
  const { colors, spacing, typography, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const { format } = useCurrency();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [viewDate, setViewDate] = useState(new Date()); 
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showSortModal, setShowSortModal] = useState(false);

  const { sortField, sortOrder, setSort } = useSortStore();
  const { setContext } = useViewContextStore();

  const fabAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    setContext({
      viewMode: viewMode === 'annually' ? 'yearly' : (viewMode as any),
      selectedDate: selectedDate,
      selectedMonth: viewDate.getMonth(),
      selectedYear: viewDate.getFullYear(),
    });
  }, [viewMode, selectedDate, viewDate]);

  useEffect(() => {
    const shouldHideFAB = selectMode || selectedIds.size > 0;
    Animated.spring(fabAnim, {
      toValue: shouldHideFAB ? 0 : 1,
      useNativeDriver: true,
      damping: 15,
    }).start();
  }, [selectMode, selectedIds.size]);

  const [conflictTransaction, setConflictTransaction] = useState<any | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const toggleGroup = (date: string) => setCollapsedGroups(p => ({ ...p, [date]: !p[date] }));

  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterCatId, setFilterCatId] = useState<string | null>(null);
  const [filterAccId, setFilterAccId] = useState<string | null>(null);
  const [filterStartDate, setFilterStartDate] = useState<Date | null>(null);
  const [filterEndDate, setFilterEndDate] = useState<Date | null>(null);
  const [showPicker, setShowPicker] = useState<'start' | 'end' | null>(null);

  const onDateChange = (_: any, selectedDate?: Date) => {
    setShowPicker(null);
    if (!selectedDate) return;
    if (showPicker === 'start') setFilterStartDate(selectedDate);
    else if (showPicker === 'end') setFilterEndDate(selectedDate);
  };
  
  const [categories, setCategories] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);

  const loadFilters = async () => {
    setCategories(await getCategories());
    setAccounts(await getAccounts());
  };

  useEffect(() => { loadFilters(); }, []);

  const fetchTransactions = async () => {
    try { 
      setLoading(true); 
      setTransactions(await getTransactions()); 
    } finally { setLoading(false); }
  };

  const handleSync = async () => {
    try {
      setSyncing(true);
      await syncEngine.runSync(true);
      await fetchTransactions();
    } finally { setSyncing(false); }
  };

  useFocusEffect(
    useCallback(() => {
      fetchTransactions();
      loadFilters();
      const sub = () => { fetchTransactions(); loadFilters(); };
      syncEvents.on('sync_completed', sub);
      return () => syncEvents.off('sync_completed', sub);
    }, [])
  );

  const sortedTransactions = useMemo(() => {
    const filtered = transactions.filter(tx => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (!tx.note?.toLowerCase().includes(query) && 
            !tx.category_name?.toLowerCase().includes(query) && 
            !tx.amount.toString().includes(query)) return false;
      }
      if (filterType !== 'all' && tx.type !== filterType) return false;
      if (filterCatId && tx.category_id !== filterCatId) return false;
      if (filterAccId && tx.account_id !== filterAccId) return false;
      if (filterStartDate || filterEndDate) {
        const txDate = new Date(tx.date);
        if (filterStartDate && txDate < new Date(filterStartDate).setHours(0,0,0,0)) return false;
        if (filterEndDate && txDate > new Date(filterEndDate).setHours(23,59,59,999)) return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case 'date': comparison = new Date(a.date).getTime() - new Date(b.date).getTime(); break;
        case 'amount': comparison = a.amount - b.amount; break;
        case 'type': comparison = a.type.localeCompare(b.type); break;
        case 'category': comparison = (a.category_name || '').localeCompare(b.category_name || ''); break;
        case 'created_at': comparison = new Date(a.updated_at || 0).getTime() - new Date(b.updated_at || 0).getTime(); break;
      }
      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }, [transactions, searchQuery, filterType, filterCatId, filterAccId, filterStartDate, filterEndDate, sortField, sortOrder]);

  const byDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    sortedTransactions.forEach(tx => {
      const d = (tx.date || TODAY).split('T')[0];
      if (!map[d]) map[d] = [];
      map[d].push(tx);
    });
    return map;
  }, [sortedTransactions]);

  const stepDate = (direction: 'up' | 'down') => {
    const d = new Date(viewDate);
    if (viewMode === 'daily' || viewMode === 'calendar') d.setDate(d.getDate() + (direction === 'up' ? 1 : -1));
    else if (viewMode === 'monthly') d.setMonth(d.getMonth() + (direction === 'up' ? 1 : -1));
    else if (viewMode === 'annually') d.setFullYear(d.getFullYear() + (direction === 'up' ? 1 : -1));
    
    setViewDate(d);
    if (viewMode === 'daily' || viewMode === 'calendar') setSelectedDate(d.toISOString().split('T')[0]);
  };

  const currentFocusStr = viewDate.toISOString().split('T')[0];
  const currentMonthStr = currentFocusStr.slice(0, 7);
  const currentYearStr  = currentFocusStr.slice(0, 4);

  const dailyTxs = byDate[currentFocusStr] || [];
  const calendarTxs = byDate[selectedDate] || [];

  const monthlyGroups = useMemo(() => {
    const groups: { date: string; txList: any[] }[] = [];
    const keys = Object.keys(byDate).filter(d => d.startsWith(currentMonthStr));
    keys.sort((a, b) => sortOrder === 'desc' ? b.localeCompare(a) : a.localeCompare(b));
    keys.forEach(d => groups.push({ date: d, txList: byDate[d] }));
    return groups;
  }, [byDate, currentMonthStr, sortOrder]);

  const annuallyGroups = useMemo(() => {
    const groups: { date: string; txList: any[] }[] = [];
    const monthMap: Record<string, any[]> = {};
    Object.keys(byDate).filter(d => d.startsWith(currentYearStr)).forEach(d => {
      const month = d.slice(0, 7);
      if (!monthMap[month]) monthMap[month] = [];
      monthMap[month].push(...byDate[d]);
    });
    const sortedMonths = Object.keys(monthMap).sort((a, b) => sortOrder === 'desc' ? b.localeCompare(a) : a.localeCompare(b));
    sortedMonths.forEach(m => groups.push({ date: m, txList: monthMap[m] }));
    return groups;
  }, [byDate, currentYearStr, sortOrder]);

  const visibleTxs = viewMode === 'daily' ? dailyTxs : viewMode === 'calendar' ? calendarTxs : viewMode === 'monthly' ? monthlyGroups.flatMap(g => g.txList) : annuallyGroups.flatMap(g => g.txList); 

  const toggleId = (id: string) => {
    setSelectMode(true);
    setSelectedIds(prev => {
      const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
    });
  };

  const bulkDelete = () => {
    if (!selectedIds.size) return;
    Alert.alert('Delete Selected', `Remove ${selectedIds.size} transactions?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        for (const id of selectedIds) await deleteTransaction(id);
        setSelectedIds(new Set()); setSelectMode(false); fetchTransactions();
      }},
    ]);
  };

  const summaryIncome  = visibleTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const summaryExpense = visibleTxs.filter(t => t.type !== 'income').reduce((s, t) => s + t.amount, 0);

  const cardProps = { colors, selectMode, selectedIds, toggleId, format, typography, spacing, borderRadius };

  return (
    <View style={[st.container, { backgroundColor: colors.background }]}>
      <View style={[st.header, { paddingTop: insets.top + spacing.m }]}>
        <View style={st.headerTop}>
          <Text style={[typography.header, { color: colors.text }]}>Transactions</Text>
          <TouchableOpacity onPress={handleSync} disabled={syncing}>
            <Ionicons name={syncing ? "sync" : "cloud-done"} size={24} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={[st.searchBar, { backgroundColor: colors.card }]}>
          <Ionicons name="search" size={20} color={colors.textSecondary} />
          <TextInput
            placeholder="Search transactions..."
            placeholderTextColor={colors.textSecondary}
            style={[st.searchInput, { color: colors.text }]}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={st.modeScroll}>
          {([
            { key: 'daily', label: 'Daily', icon: 'today' },
            { key: 'calendar', label: 'Calendar', icon: 'calendar' },
            { key: 'monthly', label: 'Monthly', icon: 'pie-chart' },
            { key: 'annually', label: 'Annually', icon: 'stats-chart' },
          ] as any).map((m: any) => (
            <TouchableOpacity
              key={m.key}
              onPress={() => { setViewMode(m.key); setSelectMode(false); setSelectedIds(new Set()); }}
              style={[st.modeChip, { backgroundColor: viewMode === m.key ? colors.primary : colors.card }]}
            >
              <Ionicons name={m.icon} size={16} color={viewMode === m.key ? '#fff' : colors.textSecondary} />
              <Text style={[st.modeText, { color: viewMode === m.key ? '#fff' : colors.textSecondary }]}>{m.label}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {viewMode === 'calendar' && (
          <View style={{ paddingHorizontal: 20 }}>
            <Calendar
              current={TODAY}
              onDayPress={(day: any) => setSelectedDate(day.dateString)}
              markedDates={{...Object.keys(byDate).reduce((a,v)=>({...a,[v]:{marked:true,dotColor:colors.primary}}),{}), [selectedDate]: {selected:true,selectedColor:colors.primary}}}
              theme={{
                calendarBackground: colors.card,
                selectedDayBackgroundColor: colors.primary,
                todayTextColor: colors.primary,
                dayTextColor: colors.text,
                monthTextColor: colors.text,
                textDisabledColor: colors.textSecondary + '44',
              }}
              style={{ borderRadius: borderRadius.l, overflow: 'hidden' }}
            />
          </View>
        )}

        <View style={st.navigationRow}>
          <TouchableOpacity onPress={() => stepDate('down')}><Ionicons name="chevron-back" size={24} color={colors.primary} /></TouchableOpacity>
          <Text style={[st.navTitle, { color: colors.text }]}>
            {viewMode === 'daily' ? (currentFocusStr === TODAY ? 'Today' : new Date(currentFocusStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })) : 
             viewMode === 'monthly' ? new Date(currentMonthStr).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : 
             `Year ${currentYearStr}`}
          </Text>
          <TouchableOpacity onPress={() => stepDate('up')}><Ionicons name="chevron-forward" size={24} color={colors.primary} /></TouchableOpacity>
        </View>

        <View style={[st.summaryBar, { marginHorizontal: 20 }]}>
          <View style={[st.summaryItem, { backgroundColor: colors.income + '15' }]}>
            <Text style={[st.summaryLabel, { color: colors.income }]}>Income</Text>
            <Text style={[st.summaryValue, { color: colors.income }]}>+{format(summaryIncome)}</Text>
          </View>
          <View style={[st.summaryItem, { backgroundColor: colors.expense + '15' }]}>
            <Text style={[st.summaryLabel, { color: colors.expense }]}>Expense</Text>
            <Text style={[st.summaryValue, { color: colors.expense }]}>-{format(summaryExpense)}</Text>
          </View>
        </View>

        <View style={st.actionBar}>
          {!selectMode ? (
            <>
              <View style={{ flexDirection: 'row', gap: spacing.m }}>
                <TouchableOpacity onPress={() => setShowSortModal(true)}><Ionicons name="swap-vertical" size={22} color={colors.primary} /></TouchableOpacity>
                <TouchableOpacity onPress={() => setShowFilterModal(true)}><Ionicons name="funnel" size={22} color={colors.primary} /></TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => setSelectMode(true)}>
                <Ionicons name="checkbox-outline" size={22} color={colors.primary} />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={{ flexDirection: 'row', gap: spacing.m }}>
                <TouchableOpacity onPress={() => {
                  if (selectedIds.size === transactions.length) {
                    setSelectedIds(new Set());
                  } else {
                    setSelectedIds(new Set(transactions.map(t => t.id)));
                  }
                }}>
                  <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>
                    {selectedIds.size === transactions.length ? 'Deselect All' : 'Select All'}
                  </Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => { setSelectMode(false); setSelectedIds(new Set()); }}>
                <Ionicons name="close" size={24} color={colors.primary} />
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={{ paddingHorizontal: 20 }}>
          {visibleTxs.length === 0 ? (
            <Text style={{ textAlign: 'center', color: colors.textSecondary, marginTop: 40 }}>No transactions found.</Text>
          ) : (viewMode === 'monthly' || viewMode === 'annually') ? (
            (viewMode === 'annually' ? annuallyGroups : monthlyGroups).map(g => (
              <DayGroup key={g.date} date={g.date} txList={g.txList} colors={colors} isYearly={viewMode === 'annually'} isCollapsed={collapsedGroups[g.date]} onToggle={() => toggleGroup(g.date)} {...cardProps} />
            ))
          ) : (
            visibleTxs.map(item => <TxCard key={item.id} item={item} {...cardProps} />)
          )}
        </View>
      </ScrollView>

      {selectMode && selectedIds.size > 0 && (
        <View style={[st.bottomToolbar, { backgroundColor: colors.card, paddingBottom: insets.bottom + spacing.m }]}>
          <Text style={{ color: colors.text, fontWeight: '600' }}>{selectedIds.size} selected</Text>
          <TouchableOpacity onPress={bulkDelete} style={st.bulkDeleteBtn}>
            <Ionicons name="trash" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontWeight: '700', marginLeft: 8 }}>Delete</Text>
          </TouchableOpacity>
        </View>
      )}

      <Animated.View style={[st.fabContainer, { bottom: insets.bottom + 20, opacity: fabAnim, transform: [{ scale: fabAnim }] }]}>
        <TouchableOpacity 
          style={[st.fab, { backgroundColor: colors.primary }]} 
          onPress={() => navigation.navigate('AddTransaction')}
        >
          <Ionicons name="add" size={32} color="white" />
        </TouchableOpacity>
      </Animated.View>

      <SyncConflictModal
        transaction={conflictTransaction}
        onResolve={() => { setConflictTransaction(null); fetchTransactions(); }}
        onClose={() => setConflictTransaction(null)}
      />

      <Modal visible={showSortModal} animationType="fade" transparent={true}>
        <Pressable style={st.modalOverlay} onPress={() => setShowSortModal(false)}>
          <Card style={st.modalCard}>
            <Text style={[st.modalTitle, { color: colors.text }]}>Sort By</Text>
            {([{k:'date',l:'Date'},{k:'amount',l:'Amount'},{k:'category',l:'Category'},{k:'created_at',l:'Created'}].map(s => (
              <TouchableOpacity key={s.k} style={st.modalOption} onPress={() => { setSort(s.k as any, sortOrder); setShowSortModal(false); }}>
                <Text style={{ color: sortField === s.k ? colors.primary : colors.text, fontWeight: sortField === s.k ? '700' : '400' }}>{s.l}</Text>
                {sortField === s.k && <Ionicons name="checkmark" size={20} color={colors.primary} />}
              </TouchableOpacity>
            )))}
            <View style={st.modalDivider} />
            <TouchableOpacity style={st.modalOption} onPress={() => { setSort(sortField, sortOrder === 'asc' ? 'desc' : 'asc'); setShowSortModal(false); }}>
              <Text style={{ color: colors.text }}>{sortOrder === 'asc' ? 'Ascending' : 'Descending'}</Text>
              <Ionicons name={sortOrder === 'asc' ? 'arrow-up' : 'arrow-down'} size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </Card>
        </Pressable>
      </Modal>

      <Modal visible={showFilterModal} animationType="slide" transparent={true}>
        <Pressable style={st.modalOverlay} onPress={() => setShowFilterModal(false)}>
          <Card style={[st.filterModal, { height: '80%' }]}>
            <View style={st.filterHeader}>
              <Text style={[st.modalTitle, { color: colors.text }]}>Filters</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                <Text style={[st.filterLabel, { marginTop: 0, color: colors.textSecondary }]}>Transaction Type</Text>
                <TouchableOpacity onPress={() => { setFilterType('all'); setFilterCatId(null); setFilterAccId(null); setFilterStartDate(null); setFilterEndDate(null); }}>
                  <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>Reset All</Text>
                </TouchableOpacity>
              </View>
              
              <View style={[st.chipRow, { flexWrap: 'wrap', marginTop: 12 }]}>
                {['all', 'income', 'expense'].map(t => (
                  <TouchableOpacity key={t} style={[st.chip, { backgroundColor: filterType === t ? colors.primary : colors.card, marginBottom: 8 }]} onPress={() => setFilterType(t as any)}>
                    <Text style={{ color: filterType === t ? '#fff' : colors.textSecondary, fontWeight: '600' }}>{t.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[st.filterLabel, { color: colors.textSecondary }]}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
                <View style={st.chipRow}>
                  <TouchableOpacity style={[st.chip, { backgroundColor: !filterCatId ? colors.primary : colors.card }]} onPress={() => setFilterCatId(null)}>
                    <Text style={{ color: !filterCatId ? '#fff' : colors.textSecondary, fontWeight: '600' }}>ALL</Text>
                  </TouchableOpacity>
                  {categories.filter(c => filterType === 'all' || c.type === filterType).map(c => (
                    <TouchableOpacity key={c.id} style={[st.chip, { backgroundColor: filterCatId === c.id ? colors.primary : colors.card }]} onPress={() => setFilterCatId(c.id)}>
                      <Text style={{ color: filterCatId === c.id ? '#fff' : colors.textSecondary, fontWeight: '600' }}>{c.name.toUpperCase()}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Text style={[st.filterLabel, { color: colors.textSecondary }]}>Account</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }}>
                <View style={st.chipRow}>
                  <TouchableOpacity style={[st.chip, { backgroundColor: !filterAccId ? colors.primary : colors.card }]} onPress={() => setFilterAccId(null)}>
                    <Text style={{ color: !filterAccId ? '#fff' : colors.textSecondary, fontWeight: '600' }}>ALL</Text>
                  </TouchableOpacity>
                  {accounts.map(a => (
                    <TouchableOpacity key={a.id} style={[st.chip, { backgroundColor: filterAccId === a.id ? colors.primary : colors.card }]} onPress={() => setFilterAccId(a.id)}>
                      <Text style={{ color: filterAccId === a.id ? '#fff' : colors.textSecondary, fontWeight: '600' }}>{a.name.toUpperCase()}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>

              <Text style={[st.filterLabel, { color: colors.textSecondary }]}>Date Range</Text>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
                <TouchableOpacity onPress={() => setShowPicker('start')} style={[st.dateSelector, { backgroundColor: colors.card, flex: 1 }]}>
                  <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                  <Text style={{ marginLeft: 8, color: colors.text, fontSize: 13, fontWeight: '600' }}>
                    {filterStartDate ? filterStartDate.toLocaleDateString() : 'Start Date'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setShowPicker('end')} style={[st.dateSelector, { backgroundColor: colors.card, flex: 1 }]}>
                  <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                  <Text style={{ marginLeft: 8, color: colors.text, fontSize: 13, fontWeight: '600' }}>
                    {filterEndDate ? filterEndDate.toLocaleDateString() : 'End Date'}
                  </Text>
                </TouchableOpacity>
              </View>

              <Button title="Apply Filters" onPress={() => setShowFilterModal(false)} style={{ marginTop: 32 }} />
            </ScrollView>
          </Card>
        </Pressable>
      </Modal>

      {showPicker && <DateTimePicker value={new Date()} mode="date" display="default" onChange={onDateChange} />}
    </View>
  );
};

const st = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 20, paddingBottom: 16 },
  headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  searchBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 48, borderRadius: 24, marginBottom: 16 },
  searchInput: { flex: 1, marginLeft: 12, fontSize: 16 },
  modeScroll: { flexDirection: 'row' },
  modeChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8 },
  modeText: { fontSize: 13, fontWeight: '600', marginLeft: 6 },
  navigationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  navTitle: { fontSize: 18, fontWeight: '700' },
  summaryBar: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  summaryItem: { flex: 1, padding: 12, borderRadius: 16 },
  summaryLabel: { fontSize: 12, fontWeight: '600', marginBottom: 2 },
  summaryValue: { fontSize: 16, fontWeight: '700' },
  actionBar: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 20, marginBottom: 16 },
  txCard: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  iconCircle: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  txTitle: { fontSize: 16, fontWeight: '600' },
  txDate: { fontSize: 13, marginTop: 2 },
  txAmount: { fontSize: 16, fontWeight: '700' },
  selectionCircle: { position: 'absolute', right: -4, top: -4, width: 20, height: 20, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  groupHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  groupTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  groupSummary: { fontSize: 13, fontWeight: '600' },
  fabContainer: { position: 'absolute', right: 20, zIndex: 99 },
  fab: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 4 },
  bottomToolbar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#eee', zIndex: 100 },
  bulkDeleteBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#B3261E', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
  modalCard: { padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  modalOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  modalDivider: { height: 1, backgroundColor: '#eee', marginVertical: 8 },
  filterModal: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, justifyContent: 'flex-start' },
  filterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  filterLabel: { fontSize: 14, fontWeight: '600', marginBottom: 12, marginTop: 16 },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  dateSelector: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12 },
});
