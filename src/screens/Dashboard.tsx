import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import {
  Animated,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Modal,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card } from "../components/Card";
import { FinanceCompanion } from "../components/FinanceCompanion";
import { FeedbackSheet } from "../components/FeedbackSheet";
import { ModernTrendChart } from "../components/ModernTrendChart";
import { useCurrency } from "../hooks/useCurrency";
import { useTheme } from "../hooks/useTheme";
import {
  getTotalBalance,
  getTotalExpense,
  getTotalIncome,
  getTrendData,
  getWeeklyComparison,
} from "../services/analyticsService";
import {
  getAccounts,
  getBudgets,
  getBudgetUsage,
  getTransactions,
} from "../services/database";
import { generateAllInsights } from "../services/insightsService";
import { MoodData, moodEngine } from "../services/moodEngine";
import { syncEvents } from "../services/syncEvents";
import { calculateSmartSurplus, SurplusData } from "../services/surplusBalanceEngine";
import { useAuthStore } from "../store/authStore";
import { useAppStore } from "../store";
import { spacing, typography } from "../utils/theme";
import { getRecurringTransactions, getGoals, insertTransaction } from "../services/database";

const screenWidth = Dimensions.get("window").width;

export const DashboardScreen = () => {
  const { colors, typography, spacing, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { format } = useCurrency();
  const { username } = useAuthStore();
  const { setActiveTab, hideBalance, hideIncome, hideExpense } = useAppStore();

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good Morning";
    if (hour < 18) return "Good Afternoon";
    return "Good Evening";
  };

  const [balance, setBalance] = useState(0);
  const [income, setIncome] = useState(0);
  const [expense, setExpense] = useState(0);
  const [recentTx, setRecentTx] = useState<any[]>([]);
  const [insightMessage, setInsightMessage] = useState("");
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [chartData, setChartData] = useState<any>(null);
  const [chartType, setChartType] = useState<"income" | "expense" | "balance">(
    "expense",
  );
  const [chartRange, setChartRange] = useState<any>("6M");
  const mountedRef = React.useRef(true);
  const [totalBudgetLimit, setTotalBudgetLimit] = useState(0);
  const [totalBudgetUsed, setTotalBudgetUsed] = useState(0);
  const [moodData, setMoodData] = useState<MoodData>({
    state: "neutral",
    score: 0,
    message: "Analyzing finances...",
  });
  const [surplusData, setSurplusData] = useState<SurplusData | null>(null);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [goals, setGoals] = useState<any[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<any>(null);
  const [isAllocating, setIsAllocating] = useState(false);
  const [showFeedbackSheet, setShowFeedbackSheet] = useState(false);

  const fetchData = async () => {
    try {
      const transactions = await getTransactions();
      const accounts = await getAccounts();

      if (!mountedRef.current) return;

      setBalance(getTotalBalance(transactions, accounts));
      setIncome(getTotalIncome(transactions));
      setExpense(getTotalExpense(transactions));
      setRecentTx(transactions.slice(0, 5));

      const weekly = getWeeklyComparison(transactions);
      setInsightMessage(weekly.message);

      const insights = generateAllInsights(transactions, format);
      setAiSuggestions(insights.suggestions);

      const trend = getTrendData(transactions, chartType, chartRange);
      if (trend && trend.datasets && trend.datasets[0].data.length > 0) {
        setChartData(trend);
      } else {
        setChartData(null);
      }

      const currentMonth = new Date().toISOString().slice(0, 7);
      const budgets = await getBudgets(currentMonth);
      let limitSum = 0;
      let usedSum = 0;
      for (const b of budgets) {
        limitSum += b.monthly_limit;
        const usage = await getBudgetUsage(b.category_id, currentMonth);
        usedSum += usage;
      }

      if (!mountedRef.current) return;
      setTotalBudgetLimit(limitSum);
      setTotalBudgetUsed(usedSum);

      const mood = await moodEngine.calculateMood(currentMonth);
      setMoodData(mood);

      const recurring = await getRecurringTransactions();
      const goalsList = await getGoals();
      setGoals(goalsList);
      
      const surplus = await calculateSmartSurplus(transactions, budgets, recurring, goalsList);
      setSurplusData(surplus);
    } catch (error) {
      console.error("Failed to fetch dashboard data:", error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      mountedRef.current = true;
      fetchData();

      const sub = () => fetchData();
      syncEvents.on("sync_completed", sub);
      syncEvents.on("mutation_detected", sub);
      return () => {
        mountedRef.current = false;
        syncEvents.off("sync_completed", sub);
        syncEvents.off("mutation_detected", sub);
      };
    }, [chartType, chartRange]),
  );

  const handleAllocateToGoal = async (goal: any) => {
    if (!surplusData) return;
    setIsAllocating(true);
    try {
      const amount = Math.floor(surplusData.savingsOpportunity);
      await insertTransaction({
        amount,
        type: 'expense',
        categoryId: 'Goal',
        date: new Date().toISOString(),
        note: `Smart surplus allocation to ${goal.name}`,
        accountId: 'default',
      });
      setShowGoalModal(false);
      fetchData();
    } catch (e) {
      console.error('Allocation failed:', e);
    } finally {
      setIsAllocating(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: insets.top + spacing.m,
          paddingBottom: 100,
        }}
        showsVerticalScrollIndicator={false}
      >
      <View style={{ paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <Text style={[styles.header, { color: colors.text }]}>Dashboard</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <TouchableOpacity 
            onPress={() => setShowFeedbackSheet(true)}
            style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.card, flexDirection: 'row', alignItems: 'center', gap: 6 }}
          >
            <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>Feedback</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            onPress={() => navigation.navigate('CloudSync')}
            style={{ padding: 8, borderRadius: 12, backgroundColor: colors.card }}
          >
            <Ionicons name="cloud-done-outline" size={22} color={colors.income} />
          </TouchableOpacity>
        </View>
      </View>

      <View style={{ paddingHorizontal: 20 }}>
        <Card variant="elevated" style={styles.mainCard}>
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View>
              <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>
                Total Balance
              </Text>
              <Text style={[styles.balance, { color: colors.text }]}>
                {hideBalance ? "****" : format(balance)}
              </Text>
            </View>
            <View
              style={[
                styles.iconBox,
                { backgroundColor: colors.primaryContainer },
              ]}
            >
              <Ionicons name="wallet" size={24} color={colors.primary} />
            </View>
          </View>
        </Card>

        <FinanceCompanion mood={moodData.state} message={moodData.message} />

        <View style={styles.row}>
          <Card
            variant="filled"
            style={[
              styles.halfCard,
              { backgroundColor: colors.primaryContainer },
            ]}
          >
            <Text style={[styles.cardLabelSmall, { color: colors.primary }]}>
              Income
            </Text>
            <Text style={[styles.income, { color: colors.primary }]}>
              {hideIncome ? "****" : `+${format(income)}`}
            </Text>
          </Card>
          <Card
            variant="filled"
            style={[styles.halfCard, { backgroundColor: "#FDECEB" }]}
          >
            <Text style={[styles.cardLabelSmall, { color: colors.expense }]}>
              Expense
            </Text>
            <Text style={[styles.expense, { color: colors.expense }]}>
              {hideExpense ? "****" : `-${format(expense)}`}
            </Text>
          </Card>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 0 }]}>
            Surplus Intelligence
          </Text>
          <View style={{ backgroundColor: (surplusData?.status === 'excellent' || surplusData?.status === 'good') ? colors.success + '20' : colors.warning + '20', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
            <Text style={{ fontSize: 11, fontWeight: '800', color: (surplusData?.status === 'excellent' || surplusData?.status === 'good') ? colors.success : colors.warning }}>
              {surplusData?.status.toUpperCase()}
            </Text>
          </View>
        </View>

        <Card variant="elevated" style={[styles.surplusCard, { backgroundColor: colors.card }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
            <View style={[styles.surplusIcon, { backgroundColor: colors.primary + '15' }]}>
              <Ionicons name="sparkles" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: colors.textSecondary }}>Safe to Spend</Text>
              <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text }}>{format(surplusData?.safeToSpend || 0)}</Text>
            </View>
            <TouchableOpacity 
              onPress={() => setShowGoalModal(true)}
              style={{ backgroundColor: colors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14 }}
            >
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>Add to Goals</Text>
            </TouchableOpacity>
          </View>

          <View style={{ padding: 16, backgroundColor: colors.background, borderRadius: 16, borderWidth: 1, borderColor: colors.border + '33' }}>
            <Text style={{ fontSize: 14, color: colors.text, lineHeight: 20, fontWeight: '500' }}>
              {surplusData?.recommendation}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, marginBottom: 4 }}>WEEKLY SURPLUS</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{format(surplusData?.weeklySurplus || 0)}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.textSecondary, marginBottom: 4 }}>SAVINGS POTENTIAL</Text>
              <Text style={{ fontSize: 16, fontWeight: '700', color: colors.success }}>{format(surplusData?.savingsOpportunity || 0)}</Text>
            </View>
          </View>
        </Card>

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Financial Insights
        </Text>
        <ModernTrendChart
          data={chartData}
          type={chartType}
          range={chartRange}
          onTypeChange={setChartType}
          onRangeChange={setChartRange}
          insight={insightMessage}
        />

        <View style={styles.sectionHeader}>
          <Text
            style={[styles.sectionTitle, { color: colors.text, marginTop: 0 }]}
          >
            Recent Activities
          </Text>
          <TouchableOpacity
            onPress={() => {
              setActiveTab(1);
              navigation.navigate("Main");
            }}
            style={{ 
              flexDirection: 'row', 
              alignItems: 'center', 
              backgroundColor: colors.primary + '15',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 20,
              gap: 4
            }}
          >
            <Text style={{ color: colors.primary, fontWeight: "700", fontSize: 13 }}>
              See all
            </Text>
            <Ionicons name="chevron-forward" size={16} color={colors.primary} />
          </TouchableOpacity>
        </View>

        {recentTx.length === 0 ? (
          <Text
            style={{
              color: colors.textSecondary,
              textAlign: "center",
              marginTop: spacing.m,
            }}
          >
            No recent transactions.
          </Text>
        ) : (
          recentTx.map((tx) => {
            const scale = new Animated.Value(1);
            const onPressIn = () => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true }).start();
            const onPressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();

            return (
              <Animated.View key={tx.id} style={{ transform: [{ scale }] }}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPressIn={onPressIn}
                  onPressOut={onPressOut}
                  style={[
                    styles.txItem,
                    { 
                      borderBottomColor: colors.border + "33",
                      backgroundColor: colors.card + '50',
                      paddingHorizontal: 12,
                      borderRadius: 16,
                      marginBottom: 8
                    },
                  ]}
                  onPress={() => {
                    setActiveTab(1); // Switch to Transactions tab
                    navigation.navigate("Main", {
                      initialDate: tx.date.split("T")[0],
                      highlightId: tx.id,
                      source: 'dashboard'
                    });
                  }}
                >
                  <View
                    style={[styles.iconCircle, { backgroundColor: colors.background }]}
                  >
                    <Ionicons
                      name={
                        tx.type === "income"
                          ? "arrow-down"
                          : tx.type === "expense"
                            ? "arrow-up"
                            : "swap-horizontal"
                      }
                      size={18}
                      color={
                        tx.type === "income"
                          ? colors.income
                          : tx.type === "expense"
                            ? colors.expense
                            : colors.text
                      }
                    />
                  </View>
                  <View style={{ flex: 1, marginLeft: spacing.m }}>
                    <Text style={[styles.txTitle, { color: colors.text }]} numberOfLines={1}>
                      {tx.note || tx.category_name ||
                        (tx.type === "transfer" ? "Transfer" : "Uncategorized")}
                    </Text>
                    <Text style={[styles.txDate, { color: colors.textSecondary }]}>
                      {new Date(tx.date).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </Text>
                  </View>
                  <Text
                    style={[
                      styles.txAmount,
                      {
                        color:
                          tx.type === "income"
                            ? colors.income
                            : tx.type === "expense"
                              ? colors.expense
                              : colors.text,
                      },
                    ]}
                  >
                    {tx.type === "income" ? "+" : tx.type === "expense" ? "-" : ""}
                    {tx.type === 'income' && hideIncome ? "****" : (tx.type === 'expense' && hideExpense ? "****" : format(tx.amount))}
                  </Text>
                </TouchableOpacity>
              </Animated.View>
            );
          })
        )}
      </View>
    </ScrollView>

      <View style={[styles.fabContainer, { bottom: insets.bottom + 20 }]}>
        <TouchableOpacity 
          style={[styles.fab, { backgroundColor: colors.primary }]} 
          onPress={() => navigation.navigate('AddTransaction')}
          activeOpacity={0.8}
        >
          <Ionicons name="add" size={32} color="white" />
        </TouchableOpacity>
      </View>

      <Modal visible={showGoalModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <Card style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={{ width: 40, height: 4, backgroundColor: colors.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />
            <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>Allocate Surplus</Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary, marginTop: 4, marginBottom: 24 }}>
              Suggested: {format(surplusData?.savingsOpportunity || 0)}
            </Text>

            <ScrollView style={{ maxHeight: 300 }}>
              {goals.length === 0 ? (
                <Text style={{ textAlign: 'center', color: colors.textSecondary, marginVertical: 20 }}>
                  No active goals found. Create one first!
                </Text>
              ) : (
                goals.map(goal => (
                  <TouchableOpacity 
                    key={goal.id} 
                    onPress={() => handleAllocateToGoal(goal)}
                    disabled={isAllocating}
                    style={{ 
                      flexDirection: 'row', 
                      alignItems: 'center', 
                      padding: 16, 
                      backgroundColor: colors.background, 
                      borderRadius: 16, 
                      marginBottom: 12,
                      borderWidth: 1,
                      borderColor: colors.border + '33'
                    }}
                  >
                    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary + '20', alignItems: 'center', justifyContent: 'center' }}>
                      <Ionicons name="flag" size={20} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={{ fontWeight: '700', color: colors.text }}>{goal.name}</Text>
                      <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                        {Math.round((goal.current_amount / goal.target_amount) * 100)}% complete
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={colors.border} />
                  </TouchableOpacity>
                ))
              )}
            </ScrollView>

            <TouchableOpacity 
              onPress={() => setShowGoalModal(false)}
              style={{ marginTop: 20, alignSelf: 'center', padding: 10 }}
            >
              <Text style={{ color: colors.textSecondary, fontWeight: '600' }}>Maybe Later</Text>
            </TouchableOpacity>
          </Card>
        </View>
      </Modal>
      <FeedbackSheet 
        isVisible={showFeedbackSheet} 
        onClose={() => setShowFeedbackSheet(false)} 
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  greeting: { fontSize: 16, fontWeight: "500" },
  header: {
    ...typography.header,
    marginBottom: spacing.m,
  },
  header: { fontSize: 32, fontWeight: "700", letterSpacing: -1 },
  mainCard: { marginBottom: 20 },
  cardLabel: { fontSize: 14, fontWeight: "600", marginBottom: 4 },
  balance: { fontSize: 36, fontWeight: "800", letterSpacing: -1 },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  halfCard: { flex: 0.48, padding: 16, marginBottom: 0 },
  cardLabelSmall: { fontSize: 13, fontWeight: "700", marginBottom: 4 },
  income: { fontSize: 18, fontWeight: "700" },
  expense: { fontSize: 18, fontWeight: "700" },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginTop: 24,
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 24,
    marginBottom: 12,
  },
  chartCard: { padding: 0, alignItems: "center" },
  budgetCard: { padding: 20 },
  budgetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  bodyText: { fontSize: 15, fontWeight: "600" },
  bodyTextSmall: { fontSize: 13, fontWeight: "500" },
  progressBar: { height: 10, borderRadius: 5, overflow: "hidden" },
  txItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  txTitle: { fontSize: 16, fontWeight: "600" },
  txDate: { fontSize: 13 },
  txAmount: { fontSize: 16, fontWeight: "700" },
  fabContainer: { 
    position: 'absolute', 
    right: 20, 
    zIndex: 99 
  },
  fab: { 
    width: 64, 
    height: 64, 
    borderRadius: 32, 
    alignItems: "center", 
    justifyContent: "center", 
    elevation: 6, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 3 }, 
    shadowOpacity: 0.3, 
    shadowRadius: 4 
  },
  surplusCard: { padding: 20, marginBottom: 20 },
  surplusIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
});
