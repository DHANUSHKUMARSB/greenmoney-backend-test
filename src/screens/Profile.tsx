import React, { useState } from 'react';
import {
  StyleSheet, Text, View, Alert, TouchableOpacity, ScrollView, TextInput, Modal, Pressable
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { useTheme } from '../hooks/useTheme';
import { signOut } from '../services/authService';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store';
import { 
  getCategories, addCategory, deleteCategory, updateCategoriesOrder
} from '../services/database';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import * as Notifications from 'expo-notifications';
import { scheduleDailyReminder, requestNotificationPermissions } from '../services/notificationService';
import { syncEngine } from '../services/syncEngine';
import { localStorage } from '../services/localStorage';
import { useFocusEffect } from '@react-navigation/native';
import { useThemeStore, ACCENT_COLORS } from '../store/themeStore';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { settingsService } from '../services/settingsService';

const ThemePill = ({ label, icon, value, current, onPress, colors }: any) => {
  const active = current === value;
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        st.pill,
        {
          backgroundColor: active ? colors.primary : colors.card,
          borderColor: active ? colors.primary : colors.border,
        },
      ]}
    >
      <Ionicons name={icon} size={16} color={active ? '#fff' : colors.textSecondary} />
      <Text style={{ color: active ? '#fff' : colors.text, marginLeft: 6, fontWeight: '700', fontSize: 12 }}>{label}</Text>
    </TouchableOpacity>
  );
};

const SettingsItem = ({ icon, label, subtitle, onPress, children, colors, showDivider = true }: any) => (
  <TouchableOpacity onPress={onPress} disabled={!onPress} style={[st.settingsItem, showDivider && { borderBottomWidth: 1, borderBottomColor: colors.border + '22' }]}>
    <View style={[st.iconCircle, { backgroundColor: colors.primaryContainer + '33' }]}>
      <Ionicons name={icon} size={20} color={colors.primary} />
    </View>
    <View style={{ flex: 1, marginLeft: 16 }}>
      <Text style={[st.settingsLabel, { color: colors.text }]}>{label}</Text>
      {subtitle && <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{subtitle}</Text>}
    </View>
    {children}
  </TouchableOpacity>
);

export const ProfileScreen = () => {
  const { colors, spacing, typography, themeMode, setThemeMode, accentColor, setAccentColor } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, username } = useAuthStore();
  const { currency, dailyReminderTime, autoSync, hideBalance, remindersEnabled } = useAppStore();
  
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [newCatName, setNewCatName] = useState('');
  const [catType, setCatType] = useState<'income' | 'expense'>('expense');
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);

  useFocusEffect(React.useCallback(() => {
    localStorage.getLastSyncTimestamp().then(setLastSync);
  }, []));

  const handleManualSync = async () => {
    setSyncing(true);
    try {
      await syncEngine.runSync(true);
      setLastSync(await localStorage.getLastSyncTimestamp());
      Alert.alert('Sync Successful', 'Your data is backed up.');
    } catch (e) { Alert.alert('Sync Error', 'Check your connection.'); }
    finally { setSyncing(false); }
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log Out', style: 'destructive', onPress: async () => { await signOut(); }},
    ]);
  };

  const toggleReminders = async (value: boolean) => {
    if (value) {
      if (await requestNotificationPermissions()) {
        const [h, m] = dailyReminderTime.split(':').map(Number);
        await scheduleDailyReminder(h, m);
      } else return;
    } else await Notifications.cancelAllScheduledNotificationsAsync();
    settingsService.updateUserSetting('remindersEnabled', value);
  };

  const onTimeChange = async (event: any, date?: Date) => {
    setShowTimePicker(false);
    if (date) {
      const time = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
      settingsService.updateUserSetting('dailyReminderTime', time);
      if (remindersEnabled) await scheduleDailyReminder(date.getHours(), date.getMinutes());
    }
  };

  const formatTime12h = (time24: string) => {
    if (!time24) return '--:--';
    const [h, m] = time24.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`;
  };

  const loadCategories = async () => setCategories(await getCategories());

  const handleAddCat = async () => {
    if (!newCatName.trim()) return;
    await addCategory(newCatName.trim(), catType);
    setNewCatName('');
    loadCategories();
  };

  const handleDeleteCat = (id: number) => {
    Alert.alert('Delete', 'Transactions remain, only category is removed.', [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteCategory(id); loadCategories(); }}
    ]);
  };

  React.useEffect(() => { if (showCatModal) loadCategories(); }, [showCatModal]);

  return (
    <View style={[st.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + spacing.m, paddingBottom: 100, paddingHorizontal: 20 }}>
        <Text style={[st.header, { color: colors.text }]}>Settings</Text>

        <Card variant="tonal" style={st.profileCard}>
          <View style={[st.avatar, { backgroundColor: colors.primary }]}>
            <Text style={{ color: '#fff', fontSize: 32, fontWeight: '800' }}>{(username || user?.email || 'U')[0].toUpperCase()}</Text>
          </View>
          <Text style={[st.username, { color: colors.text }]}>{username || user?.email?.split('@')[0]}</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 14 }}>{user?.email}</Text>
        </Card>

        <Text style={[st.sectionTitle, { color: colors.textSecondary }]}>Appearance</Text>
        <Card style={st.settingsGroup}>
          <SettingsItem icon="moon-outline" label="Theme Mode" colors={colors}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <ThemePill label="Light" icon="sunny" value="light" current={themeMode} colors={colors} onPress={() => setThemeMode('light')} />
              <ThemePill label="Dark" icon="moon" value="dark" current={themeMode} colors={colors} onPress={() => setThemeMode('dark')} />
            </View>
          </SettingsItem>
          <SettingsItem icon="color-palette-outline" label="Accent Color" colors={colors}>
            <View style={{ width: '60%', alignItems: 'flex-end' }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 4 }}>
                {ACCENT_COLORS.map(c => (
                  <TouchableOpacity key={c.color} onPress={() => setAccentColor(c.color)} style={[st.colorDot, { backgroundColor: c.color }, accentColor === c.color && { borderWidth: 3, borderColor: colors.text }]} />
                ))}
              </ScrollView>
            </View>
          </SettingsItem>
          <SettingsItem icon="eye-off-outline" label="Privacy" subtitle="Hide balance on dashboard" colors={colors} showDivider={false}>
            <TouchableOpacity onPress={() => settingsService.updateUserSetting('hideBalance', !hideBalance)} style={[st.toggle, { backgroundColor: hideBalance ? colors.primary : colors.border }]}>
              <View style={[st.toggleCircle, { alignSelf: hideBalance ? 'flex-end' : 'flex-start' }]} />
            </TouchableOpacity>
          </SettingsItem>
        </Card>

        <Text style={[st.sectionTitle, { color: colors.textSecondary }]}>Preferences</Text>
        <Card style={st.settingsGroup}>
          <SettingsItem icon="cash-outline" label="Currency" subtitle={currency} colors={colors}>
             <View style={st.pickerBox}>
                <Picker selectedValue={currency} onValueChange={(v) => settingsService.updateUserSetting('currency', v)} style={{ color: colors.text }}>
                  <Picker.Item label="Rupee (₹)" value="INR" />
                  <Picker.Item label="Dollar ($)" value="USD" />
                  <Picker.Item label="Euro (€)" value="EUR" />
                </Picker>
             </View>
          </SettingsItem>
          <SettingsItem icon="grid-outline" label="Categories" onPress={() => setShowCatModal(true)} colors={colors} showDivider={false}>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </SettingsItem>
        </Card>

        <Text style={[st.sectionTitle, { color: colors.textSecondary }]}>Notification</Text>
        <Card style={st.settingsGroup}>
          <SettingsItem icon="notifications-outline" label="Daily Reminder" subtitle="Get a nudge to log expenses" colors={colors}>
            <TouchableOpacity onPress={() => toggleReminders(!remindersEnabled)} style={[st.toggle, { backgroundColor: remindersEnabled ? colors.primary : colors.border }]}>
              <View style={[st.toggleCircle, { alignSelf: remindersEnabled ? 'flex-end' : 'flex-start' }]} />
            </TouchableOpacity>
          </SettingsItem>
          <SettingsItem 
            icon="time-outline" 
            label="Reminder Time" 
            subtitle={formatTime12h(dailyReminderTime)} 
            onPress={() => remindersEnabled && setShowTimePicker(true)} 
            colors={colors} 
            showDivider={false}
          >
            {!remindersEnabled && <Ionicons name="lock-closed" size={16} color={colors.textSecondary} />}
            {remindersEnabled && <Ionicons name="chevron-forward" size={16} color={colors.textSecondary} />}
          </SettingsItem>
        </Card>

        <Text style={[st.sectionTitle, { color: colors.textSecondary }]}>Data & Security</Text>
        <Card style={st.settingsGroup}>
          <SettingsItem icon="cloud-done-outline" label="Cloud Sync" subtitle={lastSync ? `Last: ${new Date(lastSync).toLocaleTimeString()}` : 'Never synced'} colors={colors}>
             <TouchableOpacity onPress={handleManualSync} disabled={syncing} style={[st.syncBtn, { backgroundColor: colors.primary }]}>
                <Ionicons name={syncing ? "refresh" : "sync"} size={16} color="#fff" />
             </TouchableOpacity>
          </SettingsItem>
          <SettingsItem icon="log-out-outline" label="Sign Out" onPress={handleLogout} colors={colors} showDivider={false}>
            <Text style={{ color: colors.error, fontWeight: '700' }}>Logout</Text>
          </SettingsItem>
        </Card>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Categories Modal */}
      <Modal visible={showCatModal} animationType="slide">
        <View style={[st.modal, { backgroundColor: colors.background, paddingTop: insets.top }]}>
          <View style={st.modalHeader}>
            <TouchableOpacity onPress={() => setShowCatModal(false)}><Ionicons name="close" size={28} color={colors.text} /></TouchableOpacity>
            <Text style={[st.modalTitle, { color: colors.text }]}>Categories</Text>
            <View style={{ width: 28 }} />
          </View>

          <View style={st.addCatSection}>
            <View style={st.catTypeSelector}>
              <TouchableOpacity onPress={() => setCatType('expense')} style={[st.typeBtn, catType === 'expense' && { backgroundColor: colors.error }]}>
                <Text style={{ color: catType === 'expense' ? '#fff' : colors.textSecondary, fontWeight: '700' }}>Expense</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setCatType('income')} style={[st.typeBtn, catType === 'income' && { backgroundColor: colors.primary }]}>
                <Text style={{ color: catType === 'income' ? '#fff' : colors.textSecondary, fontWeight: '700' }}>Income</Text>
              </TouchableOpacity>
            </View>
            <View style={[st.inputRow, { backgroundColor: colors.card }]}>
              <TextInput style={{ flex: 1, color: colors.text, padding: 12 }} placeholder="New category name" placeholderTextColor={colors.textSecondary} value={newCatName} onChangeText={setNewCatName} />
              <TouchableOpacity onPress={handleAddCat} style={[st.addBtnCircle, { backgroundColor: colors.primary }]}><Ionicons name="add" size={24} color="#fff" /></TouchableOpacity>
            </View>
          </View>

          <ScrollView style={{ flex: 1, paddingHorizontal: 20 }}>
            {categories.filter(c => c.type === catType).map(c => (
              <View key={c.id} style={[st.catRow, { borderBottomColor: colors.border + '22' }]}>
                <Text style={{ color: colors.text, fontWeight: '600' }}>{c.name}</Text>
                <TouchableOpacity onPress={() => handleDeleteCat(c.id)}><Ionicons name="trash-outline" size={20} color={colors.error} /></TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>

      {showTimePicker && (
        <DateTimePicker 
          value={new Date()} 
          mode="time" 
          is24Hour={false} 
          onChange={onTimeChange} 
        />
      )}
    </View>
  );
};

const st = StyleSheet.create({
  container: { flex: 1 },
  header: { fontSize: 32, fontWeight: '800', marginBottom: 24 },
  profileCard: { padding: 24, alignItems: 'center', marginBottom: 32 },
  avatar: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  username: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  sectionTitle: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12, marginLeft: 4 },
  settingsGroup: { paddingHorizontal: 16, marginBottom: 24 },
  settingsItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  settingsLabel: { fontSize: 16, fontWeight: '700' },
  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1 },
  colorDot: { width: 28, height: 28, borderRadius: 14 },
  toggle: { width: 44, height: 24, borderRadius: 12, padding: 2, justifyContent: 'center' },
  toggleCircle: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  pickerBox: { width: 120, height: 40, justifyContent: 'center' },
  syncBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  modal: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  addCatSection: { padding: 20, gap: 16 },
  catTypeSelector: { flexDirection: 'row', backgroundColor: '#8882', borderRadius: 12, padding: 4 },
  typeBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  inputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingRight: 8 },
  addBtnCircle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  catRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1 },
});
