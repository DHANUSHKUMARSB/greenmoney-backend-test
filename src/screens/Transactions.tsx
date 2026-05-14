import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, Modal, TextInput, Pressable, Animated, Platform } from 'react-native';
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
import { soundEngine } from '../services/soundEngine';
import { useAppStore } from '../store';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { transactionExportService } from '../services/transactionExportService';
import * as Sharing from 'expo-sharing';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear, subMonths } from 'date-fns';

const TODAY = new Date().toISOString().split('T')[0];

const CAT_COLORS: Record<string, string> = {
  Food: '#FF7043', Transport: '#42A5F5', Shopping: '#AB47BC', Salary: '#66BB6A',
  Transfer: '#78909C', Bills: '#FFA726', Health: '#EF5350', Education: '#29B6F6',
  Entertainment: '#EC407A', ATM: '#8D6E63',
};
const catColor = (n?: string) => n ? (CAT_COLORS[n] || '#78909C') : '#9E9E9E';

type ViewMode = 'daily' | 'calendar' | 'monthly' | 'annually' | 'all';

// ─── Timeline Components ──────────────────────────────────────────────────────
const YearSection = ({ year, months, format, colors, spacing, expanded, onToggle, children }: any) => (
  <View style={{ marginBottom: spacing.m }}>
    <TouchableOpacity onPress={onToggle} activeOpacity={0.8} style={[st.timelineHeader, { backgroundColor: colors.primary + '10' }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Ionicons name={expanded ? "chevron-down" : "chevron-forward"} size={20} color={colors.primary} />
        <Text style={[st.timelineTitle, { color: colors.primary, marginLeft: 8 }]}>{year}</Text>
      </View>
      <Text style={[st.timelineSummary, { color: colors.textSecondary }]}>{months.length} Months</Text>
    </TouchableOpacity>
    {expanded && children}
  </View>
);

const MonthSection = ({ monthLabel, txList, format, colors, spacing, expanded, onToggle, children }: any) => {
  const income = txList.filter((t: any) => t.type === 'income').reduce((s: number, t: any) => s + t.amount, 0);
  const expense = txList.filter((t: any) => t.type !== 'income').reduce((s: number, t: any) => s + t.amount, 0);
  
  return (
    <View style={{ marginLeft: spacing.m, marginBottom: spacing.s }}>
      <TouchableOpacity onPress={onToggle} activeOpacity={0.8} style={st.timelineHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name={expanded ? "chevron-down" : "chevron-forward"} size={18} color={colors.textSecondary} />
          <Text style={[st.timelineMonth, { color: colors.text, marginLeft: 8 }]}>{monthLabel}</Text>
        </View>
        <View style={{ flexDirection: 'row' }}>
          <Text style={{ color: colors.income, fontSize: 12 }}>+{format(income)}</Text>
          <Text style={{ color: colors.expense, fontSize: 12, marginLeft: 8 }}>-{format(expense)}</Text>
        </View>
      </TouchableOpacity>
      {expanded && children}
    </View>
  );
};

// ─── Reusable Transaction Card ────────────────────────────────────────────────
const TxCard = ({ item, selectMode, selectedIds, toggleId, colors, format, spacing, borderRadius, isHighlighted }: any) => {
  const isIncome = item.type === 'income';
  const isSel    = selectedIds.has(item.id);
  const navigation = useNavigation<any>();
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (isHighlighted) {
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]).start();
    }
  }, [isHighlighted]);

  const getSyncIcon = () => {
    switch (item.sync_status) {
      case 'pending': return <Ionicons name="cloud-upload" size={14} color="#FFA726" />;
      case 'synced': return <Ionicons name="checkmark-circle" size={14} color={colors.success} />;
      case 'failed': return <Ionicons name="alert-circle" size={14} color={colors.error} />;
      case 'conflict': return <Ionicons name="warning" size={14} color="#AB47BC" />;
      default: return null;
    }
  };

  const backgroundColor = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [isSel ? colors.primaryContainer : colors.card, colors.primary + '25']
  });

  return (
    <Animated.View style={{ transform: [{ scale: pulseAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.03] }) }] }}>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => selectMode ? toggleId(item.id) : navigation.navigate('AddTransaction', { transactionId: item.id })}
        onLongPress={() => !selectMode && toggleId(item.id)}
        style={[
          st.txCard, 
          { 
            backgroundColor: isHighlighted ? undefined : (isSel ? colors.primaryContainer : colors.card),
            borderRadius: borderRadius.l,
            padding: spacing.m,
            borderWidth: isHighlighted ? 2 : 0,
            borderColor: colors.primary,
          }
        ]}
      >
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor, borderRadius: borderRadius.l, zIndex: -1 }]} />
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
    </Animated.View>
  );
};

// ─── Day group header ─────────────────────────────────────────────────────
const DayGroup = ({ date, txList, isYearly, format, colors, spacing, isCollapsed, onToggle, highlightId, ...props }: any) => {
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
    <View style={{ marginBottom: spacing.s, marginLeft: props.isTimeline ? spacing.m : 0 }}>
      <TouchableOpacity onPress={onToggle} activeOpacity={0.8} style={st.groupHeader}>
        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
          <Text style={[st.groupTitle, { color: colors.textSecondary, fontSize: 11 }]}>{prettyDate}</Text>
        </View>
        <View style={{ flexDirection: 'row' }}>
          {income  > 0 && <Text style={[st.groupSummary, { color: colors.income, fontSize: 11 }]}>+{format(income)}</Text>}
          {expense > 0 && <Text style={[st.groupSummary, { color: colors.expense, marginLeft: 8, fontSize: 11 }]}>-{format(expense)}</Text>}
        </View>
      </TouchableOpacity>
      {!isCollapsed && txList.map((item: any) => (
        <TxCard 
          key={item.id} 
          item={item} 
          format={format} 
          colors={colors} 
          spacing={spacing} 
          isHighlighted={item.id === highlightId}
          {...props} 
        />
      ))}
    </View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
export const TransactionsScreen = () => {
  const { colors, spacing, typography, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<any>>();
  const route = useRoute<any>();
  const { format } = useCurrency();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('daily');
  const [listStep, setListStep] = useState<'day' | 'month' | 'year'>('day');
  const [selectedDate, setSelectedDate] = useState(TODAY);
  const [viewDate, setViewDate] = useState(new Date()); 
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showSortModal, setShowSortModal] = useState(false);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportFormat, setExportFormat] = useState<'xlsx' | 'pdf'>('pdf');
  const [rangeType, setRangeType] = useState<'today' | 'week' | 'month' | 'year' | 'custom'>('month');
  const [exportOptions, setExportOptions] = useState({ categories: true, notes: true, accounts: true, charts: true });
  const [customStart, setCustomStart] = useState(new Date());
  const [customEnd, setCustomEnd] = useState(new Date());
  const [showCustomPicker, setShowCustomPicker] = useState<'start' | 'end' | null>(null);
  const [exportFileName, setExportFileName] = useState('');
  const [showExportActionModal, setShowExportActionModal] = useState(false);
  const [lastExportUri, setLastExportUri] = useState<string | null>(null);

  const { sortField, sortOrder, setSort } = useSortStore();
  const { setContext, pendingFilter, clearFilter } = useViewContextStore();
  const { swipeBehavior } = useAppStore();

  const fabAnim = useRef(new Animated.Value(1)).current;

  // Contextual Deep Link Handling
  useEffect(() => {
    if (route.params?.initialDate) {
      const d = new Date(route.params.initialDate);
      setViewDate(d);
      setSelectedDate(route.params.initialDate);
      setViewMode('daily');
      setListStep('day');
      
      if (route.params?.highlightId) {
        setHighlightId(route.params.highlightId);
        setTimeout(() => setHighlightId(null), 3000);
      }
    }
  }, [route.params]);

  useEffect(() => {
    if (pendingFilter) {
      const { category, type } = pendingFilter;
      if (type && type !== 'all') setFilterType(type);
      if (category && categories.length > 0) {
        const cat = categories.find(c => c.name === category);
        if (cat) setFilterCatId(cat.id);
      }
      setViewMode('all');
      clearFilter();
    }
  }, [pendingFilter, categories]);

  useEffect(() => {
    const ctxMode = viewMode === 'all' ? 'all' : 
                    viewMode === 'calendar' ? 'calendar' :
                    listStep === 'day' ? 'daily' : 
                    listStep === 'month' ? 'monthly' : 'yearly';

    setContext({
      viewMode: ctxMode as any,
      selectedDate: selectedDate,
      selectedMonth: viewDate.getMonth(),
      selectedYear: viewDate.getFullYear(),
    });
  }, [viewMode, listStep, selectedDate, viewDate]);

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
      syncEvents.on('mutation_detected', sub);
      return () => {
        syncEvents.off('sync_completed', sub);
        syncEvents.off('mutation_detected', sub);
      };
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

  const timelineGroups = useMemo(() => {
    if (viewMode !== 'all') return [];
    
    const yearMap: Record<string, Record<string, Record<string, any[]>>> = {};
    
    sortedTransactions.forEach(tx => {
      const date = new Date(tx.date);
      const year = date.getFullYear().toString();
      const month = date.toISOString().slice(0, 7);
      const day = date.toISOString().slice(0, 10);
      
      if (!yearMap[year]) yearMap[year] = {};
      if (!yearMap[year][month]) yearMap[year][month] = {};
      if (!yearMap[year][month][day]) yearMap[year][month][day] = [];
      
      yearMap[year][month][day].push(tx);
    });
    
    const sortedYears = Object.keys(yearMap).sort((a, b) => sortOrder === 'desc' ? b.localeCompare(a) : a.localeCompare(b));
    
    return sortedYears.map(y => ({
      year: y,
      months: Object.keys(yearMap[y]).sort((a, b) => sortOrder === 'desc' ? b.localeCompare(a) : a.localeCompare(b)).map(m => ({
        month: m,
        monthLabel: new Date(m + '-01').toLocaleDateString('en-IN', { month: 'long' }),
        days: Object.keys(yearMap[y][m]).sort((a, b) => sortOrder === 'desc' ? b.localeCompare(a) : a.localeCompare(b)).map(d => ({
          date: d,
          txList: yearMap[y][m][d]
        }))
      }))
    }));
  }, [sortedTransactions, viewMode, sortOrder]);

  const navigateDate = (direction: 'next' | 'prev') => {
    if (viewMode !== 'daily' && viewMode !== 'calendar') return;
    
    const d = new Date(viewDate);
    if (viewMode === 'calendar' || (viewMode === 'daily' && listStep === 'day')) d.setDate(d.getDate() + (direction === 'next' ? 1 : -1));
    else if (viewMode === 'daily' && listStep === 'month') d.setMonth(d.getMonth() + (direction === 'next' ? 1 : -1));
    else if (viewMode === 'daily' && listStep === 'year') d.setFullYear(d.getFullYear() + (direction === 'next' ? 1 : -1));
    
    setViewDate(d);
    if (viewMode === 'calendar' || (viewMode === 'daily' && listStep === 'day')) setSelectedDate(d.toISOString().split('T')[0]);
    soundEngine.play('swipe_glide');
  };

  const onGestureEvent = (event: any) => {
    if (swipeBehavior !== 'dates') return;
    if (event.nativeEvent.state === State.END) {
      const { translationX } = event.nativeEvent;
      if (Math.abs(translationX) > 50) {
        navigateDate(translationX > 0 ? 'prev' : 'next');
      }
    }
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

  const visibleTxs = viewMode === 'calendar' ? calendarTxs :
                    (viewMode === 'daily' && listStep === 'day') ? dailyTxs :
                    (viewMode === 'daily' && listStep === 'month') ? monthlyGroups.flatMap(g => g.txList) :
                    (viewMode === 'daily' && listStep === 'year') ? annuallyGroups.flatMap(g => g.txList) :
                    sortedTransactions; 

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
        soundEngine.play('delete_confirmed');
        setSelectedIds(new Set()); setSelectMode(false); fetchTransactions();
      }},
    ]);
  };

  const summaryIncome  = visibleTxs.filter(t => t.type === 'income').reduce((s, t) => s + t.amount, 0);
  const summaryExpense = visibleTxs.filter(t => t.type !== 'income').reduce((s, t) => s + t.amount, 0);

  const cardProps = { colors, selectMode, selectedIds, toggleId, format, spacing, borderRadius, highlightId };

  const OptionToggle = ({ label, value, onToggle }: any) => (
    <TouchableOpacity onPress={onToggle} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12 }}>
      <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>{label}</Text>
      <Ionicons name={value ? "checkbox" : "square-outline"} size={22} color={value ? colors.primary : colors.border} />
    </TouchableOpacity>
  );


  useEffect(() => {
    if (showExportModal && !exportFileName) {
      const range = getRange();
      const name = `GreenMoney_Report_${range.label.replace(/\s+/g, '_')}`;
      setExportFileName(name);
    }
  }, [showExportModal]);

  const getRange = () => {
    const now = new Date();
    switch (rangeType) {
      case 'today': return { start: now, end: now, label: 'Today' };
      case 'week': return { start: startOfWeek(now), end: endOfWeek(now), label: 'This Week' };
      case 'month': return { start: startOfMonth(now), end: endOfMonth(now), label: new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) };
      case 'year': return { start: startOfYear(now), end: endOfYear(now), label: `Year ${now.getFullYear()}` };
      case 'custom': return { start: customStart, end: customEnd, label: 'Custom Range' };
      default: return { start: now, end: now, label: 'Export' };
    }
  };

  const performExport = async () => {
    setIsExporting(true);
    soundEngine.play('tap');
    try {
      const range = getRange();
      const start = new Date(range.start); start.setHours(0,0,0,0);
      const end = new Date(range.end); end.setHours(23,59,59,999);

      const filtered = transactions.filter(tx => {
        const d = new Date(tx.date);
        return d >= start && d <= end;
      });

      if (filtered.length === 0) {
        Alert.alert('No Data', 'No transactions found for this range.');
        return;
      }

      const exportPromise = transactionExportService.exportTransactions(filtered, {
        format: exportFormat,
        dateRange: range,
        fileName: exportFileName,
        includeCategories: exportOptions.categories,
        includeNotes: exportOptions.notes,
        includeAccounts: exportOptions.accounts,
        includeCharts: exportOptions.charts,
        includeSummaries: true
      });

      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Export timed out')), 30000)
      );

      const uri = await Promise.race([exportPromise, timeoutPromise]) as string;
      
      setLastExportUri(uri);
      setShowExportModal(false);
      setTimeout(() => setShowExportActionModal(true), 500);
    } catch (e) {
      console.error('Export failed:', e);
      Alert.alert('Export Failed', 'An error occurred during export.');
    } finally {
      setIsExporting(false);
    }
  };

  function renderExportModal() {
    return (
      <Modal visible transparent animationType="slide" onRequestClose={() => setShowExportModal(false)}>
        <Pressable style={st.modalOverlay} onPress={() => setShowExportModal(false)}>
          <Pressable style={[st.modalContent, { backgroundColor: colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24 }]}>
            <View style={st.modalHeader}>
              <View style={{ width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />
              <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>Export Data</Text>
              <Text style={{ fontSize: 13, color: colors.textSecondary, marginTop: 4 }}>Professional financial reporting</Text>
            </View>

            <ScrollView style={{ maxHeight: 500 }} showsVerticalScrollIndicator={false}>
              <Text style={[st.sectionTitle, { color: colors.text }]}>Format</Text>
              <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
                {(['pdf', 'xlsx'] as const).map(f => (
                  <TouchableOpacity key={f} onPress={() => setExportFormat(f)} style={[st.formatCard, { borderColor: exportFormat === f ? colors.primary : colors.border, backgroundColor: exportFormat === f ? colors.primary + '10' : 'transparent' }]}>
                    <Ionicons name={f === 'pdf' ? 'document-text' : 'grid'} size={24} color={exportFormat === f ? colors.primary : colors.textSecondary} />
                    <Text style={{ marginTop: 8, fontWeight: '700', color: exportFormat === f ? colors.primary : colors.textSecondary }}>{f.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={[st.sectionTitle, { color: colors.text }]}>Select Period</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {(['today', 'week', 'month', 'year', 'custom'] as const).map(r => (
                  <TouchableOpacity key={r} onPress={() => setRangeType(r)} style={[st.miniChip, { backgroundColor: rangeType === r ? colors.primary : colors.border + '33' }]}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: rangeType === r ? '#fff' : colors.textSecondary }}>{r.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {rangeType === 'custom' && (
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
                  <TouchableOpacity onPress={() => setShowCustomPicker('start')} style={[st.dateBox, { borderColor: colors.border, backgroundColor: colors.background }]}>
                    <Text style={{ fontSize: 10, color: colors.textSecondary }}>START</Text>
                    <Text style={{ fontWeight: '700', color: colors.text }}>{customStart.toLocaleDateString()}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowCustomPicker('end')} style={[st.dateBox, { borderColor: colors.border, backgroundColor: colors.background }]}>
                    <Text style={{ fontSize: 10, color: colors.textSecondary }}>END</Text>
                    <Text style={{ fontWeight: '700', color: colors.text }}>{customEnd.toLocaleDateString()}</Text>
                  </TouchableOpacity>
                </View>
              )}

              <Text style={[st.sectionTitle, { color: colors.text }]}>Report Name</Text>
              <View style={[st.searchBar, { backgroundColor: colors.background, marginBottom: 24, borderWidth: 1, borderColor: colors.border }]}>
                <Ionicons name="document-text-outline" size={20} color={colors.primary} />
                <TextInput
                  value={exportFileName}
                  onChangeText={setExportFileName}
                  style={{ flex: 1, marginLeft: 12, color: colors.text, fontWeight: '600' }}
                  placeholder="Enter filename..."
                />
              </View>

              <Text style={[st.sectionTitle, { color: colors.text }]}>Content Options</Text>
              <View style={{ marginBottom: 24 }}>
                <OptionToggle label="Include Categories" value={exportOptions.categories} onToggle={() => setExportOptions(p => ({ ...p, categories: !p.categories }))} />
                <OptionToggle label="Include Notes" value={exportOptions.notes} onToggle={() => setExportOptions(p => ({ ...p, notes: !p.notes }))} />
                <OptionToggle label="Include Account Info" value={exportOptions.accounts} onToggle={() => setExportOptions(p => ({ ...p, accounts: !p.accounts }))} />
                {exportFormat === 'pdf' && <OptionToggle label="Include Charts" value={exportOptions.charts} onToggle={() => setExportOptions(p => ({ ...p, charts: !p.charts }))} />}
              </View>
            </ScrollView>

            <Button 
              title={isExporting ? "GENERATING..." : "GENERATE EXPORT"} 
              onPress={performExport}
              loading={isExporting}
              style={{ marginTop: 10 }}
            />
            <View style={{ height: 20 }} />
          </Pressable>
        </Pressable>

        {showCustomPicker && (
          <DateTimePicker
            value={showCustomPicker === 'start' ? customStart : customEnd}
            mode="date"
            onChange={(e, d) => {
              setShowCustomPicker(null);
              if (d) {
                if (showCustomPicker === 'start') setCustomStart(d);
                else setCustomEnd(d);
              }
            }}
          />
        )}
      </Modal>
    );
  }

  function renderExportActionModal() {
    const handleAction = async (action: 'download' | 'share' | 'both') => {
      if (!lastExportUri) return;
      setShowExportActionModal(false);
      
      try {
        const isAndroid = Platform.OS === 'android';
        
        if (action === 'download' || action === 'both') {
          if (isAndroid) {
            // Android direct download to folder
            try {
              const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
              if (permissions.granted) {
                const base64 = await FileSystem.readAsStringAsync(lastExportUri, { encoding: FileSystem.EncodingType.Base64 });
                const mimeType = exportFormat === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                const uri = await FileSystem.StorageAccessFramework.createFileAsync(permissions.directoryUri, exportFileName, mimeType);
                await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
                Alert.alert('Success', 'File saved successfully to the selected folder.');
              }
            } catch (err) {
              console.warn('SAF failed, falling back to share', err);
              await Sharing.shareAsync(lastExportUri);
            }
          } else {
            // iOS Save to Files
            await Sharing.shareAsync(lastExportUri);
          }
        }
        
        if (action === 'share' || (action === 'both' && isAndroid)) {
          // If both on Android, we already did SAF, now share
          // If only share, we do share
          await Sharing.shareAsync(lastExportUri);
        }
      } catch (e) {
        console.error('Action failed:', e);
        Alert.alert('Error', 'Could not complete the action.');
      }
    };

    return (
      <Modal visible={showExportActionModal} transparent animationType="fade">
        <Pressable style={st.modalOverlay} onPress={() => setShowExportActionModal(false)}>
          <Card style={[st.modalCard, { backgroundColor: colors.card, padding: 24, borderRadius: 28 }]}>
            <View style={{ alignItems: 'center', marginBottom: 20 }}>
              <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.success + '20', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                <Ionicons name="checkmark-circle" size={40} color={colors.success} />
              </View>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>Export Ready!</Text>
              <Text style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 8 }}>
                Your report "{exportFileName}" has been generated successfully.
              </Text>
            </View>

            <View style={{ gap: 12 }}>
              <TouchableOpacity onPress={() => handleAction('download')} style={[st.actionButton, { backgroundColor: colors.primary + '10', borderColor: colors.primary }]}>
                <Ionicons name="download-outline" size={20} color={colors.primary} />
                <Text style={{ fontWeight: '700', color: colors.primary, marginLeft: 12 }}>Download Only</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => handleAction('both')} style={[st.actionButton, { backgroundColor: colors.primary }]}>
                <Ionicons name="cloud-upload-outline" size={20} color="#fff" />
                <Text style={{ fontWeight: '700', color: '#fff', marginLeft: 12 }}>Download & Share</Text>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => handleAction('share')} style={[st.actionButton, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}>
                <Ionicons name="share-social-outline" size={20} color={colors.text} />
                <Text style={{ fontWeight: '700', color: colors.text, marginLeft: 12 }}>Share Only</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={() => setShowExportActionModal(false)} style={{ marginTop: 20, alignSelf: 'center' }}>
              <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
          </Card>
        </Pressable>
      </Modal>
    );
  }

  return (
    <View style={[st.container, { backgroundColor: colors.background }]}>
      <PanGestureHandler onHandlerStateChange={onGestureEvent} activeOffsetX={[-20, 20]} failOffsetY={[-20, 20]}>
        <View style={{ flex: 1 }}>
          <View style={[st.header, { paddingTop: insets.top + spacing.m }]}>
            <View style={st.headerTop}>
              <Text style={[typography.header, { color: colors.text }]}>Transactions</Text>
              <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
                <TouchableOpacity onPress={() => setShowExportModal(true)}>
                  <Ionicons name="share-outline" size={24} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSync} disabled={syncing}>
                  <Ionicons name={syncing ? "sync" : "cloud-done"} size={24} color={colors.primary} />
                </TouchableOpacity>
              </View>
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
                { key: 'daily', label: 'Daily', icon: 'list' },
                { key: 'calendar', label: 'Calendar', icon: 'calendar' },
                { key: 'all', label: 'Timeline', icon: 'time' },
              ] as any).map((m: any) => (
                <TouchableOpacity
                  key={m.key}
                  onPress={() => { 
                    soundEngine.play('tap');
                    setViewMode(m.key); 
                    setSelectMode(false); 
                    setSelectedIds(new Set()); 
                  }}
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
                  current={viewDate.toISOString().split('T')[0]}
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

            {viewMode === 'daily' && (
              <View style={[st.stepContainer, { marginHorizontal: 20, marginBottom: 16 }]}>
                {(['day', 'month', 'year'] as any).map((s: any) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => setListStep(s)}
                    style={[st.stepChip, { backgroundColor: listStep === s ? colors.primary + '20' : 'transparent', borderColor: listStep === s ? colors.primary : 'transparent' }]}
                  >
                    <Text style={{ color: listStep === s ? colors.primary : colors.textSecondary, fontWeight: '700', fontSize: 12 }}>{s.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {viewMode !== 'all' && (
              <View style={st.navigationRow}>
                <TouchableOpacity onPress={() => navigateDate('prev')}><Ionicons name="chevron-back" size={24} color={colors.primary} /></TouchableOpacity>
                <View style={{ alignItems: 'center' }}>
                  <Text style={[st.navTitle, { color: colors.text }]}>
                    {viewMode === 'calendar' || (viewMode === 'daily' && listStep === 'day') ? (currentFocusStr === TODAY ? 'Today' : new Date(currentFocusStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })) : 
                    (viewMode === 'daily' && listStep === 'month') ? new Date(currentMonthStr).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : 
                    `Year ${currentYearStr}`}
                  </Text>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: (summaryIncome - summaryExpense) >= 0 ? colors.income : colors.expense, marginTop: 2 }}>
                    Balance: {format(summaryIncome - summaryExpense)}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => navigateDate('next')}><Ionicons name="chevron-forward" size={24} color={colors.primary} /></TouchableOpacity>
              </View>
            )}

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
              <View style={{ flexDirection: 'row', gap: spacing.m }}>
                <TouchableOpacity onPress={() => setShowSortModal(true)}><Ionicons name="swap-vertical" size={22} color={colors.primary} /></TouchableOpacity>
                <TouchableOpacity onPress={() => setShowFilterModal(true)}><Ionicons name="funnel" size={22} color={colors.primary} /></TouchableOpacity>
              </View>

              <TouchableOpacity 
                onPress={() => {
                  const allVisibleIds = visibleTxs.map(t => t.id);
                  if (!selectMode) {
                    setSelectMode(true);
                    setSelectedIds(new Set(allVisibleIds));
                  } else {
                    if (selectedIds.size === visibleTxs.length && visibleTxs.length > 0) {
                      setSelectedIds(new Set());
                      setSelectMode(false);
                    } else {
                      setSelectedIds(new Set(allVisibleIds));
                    }
                  }
                  soundEngine.play('tap');
                }}
              >
                <Ionicons 
                  name={(selectMode && selectedIds.size === visibleTxs.length && visibleTxs.length > 0) ? "checkbox" : "checkbox-outline"} 
                  size={24} 
                  color={colors.primary} 
                />
              </TouchableOpacity>
            </View>

            <View style={{ paddingHorizontal: 20 }}>
              {visibleTxs.length === 0 ? (
                <Text style={{ textAlign: 'center', color: colors.textSecondary, marginTop: 40 }}>No transactions found.</Text>
              ) : viewMode === 'all' ? (
                timelineGroups.map(y => (
                  <YearSection key={y.year} year={y.year} months={y.months} colors={colors} spacing={spacing} expanded={!collapsedGroups[y.year]} onToggle={() => toggleGroup(y.year)}>
                    {y.months.map(m => (
                      <MonthSection key={m.month} monthLabel={m.monthLabel} txList={m.days.flatMap(d => d.txList)} format={format} colors={colors} spacing={spacing} expanded={!collapsedGroups[m.month]} onToggle={() => toggleGroup(m.month)}>
                        {m.days.map(d => (
                          <DayGroup key={d.date} date={d.date} txList={d.txList} colors={colors} spacing={spacing} isTimeline={true} isCollapsed={collapsedGroups[d.date]} onToggle={() => toggleGroup(d.date)} {...cardProps} />
                        ))}
                      </MonthSection>
                    ))}
                  </YearSection>
                ))
              ) : (viewMode === 'daily' && (listStep === 'month' || listStep === 'year')) ? (
                (listStep === 'year' ? annuallyGroups : monthlyGroups).map(g => (
                  <DayGroup key={g.date} date={g.date} txList={g.txList} colors={colors} isYearly={listStep === 'year'} isCollapsed={collapsedGroups[g.date]} onToggle={() => toggleGroup(g.date)} {...cardProps} />
                ))
              ) : (
                visibleTxs.map(item => (
                  <TxCard 
                    key={item.id} 
                    item={item} 
                    isHighlighted={item.id === highlightId}
                    {...cardProps} 
                  />
                ))
              )}
            </View>
          </ScrollView>
        </View>
      </PanGestureHandler>

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
                  <TouchableOpacity style={[st.chip, { backgroundColor: !filterAccId ? colors.primary : colors.card }]} onPress={() => !filterAccId ? null : setFilterAccId(null)}>
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
      {showExportModal && renderExportModal()}
      {showExportActionModal && renderExportActionModal()}
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
  timelineHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 12, borderRadius: 12, marginBottom: 4 },
  timelineTitle: { fontSize: 16, fontWeight: '800' },
  timelineSummary: { fontSize: 12, fontWeight: '600' },
  timelineMonth: { fontSize: 14, fontWeight: '700' },
  stepContainer: { flexDirection: 'row', gap: 8, padding: 4, backgroundColor: '#f0f0f0', borderRadius: 16 },
  stepChip: { flex: 1, paddingVertical: 8, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  fabContainer: { position: 'absolute', right: 20, zIndex: 99 },
  fab: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.3, shadowRadius: 4 },
  bottomToolbar: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#eee', zIndex: 100 },
  bulkDeleteBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#B3261E', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24 },
  actionButton: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: 'transparent' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', padding: 20 },
  modalCard: { padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  modalOption: { flexDirection: 'row', justifyContent: "space-between", alignItems: 'center', paddingVertical: 16 },
  modalDivider: { height: 1, backgroundColor: '#eee', marginVertical: 8 },
  filterModal: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 24, justifyContent: 'flex-start' },
  filterHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  filterLabel: { fontSize: 14, fontWeight: '600', marginBottom: 12, marginTop: 16 },
  chipRow: { flexDirection: 'row', gap: 8 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  dateSelector: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 12 },
  modalContent: { padding: 24, maxHeight: '85%' },
  modalHeader: { marginBottom: 24 },
  sectionTitle: { fontSize: 13, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 16 },
  formatCard: { flex: 1, padding: 16, borderRadius: 16, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  dateBox: { flex: 1, padding: 12, borderRadius: 12, borderWidth: 1, gap: 4 },
  miniChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
});
