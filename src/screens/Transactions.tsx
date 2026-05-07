import React, { useState, useCallback, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, TextInput, Pressable } from 'react-native';
import { Calendar } from 'react-native-calendars';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { typography, spacing } from '../utils/theme';
import { getTransactions, deleteTransaction, getCategories, getAccounts } from '../services/database';
import { syncService } from '../services/syncService';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { useCurrency } from '../hooks/useCurrency';
import { SyncConflictModal } from '../components/SyncConflictModal';
import { syncEvents } from '../services/syncEvents';

const TODAY = new Date().toISOString().split('T')[0];
const THIS_MONTH = TODAY.slice(0, 7); // YYYY-MM

const CAT_COLORS: Record<string, string> = {
  Food: '#FF7043', Transport: '#42A5F5', Shopping: '#AB47BC', Salary: '#66BB6A',
  Transfer: '#78909C', Bills: '#FFA726', Health: '#EF5350', Education: '#29B6F6',
  Entertainment: '#EC407A', ATM: '#8D6E63',
};
const catColor = (n?: string) => n ? (CAT_COLORS[n] || '#78909C') : '#9E9E9E';

type ViewMode = 'daily' | 'calendar' | 'monthly' | 'annually' | 'timeline';

// ─── Reusable Transaction Card ────────────────────────────────────────────────
const TxCard = ({ item, selectMode, selectedIds, toggleId, singleDelete, colors, format }: any) => {
  const isIncome = item.type === 'income';
  const aColor   = isIncome ? '#4CAF50' : '#F44336';
  const isSel    = selectedIds.has(item.id);
  const cc       = catColor(item.category_name);
  const navigation = useNavigation<any>();

  const getSyncIcon = () => {
    switch (item.sync_status) {
      case 'pending': return <Ionicons name="cloud-upload-outline" size={14} color="#FFA726" />;
      case 'synced': return <Ionicons name="checkmark-circle-outline" size={14} color="#66BB6A" />;
      case 'failed': return <Ionicons name="alert-circle-outline" size={14} color="#EF5350" />;
      case 'conflict': return <Ionicons name="warning-outline" size={14} color="#AB47BC" />;
      default: return null;
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={selectMode ? 0.7 : 1}
      onPress={() => selectMode && toggleId(item.id)}
      style={[st.txCard, { backgroundColor: colors.card, borderColor: isSel ? colors.primary : colors.border, borderWidth: isSel ? 2 : 1 }]}
    >
      <View style={{ width: 4, backgroundColor: aColor, borderRadius: 4, alignSelf: 'stretch' }} />
      {selectMode && (
        <View style={st.checkbox}>
          <View style={[st.checkInner, { borderColor: colors.primary, backgroundColor: isSel ? colors.primary : 'transparent' }]}>
            {isSel && <Ionicons name="checkmark" size={13} color="#fff" />}
          </View>
        </View>
      )}
      <View style={{ flex: 1, paddingVertical: spacing.m, paddingHorizontal: spacing.m, flexDirection: 'row', alignItems: 'center' }}>
        {!selectMode && (
          <TouchableOpacity 
            onPress={() => navigation.navigate('AddTransaction', { transactionId: item.id })} 
            style={{ marginRight: spacing.m, padding: 4 }}
          >
            <Ionicons name="pencil-outline" size={18} color={colors.primary} />
          </TouchableOpacity>
        )}
        
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15, marginRight: 6 }} numberOfLines={1}>
                  {item.note || item.category_name || 'Transaction'}
                </Text>
                {getSyncIcon()}
              </View>
              <View style={[st.catBadge, { backgroundColor: cc + '22' }]}>
                <Text style={{ color: cc, fontSize: 11, fontWeight: '600' }}>{item.category_name || 'Uncategorized'}</Text>
              </View>
            </View>
            <View style={{ alignItems: 'flex-end', marginLeft: spacing.s }}>
              <Text style={{ color: aColor, fontWeight: '700', fontSize: 16 }}>
                {isIncome ? '+' : '-'}{format(item.amount)}
              </Text>
              {!selectMode && (
                <TouchableOpacity onPress={() => singleDelete(item.id)} style={{ marginTop: 6, padding: 4 }}>
                  <Ionicons name="trash-outline" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
};

// ─── Timeline Item ────────────────────────────────────────────────────────────
const TimelineItem = ({ item, isLast, colors, format, singleDelete }: any) => {
  const isIncome = item.type === 'income';
  const aColor = isIncome ? '#4CAF50' : '#F44336';
  const cc = catColor(item.category_name);

  const getSyncIcon = () => {
    switch (item.sync_status) {
      case 'pending': return <Ionicons name="cloud-upload-outline" size={12} color="#FFA726" />;
      case 'synced': return <Ionicons name="checkmark-circle-outline" size={12} color="#66BB6A" />;
      case 'failed': return <Ionicons name="alert-circle-outline" size={12} color="#EF5350" />;
      case 'conflict': return <Ionicons name="warning-outline" size={12} color="#AB47BC" />;
      default: return null;
    }
  };
  
  return (
    <View style={{ flexDirection: 'row', minHeight: 80 }}>
      <View style={{ alignItems: 'center', width: 40 }}>
        <View style={{ width: 2, flex: 1, backgroundColor: colors.border }} />
        <View style={[st.timelineMarker, { backgroundColor: cc, borderColor: colors.background }]}>
          <Ionicons name={isIncome ? 'arrow-down' : 'arrow-up'} size={12} color="#fff" />
        </View>
        {!isLast && <View style={{ width: 2, flex: 1, backgroundColor: colors.border }} />}
      </View>
      <View style={{ flex: 1, paddingBottom: spacing.l }}>
        <Card style={{ padding: spacing.m, backgroundColor: colors.card }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ color: colors.text, fontWeight: '700', fontSize: 14, marginRight: 5 }}>{item.note || item.category_name}</Text>
                {getSyncIcon()}
              </View>
              <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{new Date(item.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Text>
            </View>
            <Text style={{ color: aColor, fontWeight: '800', fontSize: 15 }}>
              {isIncome ? '+' : '-'}{format(item.amount)}
            </Text>
          </View>
        </Card>
      </View>
    </View>
  );
};

// ─── Monthly group header ─────────────────────────────────────────────────────
const DayGroup = ({ date, txList, isYearly, format, colors, isCollapsed, onToggle, ...props }: any) => {
  const prettyDate = (() => {
    try { 
      if (isYearly) {
        return new Date(date + '-01T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
      }
      return new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }); 
    }
    catch { return date; }
  })();
  const income  = txList.filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + t.amount, 0);
  const expense = txList.filter((t: any) => t.type !== 'income').reduce((s: number, t: any) => s + t.amount, 0);

  return (
    <View style={{ marginBottom: spacing.s }}>
      <TouchableOpacity 
        onPress={onToggle}
        activeOpacity={0.8}
        style={[st.groupHeader, { backgroundColor: colors.card }]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Ionicons name={isCollapsed ? 'chevron-forward' : 'chevron-down'} size={16} color={colors.textSecondary} style={{ marginRight: spacing.s }} />
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 13 }}>{prettyDate}</Text>
        </View>
        <View style={{ flexDirection: 'row' }}>
          {income  > 0 && <Text style={{ color: '#4CAF50', fontSize: 12, fontWeight: '600', marginLeft: spacing.s }}>+{format(income)}</Text>}
          {expense > 0 && <Text style={{ color: '#F44336', fontSize: 12, fontWeight: '600', marginLeft: spacing.s }}>-{format(expense)}</Text>}
        </View>
      </TouchableOpacity>
      {!isCollapsed && txList.map((item: any) => <TxCard key={item.id} item={item} format={format} colors={colors} {...props} />)}
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export const TransactionsScreen = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<any>();
  const { format } = useCurrency();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [viewDate, setViewDate] = useState(new Date()); 
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Conflict Handling
  const [conflictTransaction, setConflictTransaction] = useState<any | null>(null);

  // Collapsed sections tracking
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const toggleGroup = (date: string) => setCollapsedGroups(p => ({ ...p, [date]: !p[date] }));

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'income' | 'expense'>('all');
  const [filterCatId, setFilterCatId] = useState<string | null>(null);
  const [filterAccId, setFilterAccId] = useState<string | null>(null);
  const [filterStartDate, setFilterStartDate] = useState<Date | null>(null);
  const [filterEndDate, setFilterEndDate] = useState<Date | null>(null);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);
  
  const [categories, setCategories] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);

  const loadFilters = async () => {
    setCategories(await getCategories());
    setAccounts(await getAccounts());
  };

  useEffect(() => {
    loadFilters();
  }, []);

  const fetchTransactions = async () => {
    try { 
      setLoading(true); 
      const data = await getTransactions();
      setTransactions(data); 
    }
    catch (e) { console.error(e); } finally { setLoading(false); }
  };

  const handleSync = async () => {
    setSyncing(true);
    await syncService.syncAll();
    await fetchTransactions();
    setSyncing(false);
  };

  useFocusEffect(
    useCallback(() => {
      fetchTransactions();
      
      const sub = () => {
        console.log('Transactions: Sync detected, refreshing list and filters...');
        fetchTransactions();
        loadFilters();
      };
      syncEvents.on('sync_completed', sub);
      return () => syncEvents.off('sync_completed', sub);
    }, [])
  );

  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesNote = tx.note?.toLowerCase().includes(query);
        const matchesCat = tx.category_name?.toLowerCase().includes(query);
        if (!matchesNote && !matchesCat) return false;
      }
      if (filterType !== 'all' && tx.type !== filterType) return false;
      if (filterCatId && tx.category_id !== filterCatId) return false;
      if (filterAccId && tx.account_id !== filterAccId) return false;
      if (filterStartDate || filterEndDate) {
        const txDate = new Date(tx.date);
        if (filterStartDate) {
          const start = new Date(filterStartDate);
          start.setHours(0, 0, 0, 0);
          if (txDate < start) return false;
        }
        if (filterEndDate) {
          const end = new Date(filterEndDate);
          end.setHours(23, 59, 59, 999);
          if (txDate > end) return false;
        }
      }
      return true;
    });
  }, [transactions, searchQuery, filterType, filterCatId, filterAccId, filterStartDate, filterEndDate]);

  const byDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    filteredTransactions.forEach(tx => {
      const d = (tx.date || TODAY).split('T')[0];
      if (!map[d]) map[d] = [];
      map[d].push(tx);
    });
    return map;
  }, [filteredTransactions]);

  const stepDate = (direction: 'up' | 'down') => {
    const d = new Date(viewDate);
    if (viewMode === 'daily' || viewMode === 'calendar') d.setDate(d.getDate() + (direction === 'up' ? 1 : -1));
    else if (viewMode === 'monthly' || viewMode === 'timeline') d.setMonth(d.getMonth() + (direction === 'up' ? 1 : -1));
    else if (viewMode === 'annually') d.setFullYear(d.getFullYear() + (direction === 'up' ? 1 : -1));
    
    setViewDate(d);
    if (viewMode === 'daily' || viewMode === 'calendar') {
      setSelectedDate(d.toISOString().split('T')[0]);
    }
  };

  const currentFocusStr = viewDate.toISOString().split('T')[0];
  const currentMonthStr = currentFocusStr.slice(0, 7);
  const currentYearStr  = currentFocusStr.slice(0, 4);

  const dailyTxs = byDate[currentFocusStr] || [];
  const calendarTxs = byDate[selectedDate] || [];

  const monthlyGroups = useMemo(() => {
    const groups: { date: string; txList: any[] }[] = [];
    Object.keys(byDate)
      .filter(d => d.startsWith(currentMonthStr))
      .sort((a, b) => b.localeCompare(a))
      .forEach(d => groups.push({ date: d, txList: byDate[d] }));
    return groups;
  }, [byDate, currentMonthStr]);

  const monthlyTxs = useMemo(() => monthlyGroups.flatMap(g => g.txList), [monthlyGroups]);

  const annuallyGroups = useMemo(() => {
    const groups: { date: string; txList: any[] }[] = [];
    const monthMap: Record<string, any[]> = {};
    Object.keys(byDate)
      .filter(d => d.startsWith(currentYearStr))
      .forEach(d => {
        const month = d.slice(0, 7);
        if (!monthMap[month]) monthMap[month] = [];
        monthMap[month].push(...byDate[d]);
      });
    Object.keys(monthMap).sort((a, b) => b.localeCompare(a)).forEach(m => groups.push({ date: m, txList: monthMap[m] }));
    return groups;
  }, [byDate, currentYearStr]);

  const annuallyTxs = useMemo(() => annuallyGroups.flatMap(g => g.txList), [annuallyGroups]);

  const markedDates = useMemo(() => {
    const m: Record<string, any> = {};
    Object.keys(byDate).forEach(d => {
      m[d] = { marked: true, dotColor: '#4CAF50', selected: d === selectedDate, selectedColor: colors.primary };
    });
    if (!m[selectedDate]) m[selectedDate] = { selected: true, selectedColor: colors.primary };
    return m;
  }, [byDate, selectedDate, colors.primary]);

  const visibleTxs = 
    viewMode === 'daily' ? dailyTxs : 
    viewMode === 'calendar' ? calendarTxs : 
    viewMode === 'monthly' ? monthlyTxs :
    viewMode === 'annually' ? annuallyTxs :
    monthlyTxs; 

  const toggleId = (id: string) => setSelectedIds(prev => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  
  const allVisSel  = visibleTxs.length > 0 && visibleTxs.every(t => selectedIds.has(t.id));
  const allAllSel  = transactions.length > 0 && transactions.every(t => selectedIds.has(t.id));
  const selectVis  = () => setSelectedIds(prev => new Set([...prev, ...visibleTxs.map(t => t.id)]));
  const selectAll  = () => setSelectedIds(new Set(transactions.map(t => t.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const bulkDelete = () => {
    if (!selectedIds.size) return;
    Alert.alert('Delete Selected', `Remove ${selectedIds.size} transaction${selectedIds.size > 1 ? 's' : ''}?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        for (const id of selectedIds) await deleteTransaction(id);
        setSelectedIds(new Set()); setSelectMode(false); fetchTransactions();
      }},
    ]);
  };

  const singleDelete = (id: string) =>
    Alert.alert('Delete', 'Delete this transaction?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteTransaction(id); fetchTransactions(); } },
    ]);

  const summaryIncome  = visibleTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const summaryExpense = visibleTxs.filter(t => t.type !== 'income').reduce((s, t) => s + t.amount, 0);

  const cardProps = { colors, selectMode, selectedIds, toggleId, singleDelete, format };

  return (
    <View style={[st.container, { backgroundColor: colors.background, paddingTop: insets.top + spacing.m }]}>
      <View style={st.headerRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={[st.header, { color: colors.text }]}>Transactions</Text>
          {selectMode && (
            <View style={[st.countBadge, { backgroundColor: colors.primary }]}>
              <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>{selectedIds.size}</Text>
            </View>
          )}
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <TouchableOpacity 
            onPress={handleSync}
            disabled={syncing}
            style={{ marginRight: spacing.m, padding: 4 }}
          >
            <Ionicons name={syncing ? "sync" : "cloud-done-outline"} size={22} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => setShowFilterModal(true)} 
            style={{ marginRight: spacing.m, padding: 4 }}
          >
            <Ionicons 
              name={filterType !== 'all' || filterCatId || filterAccId ? "funnel" : "funnel-outline"} 
              size={22} 
              color={filterType !== 'all' || filterCatId || filterAccId ? colors.primary : colors.text} 
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => { setSelectMode(p => !p); setSelectedIds(new Set()); }}
            style={[st.selToggle, { backgroundColor: selectMode ? colors.primary : colors.primary + '22' }]}
          >
            <Ionicons name={selectMode ? 'close' : 'checkbox-outline'} size={18} color={selectMode ? '#fff' : colors.primary} />
            <Text style={{ color: selectMode ? '#fff' : colors.primary, fontSize: 13, fontWeight: '600', marginLeft: 4 }}>
              {selectMode ? 'Cancel' : 'Select'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ marginBottom: spacing.m, flexDirection: 'row', alignItems: 'center' }}>
        <View style={[st.searchContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="search" size={20} color={colors.textSecondary} style={{ marginRight: spacing.s }} />
          <TextInput
            placeholder="Search note or category..."
            placeholderTextColor={colors.textSecondary}
            style={{ flex: 1, color: colors.text, height: 40 }}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={[st.modeBarWrapper, { backgroundColor: colors.card }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 6 }}>
          <View style={st.modeBar}>
            {([
              { key: 'daily',    label: 'Daily',    icon: 'today-outline' },
              { key: 'calendar', label: 'Calendar', icon: 'calendar-outline' },
              { key: 'monthly',  label: 'Monthly',  icon: 'bar-chart-outline' },
              { key: 'annually', label: 'Annually', icon: 'stats-chart-outline' },
              { key: 'timeline', label: 'Timeline', icon: 'list-outline' },
            ] as { key: ViewMode; label: string; icon: string }[]).map(({ key, label, icon }) => (
              <TouchableOpacity
                key={key}
                onPress={() => { setViewMode(key); setSelectMode(false); setSelectedIds(new Set()); }}
                style={[st.modePill, { backgroundColor: viewMode === key ? colors.primary : 'transparent' }]}
              >
                <Ionicons name={icon as any} size={15} color={viewMode === key ? '#fff' : colors.textSecondary} />
                <Text style={{ color: viewMode === key ? '#fff' : colors.textSecondary, fontWeight: '600', fontSize: 13, marginLeft: 5 }}>
                  {label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {viewMode === 'calendar' && (
          <Calendar
            current={TODAY}
            onDayPress={(day: { dateString: string }) => { setSelectedDate(day.dateString); setSelectedIds(new Set()); }}
            markedDates={markedDates}
            theme={{
              calendarBackground: colors.card, 
              backgroundColor: colors.card,
              textSectionTitleColor: colors.textSecondary, 
              selectedDayBackgroundColor: colors.primary,
              selectedDayTextColor: '#fff', 
              todayTextColor: colors.primary, 
              dayTextColor: colors.text,
              textDisabledColor: colors.textSecondary + '66', 
              dotColor: '#4CAF50',
              selectedDotColor: '#fff', 
              arrowColor: colors.primary, 
              monthTextColor: colors.text,
              textDayFontSize: 13,
              textMonthFontSize: 14,
              textDayHeaderFontSize: 11,
            }}
            style={{ borderRadius: 16, marginBottom: spacing.m, overflow: 'hidden', paddingBottom: 5, height: 310 }}
          />
        )}

        <View style={[st.summaryBar, { backgroundColor: colors.card }]}>
          <TouchableOpacity onPress={() => stepDate('down')} style={st.navBtn}>
            <Ionicons name="chevron-back" size={20} color={colors.primary} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }} numberOfLines={1}>
              {viewMode === 'daily' ? (currentFocusStr === TODAY ? 'Today' : viewDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }))
               : viewMode === 'monthly' || viewMode === 'timeline' ? viewDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
               : viewMode === 'annually' ? `Year ${currentYearStr}`
               : viewDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </Text>
            <Text style={{ color: colors.textSecondary, fontSize: 12, marginTop: 2 }}>
              {visibleTxs.length} transaction{visibleTxs.length !== 1 ? 's' : ''}
            </Text>
          </View>
          <TouchableOpacity onPress={() => stepDate('up')} style={st.navBtn}>
            <Ionicons name="chevron-forward" size={20} color={colors.primary} />
          </TouchableOpacity>
        </View>

        <View style={[st.quickStats, { paddingHorizontal: spacing.m, marginBottom: spacing.m }]}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {summaryIncome  > 0 && <Text style={{ color: '#4CAF50', fontWeight: '700' }}>Income: {format(summaryIncome)}</Text>}
            {summaryExpense > 0 && <Text style={{ color: '#F44336', fontWeight: '700' }}>Expense: {format(summaryExpense)}</Text>}
          </View>
        </View>

        {selectMode && (
          <View style={[st.toolbar, { backgroundColor: colors.card }]}>
            <View style={{ flexDirection: 'row', marginBottom: spacing.s }}>
              <TouchableOpacity onPress={allVisSel ? deselectAll : selectVis} style={[st.selBtn, { borderColor: colors.primary, flex: 1, marginRight: spacing.s }]}>
                <Ionicons name={allVisSel ? 'checkbox' : 'square-outline'} size={16} color={colors.primary} />
                <Text style={{ color: colors.primary, marginLeft: 5, fontWeight: '600', fontSize: 12 }}>{allVisSel ? 'Deselect View' : 'This View'}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={allAllSel ? deselectAll : selectAll} style={[st.selBtn, { borderColor: '#FF7043', flex: 1 }]}>
                <Ionicons name={allAllSel ? 'checkbox' : 'albums-outline'} size={16} color="#FF7043" />
                <Text style={{ color: '#FF7043', marginLeft: 5, fontWeight: '600', fontSize: 12 }}>{allAllSel ? 'Deselect All' : 'All'}</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{selectedIds.size} selected</Text>
              <TouchableOpacity onPress={bulkDelete} disabled={!selectedIds.size} style={[st.delBtn, { opacity: selectedIds.size ? 1 : 0.35 }]}>
                <Ionicons name="trash" size={16} color="#fff" />
                <Text style={{ color: '#fff', marginLeft: 6, fontWeight: '700', fontSize: 13 }}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {visibleTxs.length === 0 ? (
          <View style={st.empty}>
            <Ionicons name="list-outline" size={48} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, marginTop: spacing.m, textAlign: 'center' }}>No transactions found.</Text>
          </View>
        ) : viewMode === 'timeline' ? (
          <View style={{ paddingLeft: spacing.s }}>
            {visibleTxs.map((item, index) => (
              <TimelineItem key={item.id} item={item} isLast={index === visibleTxs.length - 1} colors={colors} format={format} singleDelete={singleDelete} />
            ))}
          </View>
        ) : (viewMode === 'monthly' || viewMode === 'annually') ? (
          (viewMode === 'annually' ? annuallyGroups : monthlyGroups).map(g => (
            <DayGroup 
              key={g.date} 
              date={g.date} 
              txList={g.txList} 
              colors={colors} 
              isYearly={viewMode === 'annually'} 
              isCollapsed={collapsedGroups[g.date]} 
              onToggle={() => toggleGroup(g.date)} 
              {...cardProps} 
              onPressConflict={(tx: any) => setConflictTransaction(tx)}
            />
          ))
        ) : (
          visibleTxs.map(item => (
            <TouchableOpacity 
              key={item.id} 
              onPress={() => item.sync_status === 'conflict' ? setConflictTransaction(item) : null}
            >
              <TxCard item={item} {...cardProps} />
            </TouchableOpacity>
          ))
        )}
        <View style={{ height: 120 }} />
      </ScrollView>

      <SyncConflictModal
        transaction={conflictTransaction}
        onResolve={() => { setConflictTransaction(null); fetchTransactions(); }}
        onClose={() => setConflictTransaction(null)}
      />

      {!selectMode && (
        <View style={st.fabRow}>
          <TouchableOpacity style={[st.fab, { backgroundColor: colors.primary }]} onPress={() => navigation.navigate('AddTransaction')}>
            <Ionicons name="add" size={24} color="white" />
            <Text style={st.fabText}>Add Transaction</Text>
          </TouchableOpacity>
        </View>
      )}

      <Modal visible={showFilterModal} animationType="slide" transparent={true} onRequestClose={() => setShowFilterModal(false)}>
        <Pressable style={st.modalOverlay} onPress={() => setShowFilterModal(false)}>
          <Pressable style={[st.modalContent, { backgroundColor: colors.background }]} onPress={() => {}}>
            <View style={st.modalHeader}>
              <Text style={[typography.title, { color: colors.text }]}>Filters</Text>
              <TouchableOpacity onPress={() => setShowFilterModal(false)}><Ionicons name="close" size={24} color={colors.text} /></TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[st.filterLabel, { color: colors.textSecondary }]}>Type</Text>
              <View style={st.chipContainer}>
                {['all', 'income', 'expense'].map((t) => (
                  <TouchableOpacity key={t} style={[st.chip, { backgroundColor: filterType === t ? colors.primary : colors.card, borderColor: colors.border }]} onPress={() => { setFilterType(t as any); setFilterCatId(null); }}>
                    <Text style={{ color: filterType === t ? '#fff' : colors.text }}>{t.charAt(0).toUpperCase() + t.slice(1)}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={[st.filterLabel, { color: colors.textSecondary }]}>Account</Text>
              <View style={st.chipContainer}>
                <TouchableOpacity style={[st.chip, { backgroundColor: !filterAccId ? colors.primary : colors.card, borderColor: colors.border }]} onPress={() => setFilterAccId(null)}><Text style={{ color: !filterAccId ? '#fff' : colors.text }}>All Accounts</Text></TouchableOpacity>
                {accounts.map((acc) => (
                  <TouchableOpacity key={acc.id} style={[st.chip, { backgroundColor: filterAccId === acc.id ? colors.primary : colors.card, borderColor: colors.border }]} onPress={() => setFilterAccId(acc.id)}><Text style={{ color: filterAccId === acc.id ? '#fff' : colors.text }}>{acc.name}</Text></TouchableOpacity>
                ))}
              </View>
              <Text style={[st.filterLabel, { color: colors.textSecondary }]}>Category</Text>
              <View style={st.chipContainer}>
                <TouchableOpacity style={[st.chip, { backgroundColor: !filterCatId ? colors.primary : colors.card, borderColor: colors.border }]} onPress={() => setFilterCatId(null)}><Text style={{ color: !filterCatId ? '#fff' : colors.text }}>All Categories</Text></TouchableOpacity>
                {categories.filter(c => filterType === 'all' || c.type === filterType).map((cat) => (
                  <TouchableOpacity key={cat.id} style={[st.chip, { backgroundColor: filterCatId === cat.id ? colors.primary : colors.card, borderColor: colors.border }]} onPress={() => setFilterCatId(cat.id)}><Text style={{ color: filterCatId === cat.id ? '#fff' : colors.text }}>{cat.name}</Text></TouchableOpacity>
                ))}
              </View>
            </ScrollView>
            <View style={st.modalFooter}>
              <Button title="Apply" onPress={() => setShowFilterModal(false)} />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
};

const st = StyleSheet.create({
  container: { flex: 1 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.l, marginBottom: spacing.m },
  header: { ...typography.header, fontSize: 24 },
  countBadge: { marginLeft: spacing.s, paddingHorizontal: 6, borderRadius: 10, height: 20, justifyContent: 'center' },
  selToggle: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.m, paddingVertical: 6, borderRadius: 20 },
  searchContainer: { flex: 1, flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.m, borderRadius: 12, borderWidth: 1, marginHorizontal: spacing.l },
  modeBarWrapper: { marginBottom: spacing.m, paddingVertical: spacing.xs },
  modeBar: { flexDirection: 'row', paddingHorizontal: spacing.s },
  modePill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.m, paddingVertical: 8, borderRadius: 20, marginRight: spacing.s },
  summaryBar: { flexDirection: 'row', alignItems: 'center', padding: spacing.m, marginHorizontal: spacing.l, borderRadius: 16, marginBottom: spacing.s },
  navBtn: { padding: spacing.xs },
  quickStats: { marginBottom: spacing.m },
  txCard: { flexDirection: 'row', marginHorizontal: spacing.l, marginBottom: spacing.s, borderRadius: 12, overflow: 'hidden' },
  checkbox: { justifyContent: 'center', paddingLeft: spacing.m },
  checkInner: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  catBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, alignSelf: 'flex-start', marginTop: 4 },
  timelineMarker: { width: 24, height: 24, borderRadius: 12, borderWidth: 3, justifyContent: 'center', alignItems: 'center', zIndex: 1 },
  groupHeader: { flexDirection: 'row', alignItems: 'center', padding: spacing.m, marginHorizontal: spacing.l, borderRadius: 12 },
  empty: { padding: 40, alignItems: 'center' },
  fabRow: { position: 'absolute', bottom: spacing.xl, right: spacing.l, left: spacing.l, flexDirection: 'row', justifyContent: 'center' },
  fab: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, borderRadius: 30, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 3.84 },
  fabText: { color: '#fff', fontWeight: 'bold', marginLeft: 8, fontSize: 16 },
  toolbar: { marginHorizontal: spacing.l, marginBottom: spacing.m, padding: spacing.m, borderRadius: 16, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  selBtn: { flexDirection: 'row', alignItems: 'center', padding: 8, borderRadius: 8, borderWidth: 1, justifyContent: 'center' },
  delBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F44336', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.l, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.l },
  filterLabel: { fontWeight: '700', fontSize: 14, marginBottom: spacing.s, marginTop: spacing.m },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  modalFooter: { marginTop: spacing.xl, paddingBottom: spacing.l },
});
