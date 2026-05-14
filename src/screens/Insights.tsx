import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView, TouchableOpacity } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { getTransactions } from '../services/database';
import { getCategoryBreakdown, getTotalIncome, getTotalExpense } from '../services/analyticsService';
import { generateAllInsights } from '../services/insightsService';
import { Card } from '../components/Card';
import { Ionicons } from '@expo/vector-icons';
import { useCurrency } from '../hooks/useCurrency';
import { ModernDonutChart } from '../components/ModernDonutChart';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import { useAppStore } from '../store';
import { useViewContextStore } from '../store/viewContextStore';
import { soundEngine } from '../services/soundEngine';
import { syncEvents } from '../services/syncEvents';

const screenWidth = Dimensions.get('window').width;

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly';

export const InsightsScreen = () => {
  const { colors, spacing, typography, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const { format } = useCurrency();
  const { swipeBehavior, setActiveTab } = useAppStore();
  const { setContext } = useViewContextStore();
  
  const [transactions, setTransactions] = useState<any[]>([]);
  const [period, setPeriod] = useState<Period>('monthly');
  const [viewDate, setViewDate] = useState(new Date());
  const [filterType, setFilterType] = useState<'income' | 'expense' | 'all'>('expense');
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState<'pie' | 'bar' | 'table'>('pie');
  const [legendStyle, setLegendStyle] = useState<'list' | 'grid' | 'arrow'>('list');
  const [legendPosition, setLegendPosition] = useState<'top' | 'bottom'>('bottom');
  const [isCustomizing, setIsCustomizing] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      setTransactions(await getTransactions());
    } catch (error) { console.error('Failed to load insights:', error); }
    finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { 
    fetchData(); 
    const sub = () => fetchData();
    syncEvents.on('mutation_detected', sub);
    syncEvents.on('sync_completed', sub);
    return () => {
      syncEvents.off('mutation_detected', sub);
      syncEvents.off('sync_completed', sub);
    };
  }, []));

  const filteredTxs = useMemo(() => {
    return transactions.filter(tx => {
      if (!tx.date) return false;
      const txDateStr = tx.date.slice(0, 10);
      
      // Use local date parts to avoid UTC shift issues
      const y = viewDate.getFullYear();
      const m = (viewDate.getMonth() + 1).toString().padStart(2, '0');
      const d = viewDate.getDate().toString().padStart(2, '0');
      const targetDateStr = `${y}-${m}-${d}`;
      const targetMonthStr = `${y}-${m}`;
      const targetYearStr = `${y}`;
      
      if (period === 'daily') {
        return txDateStr === targetDateStr;
      } else if (period === 'monthly') {
        return txDateStr.startsWith(targetMonthStr);
      } else if (period === 'yearly') {
        return txDateStr.startsWith(targetYearStr);
      } else if (period === 'weekly') {
        const txDate = new Date(txDateStr);
        const start = new Date(viewDate);
        const day = start.getDay();
        const diff = start.getDate() - day + (day === 0 ? -6 : 1);
        start.setDate(diff);
        start.setHours(0,0,0,0);
        
        const end = new Date(start);
        end.setDate(start.getDate() + 7);
        
        return txDate >= start && txDate < end;
      }
      return true;
    });
  }, [transactions, period, viewDate]);

  const stats = useMemo(() => {
    try {
      const income = getTotalIncome(filteredTxs);
      const expense = getTotalExpense(filteredTxs);
      const insights = generateAllInsights(filteredTxs, format);
      let breakdown: any[] = [];
      if (filterType === 'all') {
        breakdown = [
          { name: 'Income', amount: income, color: '#4CAF50', percentage: (income / (income + expense)) * 100 || 0 },
          { name: 'Expense', amount: expense, color: '#F44336', percentage: (expense / (income + expense)) * 100 || 0 }
        ].filter(i => i.amount > 0);
      } else breakdown = getCategoryBreakdown(filteredTxs, filterType);
      return { income, expense, breakdown, insights };
    } catch (e) {
      return { income: 0, expense: 0, breakdown: [], insights: { patterns: [], suggestions: [], anomalies: [] } };
    }
  }, [filteredTxs, filterType]);

  const navigateDate = (direction: 'next' | 'prev') => {
    const d = new Date(viewDate);
    if (period === 'daily') d.setDate(d.getDate() + (direction === 'next' ? 1 : -1));
    else if (period === 'weekly') d.setDate(d.getDate() + (direction === 'next' ? 7 : -7));
    else if (period === 'monthly') d.setMonth(d.getMonth() + (direction === 'next' ? 1 : -1));
    else if (period === 'yearly') d.setFullYear(d.getFullYear() + (direction === 'next' ? 1 : -1));
    
    setViewDate(d);
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

  const periodLabel = useMemo(() => {
    if (period === 'daily') return viewDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    if (period === 'weekly') {
      const start = new Date(viewDate);
      const day = start.getDay();
      start.setDate(start.getDate() - day + (day === 0 ? -6 : 1));
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      return `${start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`;
    }
    if (period === 'monthly') return viewDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    return `Year ${viewDate.getFullYear()}`;
  }, [viewDate, period]);

  const handleCategoryPress = (categoryName: string) => {
    soundEngine.play('tap');
    setContext({
      pendingFilter: {
        category: categoryName,
        type: filterType === 'all' ? undefined : filterType 
      }
    });
    setActiveTab(1); // Index 1 is Transactions
  };

  const renderBarChart = (data: any[]) => {
    const maxAmount = Math.max(...data.map(d => d.amount));
    return (
      <View style={{ marginTop: 16 }}>
        {data.map((item, i) => (
          <TouchableOpacity key={i} style={{ marginBottom: 12 }} onPress={() => handleCategoryPress(item.name)}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{item.name}</Text>
              <Text style={{ fontSize: 13, fontWeight: '800', color: colors.text }}>{format(item.amount)}</Text>
            </View>
            <View style={{ height: 10, backgroundColor: colors.border + '22', borderRadius: 5, overflow: 'hidden' }}>
              <View style={{ height: '100%', width: `${(item.amount / maxAmount) * 100}%`, backgroundColor: item.color, borderRadius: 5 }} />
            </View>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderDataTable = (data: any[]) => (
    <View style={{ marginTop: 16, borderTopWidth: 1, borderColor: colors.border + '33' }}>
      {data.map((item, i) => (
        <TouchableOpacity key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.border + '22' }} onPress={() => handleCategoryPress(item.name)}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color, marginRight: 8 }} />
            <Text style={{ color: colors.text, fontWeight: '600' }}>{item.name}</Text>
          </View>
          <View style={{ alignItems: 'flex-end', flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: colors.text, fontWeight: '800' }}>{format(item.amount)}</Text>
              <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{item.percentage.toFixed(1)}%</Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={colors.border} />
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderLegend = (data: any[]) => {
    if (legendStyle === 'list') {
      return (
        <View style={{ marginTop: 20 }}>
          {data.map((item, i) => (
            <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color, marginRight: 12 }} />
              <Text style={{ flex: 1, color: colors.text, fontSize: 14 }}>{item.name}</Text>
              <Text style={{ color: colors.text, fontWeight: '700' }}>{format(item.amount)}</Text>
            </View>
          ))}
        </View>
      );
    }
    
    if (legendStyle === 'grid') {
      return (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 20, gap: 12 }}>
          {data.map((item, i) => (
            <View key={i} style={{ width: '47%', flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: item.color, marginRight: 8 }} />
              <Text style={{ flex: 1, color: colors.text, fontSize: 12 }} numberOfLines={1}>{item.name}</Text>
              <Text style={{ color: colors.text, fontSize: 12, fontWeight: '700' }}>{item.percentage.toFixed(0)}%</Text>
            </View>
          ))}
        </View>
      );
    }

    if (legendStyle === 'arrow') {
      return (
        <View style={{ marginTop: 20 }}>
          {data.map((item, i) => (
            <TouchableOpacity key={i} style={{ flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: item.color + '10', borderRadius: 12, marginBottom: 8 }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: item.color + '20', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <Ionicons name="trending-down" size={16} color={item.color} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>{item.name}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{item.percentage.toFixed(1)}% of total</Text>
              </View>
              <Text style={{ color: colors.text, fontWeight: '800' }}>{format(item.amount)}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.border} style={{ marginLeft: 8 }} />
            </TouchableOpacity>
          ))}
        </View>
      );
    }
    return null;
  };

  const renderPeriodPill = (p: Period, label: string) => (
    <TouchableOpacity onPress={() => { soundEngine.play('tap'); setPeriod(p); }} style={[styles.periodPill, { backgroundColor: period === p ? colors.primary : colors.card }]}>
      <Text style={{ color: period === p ? '#fff' : colors.textSecondary, fontWeight: '700', fontSize: 13 }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <PanGestureHandler onHandlerStateChange={onGestureEvent} activeOffsetX={[-20, 20]} failOffsetY={[-20, 20]}>
        <View style={{ flex: 1 }}>
          <ScrollView style={[styles.container]} contentContainerStyle={{ paddingTop: insets.top + spacing.m, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
            <Text style={[styles.header, { color: colors.text }]}>Analytics</Text>
            
            <View style={[styles.periodBar, { backgroundColor: colors.card }]}>
              {renderPeriodPill('daily', 'Day')}
              {renderPeriodPill('weekly', 'Week')}
              {renderPeriodPill('monthly', 'Month')}
              {renderPeriodPill('yearly', 'Year')}
            </View>

            <View style={styles.navigationRow}>
              <TouchableOpacity onPress={() => navigateDate('prev')}><Ionicons name="chevron-back" size={24} color={colors.primary} /></TouchableOpacity>
              <Text style={[styles.navTitle, { color: colors.text }]}>{periodLabel}</Text>
              <TouchableOpacity onPress={() => navigateDate('next')}><Ionicons name="chevron-forward" size={24} color={colors.primary} /></TouchableOpacity>
            </View>

            <View style={styles.summaryGrid}>
              <Card variant="tonal" style={styles.statCard}>
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>Income</Text>
                <Text style={{ color: colors.primary, fontSize: 20, fontWeight: '800', marginTop: 4 }}>{format(stats.income)}</Text>
              </Card>
              <Card variant="tonal" style={styles.statCard}>
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600' }}>Expenses</Text>
                <Text style={{ color: colors.error, fontSize: 20, fontWeight: '800', marginTop: 4 }}>{format(stats.expense)}</Text>
              </Card>
            </View>

            <View style={[styles.typeSwitcher, { backgroundColor: colors.card }]}>
              {([
                { key: 'expense', label: 'Expenses' },
                { key: 'income', label: 'Income' },
                { key: 'all', label: 'Both' }
              ] as const).map(({ key, label }) => (
                <TouchableOpacity key={key} style={[styles.typeTab, filterType === key && { backgroundColor: colors.primary }]} onPress={() => { soundEngine.play('tap'); setFilterType(key); }}>
                  <Text style={{ color: filterType === key ? '#fff' : colors.textSecondary, fontWeight: '700', fontSize: 13 }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Card variant="elevated" style={styles.chartCard}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>Category Distribution</Text>
                <TouchableOpacity onPress={() => { soundEngine.play('tap'); setIsCustomizing(!isCustomizing); }} style={{ padding: 4 }}>
                  <Ionicons name="options-outline" size={20} color={isCustomizing ? colors.primary : colors.textSecondary} />
                </TouchableOpacity>
              </View>

              {isCustomizing && (
                <View style={[styles.customizerBox, { borderColor: colors.border + '33' }]}>
                  <View style={styles.customOption}>
                    <Text style={[styles.customLabel, { color: colors.textSecondary }]}>Chart Type</Text>
                    <View style={styles.chipGroup}>
                      {(['pie', 'bar', 'table'] as const).map(t => (
                        <TouchableOpacity key={t} onPress={() => setChartType(t)} style={[styles.miniChip, chartType === t && { backgroundColor: colors.primary }]}>
                          <Text style={{ fontSize: 10, fontWeight: '800', color: chartType === t ? '#fff' : colors.textSecondary }}>{t.toUpperCase()}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={styles.customOption}>
                    <Text style={[styles.customLabel, { color: colors.textSecondary }]}>Legend Style</Text>
                    <View style={styles.chipGroup}>
                      {(['list', 'grid', 'arrow'] as const).map(s => (
                        <TouchableOpacity key={s} onPress={() => setLegendStyle(s)} style={[styles.miniChip, legendStyle === s && { backgroundColor: colors.primary }]}>
                          <Text style={{ fontSize: 10, fontWeight: '800', color: legendStyle === s ? '#fff' : colors.textSecondary }}>{s.toUpperCase()}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                  <View style={styles.customOption}>
                    <Text style={[styles.customLabel, { color: colors.textSecondary }]}>Position</Text>
                    <View style={styles.chipGroup}>
                      {(['top', 'bottom'] as const).map(p => (
                        <TouchableOpacity key={p} onPress={() => setLegendPosition(p)} style={[styles.miniChip, legendPosition === p && { backgroundColor: colors.primary }]}>
                          <Text style={{ fontSize: 10, fontWeight: '800', color: legendPosition === p ? '#fff' : colors.textSecondary }}>{p.toUpperCase()}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                </View>
              )}

              {stats.breakdown.length > 0 ? (
                <View style={{ flexDirection: legendPosition === 'top' ? 'column-reverse' : 'column' }}>
                  {chartType === 'pie' && (
                    <ModernDonutChart 
                      data={stats.breakdown} 
                      total={filterType === 'income' ? stats.income : stats.expense} 
                      type={filterType === 'income' ? 'Income' : 'Spend'}
                      onCategoryPress={handleCategoryPress}
                    />
                  )}
                  {chartType === 'bar' && renderBarChart(stats.breakdown)}
                  {chartType === 'table' && renderDataTable(stats.breakdown)}
                </View>
              ) : (
                <View style={styles.emptyState}>
                  <Ionicons name="stats-chart" size={48} color={colors.textSecondary + '33'} />
                  <Text style={{ color: colors.textSecondary, marginTop: 12, fontWeight: '600' }}>No activities to analyze</Text>
                </View>
              )}
            </Card>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>Smart Insights</Text>

            <View style={styles.insightList}>
              {stats.insights.anomalies.map((p, i) => (
                <Card key={`anom-${i}`} variant="filled" style={[styles.insightCard, { backgroundColor: colors.error + '11', borderColor: colors.error + '33', borderWidth: 1 }]}>
                  <View style={styles.insightHeader}>
                    <Ionicons name="alert-circle" size={20} color={colors.error} />
                    <Text style={{ color: colors.error, fontWeight: '800', marginLeft: 8 }}>Anomaly Detected</Text>
                  </View>
                  <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>{p}</Text>
                </Card>
              ))}

              {stats.insights.patterns.map((p, i) => (
                <Card key={`patt-${i}`} variant="tonal" style={styles.insightCard}>
                  <View style={styles.insightHeader}>
                    <Ionicons name="analytics" size={20} color={colors.primary} />
                    <Text style={{ color: colors.primary, fontWeight: '800', marginLeft: 8 }}>Spending Habit</Text>
                  </View>
                  <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>{p}</Text>
                </Card>
              ))}

              {stats.insights.suggestions.map((p, i) => (
                <Card key={`sugg-${i}`} variant="filled" style={[styles.insightCard, { backgroundColor: '#FFD70011', borderColor: '#FFD70033', borderWidth: 1 }]}>
                  <View style={styles.insightHeader}>
                    <Ionicons name="bulb" size={20} color="#DAA520" />
                    <Text style={{ color: '#DAA520', fontWeight: '800', marginLeft: 8 }}>Saving Tip</Text>
                  </View>
                  <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20 }}>{p}</Text>
                </Card>
              ))}

              {stats.insights.patterns.length === 0 && stats.insights.suggestions.length === 0 && (
                <View style={{ padding: 20, alignItems: 'center' }}>
                  <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>Keep tracking to unlock AI-powered financial advice!</Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </PanGestureHandler>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  header: { fontSize: 32, fontWeight: '800', marginBottom: 20 },
  periodBar: { flexDirection: 'row', padding: 6, borderRadius: 16, marginBottom: 20 },
  periodPill: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 12 },
  navigationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingHorizontal: 10 },
  navTitle: { fontSize: 16, fontWeight: '700' },
  summaryGrid: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  statCard: { flex: 1, padding: 16 },
  typeSwitcher: { flexDirection: 'row', padding: 4, borderRadius: 14, marginBottom: 20 },
  typeTab: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  chartCard: { padding: 16, marginBottom: 24 },
  cardHeader: { fontSize: 18, fontWeight: '800', marginBottom: 16 },
  emptyState: { height: 180, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 22, fontWeight: '800', marginBottom: 16 },
  insightList: { gap: 16 },
  insightCard: { padding: 16 },
  insightHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  customizerBox: { padding: 16, backgroundColor: 'rgba(0,0,0,0.02)', borderRadius: 16, marginBottom: 20, borderWidth: 1, gap: 12 },
  customOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  customLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1 },
  chipGroup: { flexDirection: 'row', gap: 6 },
  miniChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(0,0,0,0.05)' },
});
