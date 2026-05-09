import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert, Pressable } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { getCategories, getBudgets, getBudgetUsage, setBudget, getGoals, addGoal, updateGoalProgress, deleteGoal } from '../services/database';
import { useCurrency } from '../hooks/useCurrency';

export const BudgetScreen = () => {
  const { colors, spacing, typography, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const { format } = useCurrency();
  const [activeTab, setActiveTab] = useState<'budgets' | 'goals'>('budgets');
  
  const [budgetsData, setBudgetsData] = useState<any[]>([]);
  const [isBudgetModalVisible, setBudgetModalVisible] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [budgetLimitInput, setBudgetLimitInput] = useState('');

  const [goals, setGoals] = useState<any[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<any | null>(null);
  const [isGoalModalVisible, setGoalModalVisible] = useState(false);
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalDeadline, setGoalDeadline] = useState('');
  
  const [isProgressModalVisible, setProgressModalVisible] = useState(false);
  const [progressInput, setProgressInput] = useState('');

  const currentMonth = new Date().toISOString().slice(0, 7);

  const fetchData = async () => {
    try {
      if (activeTab === 'budgets') {
        const cats = await getCategories();
        const expenseCats = cats.filter((c: any) => c.type === 'expense');
        const budgets = await getBudgets(currentMonth);
        const data = [];
        for (const cat of expenseCats) {
          const budget = budgets.find((b: any) => b.category_id === cat.id);
          const usage = await getBudgetUsage(cat.id, currentMonth);
          const limit = budget ? budget.monthly_limit : 0;
          data.push({ category_id: cat.id, name: cat.name, limit, used: usage, remaining: limit > 0 ? limit - usage : 0, hasBudget: !!budget });
        }
        setBudgetsData(data);
      } else {
        setGoals(await getGoals());
      }
    } catch (error) { console.error(error); }
  };

  useFocusEffect(useCallback(() => { fetchData(); }, [activeTab]));

  const handleSaveBudget = async () => {
    if (!selectedCategoryId || !budgetLimitInput) return;
    try {
      await setBudget(selectedCategoryId, parseFloat(budgetLimitInput), currentMonth);
      setBudgetModalVisible(false);
      setBudgetLimitInput('');
      fetchData();
    } catch (error) { Alert.alert('Error', 'Failed to save budget'); }
  };

  const handleSaveGoal = async () => {
    if (!goalName || !goalTarget) return;
    try {
      await addGoal(goalName, parseFloat(goalTarget), goalDeadline || new Date().toISOString().split('T')[0]);
      setGoalModalVisible(false);
      setGoalName(''); setGoalTarget(''); setGoalDeadline('');
      fetchData();
    } catch (error) { Alert.alert('Error', 'Failed to add goal'); }
  };

  const handleAddProgress = async () => {
    if (!selectedGoal || !progressInput) return;
    try {
      await updateGoalProgress(selectedGoal.id, parseFloat(progressInput));
      setProgressModalVisible(false);
      setProgressInput('');
      setSelectedGoal(null);
      fetchData();
    } catch (error) { Alert.alert('Error', 'Failed to update progress'); }
  };

  const handleDeleteGoal = async (id: string) => {
    try {
      await deleteGoal(id);
      setSelectedGoal(null);
      fetchData();
    } catch (error) {
      Alert.alert('Error', 'Failed to delete goal');
    }
  };

  const renderBudgets = () => (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}>
      {budgetsData.map((item) => {
        const progress = item.limit > 0 ? Math.min(item.used / item.limit, 1) : 0;
        const pColor = progress >= 1 ? colors.error : progress >= 0.8 ? '#FF9800' : colors.primary;
        return (
          <Card key={item.category_id} variant="elevated" style={styles.budgetCard}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={[styles.catName, { color: colors.text }]}>{item.name}</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{item.hasBudget ? `${Math.round(progress * 100)}% utilized` : 'No budget set'}</Text>
              </View>
              <TouchableOpacity style={[styles.editBtn, { backgroundColor: colors.primaryContainer }]} onPress={() => { setSelectedCategoryId(item.category_id); setBudgetLimitInput(item.limit > 0 ? item.limit.toString() : ''); setBudgetModalVisible(true); }}>
                <Ionicons name="pencil" size={16} color={colors.primary} />
              </TouchableOpacity>
            </View>
            
            {item.hasBudget && (
              <>
                <View style={styles.progressContainer}>
                  <View style={[styles.progressBarBase, { backgroundColor: colors.border + '33' }]}>
                    <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: pColor }]} />
                  </View>
                </View>
                <View style={styles.statsRow}>
                  <View>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Used</Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>{format(item.used)}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Limit</Text>
                    <Text style={[styles.statValue, { color: colors.text }]}>{format(item.limit)}</Text>
                  </View>
                </View>
              </>
            )}
          </Card>
        );
      })}
    </ScrollView>
  );

  const renderGoals = () => (
    <View style={{ flex: 1 }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}>
        <TouchableOpacity style={[styles.newGoalBtn, { backgroundColor: colors.primaryContainer }]} onPress={() => setGoalModalVisible(true)}>
          <Ionicons name="add" size={24} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: '700', marginLeft: 8 }}>Create New Goal</Text>
        </TouchableOpacity>

        {goals.map((goal) => {
          const progress = goal.target_amount > 0 ? Math.min(goal.current_amount / goal.target_amount, 1) : 0;
          return (
            <TouchableOpacity key={goal.id} onPress={() => setSelectedGoal(goal)}>
              <Card variant="filled" style={styles.goalCard}>
                <View style={styles.goalInfo}>
                  <Text style={[styles.goalName, { color: colors.text }]}>{goal.name}</Text>
                  <Text style={[styles.goalPercent, { color: colors.primary }]}>{Math.round(progress * 100)}%</Text>
                </View>
                <View style={[styles.progressBarBase, { backgroundColor: colors.border + '33', height: 10 }]}>
                  <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: colors.primary }]} />
                </View>
                <View style={styles.goalFooter}>
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{format(goal.current_amount)} saved</Text>
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Target: {format(goal.target_amount)}</Text>
                </View>
              </Card>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  const renderGoalDetail = (goal: any) => {
    const progress = goal.target_amount > 0 ? Math.min(goal.current_amount / goal.target_amount, 1) : 0;
    return (
      <View style={{ flex: 1, paddingHorizontal: 20 }}>
        <TouchableOpacity style={styles.backBtn} onPress={() => setSelectedGoal(null)}>
          <Ionicons name="arrow-back" size={24} color={colors.primary} />
          <Text style={{ color: colors.primary, fontWeight: '700', marginLeft: 8 }}>Back to Goals</Text>
        </TouchableOpacity>
        
        <Card variant="elevated" style={styles.detailCard}>
          <Text style={[styles.detailTitle, { color: colors.text }]}>{goal.name}</Text>
          <View style={styles.detailProgress}>
            <Text style={[styles.detailPercent, { color: colors.primary }]}>{Math.round(progress * 100)}%</Text>
            <Text style={{ color: colors.textSecondary }}>{format(goal.current_amount)} / {format(goal.target_amount)}</Text>
          </View>
          <View style={[styles.progressBarBase, { backgroundColor: colors.border + '33', height: 16, borderRadius: 8 }]}>
            <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: colors.primary, borderRadius: 8 }]} />
          </View>
          <View style={styles.detailFooter}>
            <Button title="Add Funds" onPress={() => setProgressModalVisible(true)} style={{ flex: 1 }} />
            <TouchableOpacity style={[styles.deleteGoalBtn, { borderColor: colors.error }]} onPress={() => handleDeleteGoal(goal.id)}>
              <Ionicons name="trash-outline" size={20} color={colors.error} />
            </TouchableOpacity>
          </View>
        </Card>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + spacing.m }]}>
      <Text style={[styles.header, { color: colors.text, paddingHorizontal: 20 }]}>Planning</Text>

      <View style={[styles.tabBar, { backgroundColor: colors.card, marginHorizontal: 20 }]}>
        <TouchableOpacity style={[styles.tabItem, activeTab === 'budgets' && { backgroundColor: colors.primary }]} onPress={() => { setActiveTab('budgets'); setSelectedGoal(null); }}>
          <Text style={[styles.tabText, { color: activeTab === 'budgets' ? '#fff' : colors.textSecondary }]}>Budgets</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.tabItem, activeTab === 'goals' && { backgroundColor: colors.primary }]} onPress={() => setActiveTab('goals')}>
          <Text style={[styles.tabText, { color: activeTab === 'goals' ? '#fff' : colors.textSecondary }]}>Goals</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'budgets' ? renderBudgets() : (selectedGoal ? renderGoalDetail(selectedGoal) : renderGoals())}

      <Modal visible={isBudgetModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setBudgetModalVisible(false)}>
          <Card style={styles.modalCard}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Set Category Budget</Text>
            <TextInput style={[styles.modalInput, { backgroundColor: colors.background, color: colors.text }]} placeholder="Amount" placeholderTextColor={colors.textSecondary} keyboardType="numeric" value={budgetLimitInput} onChangeText={setBudgetLimitInput} autoFocus />
            <Button title="Save Budget" onPress={handleSaveBudget} style={{ marginTop: 24 }} />
          </Card>
        </Pressable>
      </Modal>

      <Modal visible={isGoalModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setGoalModalVisible(false)}>
          <Card style={styles.modalCard}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>New Savings Goal</Text>
            <TextInput style={[styles.modalInput, { backgroundColor: colors.background, color: colors.text, marginBottom: 12 }]} placeholder="What are you saving for?" placeholderTextColor={colors.textSecondary} value={goalName} onChangeText={setGoalName} />
            <TextInput style={[styles.modalInput, { backgroundColor: colors.background, color: colors.text }]} placeholder="Target Amount" placeholderTextColor={colors.textSecondary} keyboardType="numeric" value={goalTarget} onChangeText={setGoalTarget} />
            <Button title="Create Goal" onPress={handleSaveGoal} style={{ marginTop: 24 }} />
          </Card>
        </Pressable>
      </Modal>

      <Modal visible={isProgressModalVisible} transparent animationType="fade">
        <Pressable style={styles.modalOverlay} onPress={() => setProgressModalVisible(false)}>
          <Card style={styles.modalCard}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Add Progress</Text>
            <TextInput style={[styles.modalInput, { backgroundColor: colors.background, color: colors.text }]} placeholder="Contribution Amount" placeholderTextColor={colors.textSecondary} keyboardType="numeric" value={progressInput} onChangeText={setProgressInput} autoFocus />
            <Button title="Add to Goal" onPress={handleAddProgress} style={{ marginTop: 24 }} />
          </Card>
        </Pressable>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { fontSize: 32, fontWeight: '800', marginBottom: 20 },
  tabBar: { flexDirection: 'row', padding: 6, borderRadius: 16, marginBottom: 24 },
  tabItem: { flex: 1, paddingVertical: 10, borderRadius: 12, alignItems: 'center' },
  tabText: { fontSize: 14, fontWeight: '700' },
  budgetCard: { marginBottom: 16, padding: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  catName: { fontSize: 18, fontWeight: '700' },
  editBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  progressContainer: { marginBottom: 12 },
  progressBarBase: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between' },
  statLabel: { fontSize: 11, fontWeight: '600', marginBottom: 2 },
  statValue: { fontSize: 15, fontWeight: '700' },
  newGoalBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderRadius: 16, marginBottom: 24 },
  goalCard: { padding: 16, marginBottom: 16 },
  goalInfo: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  goalName: { fontSize: 16, fontWeight: '700' },
  goalPercent: { fontSize: 16, fontWeight: '800' },
  goalFooter: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12 },
  backBtn: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  detailCard: { padding: 24 },
  detailTitle: { fontSize: 24, fontWeight: '800', marginBottom: 8 },
  detailProgress: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 16 },
  detailPercent: { fontSize: 48, fontWeight: '900' },
  detailFooter: { flexDirection: 'row', gap: 12, marginTop: 32 },
  deleteGoalBtn: { width: 56, height: 56, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  modalCard: { padding: 24 },
  modalTitle: { fontSize: 20, fontWeight: '800', marginBottom: 20 },
  modalInput: { padding: 16, borderRadius: 12, fontSize: 16 },
});
