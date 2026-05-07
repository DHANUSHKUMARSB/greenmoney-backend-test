import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { typography, spacing } from '../utils/theme';
import { Card } from '../components/Card';
import { getCategories, getBudgets, getBudgetUsage, setBudget, getGoals, addGoal, updateGoalProgress, deleteGoal } from '../services/database';
import { useCurrency } from '../hooks/useCurrency';

export const BudgetScreen = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { format } = useCurrency();
  const [activeTab, setActiveTab] = useState<'budgets' | 'goals'>('budgets');
  
  // Budgets state
  const [budgetsData, setBudgetsData] = useState<any[]>([]);
  const [isBudgetModalVisible, setBudgetModalVisible] = useState(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [budgetLimitInput, setBudgetLimitInput] = useState('');

  // Goals state
  const [goals, setGoals] = useState<any[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<any | null>(null);
  const [isGoalModalVisible, setGoalModalVisible] = useState(false);
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalDeadline, setGoalDeadline] = useState('');
  
  const [isProgressModalVisible, setProgressModalVisible] = useState(false);
  const [progressInput, setProgressInput] = useState('');

  const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

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
          data.push({
            category_id: cat.id,
            name: cat.name,
            limit: limit,
            used: usage,
            remaining: limit > 0 ? limit - usage : 0,
            hasBudget: !!budget
          });
        }
        setBudgetsData(data);
      } else {
        const g = await getGoals();
        setGoals(g);
      }
    } catch (error) {
      console.error(error);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [activeTab])
  );

  const handleSaveBudget = async () => {
    if (!selectedCategoryId || !budgetLimitInput) return;
    try {
      await setBudget(selectedCategoryId, parseFloat(budgetLimitInput), currentMonth);
      setBudgetModalVisible(false);
      setBudgetLimitInput('');
      fetchData();
    } catch (error) {
      Alert.alert('Error', 'Failed to save budget');
    }
  };

  const handleSaveGoal = async () => {
    if (!goalName || !goalTarget) return;
    try {
      await addGoal(goalName, parseFloat(goalTarget), goalDeadline || new Date().toISOString().split('T')[0]);
      setGoalModalVisible(false);
      setGoalName('');
      setGoalTarget('');
      setGoalDeadline('');
      fetchData();
    } catch (error) {
      Alert.alert('Error', 'Failed to add goal');
    }
  };

  const handleAddProgress = async () => {
    if (!selectedGoal || !progressInput) return;
    try {
      await updateGoalProgress(selectedGoal.id, parseFloat(progressInput));
      setProgressModalVisible(false);
      setProgressInput('');
      setSelectedGoal(null); // Return to goals list to refresh
      fetchData();
    } catch (error) {
      Alert.alert('Error', 'Failed to update progress');
    }
  };

  const handleDeleteGoal = async (id: number) => {
    try {
      await deleteGoal(id);
      setSelectedGoal(null);
      fetchData();
    } catch (error) {
      Alert.alert('Error', 'Failed to delete goal');
    }
  };

  const renderBudgets = () => (
    <ScrollView showsVerticalScrollIndicator={false}>
      {budgetsData.map((item) => {
        const progress = item.limit > 0 ? Math.min(item.used / item.limit, 1) : 0;
        const progressColor = progress >= 1 ? colors.error : progress >= 0.8 ? '#FF9800' : colors.primary;
        return (
          <Card key={item.category_id} style={{ marginBottom: spacing.m }}>
            <View style={styles.cardHeader}>
              <Text style={{ color: colors.text, ...typography.title }}>{item.name}</Text>
              <TouchableOpacity onPress={() => {
                setSelectedCategoryId(item.category_id);
                setBudgetLimitInput(item.limit > 0 ? item.limit.toString() : '');
                setBudgetModalVisible(true);
              }}>
                <Ionicons name="pencil" size={20} color={colors.primary} />
              </TouchableOpacity>
            </View>
            
            {!item.hasBudget ? (
              <Text style={{ color: colors.textSecondary }}>No budget set.</Text>
            ) : (
              <>
                <View style={styles.budgetRow}>
                  <Text style={{ color: colors.textSecondary }}>Used: {format(item.used)}</Text>
                  <Text style={{ color: colors.textSecondary }}>Limit: {format(item.limit)}</Text>
                </View>
                <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                  <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: progressColor }]} />
                </View>
                <View style={styles.budgetRow}>
                  <Text style={{ color: colors.textSecondary }}>Remaining: {format(Math.max(item.remaining, 0))}</Text>
                </View>
                {progress >= 1 && <Text style={{ color: colors.error, marginTop: spacing.xs, fontWeight: 'bold' }}>⚠️ Budget Exceeded!</Text>}
                {progress >= 0.8 && progress < 1 && <Text style={{ color: '#FF9800', marginTop: spacing.xs, fontWeight: 'bold' }}>⚠️ Near Limit</Text>}
              </>
            )}
          </Card>
        );
      })}
    </ScrollView>
  );

  const renderGoals = () => {
    if (selectedGoal) {
      return renderGoalDetail();
    }

    return (
      <View style={{ flex: 1 }}>
        <TouchableOpacity 
          style={[styles.addButton, { backgroundColor: colors.primary }]}
          onPress={() => setGoalModalVisible(true)}
        >
          <Text style={{ color: '#fff', fontWeight: 'bold' }}>+ New Goal</Text>
        </TouchableOpacity>

        <ScrollView showsVerticalScrollIndicator={false}>
          {goals.map((goal) => {
            const progress = goal.target_amount > 0 ? Math.min(goal.current_amount / goal.target_amount, 1) : 0;
            return (
              <TouchableOpacity key={goal.id} onPress={() => setSelectedGoal(goal)}>
                <Card style={{ marginBottom: spacing.m }}>
                  <Text style={{ color: colors.text, ...typography.title }}>{goal.name}</Text>
                  <View style={styles.budgetRow}>
                    <Text style={{ color: colors.textSecondary }}>{format(goal.current_amount)} / {format(goal.target_amount)}</Text>
                    <Text style={{ color: colors.textSecondary }}>{(progress * 100).toFixed(0)}%</Text>
                  </View>
                  <View style={[styles.progressBar, { backgroundColor: colors.border }]}>
                    <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: colors.primary }]} />
                  </View>
                  {goal.deadline && (
                    <Text style={{ color: colors.textSecondary, marginTop: spacing.xs, fontSize: 12 }}>Deadline: {goal.deadline}</Text>
                  )}
                </Card>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  const renderGoalDetail = () => {
    const progress = selectedGoal.target_amount > 0 ? Math.min(selectedGoal.current_amount / selectedGoal.target_amount, 1) : 0;
    
    return (
      <View style={{ flex: 1 }}>
        <TouchableOpacity style={{ marginBottom: spacing.m }} onPress={() => { setSelectedGoal(null); fetchData(); }}>
          <Text style={{ color: colors.primary }}>← Back to Goals</Text>
        </TouchableOpacity>
        
        <Card style={{ marginBottom: spacing.m }}>
          <Text style={{ color: colors.text, ...typography.header }}>{selectedGoal.name}</Text>
          <Text style={{ color: colors.textSecondary, marginBottom: spacing.m }}>Target: {format(selectedGoal.target_amount)}</Text>
          
          <View style={{ alignItems: 'center', marginBottom: spacing.m }}>
            <Text style={{ color: colors.text, fontSize: 36, fontWeight: 'bold' }}>{(progress * 100).toFixed(0)}%</Text>
            <Text style={{ color: colors.textSecondary }}>{format(selectedGoal.current_amount)} saved</Text>
          </View>

          <View style={[styles.progressBar, { backgroundColor: colors.border, height: 16, borderRadius: 8 }]}>
            <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: colors.primary, borderRadius: 8 }]} />
          </View>
        </Card>

        <View style={styles.row}>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: colors.primary, flex: 1, marginRight: spacing.s }]}
            onPress={() => setProgressModalVisible(true)}
          >
            <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>Add Funds</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: colors.error, flex: 1, marginLeft: spacing.s }]}
            onPress={() => handleDeleteGoal(selectedGoal.id)}
          >
            <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>Delete</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + spacing.m }]}>
      <Text style={[styles.header, { color: colors.text }]}>Planning</Text>

      <View style={styles.tabsContainer}>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'budgets' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]} 
          onPress={() => { setActiveTab('budgets'); setSelectedGoal(null); }}
        >
          <Text style={{ color: activeTab === 'budgets' ? colors.primary : colors.textSecondary, fontWeight: 'bold' }}>Budgets</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tab, activeTab === 'goals' && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]} 
          onPress={() => setActiveTab('goals')}
        >
          <Text style={{ color: activeTab === 'goals' ? colors.primary : colors.textSecondary, fontWeight: 'bold' }}>Goals</Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'budgets' ? renderBudgets() : renderGoals()}

      <Modal visible={isBudgetModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Set Budget</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              placeholder="Monthly Limit"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              value={budgetLimitInput}
              onChangeText={setBudgetLimitInput}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setBudgetModalVisible(false)} style={{ padding: spacing.m }}>
                <Text style={{ color: colors.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveBudget} style={{ padding: spacing.m }}>
                <Text style={{ color: colors.primary, fontWeight: 'bold' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isGoalModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>New Goal</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              placeholder="Goal Name"
              placeholderTextColor={colors.textSecondary}
              value={goalName}
              onChangeText={setGoalName}
            />
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              placeholder="Target Amount"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              value={goalTarget}
              onChangeText={setGoalTarget}
            />
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              placeholder="Deadline (e.g. 2026-12-31)"
              placeholderTextColor={colors.textSecondary}
              value={goalDeadline}
              onChangeText={setGoalDeadline}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setGoalModalVisible(false)} style={{ padding: spacing.m }}>
                <Text style={{ color: colors.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSaveGoal} style={{ padding: spacing.m }}>
                <Text style={{ color: colors.primary, fontWeight: 'bold' }}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={isProgressModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Add Funds to Goal</Text>
            <TextInput
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
              placeholder="Amount to Add"
              placeholderTextColor={colors.textSecondary}
              keyboardType="numeric"
              value={progressInput}
              onChangeText={setProgressInput}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setProgressModalVisible(false)} style={{ padding: spacing.m }}>
                <Text style={{ color: colors.textSecondary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleAddProgress} style={{ padding: spacing.m }}>
                <Text style={{ color: colors.primary, fontWeight: 'bold' }}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

    </View>
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
  tabsContainer: {
    flexDirection: 'row',
    marginBottom: spacing.m,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.s,
    alignItems: 'center',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.s,
  },
  budgetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.s,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginTop: spacing.s,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
  },
  addButton: {
    padding: spacing.m,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: spacing.m,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    padding: spacing.m,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: spacing.m,
  },
  modalContent: {
    padding: spacing.l,
    borderRadius: 16,
  },
  modalTitle: {
    ...typography.title,
    marginBottom: spacing.m,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.s,
    marginBottom: spacing.m,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  }
});
