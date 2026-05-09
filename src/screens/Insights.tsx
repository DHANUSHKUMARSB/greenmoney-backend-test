import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PieChart } from 'react-native-chart-kit';
import { useTheme } from '../hooks/useTheme';
import { getTransactions } from '../services/database';
import { getCategoryBreakdown, getTotalIncome, getTotalExpense } from '../services/analyticsService';
import { generateAllInsights } from '../services/insightsService';
import { Card } from '../components/Card';
import { Ionicons } from '@expo/vector-icons';
import { useCurrency } from '../hooks/useCurrency';

const screenWidth = Dimensions.get('window').width;

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly';

export const InsightsScreen = () => {
  const { colors, spacing, typography, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const { format } = useCurrency();
  
  const [transactions, setTransactions] = useState<any[]>([]);
  const [period, setPeriod] = useState<Period>('monthly');
  const [filterType, setFilterType] = useState<'income' | 'expense' | 'all'>('expense');
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      setTransactions(await getTransactions());
    } catch (error) { console.error('Failed to load insights:', error); }
    finally { setLoading(false); }
  };

  useFocusEffect(useCallback(() => { fetchData(); }, []));

  const filteredTxs = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    return transactions.filter(tx => {
      const txDate = new Date(tx.date);
      if (period === 'daily') return txDate >= startOfToday && txDate <= endOfToday;
      if (period === 'weekly') {
        const sevenDaysAgo = new Date(startOfToday);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return txDate >= sevenDaysAgo && txDate <= endOfToday;
      }
      if (period === 'monthly') return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
      if (period === 'yearly') return txDate.getFullYear() === now.getFullYear();
      return true;
    });
  }, [transactions, period]);

  const stats = useMemo(() => {
    try {
      const income = getTotalIncome(filteredTxs);
      const expense = getTotalExpense(filteredTxs);
      const insights = generateAllInsights(filteredTxs);
      let breakdown: any[] = [];
      if (filterType === 'all') {
        breakdown = [
          { name: 'Income', amount: income, color: '#4CAF50', legendFontColor: colors.text, legendFontSize: 12 },
          { name: 'Expense', amount: expense, color: '#F44336', legendFontColor: colors.text, legendFontSize: 12 }
        ].filter(i => i.amount > 0);
      } else breakdown = getCategoryBreakdown(filteredTxs, filterType);
      return { income, expense, breakdown, insights };
    } catch (e) {
      return { income: 0, expense: 0, breakdown: [], insights: { patterns: [], suggestions: [], anomalies: [] } };
    }
  }, [filteredTxs, filterType, colors.text]);

  const renderPeriodPill = (p: Period, label: string) => (
    <TouchableOpacity onPress={() => setPeriod(p)} style={[styles.periodPill, { backgroundColor: period === p ? colors.primary : colors.card }]}>
      <Text style={{ color: period === p ? '#fff' : colors.textSecondary, fontWeight: '700', fontSize: 13 }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]} contentContainerStyle={{ paddingTop: insets.top + spacing.m, paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
      <Text style={[styles.header, { color: colors.text }]}>Analytics</Text>
      
      <View style={[styles.periodBar, { backgroundColor: colors.card }]}>
        {renderPeriodPill('daily', 'Day')}
        {renderPeriodPill('weekly', 'Week')}
        {renderPeriodPill('monthly', 'Month')}
        {renderPeriodPill('yearly', 'Year')}
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
          <TouchableOpacity key={key} style={[styles.typeTab, filterType === key && { backgroundColor: colors.primary }]} onPress={() => setFilterType(key)}>
            <Text style={{ color: filterType === key ? '#fff' : colors.textSecondary, fontWeight: '700', fontSize: 13 }}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Card variant="elevated" style={styles.chartCard}>
        <Text style={[styles.cardHeader, { color: colors.text }]}>Distribution</Text>
        {stats.breakdown.length > 0 ? (
          <View style={{ alignItems: 'center' }}>
            <PieChart
              data={stats.breakdown}
              width={screenWidth - 60}
              height={200}
              chartConfig={{ color: (opacity = 1) => `rgba(0, 0, 0, ${opacity})` }}
              accessor={"amount"}
              backgroundColor={"transparent"}
              paddingLeft={"20"}
              center={[10, 0]}
              absolute
            />
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="stats-chart" size={48} color={colors.textSecondary + '33'} />
            <Text style={{ color: colors.textSecondary, marginTop: 12, fontWeight: '600' }}>No data available</Text>
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
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  header: { fontSize: 32, fontWeight: '800', marginBottom: 20 },
  periodBar: { flexDirection: 'row', padding: 6, borderRadius: 16, marginBottom: 20 },
  periodPill: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 12 },
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
});
