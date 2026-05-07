import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, Platform, Switch } from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../hooks/useTheme';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { typography, spacing } from '../utils/theme';
import { 
  getCategories, 
  getAccounts, 
  insertTransaction, 
  updateTransaction, 
  getTransactionById,
  insertRecurringTransaction,
  TransactionInput 
} from '../services/database';
import { useCurrency } from '../hooks/useCurrency';
import { syncService } from '../services/syncService';

export const AddTransactionScreen = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const route = useRoute<any>();
  const { symbol } = useCurrency();
  const txId = route.params?.transactionId;

  const [amount, setAmount] = useState('');
  const [type, setType] = useState<'income' | 'expense' | 'transfer'>('expense');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [date, setDate] = useState(new Date());
  const [note, setNote] = useState('');
  
  const [isRecurring, setIsRecurring] = useState(false);
  const [frequency, setFrequency] = useState<'daily' | 'weekly' | 'monthly'>('monthly');
  
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [accounts, setAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const fetchedCategories: any[] = await getCategories();
      const fetchedAccounts: any[] = await getAccounts();
      
      setCategories(fetchedCategories);
      setAccounts(fetchedAccounts);

      // Set defaults
      if (fetchedAccounts.length > 0) {
        const cashAccount = fetchedAccounts.find((a: any) => a.name.toLowerCase() === 'cash');
        setAccountId(cashAccount ? cashAccount.id : fetchedAccounts[0].id);
      }

      if (fetchedCategories.length > 0) {
        const expenseCategory = fetchedCategories.find((c: any) => c.type === 'expense');
        setCategoryId(expenseCategory ? expenseCategory.id : fetchedCategories[0].id);
      }

      // If editing, load transaction details
      if (txId) {
        const tx = await getTransactionById(txId);
        if (tx) {
          setAmount(tx.amount.toString());
          setType(tx.type);
          setCategoryId(tx.category_id);
          setAccountId(tx.account_id);
          setDate(new Date(tx.date));
          setNote(tx.note || '');
        }
      }
    } catch (error) {
      console.error('Failed to load DB data:', error);
    }
  };

  const handleSave = async () => {
    if (!amount || isNaN(Number(amount))) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }
    if (!accountId) {
      Alert.alert('Error', 'Please select an account');
      return;
    }

    setLoading(true);
    try {
      const tx: TransactionInput = {
        amount: Number(amount),
        type,
        categoryId: categoryId || undefined,
        accountId,
        date: date.toISOString(),
        note: note.trim() || undefined,
      };

      if (txId) {
        await updateTransaction(txId, tx);
      } else {
        await insertTransaction(tx);
        
        // If recurring, save the template
        if (isRecurring) {
          let nextDate = new Date(date);
          if (frequency === 'daily') nextDate.setDate(nextDate.getDate() + 1);
          else if (frequency === 'weekly') nextDate.setDate(nextDate.getDate() + 7);
          else if (frequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
          
          await insertRecurringTransaction(tx, frequency, nextDate.toISOString());
        }
      }
      syncService.syncAll(); // Trigger sync in background
      navigation.goBack();
    } catch (error: any) {
      Alert.alert('Save Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    const currentDate = selectedDate || date;
    setShowDatePicker(Platform.OS === 'ios');
    setDate(currentDate);
  };

  const filteredCategories = categories.filter(c => c.type === type);

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ 
        paddingTop: insets.top + spacing.m,
        paddingBottom: spacing.xxl + 40 // Bottom padding for notes field
      }}
      enableOnAndroid={true}
      extraScrollHeight={Platform.OS === 'ios' ? 50 : 30}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.container}>
        <Text style={[styles.header, { color: colors.text }]}>Add Transaction</Text>

        {/* Type Selector */}
        <View style={styles.typeSelector}>
          {(['expense', 'income', 'transfer'] as const).map((t) => (
            <TouchableOpacity
              key={t}
              style={[
                styles.typeButton,
                { 
                  backgroundColor: type === t ? colors.primary : 'transparent',
                  borderColor: colors.primary,
                }
              ]}
              onPress={() => {
                setType(t);
                const matchingCat = categories.find(c => c.type === t);
                if (matchingCat) setCategoryId(matchingCat.id);
              }}
            >
              <Text style={[
                styles.typeButtonText,
                { color: type === t ? 'white' : colors.primary }
              ]}>
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <Input
          label="Amount"
          placeholder={`${symbol}0.00`}
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
        />

        <View style={styles.fieldContainer}>
          <Text style={[styles.label, { color: colors.text }]}>Account</Text>
          <View style={[styles.pickerContainer, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Picker
              selectedValue={accountId}
              onValueChange={(itemValue) => setAccountId(itemValue)}
              style={{ color: colors.text }}
              dropdownIconColor={colors.text}
            >
              {accounts.map(acc => (
                <Picker.Item key={acc.id} label={acc.name} value={acc.id} color={Platform.OS === 'ios' ? colors.text : undefined} />
              ))}
            </Picker>
          </View>
        </View>

        {type !== 'transfer' && (
          <View style={styles.fieldContainer}>
            <Text style={[styles.label, { color: colors.text }]}>Category</Text>
            <View style={[styles.pickerContainer, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Picker
                selectedValue={categoryId}
                onValueChange={(itemValue) => setCategoryId(itemValue)}
                style={{ color: colors.text }}
                dropdownIconColor={colors.text}
              >
                {filteredCategories.map(cat => (
                  <Picker.Item key={cat.id} label={cat.name} value={cat.id} color={Platform.OS === 'ios' ? colors.text : undefined} />
                ))}
              </Picker>
            </View>
          </View>
        )}

        <View style={styles.fieldContainer}>
          <Text style={[styles.label, { color: colors.text }]}>Date</Text>
          {Platform.OS === 'ios' ? (
            <DateTimePicker
              value={date}
              mode="date"
              display="default"
              onChange={onDateChange}
            />
          ) : (
            <>
              <Button 
                title={date.toDateString()} 
                onPress={() => setShowDatePicker(true)} 
                variant="outline" 
              />
              {showDatePicker && (
                <DateTimePicker
                  value={date}
                  mode="date"
                  display="default"
                  onChange={onDateChange}
                />
              )}
            </>
          )}
        </View>

        {/* Note (Optional) */}
        <Input
          label="Note (Optional)"
          placeholder="Enter note..."
          value={note}
          onChangeText={setNote}
          multiline
        />

        {!txId && (
          <Card style={styles.recurringCard}>
            <View style={styles.recurringRow}>
              <View>
                <Text style={{ color: colors.text, fontWeight: '600' }}>Recurring Transaction</Text>
                <Text style={{ color: colors.textSecondary, fontSize: 12 }}>Auto-add every period</Text>
              </View>
              <Switch
                value={isRecurring}
                onValueChange={setIsRecurring}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor="#fff"
              />
            </View>
            
            {isRecurring && (
              <View style={styles.frequencyContainer}>
                <Text style={{ color: colors.text, fontSize: 14, marginBottom: spacing.xs }}>Frequency</Text>
                <View style={[styles.pickerContainer, { borderColor: colors.border, backgroundColor: colors.card }]}>
                  <Picker
                    selectedValue={frequency}
                    onValueChange={(v: any) => setFrequency(v)}
                    style={{ color: colors.text }}
                    dropdownIconColor={colors.text}
                  >
                    <Picker.Item label="Daily" value="daily" />
                    <Picker.Item label="Weekly" value="weekly" />
                    <Picker.Item label="Monthly" value="monthly" />
                  </Picker>
                </View>
              </View>
            )}
          </Card>
        )}

        <Button
          title={txId ? "Update Transaction" : "Save Transaction"}
          onPress={handleSave}
          loading={loading}
          style={styles.saveButton}
        />
      </View>
    </KeyboardAwareScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.m,
  },
  header: {
    ...typography.header,
    marginBottom: spacing.l,
    marginTop: spacing.s,
  },
  typeSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.l,
  },
  typeButton: {
    flex: 1,
    paddingVertical: spacing.s,
    borderWidth: 1,
    borderRadius: 8,
    marginHorizontal: spacing.xs,
    alignItems: 'center',
  },
  typeButtonText: {
    fontWeight: '600',
  },
  fieldContainer: {
    marginBottom: spacing.m,
  },
  label: {
    ...typography.body,
    marginBottom: spacing.xs,
    fontWeight: '500',
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 8,
    overflow: 'hidden',
  },
  saveButton: {
    marginTop: spacing.l,
  },
  recurringCard: {
    marginTop: spacing.m,
    padding: spacing.m,
  },
  recurringRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  frequencyContainer: {
    marginTop: spacing.m,
    paddingTop: spacing.m,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  }
});
