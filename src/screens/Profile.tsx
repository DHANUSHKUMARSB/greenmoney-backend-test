import React, { useState } from 'react';
import {
  StyleSheet, Text, View, Alert, TouchableOpacity, ScrollView, TextInput, Modal, Pressable
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { useTheme } from '../hooks/useTheme';
import { spacing, typography } from '../utils/theme';
import { signOut } from '../services/authService';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store';
import { 
  getCategories, addCategory, deleteCategory, updateCategoriesOrder,
  setupDefaultDataForUser 
} from '../services/database';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import * as Notifications from 'expo-notifications';
import { scheduleDailyReminder, requestNotificationPermissions } from '../services/notificationService';
import { syncEngine } from '../services/syncEngine';
import { localStorage } from '../services/localStorage';
import { useFocusEffect } from '@react-navigation/native';
import { useThemeStore, ACCENT_COLORS } from '../store/themeStore';
import DraggableFlatList, { ScaleDecorator, RenderItemParams } from 'react-native-draggable-flatlist';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, { 
  useAnimatedStyle, 
  withRepeat, 
  withSequence, 
  withTiming 
} from 'react-native-reanimated';


// ─── Theme option pill ───────────────────────────────────────────────────────
const ThemePill = ({
  label, icon, value, current, onPress, colors,
}: {
  label: string; icon: string; value: string;
  current: string; onPress: () => void; colors: any;
}) => {
  const active = current === value;
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        st.pill,
        {
          backgroundColor: active ? colors.primary : colors.card,
          borderColor:     active ? colors.primary : colors.border,
        },
      ]}
    >
      <Ionicons
        name={icon as any}
        size={18}
        color={active ? '#fff' : colors.textSecondary}
      />
      <Text style={{ color: active ? '#fff' : colors.text, marginLeft: 6, fontWeight: '600', fontSize: 13 }}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

// ─── Draggable Item ──────────────────────────────────────────────────────────
const DraggableCategoryItem = React.memo(({ item, drag, isActive, colors, handleDeleteCat }: any) => {
  return (
    <Pressable
      onLongPress={drag}
      delayLongPress={200}
      disabled={isActive}
      style={({ pressed }) => [
        {
          width: '100%',
          opacity: pressed ? 0.9 : 1,
        }
      ]}
    >
      <View
        style={[
          st.catItem, 
          { 
            borderBottomColor: colors.border,
            paddingHorizontal: spacing.m,
          }
        ]}
      >
        <View style={{ marginRight: spacing.m }}>
          <Ionicons 
            name="reorder-three-outline" 
            size={24} 
            color={isActive ? colors.primary : colors.textSecondary} 
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: '600' }}>{item.name}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 11 }}>{item.type.toUpperCase()}</Text>
        </View>
        <TouchableOpacity 
          onPress={() => handleDeleteCat(item.id)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="trash-outline" size={20} color={colors.error} />
        </TouchableOpacity>
      </View>
    </Pressable>
  );
});

// ─── Settings row ────────────────────────────────────────────────────────────
const SettingsRow = ({ icon, label, children, colors }: any) => (
  <View style={[st.settingsRow, { borderBottomColor: colors.border }]}>
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: spacing.s }}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={{ color: colors.text, fontWeight: '600', marginLeft: spacing.s, fontSize: 15 }}>{label}</Text>
    </View>
    {children}
  </View>
);

// ─── Main Screen ─────────────────────────────────────────────────────────────
export const ProfileScreen = () => {
  const { colors, themeMode, setThemeMode } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const { 
    currency, setCurrency, 
    pin, setPin, 
    remindersEnabled, setRemindersEnabled,
    dailyReminderTime, setDailyReminderTime 
  } = useAppStore();
  
  const [settingsOpen, setSettingsOpen] = useState(true);
  const [showPinModal, setShowPinModal] = useState(false);
  const [tempPin, setTempPin] = useState('');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [incomeOpen, setIncomeOpen] = useState(true);
  const [expenseOpen, setExpenseOpen] = useState(true);
  const [newIncomeName, setNewIncomeName] = useState('');
  const [newExpenseName, setNewExpenseName] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const { accentColor, setAccentColor } = useTheme();

  useFocusEffect(React.useCallback(() => {
    localStorage.getLastSyncTimestamp().then(setLastSync);
  }, []));

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await syncEngine.runSync(true);
      const timestamp = await localStorage.getLastSyncTimestamp();
      setLastSync(timestamp);
      Alert.alert('Sync Complete', 'Your data has been successfully backed up to the cloud.');
    } catch (e) {
      Alert.alert('Sync Failed', 'Could not backup data. Please check your connection.');
    } finally {
      setSyncing(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: async () => {
        try { await signOut(); }
        catch (e: any) { Alert.alert('Logout Failed', e.message); }
      }},
    ]);
  };

  const handlePinSave = () => {
    if (tempPin.length === 4) {
      setPin(tempPin);
      setShowPinModal(false);
      Alert.alert('Success', 'PIN has been set successfully.');
    } else {
      Alert.alert('Error', 'PIN must be 4 digits.');
    }
  };

  const toggleReminders = async (value: boolean) => {
    if (value) {
      const granted = await requestNotificationPermissions();
      if (!granted) {
        Alert.alert('Permission Denied', 'Please enable notifications in your device settings.');
        return;
      }
      const [h, m] = dailyReminderTime.split(':').map(Number);
      await scheduleDailyReminder(h, m);
    } else {
      await Notifications.cancelAllScheduledNotificationsAsync();
    }
    setRemindersEnabled(value);
  };

  const onTimeChange = async (event: any, selectedDate?: Date) => {
    setShowTimePicker(false);
    if (selectedDate) {
      const h = selectedDate.getHours();
      const m = selectedDate.getMinutes();
      const timeString = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      setDailyReminderTime(timeString);
      if (remindersEnabled) {
        await scheduleDailyReminder(h, m);
      }
    }
  };

  const loadCategories = React.useCallback(async () => {
    const cats = await getCategories();
    setCategories(cats);
  }, []);

  const handleAddCat = React.useCallback(async (type: 'income' | 'expense') => {
    const name = type === 'income' ? newIncomeName : newExpenseName;
    if (!name.trim()) return;
    try {
      await addCategory(name.trim(), type);
      if (type === 'income') setNewIncomeName('');
      else setNewExpenseName('');
      loadCategories();
    } catch (e) { Alert.alert('Error', 'Failed to add category'); }
  }, [newIncomeName, newExpenseName, loadCategories]);

  const handleDeleteCat = React.useCallback((id: number) => {
    Alert.alert('Delete Category', 'This will only remove the category from selection. Past transactions will remain.', [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        await deleteCategory(id);
        loadCategories();
      }}
    ], { cancelable: true });
  }, [loadCategories]);


  const onDragEnd = React.useCallback(async ({ data }: { data: any[] }) => {
    // Merge dragged data back into the main categories list
    const updatedType = data[0]?.type;
    if (!updatedType) return;

    const otherTypes = categories.filter(c => c.type !== updatedType);
    const newAllCats = [...otherTypes, ...data].sort((a, b) => a.display_order - b.display_order);
    
    // Actually, just update the display_order for all in the local type
    const updates = data.map((c, i) => ({ id: c.id, display_order: i }));
    setCategories(prev => {
      const filtered = prev.filter(c => c.type !== updatedType);
      return [...filtered, ...data];
    });

    try {
      await updateCategoriesOrder(updates);
    } catch (e) {
      Alert.alert('Error', 'Failed to update order');
    }
  }, [categories]);

  const incomeCats = React.useMemo(() => categories.filter(c => c.type === 'income'), [categories]);
  const expenseCats = React.useMemo(() => categories.filter(c => c.type === 'expense'), [categories]);

  const renderCategoryItem = React.useCallback((params: RenderItemParams<any>) => (
    <DraggableCategoryItem 
      {...params} 
      colors={colors} 
      handleDeleteCat={handleDeleteCat} 
    />
  ), [colors, handleDeleteCat]);

  React.useEffect(() => {
    if (showCatModal) loadCategories();
  }, [showCatModal]);

  const formattedDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })
    : 'Unknown';

  const formatTime12h = (time24: string) => {
    const [h, m] = time24.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  return (
    <View style={[st.container, { backgroundColor: colors.background, paddingTop: insets.top + spacing.m }]}>
      <Text style={[st.header, { color: colors.text }]}>Profile</Text>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* ── User info card ───────────────────────────────────── */}
        <Card style={{ marginBottom: spacing.l }}>
          {/* Avatar circle */}
          <View style={[st.avatarCircle, { backgroundColor: colors.primary + '22' }]}>
            <Ionicons name="person" size={36} color={colors.primary} />
          </View>

          <Text style={[st.email, { color: colors.text }]} numberOfLines={1}>
            {user?.email || 'Not logged in'}
          </Text>
          <Text style={[st.subLabel, { color: colors.textSecondary }]}>
            Member since {formattedDate}
          </Text>

          <View style={[st.divider, { backgroundColor: colors.border }]} />

          <View style={st.infoRow}>
            <Text style={[st.infoLabel, { color: colors.textSecondary }]}>User ID</Text>
            <Text style={[st.infoValue, { color: colors.text }]} selectable numberOfLines={1}>
              {user?.id ? user.id.slice(0, 18) + '…' : 'N/A'}
            </Text>
          </View>
        </Card>

        {/* ── Settings section ─────────────────────────────────── */}
        <TouchableOpacity
          onPress={() => setSettingsOpen(p => !p)}
          style={[st.settingsHeader, { backgroundColor: colors.card }]}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Ionicons name="settings-outline" size={20} color={colors.primary} />
            <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, marginLeft: spacing.s }}>Settings</Text>
          </View>
          <Ionicons name={settingsOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
        </TouchableOpacity>

        {settingsOpen && (
          <Card style={{ marginTop: 2, borderTopLeftRadius: 0, borderTopRightRadius: 0, paddingBottom: spacing.xl }}>
            <SettingsRow icon="color-palette-outline" label="Theme" colors={colors}>
              <View style={st.pillRow}>
                <ThemePill
                  label="System"  icon="phone-portrait-outline"
                  value="system"  current={themeMode}
                  onPress={() => setThemeMode('system')} colors={colors}
                />
                <ThemePill
                  label="Light"   icon="sunny-outline"
                  value="light"   current={themeMode}
                  onPress={() => setThemeMode('light')} colors={colors}
                />
                <ThemePill
                  label="Dark"    icon="moon-outline"
                  value="dark"    current={themeMode}
                  onPress={() => setThemeMode('dark')} colors={colors}
                />
              </View>
            </SettingsRow>

            <SettingsRow icon="color-filter-outline" label="Theme Color" colors={colors}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.s, paddingVertical: spacing.xs }}>
                {ACCENT_COLORS.map(c => (
                  <TouchableOpacity
                    key={c.color}
                    onPress={() => setAccentColor(c.color)}
                    style={[
                      st.colorCircle,
                      { backgroundColor: c.color },
                      accentColor === c.color && { borderWidth: 3, borderColor: colors.text }
                    ]}
                  />
                ))}
              </ScrollView>
            </SettingsRow>

            <SettingsRow icon="cash-outline" label="Currency" colors={colors}>
              <View style={[st.pickerContainer, { borderColor: colors.border, backgroundColor: colors.background }]}>
                <Picker
                  selectedValue={currency}
                  onValueChange={(v) => setCurrency(v)}
                  style={{ color: colors.text }}
                  dropdownIconColor={colors.text}
                >
                  <Picker.Item label="Indian Rupee (₹)" value="INR" />
                  <Picker.Item label="US Dollar ($)" value="USD" />
                  <Picker.Item label="Euro (€)" value="EUR" />
                  <Picker.Item label="British Pound (£)" value="GBP" />
                </Picker>
              </View>
            </SettingsRow>

            <SettingsRow icon="lock-closed-outline" label="Security" colors={colors}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.textSecondary }}>App Lock (PIN)</Text>
                <TouchableOpacity 
                  onPress={() => { setTempPin(pin || ''); setShowPinModal(true); }}
                  style={[st.actionBtn, { backgroundColor: colors.primary + '22' }]}
                >
                  <Text style={{ color: colors.primary, fontWeight: '600' }}>{pin ? 'Change PIN' : 'Set PIN'}</Text>
                </TouchableOpacity>
              </View>
              {pin && (
                <TouchableOpacity onPress={() => setPin(null)} style={{ marginTop: spacing.s }}>
                  <Text style={{ color: colors.error, fontSize: 13 }}>Disable PIN Lock</Text>
                </TouchableOpacity>
              )}
            </SettingsRow>

            <SettingsRow icon="notifications-outline" label="Notifications" colors={colors}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ color: colors.textSecondary }}>Daily Reminder</Text>
                <TouchableOpacity 
                  onPress={() => toggleReminders(!remindersEnabled)}
                  style={[st.toggle, { backgroundColor: remindersEnabled ? colors.primary : colors.border }]}
                >
                  <View style={[st.toggleCircle, { alignSelf: remindersEnabled ? 'flex-end' : 'flex-start' }]} />
                </TouchableOpacity>
              </View>
              {remindersEnabled && (
                <View style={{ marginTop: spacing.m, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Text style={{ color: colors.textSecondary }}>Reminder Time</Text>
                  <TouchableOpacity onPress={() => setShowTimePicker(true)}>
                    <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 16 }}>{formatTime12h(dailyReminderTime)}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </SettingsRow>

            <SettingsRow icon="list-outline" label="Configuration" colors={colors}>
              <TouchableOpacity 
                onPress={() => setShowCatModal(true)}
                style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <Text style={{ color: colors.textSecondary }}>Manage Categories</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </SettingsRow>

            <SettingsRow icon="cloud-done-outline" label="Cloud Backup & Sync" colors={colors}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View>
                  <Text style={{ color: colors.textSecondary, fontSize: 13 }}>
                    Last Sync: {lastSync ? new Date(lastSync).toLocaleString() : 'Never'}
                  </Text>
                </View>
                <TouchableOpacity 
                  onPress={handleManualSync}
                  disabled={syncing}
                  style={[st.actionBtn, { backgroundColor: colors.primary }]}
                >
                  <Text style={{ color: '#fff', fontWeight: '700' }}>
                    {syncing ? 'Syncing...' : 'Sync Now'}
                  </Text>
                </TouchableOpacity>
              </View>
            </SettingsRow>
          </Card>
        )}
      </ScrollView>

      {/* PIN Modal */}
      <Modal visible={showPinModal} transparent animationType="fade">
        <View style={st.modalOverlay}>
          <Card style={st.modalContent}>
            <Text style={[typography.title, { color: colors.text, marginBottom: spacing.m }]}>Set App PIN</Text>
            <Text style={{ color: colors.textSecondary, marginBottom: spacing.m }}>Enter a 4-digit PIN to secure your app.</Text>
            <TextInput
              style={[st.pinInput, { borderColor: colors.border, color: colors.text }]}
              value={tempPin}
              onChangeText={setTempPin}
              keyboardType="numeric"
              maxLength={4}
              secureTextEntry
              placeholder="0000"
              autoFocus
            />
            <View style={{ flexDirection: 'row', gap: spacing.m, marginTop: spacing.l }}>
              <Button title="Cancel" variant="outline" onPress={() => setShowPinModal(false)} style={{ flex: 1 }} />
              <Button title="Save" onPress={handlePinSave} style={{ flex: 1 }} />
            </View>
          </Card>
        </View>
      </Modal>

      {/* Categories Modal */}
      <Modal visible={showCatModal} animationType="slide">
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View style={[st.catModal, { backgroundColor: colors.background, paddingTop: insets.top }]}>
            <View style={st.modalHeader}>
              <TouchableOpacity onPress={() => setShowCatModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={[st.modalTitle, { color: colors.text }]}>Manage Categories</Text>
              <View style={{ width: 24 }} />
            </View>

          <ScrollView style={{ flex: 1 }}>
            {/* Income Section */}
            <TouchableOpacity 
              onPress={() => setIncomeOpen(!incomeOpen)}
              style={[st.secHeader, { backgroundColor: colors.primary + '11' }]}
            >
              <Text style={{ color: colors.primary, fontWeight: '700' }}>INCOME CATEGORIES ({incomeCats.length})</Text>
              <Ionicons name={incomeOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.primary} />
            </TouchableOpacity>
            
            {incomeOpen && (
              <View style={{ padding: spacing.m }}>
                <View style={[st.addCatBox, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: spacing.m }]}>
                  <TextInput
                    style={{ color: colors.text, flex: 1, padding: spacing.s }}
                    placeholder="New Income Category"
                    placeholderTextColor={colors.textSecondary}
                    value={newIncomeName}
                    onChangeText={setNewIncomeName}
                  />
                  <TouchableOpacity onPress={() => handleAddCat('income')} style={[st.addBtn, { backgroundColor: colors.primary }]}>
                    <Ionicons name="add" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
                
                {incomeCats.map((item, index) => (
                  <DraggableCategoryItem 
                    key={item.id}
                    item={item}
                    drag={() => {}} // Simple list for now within scrollview
                    isActive={false}
                    colors={colors}
                    handleDeleteCat={handleDeleteCat}
                  />
                ))}
              </View>
            )}

            {/* Expense Section */}
            <TouchableOpacity 
              onPress={() => setExpenseOpen(!expenseOpen)}
              style={[st.secHeader, { backgroundColor: colors.error + '11', marginTop: spacing.s }]}
            >
              <Text style={{ color: colors.error, fontWeight: '700' }}>EXPENSE CATEGORIES ({expenseCats.length})</Text>
              <Ionicons name={expenseOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.error} />
            </TouchableOpacity>

            {expenseOpen && (
              <View style={{ padding: spacing.m }}>
                <View style={[st.addCatBox, { backgroundColor: colors.card, borderColor: colors.border, marginBottom: spacing.m }]}>
                  <TextInput
                    style={{ color: colors.text, flex: 1, padding: spacing.s }}
                    placeholder="New Expense Category"
                    placeholderTextColor={colors.textSecondary}
                    value={newExpenseName}
                    onChangeText={setNewExpenseName}
                  />
                  <TouchableOpacity onPress={() => handleAddCat('expense')} style={[st.addBtn, { backgroundColor: colors.error }]}>
                    <Ionicons name="add" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>

                {expenseCats.map((item, index) => (
                  <DraggableCategoryItem 
                    key={item.id}
                    item={item}
                    drag={() => {}} 
                    isActive={false}
                    colors={colors}
                    handleDeleteCat={handleDeleteCat}
                  />
                ))}
              </View>
            )}
          </ScrollView>
          </View>
        </GestureHandlerRootView>
      </Modal>

      {showTimePicker && (
        <DateTimePicker
          value={(() => {
            const [h, m] = dailyReminderTime.split(':').map(Number);
            const d = new Date();
            d.setHours(h, m, 0, 0);
            return d;
          })()}
          mode="time"
          is24Hour={true}
          display="default"
          onChange={onTimeChange}
        />
      )}

      {/* ── Log Out pinned at bottom ─────────────────────────── */}
      <View style={[st.footer, { backgroundColor: colors.background }]}>
        <TouchableOpacity onPress={handleLogout} style={[st.logoutBtn, { borderColor: '#F44336' }]}>
          <Ionicons name="log-out-outline" size={20} color="#F44336" />
          <Text style={{ color: '#F44336', fontWeight: '700', fontSize: 15, marginLeft: spacing.s }}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

// ─── Styles ──────────────────────────────────────────────────────────────────
const st = StyleSheet.create({
  container:      { flex: 1, padding: spacing.m },
  header:         { ...typography.header, marginBottom: spacing.m },
  avatarCircle:   { width: 72, height: 72, borderRadius: 36, alignSelf: 'center', justifyContent: 'center', alignItems: 'center', marginBottom: spacing.m },
  email:          { textAlign: 'center', fontWeight: '700', fontSize: 16 },
  subLabel:       { textAlign: 'center', fontSize: 12, marginTop: 4 },
  divider:        { height: 1, marginVertical: spacing.m },
  infoRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  infoLabel:      { fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  infoValue:      { fontSize: 13, fontWeight: '600', flex: 1, textAlign: 'right', marginLeft: spacing.s },
  settingsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.m, borderRadius: 12 },
  settingsRow:    { paddingVertical: spacing.m, borderBottomWidth: 1 },
  pillRow:        { flexDirection: 'row', gap: spacing.s },
  pill:           { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.m, paddingVertical: spacing.s, borderRadius: 20, borderWidth: 1.5 },
  footer:         { paddingVertical: spacing.m, paddingBottom: spacing.l },
  logoutBtn:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderRadius: 12, paddingVertical: spacing.m },
  pickerContainer: { borderWidth: 1, borderRadius: 12, overflow: 'hidden', marginTop: spacing.s },
  actionBtn: { paddingHorizontal: spacing.m, paddingVertical: spacing.s, borderRadius: 8 },
  toggle: { width: 44, height: 24, borderRadius: 12, padding: 2, justifyContent: 'center' },
  toggleCircle: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: spacing.l },
  modalContent: { padding: spacing.l },
  pinInput: { borderWidth: 1, borderRadius: 12, padding: spacing.m, textAlign: 'center', fontSize: 24, letterSpacing: 8 },
  catModal: { flex: 1 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.m, borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' },
  modalTitle: { fontWeight: 'bold', fontSize: 18 },
  addCatBox: { flexDirection: 'row', alignItems: 'center', padding: spacing.s, borderRadius: 12, borderWidth: 1 },
  addBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  catItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.m, borderBottomWidth: 1 },
  secHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.m, borderRadius: 8 },
  colorCircle: { width: 36, height: 36, borderRadius: 18, marginRight: spacing.s },
});
