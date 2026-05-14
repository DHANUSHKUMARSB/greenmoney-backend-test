import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { Calendar } from "react-native-calendars";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { useCurrency } from "../hooks/useCurrency";
import { useTheme } from "../hooks/useTheme";
import { budgetEngine, BudgetWarning } from "../services/budgetEngine";
import {
  budgetFrequencyEngine,
  SpendingFrequency,
} from "../services/budgetFrequencyEngine";
import { budgetRuleEngine } from "../services/budgetRuleEngine";
import {
  addGoal,
  deleteBudget,
  deleteGoal,
  getAccounts,
  getBudgets,
  getBudgetUsage,
  getCategories,
  getGoals,
  getTotalIncomeForMonth,
  getTransactions,
  insertTransaction,
  setBudget,
  updateGoalProgress,
  updateTransaction,
} from "../services/database";
import { syncEvents } from "../services/syncEvents";
import { useAuthStore } from "../store/authStore";

const TODAY = new Date().toISOString().slice(0, 10);

export const BudgetScreen = () => {
  const { colors, spacing, typography, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const { format } = useCurrency();
  const [activeTab, setActiveTab] = useState<"budgets" | "goals">("budgets");

  if (
    Platform.OS === "android" &&
    UIManager.setLayoutAnimationEnabledExperimental
  ) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
  }

  const [viewMode, setViewMode] = useState<"daily" | "calendar" | "timeline">(
    "daily",
  );
  const [listStep, setListStep] = useState<"day" | "month" | "year">("month");
  const [currentDate, setCurrentDate] = useState(TODAY);

  const currentMonth = currentDate.slice(0, 7);
  const currentYear = currentDate.slice(0, 4);

  const [budgetsData, setBudgetsData] = useState<any[]>([]);
  const [isBudgetModalVisible, setBudgetModalVisible] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(
    null,
  );
  const [budgetLimitInput, setBudgetLimitInput] = useState("");
  const [recurrenceType, setRecurrenceType] = useState<
    "one_time" | "recurring"
  >("one_time");
  const [basePeriod, setBasePeriod] = useState<"daily" | "monthly" | "yearly">(
    "monthly",
  );
  const [amountType, setAmountType] = useState<"fixed" | "percentage">("fixed");
  const [percentageValue, setPercentageValue] = useState("");
  const [showPercentage, setShowPercentage] = useState(false);
  const [totalIncome, setTotalIncome] = useState(0);
  const [spendingFrequency, setSpendingFrequency] =
    useState<SpendingFrequency>("daily");
  const [frequencyConfig, setFrequencyConfig] = useState<any>({});
  const [activeHelp, setActiveHelp] = useState<{
    title: string;
    message: string;
  } | null>(null);
  const [budgetPeriod, setBudgetPeriod] = useState<"monthly" | "yearly">(
    "monthly",
  );
  const [budgetWarnings, setBudgetWarnings] = useState<BudgetWarning[]>([]);
  const [showWarningModal, setShowWarningModal] = useState(false);

  const [goals, setGoals] = useState<any[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<any | null>(null);
  const [isGoalModalVisible, setGoalModalVisible] = useState(false);
  const [goalName, setGoalName] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalDeadline, setGoalDeadline] = useState("");

  const [isProgressModalVisible, setProgressModalVisible] = useState(false);
  const [progressInput, setProgressInput] = useState("");
  const [goalContributions, setGoalContributions] = useState<any[]>([]);
  const [editingContribution, setEditingContribution] = useState<any>(null);

  const fetchData = async () => {
    try {
      // Always process for the current month
      await budgetRuleEngine.processMonthlyBudgets(currentMonth);

      const income = await getTotalIncomeForMonth(currentMonth);
      setTotalIncome(income);

      // Sync percentage budgets and check for warnings
      const userId = useAuthStore.getState().user?.uid;
      if (userId) {
        const warnings = await budgetEngine.syncBudgetsWithIncome(userId);
        if (warnings.length > 0 && activeTab === "budgets") {
          setBudgetWarnings(warnings);
          setShowWarningModal(true);
        }
      }

      if (activeTab === "budgets") {
        const cats = await getCategories();
        const expenseCats = cats.filter((c: any) => c.type === "expense");

        // 1. Get dynamically scaled budgets for the current view (day, month, or year)
        const activePeriod =
          listStep === "day"
            ? "daily"
            : listStep === "year"
              ? "yearly"
              : "monthly";
        const activeBudgets = await getBudgets(currentDate, activePeriod);

        const data = [];
        for (const cat of expenseCats) {
          const budget = activeBudgets.find((b) => b.category_id === cat.id);
          const usage = await getBudgetUsage(cat.id, currentDate, activePeriod);

          const limit = budget?.display_limit || 0;
          const pacing = budgetFrequencyEngine.calculatePacing(
            usage,
            limit,
            budget?.spending_frequency || "daily",
            listStep === "day"
              ? "daily"
              : listStep === "year"
                ? "yearly"
                : "monthly",
            currentDate,
            cat.name,
          );

          data.push({
            category_id: cat.id,
            name: cat.name,
            limit,
            used: usage,
            remaining: limit > 0 ? limit - usage : 0,
            hasBudget: limit > 0,
            amount_type: budget?.amount_type || "fixed",
            percentage_value: budget?.percentage_value,
            recurrence_type: budget?.recurrence_type || "one_time",
            base_period: budget?.period || "monthly",
            base_amount: budget?.amount || 0,
            spending_frequency: budget?.spending_frequency || "daily",
            pacing,
            is_system_generated: budget?.is_system_generated || false,
          });
        }
        setBudgetsData(data);
      } else {
        setGoals(await getGoals());
      }
    } catch (error) {
      console.error(error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
      const sub = () => fetchData();
      syncEvents.on("mutation_detected", sub);
      syncEvents.on("sync_completed", sub);
      return () => {
        syncEvents.off("mutation_detected", sub);
        syncEvents.off("sync_completed", sub);
      };
    }, [activeTab, currentDate, listStep]),
  );

  const navigateDate = (direction: "next" | "prev") => {
    const d = new Date(currentDate);
    if (listStep === "day")
      d.setDate(d.getDate() + (direction === "next" ? 1 : -1));
    else if (listStep === "month")
      d.setMonth(d.getMonth() + (direction === "next" ? 1 : -1));
    else if (listStep === "year")
      d.setFullYear(d.getFullYear() + (direction === "next" ? 1 : -1));
    setCurrentDate(d.toISOString().slice(0, 10));
  };

  const handleSaveBudget = async () => {
    if (!selectedCategoryId) return;

    let limit = parseFloat(budgetLimitInput);
    if (amountType === "percentage") {
      const p = parseFloat(percentageValue);
      if (isNaN(p)) return;
      limit = Math.round((totalIncome * p) / 100);
    }

    if (isNaN(limit)) return;

    try {
      await setBudget(selectedCategoryId, limit, currentDate, {
        period: basePeriod,
        recurrence_type: recurrenceType,
        spending_frequency: spendingFrequency,
        frequency_config: frequencyConfig,
        amount_type: amountType,
        percentage_value:
          amountType === "percentage" ? parseFloat(percentageValue) : undefined,
      });
      setBudgetModalVisible(false);
      resetBudgetModal();
      fetchData();
    } catch (error) {
      Alert.alert("Error", "Failed to save budget");
    }
  };

  const handleDeleteBudget = async () => {
    if (!selectedCategoryId) return;

    Alert.alert(
      "Clear Budget",
      "Are you sure you want to remove this budget? This will reset the limit for this category.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteBudget(selectedCategoryId, currentDate, basePeriod);
              setBudgetModalVisible(false);
              resetBudgetModal();
              fetchData();
            } catch (error) {
              Alert.alert("Error", "Failed to clear budget");
            }
          },
        },
      ],
    );
  };

  const resetBudgetModal = () => {
    setRecurrenceType("one_time");
    setBasePeriod("monthly");
    setAmountType("fixed");
    setPercentageValue("");
    setSpendingFrequency("daily");
    setFrequencyConfig({});
    setActiveHelp(null);
  };

  const handleSaveGoal = async () => {
    if (!goalName || !goalTarget) return;
    try {
      await addGoal(
        goalName,
        parseFloat(goalTarget),
        goalDeadline || new Date().toISOString().split("T")[0],
      );
      setGoalModalVisible(false);
      setGoalName("");
      setGoalTarget("");
      setGoalDeadline("");
      fetchData();
    } catch (error) {
      Alert.alert("Error", "Failed to add goal");
    }
  };

  const fetchGoalContributions = async (goal: any) => {
    if (!goal) return;
    try {
      const allTxs = await getTransactions();
      const contributions = allTxs
        .filter((t) => (t.note || "").trim() === `Goal: ${goal.name}`)
        .sort((a, b) => b.date.localeCompare(a.date));
      setGoalContributions(contributions);
    } catch (error) {
      console.error("[BUDGET]: Failed to fetch contributions:", error);
    }
  };

  useEffect(() => {
    if (selectedGoal) {
      fetchGoalContributions(selectedGoal);
    }
  }, [selectedGoal]);

  const handleAddProgress = async () => {
    if (!selectedGoal || !progressInput) return;
    try {
      const amount = parseFloat(progressInput);
      await updateGoalProgress(selectedGoal.id, amount);

      // Auto-create transaction for the goal contribution
      try {
        const accounts = await getAccounts();
        const primaryAccount = accounts[0]?.id || "1"; // Fallback to '1' if no accounts

        await insertTransaction({
          amount: amount,
          type: "expense",
          categoryId: "Goal", // Match default category name
          accountId: primaryAccount,
          date: new Date().toISOString().split("T")[0],
          note: `Goal: ${selectedGoal.name}`,
        });
      } catch (txError) {
        console.error(
          "[BUDGET]: Failed to auto-create goal transaction:",
          txError,
        );
      }

      setProgressModalVisible(false);
      setProgressInput("");

      // Update local state immediately for better UX
      if (selectedGoal) {
        const updatedGoal = {
          ...selectedGoal,
          current_amount: Number(selectedGoal.current_amount || 0) + amount,
        };
        setSelectedGoal(updatedGoal);
        fetchGoalContributions(updatedGoal);
      }

      fetchData();
    } catch (error) {
      Alert.alert("Error", "Failed to update progress");
    }
  };

  const handleEditContribution = async (tx: any, newAmount: number) => {
    try {
      const amount = Number(newAmount || 0);
      const diff = amount - Number(tx.amount || 0);

      console.log("[BUDGET]: Updating contribution...", {
        id: tx.id,
        amount,
        diff,
      });

      await updateTransaction(tx.id, {
        amount: amount,
        type: tx.type || "expense",
        categoryId: "Goal",
        accountId: tx.account_id || "1",
        date: tx.date || new Date().toISOString().slice(0, 10),
        note: tx.note,
      });

      if (selectedGoal) {
        await updateGoalProgress(selectedGoal.id, diff);
        // Update local selectedGoal state to reflect change immediately
        const updatedGoal = {
          ...selectedGoal,
          current_amount: Number(selectedGoal.current_amount || 0) + diff,
        };
        setSelectedGoal(updatedGoal);
        fetchGoalContributions(updatedGoal);
      }

      setEditingContribution(null);
      setProgressInput("");
      fetchData();
      if (selectedGoal) fetchGoalContributions(selectedGoal);
    } catch (error) {
      console.error("[BUDGET]: Edit contribution failed:", error);
      Alert.alert("Error", "Failed to update contribution");
    }
  };

  const handleResolveWarning = async (
    warning: BudgetWarning,
    action: "fixed" | "delete",
  ) => {
    try {
      if (action === "delete") {
        await deleteBudget(
          warning.budget.category_id,
          currentDate,
          warning.budget.period,
        );
      } else {
        // Switch to fixed amount (current calculated amount)
        await setBudget(
          warning.budget.category_id,
          warning.budget.amount,
          currentDate,
          {
            period: warning.budget.period,
            recurrence_type: warning.budget.recurrence_type,
            spending_frequency: warning.budget.spending_frequency,
            amount_type: "fixed",
          },
        );
      }

      const newWarnings = budgetWarnings.filter(
        (w) => w.budget.id !== warning.budget.id,
      );
      setBudgetWarnings(newWarnings);
      if (newWarnings.length === 0) setShowWarningModal(false);
      fetchData();
    } catch (e) {
      Alert.alert("Error", "Failed to resolve budget warning");
    }
  };

  const handleDeleteGoal = async (id: string) => {
    try {
      await deleteGoal(id);
      setSelectedGoal(null);
      fetchData();
    } catch (error) {
      Alert.alert("Error", "Failed to delete goal");
    }
  };

  const showHelp = (title: string, message: string) => {
    if (activeHelp?.title === title) {
      // Unmount: No animation for instant dismissal
      setActiveHelp(null);
    } else {
      // Mount: Smooth animation for the entrance
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
      setActiveHelp({ title, message });
    }
  };

  const renderBudgets = () => (
    <View style={{ paddingHorizontal: 20, paddingBottom: 100 }}>
      {budgetsData.length === 0 ? (
        <Card variant="filled" style={styles.emptyState}>
          <Ionicons
            name="receipt-outline"
            size={48}
            color={colors.textSecondary + "44"}
          />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No categories found.
          </Text>
        </Card>
      ) : (
        budgetsData.map((item) => {
          const progress =
            item.limit > 0 ? Math.min(item.used / item.limit, 1) : 0;
          const pacingStatus = item.pacing?.status || "healthy";
          const pColor =
            pacingStatus === "critical"
              ? colors.error
              : pacingStatus === "warning"
                ? "#FF9800"
                : colors.primary;
          return (
            <Card
              key={item.category_id}
              variant="elevated"
              style={[
                styles.budgetCard,
                pacingStatus === "critical" && {
                  borderColor: colors.error + "44",
                  borderWidth: 1,
                },
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <Text style={[styles.catName, { color: colors.text }]}>
                      {item.name}
                    </Text>
                    {item.recurrence_type === "recurring" && (
                      <Ionicons
                        name="repeat"
                        size={14}
                        color={colors.primary}
                      />
                    )}
                    <View
                      style={[
                        styles.badge,
                        {
                          backgroundColor:
                            item.base_period === "yearly"
                              ? colors.income + "15"
                              : colors.primary + "15",
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color:
                            item.base_period === "yearly"
                              ? colors.income
                              : colors.primary,
                          fontSize: 10,
                          fontWeight: "800",
                        }}
                      >
                        {item.base_period?.toUpperCase()}
                      </Text>
                    </View>
                    {item.recurrence_type === "one_time" && (
                      <View
                        style={[
                          styles.badge,
                          { backgroundColor: colors.textSecondary + "15" },
                        ]}
                      >
                        <Text
                          style={{
                            color: colors.textSecondary,
                            fontSize: 10,
                            fontWeight: "800",
                          }}
                        >
                          ONCE
                        </Text>
                      </View>
                    )}
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                      {item.hasBudget
                        ? showPercentage
                          ? `${Math.max(0, Math.round((1 - progress) * 100))}% remaining`
                          : `${format(item.remaining)} left`
                        : "No budget set"}
                    </Text>
                    {item.hasBudget && (
                      <TouchableOpacity
                        onPress={() => setShowPercentage(!showPercentage)}
                        style={{ marginLeft: 6, padding: 2 }}
                      >
                        <Ionicons
                          name="swap-horizontal-outline"
                          size={12}
                          color={colors.primary}
                        />
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {item.hasBudget && (
                    <TouchableOpacity
                      style={[
                        styles.editBtn,
                        { backgroundColor: colors.error + "15" },
                      ]}
                      onPress={() => {
                        setSelectedCategoryId(item.category_id);
                        setBasePeriod(item.base_period); // Set base period so handleDeleteBudget knows which one to delete
                        handleDeleteBudget();
                      }}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={16}
                        color={colors.error}
                      />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[
                      styles.editBtn,
                      { backgroundColor: colors.primaryContainer },
                    ]}
                    onPress={() => {
                      setSelectedCategoryId(item.category_id);
                      setBudgetLimitInput(
                        item.base_amount > 0 ? item.base_amount.toString() : "",
                      );
                      setAmountType(item.amount_type);
                      setPercentageValue(
                        item.percentage_value?.toString() || "",
                      );
                      setBasePeriod(item.base_period);
                      setRecurrenceType(item.recurrence_type);
                      // Suggest frequency if it's a new budget
                      if (!item.hasBudget) {
                        setSpendingFrequency(
                          budgetFrequencyEngine.getSuggestedFrequency(
                            item.name,
                          ),
                        );
                      } else {
                        setSpendingFrequency(
                          item.spending_frequency || "daily",
                        );
                      }
                      setBudgetModalVisible(true);
                    }}
                  >
                    <Ionicons name="pencil" size={16} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              </View>

              {item.hasBudget && (
                <>
                  <View style={styles.progressContainer}>
                    <View
                      style={[
                        styles.progressBarBase,
                        { backgroundColor: colors.border + "33" },
                      ]}
                    >
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${progress * 100}%`,
                            backgroundColor: pColor,
                          },
                        ]}
                      />
                    </View>
                  </View>
                  <View style={styles.statsRow}>
                    <View>
                      <Text
                        style={[
                          styles.statLabel,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Used
                      </Text>
                      <Text style={[styles.statValue, { color: colors.text }]}>
                        {format(item.used)}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text
                        style={[
                          styles.statLabel,
                          { color: colors.textSecondary },
                        ]}
                      >
                        Limit
                      </Text>
                      <Text style={[styles.statValue, { color: colors.text }]}>
                        {format(item.limit)}
                      </Text>
                    </View>
                  </View>
                </>
              )}
            </Card>
          );
        })
      )}
    </View>
  );

  const renderGoals = () => (
    <View style={{ paddingHorizontal: 20, paddingBottom: 100 }}>
      <TouchableOpacity
        style={[
          styles.newGoalBtn,
          { backgroundColor: colors.primaryContainer },
        ]}
        onPress={() => setGoalModalVisible(true)}
      >
        <Ionicons name="add" size={24} color={colors.primary} />
        <Text
          style={{ color: colors.primary, fontWeight: "700", marginLeft: 8 }}
        >
          Create New Goal
        </Text>
      </TouchableOpacity>

      {goals.map((goal) => {
        const progress =
          goal.target_amount > 0
            ? Math.min(goal.current_amount / goal.target_amount, 1)
            : 0;
        return (
          <TouchableOpacity key={goal.id} onPress={() => setSelectedGoal(goal)}>
            <Card variant="filled" style={styles.goalCard}>
              <View style={styles.goalInfo}>
                <Text style={[styles.goalName, { color: colors.text }]}>
                  {goal.name}
                </Text>
                <Text style={[styles.goalPercent, { color: colors.primary }]}>
                  {Math.round(progress * 100)}%
                </Text>
              </View>
              <View
                style={[
                  styles.progressBarBase,
                  { backgroundColor: colors.border + "33", height: 10 },
                ]}
              >
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${progress * 100}%`,
                      backgroundColor: colors.primary,
                    },
                  ]}
                />
              </View>
              <View style={styles.goalFooter}>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                  {format(goal.current_amount)} saved
                </Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                  Target: {format(goal.target_amount)}
                </Text>
              </View>
            </Card>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderGoalDetail = (goal: any) => {
    const progress =
      goal.target_amount > 0
        ? Math.min(goal.current_amount / goal.target_amount, 1)
        : 0;
    return (
      <View style={{ paddingHorizontal: 20, paddingBottom: 100 }}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => setSelectedGoal(null)}
        >
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
          <Text
            style={{ color: colors.primary, fontWeight: "700", marginLeft: 8 }}
          >
            Back to Goals
          </Text>
        </TouchableOpacity>

        <Card variant="elevated" style={styles.detailCard}>
          <Text style={[styles.detailTitle, { color: colors.text }]}>
            {goal.name}
          </Text>
          <View style={styles.detailProgress}>
            <Text style={[styles.detailPercent, { color: colors.primary }]}>
              {Math.round(progress * 100)}%
            </Text>
            <Text style={{ color: colors.textSecondary }}>
              {format(goal.current_amount)} / {format(goal.target_amount)}
            </Text>
          </View>
          <View
            style={[
              styles.progressBarBase,
              {
                backgroundColor: colors.border + "33",
                height: 16,
                borderRadius: 8,
              },
            ]}
          >
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progress * 100}%`,
                  backgroundColor: colors.primary,
                  borderRadius: 8,
                },
              ]}
            />
          </View>
          <View style={styles.detailFooter}>
            <Button
              title="Add Funds"
              onPress={() => setProgressModalVisible(true)}
              style={{ flex: 1 }}
            />
            <TouchableOpacity
              style={[styles.deleteGoalBtn, { borderColor: colors.error }]}
              onPress={() => handleDeleteGoal(goal.id)}
            >
              <Ionicons name="trash-outline" size={20} color={colors.error} />
            </TouchableOpacity>
          </View>
        </Card>

        <Text
          style={{
            marginTop: 32,
            marginBottom: 16,
            fontSize: 18,
            fontWeight: "800",
            color: colors.text,
          }}
        >
          Contribution History
        </Text>

        {goalContributions.length === 0 ? (
          <View style={{ padding: 32, alignItems: "center" }}>
            <Text style={{ color: colors.textSecondary }}>
              No contributions yet.
            </Text>
          </View>
        ) : (
          goalContributions.map((tx) => (
            <Card
              key={tx.id}
              variant="filled"
              style={{ marginBottom: 12, padding: 12 }}
            >
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <View>
                  <Text
                    style={{
                      color: colors.text,
                      fontWeight: "700",
                      fontSize: 15,
                    }}
                  >
                    {format(tx.amount)}
                  </Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 12 }}>
                    {tx.date}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setEditingContribution(tx);
                    setProgressInput(tx.amount.toString());
                    setProgressModalVisible(true);
                  }}
                  style={{
                    backgroundColor: colors.primary + "15",
                    padding: 12,
                    borderRadius: 12,
                  }}
                >
                  <Ionicons name="pencil" size={16} color={colors.primary} />
                </TouchableOpacity>
              </View>
            </Card>
          ))
        )}
      </View>
    );
  };

  const periodLabel = useMemo(() => {
    const d = new Date(currentDate);
    if (listStep === "day")
      return d.toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "short",
      });
    if (listStep === "month")
      return d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    return `Year ${currentYear}`;
  }, [currentDate, listStep]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: insets.top + spacing.m }}
      >
        <View
          style={{
            paddingHorizontal: 20,
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Text
            style={[styles.header, { color: colors.text, marginBottom: 0 }]}
          >
            Planning
          </Text>
        </View>

        {activeTab === "budgets" && (
          <View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.modeScroll}
            >
              {(
                [
                  { key: "daily", label: "Daily", icon: "list" },
                  { key: "calendar", label: "Calendar", icon: "calendar" },
                  { key: "timeline", label: "Timeline", icon: "time" },
                ] as any
              ).map((m: any) => (
                <TouchableOpacity
                  key={m.key}
                  onPress={() => setViewMode(m.key)}
                  style={[
                    styles.modeChip,
                    {
                      backgroundColor:
                        viewMode === m.key ? colors.primary : colors.card,
                    },
                  ]}
                >
                  <Ionicons
                    name={m.icon}
                    size={16}
                    color={viewMode === m.key ? "#fff" : colors.textSecondary}
                  />
                  <Text
                    style={[
                      styles.modeText,
                      {
                        color:
                          viewMode === m.key ? "#fff" : colors.textSecondary,
                      },
                    ]}
                  >
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {viewMode === "calendar" && (
              <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
                <Calendar
                  current={currentDate}
                  onDayPress={(day: any) => {
                    setCurrentDate(day.dateString);
                    setListStep("day");
                  }}
                  markedDates={{
                    [currentDate]: {
                      selected: true,
                      selectedColor: colors.primary,
                    },
                  }}
                  theme={{
                    calendarBackground: colors.card,
                    selectedDayBackgroundColor: colors.primary,
                    todayTextColor: colors.primary,
                    dayTextColor: colors.text,
                    monthTextColor: colors.text,
                    textDisabledColor: colors.textSecondary + "44",
                  }}
                  style={{ borderRadius: borderRadius.l, overflow: "hidden" }}
                />
              </View>
            )}

            <View
              style={[
                styles.stepContainer,
                { marginHorizontal: 20, marginBottom: 16 },
              ]}
            >
              {(["day", "month", "year"] as any).map((s: any) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setListStep(s)}
                  style={[
                    styles.stepChip,
                    {
                      backgroundColor:
                        listStep === s ? colors.primary + "20" : "transparent",
                      borderColor:
                        listStep === s ? colors.primary : "transparent",
                    },
                  ]}
                >
                  <Text
                    style={{
                      color:
                        listStep === s ? colors.primary : colors.textSecondary,
                      fontWeight: "700",
                      fontSize: 12,
                    }}
                  >
                    {s.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.periodNavigator}>
              <TouchableOpacity
                onPress={() => navigateDate("prev")}
                style={styles.navBtn}
              >
                <Ionicons
                  name="chevron-back"
                  size={24}
                  color={colors.primary}
                />
              </TouchableOpacity>
              <View style={styles.periodInfo}>
                <Text style={[styles.periodLabel, { color: colors.text }]}>
                  {periodLabel}
                </Text>
                {totalIncome > 0 && (
                  <Text
                    style={{
                      color: colors.income,
                      fontSize: 11,
                      fontWeight: "700",
                    }}
                  >
                    Income: {format(totalIncome)}
                  </Text>
                )}
              </View>
              <TouchableOpacity
                onPress={() => navigateDate("next")}
                style={styles.navBtn}
              >
                <Ionicons
                  name="chevron-forward"
                  size={24}
                  color={colors.primary}
                />
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View
          style={[
            styles.tabBar,
            { backgroundColor: colors.card, marginHorizontal: 20 },
          ]}
        >
          <TouchableOpacity
            style={[
              styles.tabItem,
              activeTab === "budgets" && { backgroundColor: colors.primary },
            ]}
            onPress={() => {
              setActiveTab("budgets");
              setSelectedGoal(null);
            }}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color:
                    activeTab === "budgets" ? "#fff" : colors.textSecondary,
                },
              ]}
            >
              Budgets
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabItem,
              activeTab === "goals" && { backgroundColor: colors.primary },
            ]}
            onPress={() => setActiveTab("goals")}
          >
            <Text
              style={[
                styles.tabText,
                {
                  color: activeTab === "goals" ? "#fff" : colors.textSecondary,
                },
              ]}
            >
              Goals
            </Text>
          </TouchableOpacity>
        </View>

        {activeTab === "budgets"
          ? renderBudgets()
          : selectedGoal
            ? renderGoalDetail(selectedGoal)
            : renderGoals()}
      </ScrollView>

      <Modal
        visible={isBudgetModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setBudgetModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              setBudgetModalVisible(false);
              setActiveHelp(null);
            }}
          />
          <Card style={styles.modalCard}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              Budget Configuration
            </Text>

            {activeHelp && (
              <View
                style={[
                  styles.helpCard,
                  {
                    backgroundColor: colors.primary + "15",
                    borderColor: colors.primary + "33",
                  },
                ]}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 6,
                    gap: 8,
                  }}
                >
                  <Ionicons
                    name="information-circle"
                    size={18}
                    color={colors.primary}
                  />
                  <Text
                    style={{
                      color: colors.primary,
                      fontWeight: "800",
                      fontSize: 13,
                      textTransform: "uppercase",
                    }}
                  >
                    {activeHelp.title}
                  </Text>
                </View>
                <Text
                  style={{
                    color: colors.text,
                    fontSize: 13,
                    lineHeight: 18,
                    opacity: 0.9,
                  }}
                >
                  {activeHelp.message}
                </Text>
                <TouchableOpacity
                  onPress={() => setActiveHelp(null)}
                  style={{ marginTop: 8, alignSelf: "flex-end" }}
                >
                  <Text
                    style={{
                      color: colors.primary,
                      fontWeight: "700",
                      fontSize: 12,
                    }}
                  >
                    DISMISS
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.optionRow}>
              <View style={styles.headerWithHelp}>
                <Text
                  style={[styles.optionLabel, { color: colors.textSecondary }]}
                >
                  This Budget is for
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    showHelp(
                      "Base Period",
                      'Defines the core timeframe of your budget. For example, setting ₹5000 as "Monthly" allows the app to automatically calculate your daily allowance (approx. ₹166/day).',
                    )
                  }
                >
                  <Ionicons
                    name="help-circle-outline"
                    size={16}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipGroup}
              >
                {(["daily", "monthly", "yearly"] as const).map((p) => (
                  <TouchableOpacity
                    key={p}
                    onPress={() => setBasePeriod(p)}
                    style={[
                      styles.chip,
                      basePeriod === p && { backgroundColor: colors.primary },
                    ]}
                  >
                    <Text
                      style={{
                        color: basePeriod === p ? "#fff" : colors.textSecondary,
                        fontWeight: "700",
                        fontSize: 12,
                      }}
                    >
                      {p.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.optionRow}>
              <View style={styles.headerWithHelp}>
                <Text
                  style={[styles.optionLabel, { color: colors.textSecondary }]}
                >
                  Repeat
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    showHelp(
                      "Repeat Type",
                      "One Time: Perfect for specific events or projects. Recurring: Automatically resets every period (Day, Month, or Year) to help you track ongoing habits.",
                    )
                  }
                >
                  <Ionicons
                    name="help-circle-outline"
                    size={16}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              </View>
              <View style={styles.chipGroup}>
                <TouchableOpacity
                  onPress={() => setRecurrenceType("one_time")}
                  style={[
                    styles.chip,
                    recurrenceType === "one_time" && {
                      backgroundColor: colors.primary,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color:
                        recurrenceType === "one_time"
                          ? "#fff"
                          : colors.textSecondary,
                      fontWeight: "700",
                      fontSize: 12,
                    }}
                  >
                    ONE TIME
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setRecurrenceType("recurring")}
                  style={[
                    styles.chip,
                    recurrenceType === "recurring" && {
                      backgroundColor: colors.primary,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color:
                        recurrenceType === "recurring"
                          ? "#fff"
                          : colors.textSecondary,
                      fontWeight: "700",
                      fontSize: 12,
                    }}
                  >
                    RECURRING
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.optionRow}>
              <View style={styles.headerWithHelp}>
                <Text
                  style={[styles.optionLabel, { color: colors.textSecondary }]}
                >
                  Spend for{" "}
                  {budgetsData.find((b) => b.category_id === selectedCategoryId)
                    ?.name || "this category"}
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    showHelp(
                      "Spending Frequency",
                      "Behavioral Pacing! Tells the app how often you actually spend in this category. Daily (like Food) assumes steady spending, while Occasionally (like Travel) allows for flexible progress bars without aggressive warnings.",
                    )
                  }
                >
                  <Ionicons
                    name="help-circle-outline"
                    size={16}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipGroup}
              >
                {(
                  [
                    "daily",
                    "weekly",
                    "biweekly",
                    "monthly",
                    "occasionally",
                    "custom",
                  ] as const
                ).map((f) => (
                  <TouchableOpacity
                    key={f}
                    onPress={() => setSpendingFrequency(f)}
                    style={[
                      styles.chip,
                      spendingFrequency === f && {
                        backgroundColor: colors.primary,
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color:
                          spendingFrequency === f
                            ? "#fff"
                            : colors.textSecondary,
                        fontWeight: "700",
                        fontSize: 10,
                      }}
                    >
                      {f.toUpperCase()}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            <View style={styles.optionRow}>
              <View style={styles.headerWithHelp}>
                <Text
                  style={[styles.optionLabel, { color: colors.textSecondary }]}
                >
                  Amount Type
                </Text>
                <TouchableOpacity
                  onPress={() =>
                    showHelp(
                      "Amount Type",
                      "Fixed: You set a specific currency limit. Percentage: The budget automatically adjusts as a percentage of your total monthly income—ideal for dynamic savings goals.",
                    )
                  }
                >
                  <Ionicons
                    name="help-circle-outline"
                    size={16}
                    color={colors.primary}
                  />
                </TouchableOpacity>
              </View>
              <View style={styles.chipGroup}>
                <TouchableOpacity
                  onPress={() => setAmountType("fixed")}
                  style={[
                    styles.chip,
                    amountType === "fixed" && {
                      backgroundColor: colors.primary,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color:
                        amountType === "fixed" ? "#fff" : colors.textSecondary,
                      fontWeight: "700",
                      fontSize: 12,
                    }}
                  >
                    FIXED
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setAmountType("percentage")}
                  style={[
                    styles.chip,
                    amountType === "percentage" && {
                      backgroundColor: colors.primary,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color:
                        amountType === "percentage"
                          ? "#fff"
                          : colors.textSecondary,
                      fontWeight: "700",
                      fontSize: 12,
                    }}
                  >
                    PERCENTAGE
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {amountType === "fixed" ? (
              <TextInput
                style={[
                  styles.modalInput,
                  {
                    backgroundColor: colors.background,
                    color: colors.text,
                    marginTop: 16,
                  },
                ]}
                placeholder={`Enter ${basePeriod} limit`}
                placeholderTextColor={colors.textSecondary}
                keyboardType="numeric"
                value={budgetLimitInput}
                onChangeText={setBudgetLimitInput}
              />
            ) : (
              <View style={{ marginTop: 16 }}>
                <TextInput
                  style={[
                    styles.modalInput,
                    { backgroundColor: colors.background, color: colors.text },
                  ]}
                  placeholder="Percentage (e.g. 10)"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="numeric"
                  value={percentageValue}
                  onChangeText={setPercentageValue}
                />
                <Text
                  style={{
                    color: colors.textSecondary,
                    fontSize: 12,
                    marginTop: 4,
                  }}
                >
                  {percentageValue
                    ? `Approx: ${format((totalIncome * parseFloat(percentageValue)) / 100 || 0)}`
                    : "Calculated based on income"}
                </Text>
              </View>
            )}

            <Button
              title="Save Budget"
              onPress={handleSaveBudget}
              style={{ marginTop: 32 }}
            />

            {budgetsData.find((b) => b.category_id === selectedCategoryId)
              ?.hasBudget && (
              <TouchableOpacity
                onPress={handleDeleteBudget}
                style={{ marginTop: 16, alignItems: "center", padding: 8 }}
              >
                <Text
                  style={{
                    color: colors.error,
                    fontWeight: "700",
                    fontSize: 14,
                  }}
                >
                  CLEAR BUDGET
                </Text>
              </TouchableOpacity>
            )}
          </Card>
        </View>
      </Modal>

      <Modal
        visible={isGoalModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setGoalModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setGoalModalVisible(false)}
          />
          <Card style={styles.modalCard}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              New Savings Goal
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: colors.background,
                  color: colors.text,
                  marginBottom: 12,
                },
              ]}
              placeholder="What are you saving for?"
              placeholderTextColor={colors.textSecondary}
              value={goalName}
              onChangeText={setGoalName}
            />
            <TextInput
              style={[
                styles.modalInput,
                { backgroundColor: colors.background, color: colors.text },
              ]}
              placeholder="Target Amount"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              value={goalTarget}
              onChangeText={setGoalTarget}
            />
            <Button
              title="Create Goal"
              onPress={handleSaveGoal}
              style={{ marginTop: 24 }}
            />
          </Card>
        </View>
      </Modal>

      <Modal
        visible={isProgressModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setProgressModalVisible(false);
          setEditingContribution(null);
          setProgressInput("");
        }}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              setProgressModalVisible(false);
              setEditingContribution(null);
              setProgressInput("");
            }}
          />
          <Card style={styles.modalCard}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {editingContribution ? "Edit Contribution" : "Add Progress"}
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                { backgroundColor: colors.background, color: colors.text },
              ]}
              placeholder="Amount"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              value={progressInput}
              onChangeText={setProgressInput}
              autoFocus
            />
            <Button
              title={editingContribution ? "Update Amount" : "Add to Goal"}
              onPress={() => {
                if (editingContribution) {
                  handleEditContribution(
                    editingContribution,
                    parseFloat(progressInput),
                  );
                } else {
                  handleAddProgress();
                }
              }}
              style={{ marginTop: 24 }}
            />
          </Card>
        </View>
      </Modal>

      {/* Budget Warning Modal */}
      <Modal visible={showWarningModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Card
            style={[
              styles.warningModalContent,
              { backgroundColor: colors.card },
            ]}
          >
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <View
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 24,
                  backgroundColor: colors.error + "15",
                  alignItems: "center",
                  justifyContent: "center",
                  marginRight: 16,
                }}
              >
                <Ionicons name="warning" size={24} color={colors.error} />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: "800",
                    color: colors.text,
                  }}
                >
                  Insufficient Income
                </Text>
                <Text style={{ fontSize: 13, color: colors.textSecondary }}>
                  Your income doesn't cover these budgets.
                </Text>
              </View>
            </View>

            <ScrollView style={{ maxHeight: 300, marginBottom: 20 }}>
              {budgetWarnings.map((warning, i) => (
                <View
                  key={i}
                  style={{
                    padding: 16,
                    backgroundColor: colors.background,
                    borderRadius: 16,
                    marginBottom: 12,
                    borderWidth: 1,
                    borderColor: colors.border + "33",
                  }}
                >
                  <Text
                    style={{
                      fontWeight: "800",
                      color: colors.text,
                      fontSize: 15,
                    }}
                  >
                    {warning.budget.category_name}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      color: colors.textSecondary,
                      marginTop: 4,
                    }}
                  >
                    Current Income: {format(warning.currentIncome)}
                  </Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary }}>
                    Target ({warning.budget.percentage_value}%):{" "}
                    {format(
                      (warning.currentIncome *
                        (warning.budget.percentage_value || 0)) /
                        100,
                    )}
                  </Text>

                  <View
                    style={{ flexDirection: "row", gap: 10, marginTop: 16 }}
                  >
                    <TouchableOpacity
                      onPress={() => handleResolveWarning(warning, "fixed")}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        backgroundColor: colors.primary,
                        borderRadius: 12,
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: "700",
                        }}
                      >
                        Keep Fixed
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleResolveWarning(warning, "delete")}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        backgroundColor: colors.error + "15",
                        borderRadius: 12,
                        alignItems: "center",
                      }}
                    >
                      <Text
                        style={{
                          color: colors.error,
                          fontSize: 12,
                          fontWeight: "700",
                        }}
                      >
                        Remove
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>

            <TouchableOpacity
              onPress={() => setShowWarningModal(false)}
              style={{ alignSelf: "center" }}
            >
              <Text style={{ color: colors.textSecondary, fontWeight: "600" }}>
                Dismiss
              </Text>
            </TouchableOpacity>
          </Card>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { fontSize: 32, fontWeight: "800", marginBottom: 20 },
  modeScroll: { flexDirection: "row", paddingHorizontal: 20, marginBottom: 16 },
  modeChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  modeText: { fontSize: 13, fontWeight: "600", marginLeft: 6 },
  stepContainer: {
    flexDirection: "row",
    gap: 8,
    padding: 4,
    backgroundColor: "#f0f0f0",
    borderRadius: 16,
  },
  stepChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  periodNavigator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  navBtn: { padding: 8 },
  periodInfo: { alignItems: "center" },
  periodLabel: { fontSize: 18, fontWeight: "800" },
  tabBar: {
    flexDirection: "row",
    padding: 6,
    borderRadius: 16,
    marginBottom: 24,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
  },
  tabText: { fontSize: 14, fontWeight: "700" },
  budgetCard: { marginBottom: 16, padding: 16 },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  catName: { fontSize: 18, fontWeight: "700" },
  badge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  editBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  progressContainer: { marginBottom: 12 },
  progressBarBase: { height: 8, borderRadius: 4, overflow: "hidden" },
  progressFill: { height: "100%", borderRadius: 4 },
  statsRow: { flexDirection: "row", justifyContent: "space-between" },
  statLabel: { fontSize: 11, fontWeight: "600", marginBottom: 2 },
  statValue: { fontSize: 15, fontWeight: "700" },
  emptyState: {
    padding: 40,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  emptyText: { fontSize: 14, fontWeight: "600" },
  newGoalBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
  },
  goalCard: { padding: 16, marginBottom: 16 },
  goalInfo: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  goalName: { fontSize: 16, fontWeight: "700" },
  goalPercent: { fontSize: 16, fontWeight: "800" },
  goalFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  backBtn: { flexDirection: "row", alignItems: "center", marginBottom: 20 },
  detailCard: { padding: 24 },
  detailTitle: { fontSize: 24, fontWeight: "800", marginBottom: 8 },
  detailProgress: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: 16,
  },
  detailPercent: { fontSize: 48, fontWeight: "900" },
  detailFooter: { flexDirection: "row", gap: 12, marginTop: 32 },
  deleteGoalBtn: {
    width: 56,
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    padding: 24,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingTop: 32,
  },
  modalTitle: { fontSize: 22, fontWeight: "900", marginBottom: 24 },
  modalInput: {
    padding: 16,
    borderRadius: 12,
    fontSize: 18,
    fontWeight: "700",
  },
  optionRow: { marginBottom: 20 },
  headerWithHelp: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
    paddingRight: 4,
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  helpCard: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 24,
    borderStyle: "dashed",
  },
  chipGroup: { flexDirection: "row", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: "#8882",
  },
  warningModalContent: {
    width: "90%",
    maxHeight: "80%",
    padding: 24,
    borderRadius: 32,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
  },
});
