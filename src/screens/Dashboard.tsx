import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Dimensions, TouchableOpacity } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LineChart } from 'react-native-chart-kit';
import { useTheme } from '../hooks/useTheme';
import { Card } from '../components/Card';
import { typography, spacing } from '../utils/theme';
import { getTransactions, getAccounts, getBudgets, getBudgetUsage } from '../services/database';
import { 
  getTotalBalance, 
  getTotalIncome, 
  getTotalExpense, 
  getMonthlySummary, 
  getWeeklyComparison 
} from '../services/analyticsService';
import { generateAllInsights } from '../services/insightsService';
import { useCurrency } from '../hooks/useCurrency';
import { syncEvents } from '../services/syncEvents';

const screenWidth = Dimensions.get('window').width;

export const DashboardScreen = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { format } = useCurrency();
  
  const [balance, setBalance] = useState(0);
  const [income, setIncome] = useState(0);
  const [expense, setExpense] = useState(0);
  const [recentTx, setRecentTx] = useState<any[]>([]);
  const [insightMessage, setInsightMessage] = useState('');
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [chartData, setChartData] = useState<any>(null);
  const [totalBudgetLimit, setTotalBudgetLimit] = useState(0);
  const [totalBudgetUsed, setTotalBudgetUsed] = useState(0);

  const fetchData = async () => {
    try {
      const transactions = await getTransactions();
      const accounts = await getAccounts();
      
      setBalance(getTotalBalance(transactions, accounts));
      setIncome(getTotalIncome(transactions));
      setExpense(getTotalExpense(transactions));
      setRecentTx(transactions.slice(0, 5));
      
      const weekly = getWeeklyComparison(transactions);
      setInsightMessage(weekly.message);

      const insights = generateAllInsights(transactions);
      setAiSuggestions(insights.suggestions);

      const summary = getMonthlySummary(transactions);
      setChartData(summary);

      const currentMonth = new Date().toISOString().slice(0, 7);
      const budgets = await getBudgets(currentMonth);
      let limitSum = 0;
      let usedSum = 0;
      for (const b of budgets) {
        limitSum += b.monthly_limit;
        const usage = await getBudgetUsage(b.category_id, currentMonth);
        usedSum += usage;
      }
      setTotalBudgetLimit(limitSum);
      setTotalBudgetUsed(usedSum);
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();

      // Listen for background sync completions
      const sub = () => {
        console.log('Dashboard: Sync detected, refreshing...');
        fetchData();
      };
      syncEvents.on('sync_completed', sub);
      return () => syncEvents.off('sync_completed', sub);
    }, [])
  );

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + spacing.m }]} showsVerticalScrollIndicator={false}>
      <Text style={[styles.header, { color: colors.text }]}>Dashboard</Text>
      
      <Card>
        <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>Total Balance</Text>
        <Text style={[styles.balance, { color: colors.text }]}>
          {format(balance)}
        </Text>
      </Card>

      <View style={styles.row}>
        <TouchableOpacity 
          style={styles.halfCardWrapper} 
          onPress={() => navigation.navigate('FilteredTransactions', { type: 'income' })}
        >
          <Card style={styles.halfCard}>
            <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>Income</Text>
            <Text style={[styles.income, { color: colors.primary }]}>
              +{format(income)}
            </Text>
          </Card>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.halfCardWrapper} 
          onPress={() => navigation.navigate('FilteredTransactions', { type: 'expense' })}
        >
          <Card style={styles.halfCard}>
            <Text style={[styles.cardTitle, { color: colors.textSecondary }]}>Expense</Text>
            <Text style={[styles.expense, { color: colors.error }]}>
              -{format(expense)}
            </Text>
          </Card>
        </TouchableOpacity>
      </View>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Insights</Text>
      <Card style={{ marginBottom: spacing.m }}>
        <Text style={{ color: colors.text, ...typography.body, fontWeight: 'bold' }}>
          💡 {insightMessage}
        </Text>
        {aiSuggestions.length > 0 && (
          <Text style={{ color: colors.primary, ...typography.body, marginTop: spacing.s }}>
            ✨ AI Suggestion: {aiSuggestions[0]}
          </Text>
        )}
      </Card>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Spending Trend</Text>
      {chartData && (
        <Card style={{ padding: 0, paddingVertical: spacing.m, overflow: 'hidden', marginBottom: spacing.m }}>
          <LineChart
            data={chartData}
            width={screenWidth - spacing.m * 2 - 2}
            height={220}
            chartConfig={{
              backgroundColor: colors.card,
              backgroundGradientFrom: colors.card,
              backgroundGradientTo: colors.card,
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(33, 150, 243, ${opacity})`,
              labelColor: (opacity = 1) => colors.textSecondary,
              style: { borderRadius: 16 },
              propsForDots: { r: '4', strokeWidth: '2', stroke: colors.primary }
            }}
            bezier
            style={{ marginVertical: 8, borderRadius: 16 }}
          />
        </Card>
      )}

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Budget Progress</Text>
      <Card style={{ marginBottom: spacing.m }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: spacing.xs }}>
          <Text style={{ color: colors.text }}>Monthly Budget</Text>
          <Text style={{ color: colors.textSecondary }}>{format(totalBudgetUsed)} / {format(totalBudgetLimit)}</Text>
        </View>
        <View style={{ height: 8, backgroundColor: colors.border, borderRadius: 4, overflow: 'hidden' }}>
          <View style={{ width: `${totalBudgetLimit > 0 ? Math.min(totalBudgetUsed / totalBudgetLimit, 1) * 100 : 0}%`, height: '100%', backgroundColor: totalBudgetUsed >= totalBudgetLimit ? colors.error : colors.primary }} />
        </View>
      </Card>

      <Text style={[styles.sectionTitle, { color: colors.text }]}>Recent Transactions</Text>
      <View style={{ paddingBottom: spacing.xxl }}>
        {recentTx.length === 0 ? (
          <Text style={{ color: colors.textSecondary }}>No recent transactions.</Text>
        ) : (
          recentTx.map(tx => (
            <TouchableOpacity 
              key={tx.id} 
              style={[styles.txItem, { borderBottomColor: colors.border }]}
              onPress={() => navigation.navigate('Main', { 
                screen: 'Transactions', 
                params: { initialDate: tx.date.split('T')[0], highlightId: tx.id } 
              })}
            >
              <View>
                <Text style={{ color: colors.text, fontWeight: 'bold' }}>
                  {tx.category_name || (tx.type === 'transfer' ? 'Transfer' : 'Uncategorized')}
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                  {new Date(tx.date).toLocaleDateString()}
                </Text>
              </View>
              <Text style={{ 
                color: tx.type === 'income' ? colors.primary : (tx.type === 'expense' ? colors.error : colors.text),
                fontWeight: 'bold'
              }}>
                {tx.type === 'income' ? '+' : (tx.type === 'expense' ? '-' : '')}{format(tx.amount)}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>

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
    marginBottom: spacing.xs,
  },
  balance: {
    ...typography.header,
    fontSize: 32,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.m,
    marginBottom: spacing.m,
  },
  halfCardWrapper: {
    flex: 0.48,
  },
  halfCard: {
    flex: 1,
  },
  income: {
    ...typography.title,
  },
  expense: {
    ...typography.title,
  },
  sectionTitle: {
    ...typography.title,
    marginBottom: spacing.s,
    marginTop: spacing.s,
  },
  txItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.m,
    borderBottomWidth: 1,
  }
});
