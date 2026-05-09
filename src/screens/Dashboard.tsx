import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import React, { useCallback, useState } from "react";
import {
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { LineChart } from "react-native-chart-kit";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card } from "../components/Card";
import { useCurrency } from "../hooks/useCurrency";
import { useTheme } from "../hooks/useTheme";
import {
  getMonthlySummary,
  getTotalBalance,
  getTotalExpense,
  getTotalIncome,
  getWeeklyComparison,
} from "../services/analyticsService";
import {
  getAccounts,
  getBudgets,
  getBudgetUsage,
  getTransactions,
} from "../services/database";
import { generateAllInsights } from "../services/insightsService";
import { syncEvents } from "../services/syncEvents";
import { useAuthStore } from "../store/authStore";
import { spacing, typography } from "../utils/theme";

const screenWidth = Dimensions.get("window").width;

export const DashboardScreen = () => {
  const { colors, typography, spacing, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { format } = useCurrency();
  const { username } = useAuthStore();

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
  const mountedRef = React.useRef(true);
  const [totalBudgetLimit, setTotalBudgetLimit] = useState(0);
  const [totalBudgetUsed, setTotalBudgetUsed] = useState(0);

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

      const insights = generateAllInsights(transactions);
      setAiSuggestions(insights.suggestions);

      const summary = getMonthlySummary(transactions);
      if (summary && summary.datasets && summary.datasets[0].data.length > 0) {
        setChartData(summary);
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
      return () => {
        mountedRef.current = false;
        syncEvents.off("sync_completed", sub);
      };
    }, []),
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.m,
        paddingBottom: 100,
      }}
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingHorizontal: 20 }}>
        <Text style={[styles.header, { color: colors.text }]}>Dashboard</Text>
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
                {format(balance)}
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
              +{format(income)}
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
              -{format(expense)}
            </Text>
          </Card>
        </View>

        {chartData && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Spending Trend
            </Text>
            <Card variant="outlined" style={styles.chartCard}>
              <LineChart
                data={chartData}
                width={screenWidth - spacing.m * 4}
                height={180}
                chartConfig={{
                  backgroundColor: colors.background,
                  backgroundGradientFrom: colors.background,
                  backgroundGradientTo: colors.background,
                  decimalPlaces: 0,
                  color: (opacity = 1) => colors.primary,
                  labelColor: (opacity = 1) => colors.textSecondary,
                  style: { borderRadius: 16 },
                  propsForDots: {
                    r: "4",
                    strokeWidth: "2",
                    stroke: colors.primary,
                  },
                  propsForLabels: { fontSize: 10 },
                }}
                bezier
                withVerticalLines={false}
                withHorizontalLines={false}
                style={{ borderRadius: 16, marginTop: spacing.s }}
              />
            </Card>
          </>
        )}

        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Budget Progress
        </Text>
        <Card variant="filled" style={styles.budgetCard}>
          <View style={styles.budgetHeader}>
            <Text style={[styles.bodyText, { color: colors.text }]}>
              Monthly Budget
            </Text>
            <Text
              style={[styles.bodyTextSmall, { color: colors.textSecondary }]}
            >
              {Math.round((totalBudgetUsed / totalBudgetLimit) * 100 || 0)}%
              used
            </Text>
          </View>
          <View
            style={[
              styles.progressBar,
              { backgroundColor: colors.border + "33" },
            ]}
          >
            <View
              style={{
                width: `${totalBudgetLimit > 0 ? Math.min(totalBudgetUsed / totalBudgetLimit, 1) * 100 : 0}%`,
                height: "100%",
                backgroundColor:
                  totalBudgetUsed >= totalBudgetLimit
                    ? colors.error
                    : colors.primary,
                borderRadius: borderRadius.full,
              }}
            />
          </View>
          <Text
            style={[
              styles.bodyTextSmall,
              { color: colors.textSecondary, marginTop: spacing.s },
            ]}
          >
            {format(totalBudgetUsed)} of {format(totalBudgetLimit)}
          </Text>
        </Card>

        <View style={styles.sectionHeader}>
          <Text
            style={[styles.sectionTitle, { color: colors.text, marginTop: 0 }]}
          >
            Recent Activities
          </Text>
          <TouchableOpacity
            onPress={() =>
              navigation.navigate("Main", { screen: "Transactions" })
            }
          >
            <Text style={{ color: colors.primary, fontWeight: "600" }}>
              See all
            </Text>
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
          recentTx.map((tx) => (
            <TouchableOpacity
              key={tx.id}
              style={[
                styles.txItem,
                { borderBottomColor: colors.border + "33" },
              ]}
              onPress={() =>
                navigation.navigate("Main", {
                  screen: "Transactions",
                  params: {
                    initialDate: tx.date.split("T")[0],
                    highlightId: tx.id,
                  },
                })
              }
            >
              <View
                style={[styles.iconCircle, { backgroundColor: colors.card }]}
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
                <Text style={[styles.txTitle, { color: colors.text }]}>
                  {tx.category_name ||
                    (tx.type === "transfer" ? "Transfer" : "Uncategorized")}
                </Text>
                <Text style={[styles.txDate, { color: colors.textSecondary }]}>
                  {new Date(tx.date).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
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
                {format(tx.amount)}
              </Text>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
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
});
