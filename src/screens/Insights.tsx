import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions, ScrollView, TouchableOpacity } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PieChart, BarChart } from 'react-native-chart-kit';
import { useTheme } from '../hooks/useTheme';
import { typography, spacing } from '../utils/theme';
import { getTransactions } from '../services/database';
import { getCategoryBreakdown, getTotalIncome, getTotalExpense } from '../services/analyticsService';
import { generateAllInsights } from '../services/insightsService';
import { Card } from '../components/Card';
import { Ionicons } from '@expo/vector-icons';

const screenWidth = Dimensions.get('window').width;

type Period = 'daily' | 'weekly' | 'monthly' | 'yearly';

export const InsightsScreen = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  
  const [transactions, setTransactions] = useState<any[]>([]);
  const [period, setPeriod] = useState<Period>('monthly');
  const [filterType, setFilterType] = useState<'income' | 'expense' | 'all'>('expense');
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const txs = await getTransactions();
      setTransactions(txs);
    } catch (error) {
      console.error('Failed to load insights:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [])
  );

  const filteredTxs = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    return transactions.filter(tx => {
      const txDate = new Date(tx.date);
      
      if (period === 'daily') {
        return txDate >= startOfToday && txDate <= endOfToday;
      } else if (period === 'weekly') {
        const sevenDaysAgo = new Date(startOfToday);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        return txDate >= sevenDaysAgo && txDate <= endOfToday;
      } else if (period === 'monthly') {
        return txDate.getMonth() === now.getMonth() && txDate.getFullYear() === now.getFullYear();
      } else if (period === 'yearly') {
        return txDate.getFullYear() === now.getFullYear();
      }
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
        // Income vs Expense comparison breakdown
        breakdown = [
          { name: 'Income', amount: income, color: '#4CAF50', legendFontColor: colors.text, legendFontSize: 12 },
          { name: 'Expense', amount: expense, color: '#F44336', legendFontColor: colors.text, legendFontSize: 12 }
        ].filter(i => i.amount > 0);
      } else {
        // Category breakdown for specific type
        breakdown = getCategoryBreakdown(filteredTxs, filterType);
      }
      
      return { income, expense, breakdown, insights };
    } catch (e) {
      console.error('Stats calculation error:', e);
      return { income: 0, expense: 0, breakdown: [], insights: { patterns: [], suggestions: [], anomalies: [] } };
    }
  }, [filteredTxs, filterType]);

  const renderPeriodPill = (p: Period, label: string) => (
    <TouchableOpacity
      style={[
        styles.periodPill,
        { backgroundColor: period === p ? colors.primary : colors.card, borderColor: colors.border }
      ]}
      onPress={() => setPeriod(p)}
    >
      <Text style={{ color: period === p ? '#fff' : colors.text, fontWeight: '600' }}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + spacing.m }]} showsVerticalScrollIndicator={false}>
      <Text style={[styles.header, { color: colors.text }]}>Financial Insights</Text>
      
      {/* Period Selector */}
      <View style={styles.periodRow}>
        {renderPeriodPill('daily', 'Daily')}
        {renderPeriodPill('weekly', 'Weekly')}
        {renderPeriodPill('monthly', 'Monthly')}
        {renderPeriodPill('yearly', 'Yearly')}
      </View>

      {/* Summary Stats */}
      <View style={styles.summaryRow}>
        <Card style={[styles.summaryCard, { backgroundColor: colors.card }]}>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Income</Text>
          <Text style={{ color: '#4CAF50', fontSize: 18, fontWeight: '700' }}>+₹{stats.income.toLocaleString('en-IN')}</Text>
        </Card>
        <Card style={[styles.summaryCard, { backgroundColor: colors.card }]}>
          <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Expense</Text>
          <Text style={{ color: '#F44336', fontSize: 18, fontWeight: '700' }}>-₹{stats.expense.toLocaleString('en-IN')}</Text>
        </Card>
      </View>

      {/* Type Selector */}
      <View style={[styles.typeRow, { backgroundColor: colors.card }]}>
        {([
          { key: 'expense', label: 'Expenses' },
          { key: 'income', label: 'Income' },
          { key: 'all', label: 'Both' }
        ] as const).map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[
              styles.typeTab,
              { borderBottomColor: filterType === key ? colors.primary : 'transparent' }
            ]}
            onPress={() => setFilterType(key)}
          >
            <Text style={{ 
              color: filterType === key ? colors.primary : colors.textSecondary,
              fontWeight: filterType === key ? 'bold' : '500'
            }}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Card style={{ marginBottom: spacing.m }}>
        <Text style={[styles.cardTitle, { color: colors.text }]}>
          {filterType === 'all' ? 'Income vs Expense' : filterType === 'income' ? 'Income Breakdown' : 'Expense Breakdown'}
        </Text>
        {stats.breakdown.length > 0 ? (
          <PieChart
            data={stats.breakdown}
            width={screenWidth - spacing.m * 2 - 40}
            height={220}
            chartConfig={{
              color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
            }}
            accessor={"amount"}
            backgroundColor={"transparent"}
            paddingLeft={"15"}
            center={[10, 0]}
            absolute
          />
        ) : (
          <View style={styles.emptyChart}>
            <Ionicons name="pie-chart-outline" size={40} color={colors.textSecondary} />
            <Text style={{ color: colors.textSecondary, marginTop: spacing.s }}>No data for this period.</Text>
          </View>
        )}
      </Card>

      <Text style={[styles.header, { color: colors.text, fontSize: 20, marginTop: spacing.m }]}>AI Intelligence</Text>

      {stats.insights.patterns.length > 0 ? (
        <Card style={{ marginBottom: spacing.m }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.s }}>
            <Ionicons name="trending-up" size={20} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.text, marginLeft: spacing.s }]}>Spending Patterns</Text>
          </View>
          {stats.insights.patterns.map((p: string, i: number) => (
            <Text key={i} style={{ color: colors.textSecondary, marginBottom: spacing.xs }}>• {p}</Text>
          ))}
        </Card>
      ) : null}

      {stats.insights.suggestions.length > 0 ? (
        <Card style={{ marginBottom: spacing.m }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.s }}>
            <Ionicons name="bulb-outline" size={20} color={colors.primary} />
            <Text style={[styles.cardTitle, { color: colors.text, marginLeft: spacing.s }]}>Savings Suggestions</Text>
          </View>
          {stats.insights.suggestions.map((p: string, i: number) => (
            <Text key={i} style={{ color: colors.textSecondary, marginBottom: spacing.xs }}>• {p}</Text>
          ))}
        </Card>
      ) : null}

      {stats.insights.anomalies.length > 0 ? (
        <Card style={{ marginBottom: spacing.l }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.s }}>
            <Ionicons name="warning-outline" size={20} color={colors.error} />
            <Text style={[styles.cardTitle, { color: colors.error, marginLeft: spacing.s }]}>Anomalies Detected</Text>
          </View>
          {stats.insights.anomalies.map((p: string, i: number) => (
            <Text key={i} style={{ color: colors.textSecondary, marginBottom: spacing.xs }}>• {p}</Text>
          ))}
        </Card>
      ) : null}

      {!loading && stats.breakdown.length === 0 && (
        <View style={{ padding: spacing.xl, alignItems: 'center' }}>
          <Text style={{ color: colors.textSecondary, textAlign: 'center' }}>
            Not enough data in this period to generate detailed AI insights.
          </Text>
        </View>
      )}

    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.m,
  },
  header: {
    ...typography.header,
    marginBottom: spacing.m,
  },
  cardTitle: {
    ...typography.body,
    fontWeight: 'bold',
  },
  periodRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.m,
  },
  periodPill: {
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    borderRadius: 20,
    borderWidth: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.m,
    gap: spacing.s,
  },
  summaryCard: {
    flex: 1,
    padding: spacing.m,
    alignItems: 'center',
  },
  emptyChart: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
  },
  typeRow: {
    flexDirection: 'row',
    marginBottom: spacing.m,
    borderRadius: 12,
    overflow: 'hidden',
    padding: 2,
  },
  typeTab: {
    flex: 1,
    paddingVertical: spacing.s,
    alignItems: 'center',
    borderBottomWidth: 3,
  }
});
