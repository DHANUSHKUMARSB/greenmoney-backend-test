import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, Platform, Switch, Modal, Pressable, TextInput } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Select } from '../components/Select';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { useCurrency } from '../hooks/useCurrency';
import { toastService } from '../services/toastService';
import { soundEngine } from '../services/soundEngine';
import { 
  getCategories, 
  getAccounts, 
  insertTransaction, 
  updateTransaction, 
  getTransactionById,
  insertRecurringTransaction,
  getBudgets,
  getBudgetUsage,
  checkDuplicateTransaction,
  TransactionInput 
} from '../services/database';
import { useViewContextStore } from '../store/viewContextStore';
import { getContextualDefaultDate } from '../utils/dateUtils';
import { CalculatorModal } from '../components/CalculatorModal';

export const AddTransactionScreen = () => {
  const { colors, spacing, typography, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { symbol, format } = useCurrency();
  const txId = route.params?.transactionId;

  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense' | 'transfer'>('expense');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [date, setDate] = useState(new Date());
  const [note, setNote] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringType, setRecurringType] = useState<'repeat' | 'installment'>('repeat');
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [interval, setInterval] = useState('1');
  const [totalInstallments, setTotalInstallments] = useState('12');
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isExceedModalVisible, setExceedModalVisible] = useState(false);
  const [exceedData, setExceedData] = useState<any>(null);
  const [isCalculatorVisible, setIsCalculatorVisible] = useState(false);
  
  const amountRef = useRef<any>(null);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    if (!txId) {
      const context = useViewContextStore.getState();
      const defaultDate = getContextualDefaultDate(context);
      setDate(defaultDate);
    }
    loadData();
    return () => { isMounted.current = false; };
  }, [txId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [fetchedCategories, fetchedAccounts] = await Promise.all([
        getCategories(),
        getAccounts()
      ]);
      
      if (!isMounted.current) return;
      setCategories(fetchedCategories);
      setAccounts(fetchedAccounts);

      if (fetchedAccounts.length > 0 && !accountId) {
        const cashAccount = fetchedAccounts.find((a: any) => a.name.toLowerCase() === 'cash');
        setAccountId(cashAccount ? cashAccount.id : fetchedAccounts[0].id);
      }

      if (fetchedCategories.length > 0 && !categoryId) {
        const expenseCategory = fetchedCategories.find((c: any) => c.type === 'expense');
        setCategoryId(expenseCategory ? expenseCategory.id : fetchedCategories[0].id);
      }

      if (txId) {
        const tx = await getTransactionById(txId);
        if (tx && isMounted.current) {
          setAmount(tx.amount.toString());
          setType(tx.type);
          setCategoryId(tx.category_id);
          setAccountId(tx.account_id);
          setDate(new Date(tx.date));
          setNote(tx.note || '');
        }
      }
    } catch (error) {
      console.error('Failed to load form data:', error);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  };

  const validate = () => {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a positive numeric value.');
      return false;
    }
    if (!accountId) {
      Alert.alert('Missing Account', 'Please select an account.');
      return false;
    }
    if (type !== 'transfer' && !categoryId) {
      Alert.alert('Missing Category', 'Please select a category.');
      return false;
    }
    return true;
  };

  const performSave = async () => {
    if (isSaving || !validate()) return false;
    setIsSaving(true);
    try {
      const tx: TransactionInput = {
        amount: Number(amount),
        type,
        categoryId: categoryId || undefined,
        accountId: accountId!,
        date: date.toISOString(),
        note: note.trim() || undefined,
      };

      if (txId) {
        await updateTransaction(txId, tx);
        soundEngine.play('success');
      } else {
        await insertTransaction(tx);
        soundEngine.play(type === 'income' ? 'income_added' : 'expense_added');
        if (isRecurring) {
          let nextDate = new Date(date);
          const jump = Number(interval || 1);
          if (frequency === 'daily') nextDate.setDate(nextDate.getDate() + jump);
          else if (frequency === 'weekly') nextDate.setDate(nextDate.getDate() + (7 * jump));
          else if (frequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + jump);
          else if (frequency === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + jump);
          
          await insertRecurringTransaction(tx, {
            recurring_type: recurringType,
            frequency,
            interval: jump,
            total_installments: recurringType === 'installment' ? Number(totalInstallments) : undefined,
            next_date: nextDate.toISOString()
          });
        }
      }
      return true;
    } catch (error) {
      Alert.alert('Save Failed', 'An error occurred while saving.');
      return false;
    } finally {
      if (isMounted.current) setIsSaving(false);
    }
  };

  const checkBudget = async () => {
    if (type !== 'expense' || !categoryId) return false;
    try {
      const todayStr = date.toISOString().slice(0, 10);
      const budgets = await getBudgets(todayStr, 'monthly'); // We check at month level by default for safety
      
      const budget = budgets.find(b => b.category_id.toString() === categoryId.toString());
      
      if (budget && budget.display_limit > 0) {
        // Use the budget's specific period for calculation
        const usage = await getBudgetUsage(categoryId, todayStr, budget.period);
        
        if (usage > budget.display_limit) {
          setExceedData({ 
            categoryName: budget.category_name, 
            limit: budget.display_limit, 
            usage: usage - Number(amount), 
            currentAmount: Number(amount), 
            exceededAmount: usage - budget.display_limit 
          });
          setExceedModalVisible(true);
          return true;
        }
      }
    } catch (e) { console.error('Budget check failed:', e); }
    return false;
  };

  const handleSave = async () => {
    const tx: TransactionInput = {
      amount: Number(amount),
      type,
      categoryId: categoryId || undefined,
      accountId: accountId!,
      date: date.toISOString(),
      note: note.trim() || undefined,
    };

    const duplicate = await checkDuplicateTransaction(tx, txId);
    if (duplicate) {
      soundEngine.play('warning');
      Alert.alert(
        'Potential Duplicate',
        `A similar ${type} of ${format(duplicate.amount)} already exists on ${duplicate.date}. Save anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Save Anyway', onPress: async () => await executeSaveAndNavigate() }
        ]
      );
      return;
    }

    await executeSaveAndNavigate();
  };

  const executeSaveAndNavigate = async () => {
    if (await performSave()) {
      soundEngine.play(type === 'income' ? 'income_added' : 'expense_added');
      if (!(await checkBudget())) navigation.goBack();
      else soundEngine.play('warning');
    } else {
      soundEngine.play('error');
    }
  };

  const handleAddMore = async () => {
    const tx: TransactionInput = {
      amount: Number(amount),
      type,
      categoryId: categoryId || undefined,
      accountId: accountId!,
      date: date.toISOString(),
      note: note.trim() || undefined,
    };

    const duplicate = await checkDuplicateTransaction(tx, txId);
    if (duplicate) {
      soundEngine.play('warning');
      Alert.alert(
        'Potential Duplicate',
        `A similar ${type} of ${format(duplicate.amount)} already exists. Add anyway?`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Add Anyway', onPress: async () => await executeAddMore() }
        ]
      );
      return;
    }

    await executeAddMore();
  };

  const executeAddMore = async () => {
    if (await performSave()) {
      soundEngine.play(type === 'income' ? 'income_added' : 'expense_added');
      await checkBudget();
      setAmount('');
      setNote('');
      setTimeout(() => amountRef.current?.focus(), 100);
    } else {
      soundEngine.play('error');
    }
  };

  const onDateChange = useCallback((event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) setDate(selectedDate);
  }, []);

  const filteredCategories = categories.filter(c => c.type === type);

  if (loading) return (
    <View style={[styles.centered, { backgroundColor: colors.background }]}>
      <Text style={{ color: colors.textSecondary }}>Loading...</Text>
    </View>
  );

  return (
    <>
      <KeyboardAwareScrollView
        style={{ flex: 1, backgroundColor: colors.background }}
        contentContainerStyle={{ paddingTop: insets.top + spacing.m, paddingBottom: 100 }}
        enableOnAndroid={true}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.closeBtn, { backgroundColor: colors.card }]}>
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>
            <Text style={[styles.header, { color: colors.text }]}>{txId ? 'Edit' : 'New'} Transaction</Text>
            <View style={{ width: 44 }} />
          </View>

          <View style={[styles.amountContainer, { backgroundColor: colors.primaryContainer + '33' }]}>
            <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={[styles.amountSymbol, { color: colors.primary }]}>{symbol}</Text>
              <TextInput
                ref={amountRef}
                style={[styles.amountInput, { color: colors.text }]}
                value={amount}
                onChangeText={setAmount}
                placeholder="0.00"
                placeholderTextColor={colors.textSecondary + '66'}
                keyboardType="numeric"
                autoFocus={!txId}
              />
            </View>
            <TouchableOpacity 
              onPress={() => {
                setIsCalculatorVisible(true);
                if (Platform.OS !== 'web') {
                  soundEngine.play('tap_secondary');
                }
              }}
              style={[styles.calcTrigger, { backgroundColor: colors.card }]}
            >
              <Ionicons name="calculator-outline" size={24} color={colors.primary} />
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            onPress={() => (navigation as any).navigate('BulkUpload')}
            style={[styles.bulkImportBtn, { borderColor: colors.primary + '33' }]}
          >
            <Ionicons name="sparkles" size={18} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: '700', marginLeft: 8 }}>Bulk Import with AI</Text>
          </TouchableOpacity>

          <View style={[styles.typeSwitcher, { backgroundColor: colors.card }]}>
            {(['expense', 'income', 'transfer'] as const).map((t) => (
              <TouchableOpacity
                key={t}
                onPress={() => { setType(t); const matchingCat = categories.find(c => c.type === t); if (matchingCat) setCategoryId(matchingCat.id); }}
                style={[styles.typeOption, { backgroundColor: type === t ? colors.primary : 'transparent' }]}
              >
                <Text style={[styles.typeOptionText, { color: type === t ? '#fff' : colors.textSecondary }]}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.formSection}>
            <View style={styles.inputRow}>
              <View style={styles.inputIcon}><Ionicons name="wallet-outline" size={22} color={colors.primary} /></View>
              <View style={{ flex: 1 }}>
                <Select 
                  label="Account"
                  value={accountId}
                  onValueChange={(v) => setAccountId(v)}
                  options={accounts.map(acc => ({ label: acc.name, value: acc.id, icon: 'wallet-outline' }))}
                  style={{ marginBottom: 0 }}
                />
              </View>
            </View>

            {type !== 'transfer' && (
              <View style={styles.inputRow}>
                <View style={styles.inputIcon}><Ionicons name="grid-outline" size={22} color={colors.primary} /></View>
                <View style={{ flex: 1 }}>
                  <Select 
                    label="Category"
                    value={categoryId}
                    onValueChange={(v) => setCategoryId(v)}
                    options={filteredCategories.map(cat => ({ label: cat.name, value: cat.id, icon: 'grid-outline' }))}
                    style={{ marginBottom: 0 }}
                  />
                </View>
              </View>
            )}

            <View style={styles.inputRow}>
              <View style={styles.inputIcon}><Ionicons name="calendar-outline" size={22} color={colors.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Date</Text>
                <TouchableOpacity onPress={() => setShowDatePicker(true)} style={[styles.dateSelector, { backgroundColor: colors.card }]}>
                  <Text style={{ color: colors.text, fontWeight: '600' }}>{date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputRow}>
              <View style={styles.inputIcon}><Ionicons name="document-text-outline" size={22} color={colors.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Note</Text>
                <TextInput
                  placeholder="What was this for?"
                  placeholderTextColor={colors.textSecondary + '66'}
                  style={[styles.noteInput, { backgroundColor: colors.card, color: colors.text }]}
                  value={note}
                  onChangeText={setNote}
                  multiline
                />
              </View>
            </View>
          </View>

          {!txId && (
            <Card style={styles.recurringCard}>
              <View style={styles.recurringHeader}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Ionicons name="repeat" size={20} color={colors.primary} style={{ marginRight: 8 }} />
                  <Text style={{ color: colors.text, fontWeight: '700' }}>Recurring</Text>
                </View>
                <Switch value={isRecurring} onValueChange={setIsRecurring} trackColor={{ false: colors.border, true: colors.primary }} />
              </View>
              {isRecurring && (
                <View style={styles.recurringDetails}>
                  <View style={styles.frequencyGrid}>
                    {['daily', 'weekly', 'monthly', 'yearly'].map(f => (
                      <TouchableOpacity key={f} onPress={() => setFrequency(f as any)} style={[styles.freqChip, { backgroundColor: frequency === f ? colors.primary : colors.background, borderColor: colors.primary }]}>
                        <Text style={{ color: frequency === f ? '#fff' : colors.primary, fontSize: 12, fontWeight: '700' }}>{f.charAt(0).toUpperCase() + f.slice(1)}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}
            </Card>
          )}

          <View style={styles.footer}>
            {!txId && (
              <Button title="Save & Add More" onPress={handleAddMore} variant="outline" style={{ flex: 1 }} loading={isSaving} />
            )}
            <Button title={txId ? "Update" : "Save"} onPress={handleSave} style={{ flex: 1 }} loading={isSaving} />
          </View>
        </View>
      </KeyboardAwareScrollView>

      {showDatePicker && <DateTimePicker value={date} mode="date" display="default" onChange={onDateChange} />}

      <CalculatorModal 
        isVisible={isCalculatorVisible}
        onClose={() => setIsCalculatorVisible(false)}
        initialValue={amount}
        onImport={(val) => {
          setAmount(val);
          setTimeout(() => amountRef.current?.focus(), 100);
        }}
      />

      <Modal visible={isExceedModalVisible} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Card style={styles.alertCard}>
            <View style={[styles.alertIcon, { backgroundColor: colors.error + '15' }]}>
              <Ionicons name="warning" size={32} color={colors.error} />
            </View>
            <Text style={[styles.alertTitle, { color: colors.text }]}>Budget Overlimit!</Text>
            <Text style={[styles.alertSubtitle, { color: colors.textSecondary }]}>
              Your <Text style={{ fontWeight: '700', color: colors.text }}>{exceedData?.categoryName}</Text> budget is now over the limit.
            </Text>

            <View style={styles.statsContainer}>
              <View style={styles.statRow}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Monthly Limit</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>{format(exceedData?.limit || 0)}</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>Already Spent</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>{format(exceedData?.usage || 0)}</Text>
              </View>
              <View style={[styles.statRow, { paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.border + '33', marginTop: 4 }]}>
                <Text style={[styles.statLabel, { color: colors.primary, fontWeight: '700' }]}>This Purchase</Text>
                <Text style={[styles.statValue, { color: colors.primary, fontWeight: '800' }]}>+ {format(exceedData?.currentAmount || 0)}</Text>
              </View>
              <View style={[styles.statRow, { paddingVertical: 12, backgroundColor: colors.error + '08', borderRadius: 12, marginTop: 8 }]}>
                <Text style={[styles.statLabel, { color: colors.error, fontWeight: '700' }]}>Exceeded By</Text>
                <Text style={[styles.statValue, { color: colors.error, fontWeight: '900', fontSize: 18 }]}>{format(exceedData?.exceededAmount || 0)}</Text>
              </View>
            </View>

            <Button 
              title="Understood" 
              onPress={() => { setExceedModalVisible(false); navigation.goBack(); }} 
              style={{ width: '100%', marginTop: 12 }} 
            />
          </Card>
        </View>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 20 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  closeBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  header: { fontSize: 20, fontWeight: '800' },
  amountContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 24, borderRadius: 24, marginBottom: 24 },
  amountSymbol: { fontSize: 32, fontWeight: '600', marginRight: 4 },
  amountInput: { fontSize: 48, fontWeight: '800', textAlign: 'center', minWidth: 100 },
  typeSwitcher: { flexDirection: 'row', padding: 4, borderRadius: 14, marginBottom: 24 },
  typeOption: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  typeOptionText: { fontSize: 14, fontWeight: '700' },
  formSection: { gap: 20 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-start' },
  inputIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', marginTop: 16 },
  inputLabel: { fontSize: 13, fontWeight: '600', marginBottom: 6 },
  pickerWrapper: { borderRadius: 12, overflow: 'hidden' },
  dateSelector: { padding: 16, borderRadius: 12 },
  noteInput: { padding: 16, borderRadius: 12, minHeight: 80, textAlignVertical: 'top' },
  recurringCard: { marginTop: 24, padding: 16 },
  recurringHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  recurringDetails: { marginTop: 16 },
  frequencyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  freqChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, borderWidth: 1 },
  footer: { flexDirection: 'row', gap: 12, marginTop: 40 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 24 },
  alertCard: { padding: 24, alignItems: 'center', width: '100%' },
  alertIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  alertTitle: { fontSize: 22, fontWeight: '900', marginBottom: 8 },
  alertSubtitle: { textAlign: 'center', fontSize: 14, lineHeight: 20, marginBottom: 24 },
  statsContainer: { width: '100%', gap: 4, marginBottom: 20 },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 4 },
  statLabel: { fontSize: 14, fontWeight: '500' },
  statValue: { fontSize: 15, fontWeight: '600' },
  alertText: { textAlign: 'center', fontSize: 15, lineHeight: 22 },
  bulkImportBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 16, borderStyle: 'dashed', borderWidth: 1, marginBottom: 24 },
  calcTrigger: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    right: 16,
  },
});
