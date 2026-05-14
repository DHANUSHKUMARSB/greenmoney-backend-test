import React, { useState } from 'react';
import {
  StyleSheet, Text, View, Alert, TouchableOpacity, ScrollView, TextInput, Modal, Pressable, Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { useTheme } from '../hooks/useTheme';
import { signOut } from '../services/authService';
import { FeedbackSheet } from '../components/FeedbackSheet';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store';
import { 
  getCategories, addCategory, deleteCategory, updateCategoriesOrder
} from '../services/database';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Select } from '../components/Select';
import * as Notifications from 'expo-notifications';
import { scheduleDailyReminder, requestNotificationPermissions } from '../services/notificationService';
import { syncEngine } from '../services/syncEngine';
import { localStorage } from '../services/localStorage';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useThemeStore, ACCENT_COLORS } from '../store/themeStore';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { settingsService } from '../services/settingsService';
import { soundEngine } from '../services/soundEngine';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { accountService } from '../services/accountService';
import { supabase } from '../services/supabase';
import Constants from 'expo-constants';
import { useForceUpdate } from '../hooks/useForceUpdate';
import { BlurView } from 'expo-blur';
import { firebaseProfileService } from '../services/firebaseProfileService';

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
  const { isDark, colors, spacing, typography, themeMode, setThemeMode, accentColor, setAccentColor } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, username, profileImage, setProfileImage } = useAuthStore();
  const { 
    currency, dailyReminderTime, autoSync, hideBalance, remindersEnabled,
    soundEnabled, hapticsEnabled, feedbackIntensity,
    swipeBehavior, swipeAnimation 
  } = useAppStore();
  const { accentColor: rawAccentColor } = useThemeStore();
  const navigation = useNavigation<any>();

  
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showCatModal, setShowCatModal] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState('');
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [lastTap, setLastTap] = useState(0);
  const { savedAccounts, setSavedAccounts } = useAuthStore();
  const [showFeedback, setShowFeedback] = useState(false);

  const { 
    availableVersions, 
    downloadAndInstall,
    isDownloading,
    downloadProgress
  } = useForceUpdate();

  useFocusEffect(React.useCallback(() => {
    localStorage.getLastSyncTimestamp().then(setLastSync);
    accountService.getSavedAccounts().then(setSavedAccounts);
    accountService.saveCurrentAccount(); 
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
      { text: 'Log Out', style: 'destructive', onPress: async () => { 
        await signOut(); 
      }},
    ]);
  };

  const onSwitchPress = () => {
    const now = Date.now();
    if (now - lastTap < 300) {
      handleQuickSwitch();
    } else {
      setLastTap(now);
      setTimeout(() => {
        setLastTap((prev) => {
          if (prev === now) setShowAccountModal(true);
          return prev;
        });
      }, 300);
    }
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

  const handleDeleteCat = (id: number) => {
    Alert.alert('Delete', 'Transactions remain, only category is removed.', [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteCategory(id); loadCategories(); }}
    ]);
  };

  const handleCopyId = async () => {
    if (user?.uid) {
      await Clipboard.setStringAsync(user.uid);
      Alert.alert('Copied', 'User ID copied to clipboard');
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Unknown';
    return new Date(dateString).toLocaleDateString(undefined, { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const handleSaveName = async () => {
    if (!tempName.trim() || !user) {
      setIsEditingName(false);
      return;
    }
    
    const originalName = username;
    const newName = tempName.trim();
    
    // Optimistic Update
    useAuthStore.getState().setUsername(newName);
    setIsEditingName(false);
    
    try {
      await firebaseProfileService.updateUsername(user.uid, newName);
      console.log('[FIREBASE]: Username synced successfully');
    } catch (e) {
      console.error('Failed to update name in Firebase', e);
      // Revert on failure
      useAuthStore.getState().setUsername(originalName);
      Alert.alert('Sync Delayed', 'Your name will update once you are back online.');
    }
  };

  const startEditing = () => {
    setTempName(username || '');
    setIsEditingName(true);
  };

  const handleEditAvatar = async () => {
    if (!user) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5, 
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      const originalImage = profileImage;
      
      // Optimistic Update
      setProfileImage(base64Image);
      
      try {
        await firebaseProfileService.uploadAvatar(user.uid, base64Image);
        console.log('[FIREBASE]: Avatar synced successfully');
      } catch (e) {
        console.error('Failed to upload avatar to Firebase', e);
        // We don't necessarily revert the image since it's cached locally now, 
        // but we warn the user.
        Alert.alert('Sync Delayed', 'Profile picture will sync once online.');
      }
    }
  };

  React.useEffect(() => { if (showCatModal) loadCategories(); }, [showCatModal]);

  return (
    <View style={[st.container, { backgroundColor: colors.background }]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingTop: insets.top + spacing.m, paddingBottom: 100, paddingHorizontal: 20 }}>
        <Text style={[st.header, { color: colors.text }]}>Settings</Text>

        <Card variant="tonal" style={[st.profileCard, { backgroundColor: colors.primary + '08', borderColor: colors.primary + '15' }]}>
          <View style={st.profileHeader}>
            <View style={[st.avatarContainer, { shadowColor: colors.primary }]}>
              <View style={[st.avatarBorder, { backgroundColor: colors.primary + '20' }]}>
                <View style={[st.avatar, { backgroundColor: colors.primary }]}>
                  {profileImage ? (
                    <Image source={{ uri: profileImage }} style={st.avatarImage} />
                  ) : (
                    <Text style={st.avatarText}>{(username || user?.email || 'U')[0].toUpperCase()}</Text>
                  )}
                </View>
              </View>
              <TouchableOpacity onPress={handleEditAvatar} style={[st.editAvatarBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="camera" size={14} color={colors.primary} />
              </TouchableOpacity>
            </View>

            <View style={st.profileMainInfo}>
              {isEditingName ? (
                <View style={st.editNameRow}>
                  <TextInput 
                    style={[st.nameInput, { color: colors.text, borderBottomColor: colors.primary }]}
                    value={tempName}
                    onChangeText={setTempName}
                    autoFocus
                    placeholder="Enter name"
                    placeholderTextColor={colors.textSecondary}
                  />
                  <TouchableOpacity onPress={handleSaveName}><Ionicons name="checkmark-circle" size={26} color={colors.primary} /></TouchableOpacity>
                  <TouchableOpacity onPress={() => setIsEditingName(false)}><Ionicons name="close-circle" size={26} color={colors.error} /></TouchableOpacity>
                </View>
              ) : (
                <View style={st.nameRow}>
                  <Text style={[st.username, { color: colors.text }]}>{username || 'User'}</Text>
                  <TouchableOpacity onPress={startEditing} style={st.editIcon}>
                    <Ionicons name="create-outline" size={18} color={colors.primary} />
                  </TouchableOpacity>
                </View>
              )}
              <Text style={[st.email, { color: colors.textSecondary }]}>{user?.email}</Text>
              
              <View style={st.statsRow}>
                <View style={[st.miniBadge, { backgroundColor: colors.primary + '10' }]}>
                  <Ionicons name="calendar-outline" size={12} color={colors.primary} />
                  <Text style={[st.miniBadgeText, { color: colors.primary }]}>{formatDate(user?.metadata?.creationTime)}</Text>
                </View>
                <TouchableOpacity onPress={handleCopyId} style={[st.miniBadge, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}>
                  <Ionicons name="finger-print-outline" size={12} color={colors.textSecondary} />
                  <Text style={[st.miniBadgeText, { color: colors.textSecondary }]}>ID: {user?.uid?.slice(0, 6)}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

        </Card>

        {/* Account section temporarily disabled during migration */}

        <Text style={[st.sectionTitle, { color: colors.textSecondary, marginTop: 8 }]}>Appearance</Text>
        <Card style={st.settingsGroup}>
          <SettingsItem icon="moon-outline" label="Theme Mode" colors={colors}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <ThemePill label="Light" icon="sunny" value="light" current={themeMode} colors={colors} onPress={() => settingsService.updateUserSetting('themeMode', 'light')} />
              <ThemePill label="Dark" icon="moon" value="dark" current={themeMode} colors={colors} onPress={() => settingsService.updateUserSetting('themeMode', 'dark')} />
            </View>
          </SettingsItem>
          <SettingsItem icon="color-palette-outline" label="Accent Color" colors={colors}>
            <View style={{ width: '60%', alignItems: 'flex-end' }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingRight: 4 }}>
                {ACCENT_COLORS.map(c => (
                  <TouchableOpacity 
                    key={c.color} 
                    onPress={() => settingsService.updateUserSetting('accentColor', c.color)} 
                    style={[
                      st.colorDot, 
                      { backgroundColor: isDark ? c.dark : c.color }, 
                      rawAccentColor === c.color && { borderWidth: 3, borderColor: colors.text }
                    ]} 
                  />
                ))}
              </ScrollView>
            </View>
          </SettingsItem>
          <SettingsItem 
            icon="shield-checkmark-outline" 
            label="Privacy & Security" 
            subtitle="Manage data visibility & masking" 
            onPress={() => navigation.navigate('PrivacySettings')}
            colors={colors} 
          >
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </SettingsItem>
          <SettingsItem icon="swap-horizontal-outline" label="Swipe Animation" colors={colors} showDivider={true}>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <ThemePill label="Standard" icon="remove" value="standard" current={swipeAnimation} colors={colors} onPress={() => settingsService.updateUserSetting('swipeAnimation', 'standard')} />
              <ThemePill label="3D Cube" icon="cube" value="cube" current={swipeAnimation} colors={colors} onPress={() => settingsService.updateUserSetting('swipeAnimation', 'cube')} />
            </View>
          </SettingsItem>
          
          <View style={[st.verticalSettingsItem, { borderBottomColor: colors.border + '22' }]}>
            <View style={st.settingsRow}>
              <View style={[st.iconCircle, { backgroundColor: colors.primaryContainer + '33' }]}>
                <Ionicons name="git-compare-outline" size={20} color={colors.primary} />
              </View>
              <Text style={[st.settingsLabel, { color: colors.text, marginLeft: 16 }]}>Swipe Behavior</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 6, marginTop: 12, paddingLeft: 56 }}>
              <ThemePill label="Screens" icon="apps" value="screens" current={swipeBehavior} colors={colors} onPress={() => settingsService.updateUserSetting('swipeBehavior', 'screens')} />
              <ThemePill label="Dates" icon="calendar" value="dates" current={swipeBehavior} colors={colors} onPress={() => settingsService.updateUserSetting('swipeBehavior', 'dates')} />
              <ThemePill label="None" icon="close-circle" value="none" current={swipeBehavior} colors={colors} onPress={() => settingsService.updateUserSetting('swipeBehavior', 'none')} />
            </View>
          </View>
        </Card>

        <Text style={[st.sectionTitle, { color: colors.textSecondary }]}>Preferences</Text>
        <Card style={st.settingsGroup}>
          <SettingsItem icon="cash-outline" label="Currency" subtitle="Change display currency" colors={colors} showDivider={false}>
             <View style={{ width: 140 }}>
                <Select 
                  value={currency} 
                  onValueChange={(v) => settingsService.updateUserSetting('currency', v)} 
                  options={[
                    { label: 'Rupee (₹)', value: 'INR', icon: 'cash-outline' },
                    { label: 'Dollar ($)', value: 'USD', icon: 'logo-usd' },
                    { label: 'Euro (€)', value: 'EUR', icon: 'logo-euro' }
                  ]}
                  style={{ marginBottom: 0 }}
                />
             </View>
          </SettingsItem>
          <SettingsItem 
            icon="grid-outline" 
            label="Categories" 
            subtitle="Manage & reorder categories" 
            onPress={() => navigation.navigate('CategoryManagement')} 
            colors={colors} 
            showDivider={false}
          >
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </SettingsItem>
        </Card>

        <Text style={[st.sectionTitle, { color: colors.textSecondary }]}>Support & Feedback</Text>
        <Card style={st.settingsGroup}>
          <SettingsItem 
            icon="chatbubble-ellipses-outline" 
            label="Send Feedback" 
            subtitle="Report bugs or suggest features" 
            onPress={() => setShowFeedback(true)} 
            colors={colors} 
            showDivider={false}
          >
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

          {remindersEnabled && (
            <SettingsItem icon="musical-notes-outline" label="Alert Tone" colors={colors} showDivider={false}>
              <View style={{ width: '65%', alignItems: 'flex-end' }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {(['modern', 'digital', 'chime', 'nature'] as const).map((s) => (
                    <ThemePill 
                      key={s} 
                      label={s.charAt(0).toUpperCase() + s.slice(1)} 
                      value={s} 
                      current={useAppStore.getState().notificationSound} 
                      colors={colors} 
                      onPress={() => {
                        settingsService.updateUserSetting('notificationSound', s);
                        soundEngine.play('tap'); 
                      }} 
                    />
                  ))}
                </ScrollView>
              </View>
            </SettingsItem>
          )}
        </Card>
              <Text style={[st.sectionTitle, { color: colors.textSecondary }]}>Sound & Interaction</Text>
        <Card style={st.settingsGroup}>
          <SettingsItem icon="volume-medium-outline" label="Master Sound" subtitle="Global audio toggle" colors={colors}>
            <TouchableOpacity onPress={() => {
              settingsService.updateUserSetting('soundEnabled', !soundEnabled);
              soundEngine.play('tap_secondary');
            }} style={[st.toggle, { backgroundColor: soundEnabled ? colors.primary : colors.border }]}>
              <View style={[st.toggleCircle, { alignSelf: soundEnabled ? 'flex-end' : 'flex-start' }]} />
            </TouchableOpacity>
          </SettingsItem>

          {soundEnabled && (
            <>
              <SettingsItem icon="library-outline" label="Sound Theme" colors={colors}>
                <View style={{ width: '65%', alignItems: 'flex-end' }}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                    {(['minimal', 'modern', 'futuristic', 'soft', 'playful'] as const).map((t) => (
                      <ThemePill 
                        key={t} 
                        label={t.charAt(0).toUpperCase() + t.slice(1)} 
                        value={t} 
                        current={useAppStore.getState().soundTheme} 
                        colors={colors} 
                        onPress={() => {
                          settingsService.updateUserSetting('soundTheme', t);
                          soundEngine.play('tap_primary');
                        }} 
                      />
                    ))}
                  </ScrollView>
                </View>
              </SettingsItem>
              <SettingsItem icon="radio-button-on-outline" label="Button Sounds" colors={colors}>
                <TouchableOpacity onPress={() => {
                  settingsService.updateUserSetting('buttonSoundsEnabled', !useAppStore.getState().buttonSoundsEnabled);
                  soundEngine.play('tap_secondary');
                }} style={[st.toggle, { backgroundColor: useAppStore.getState().buttonSoundsEnabled ? colors.primary : colors.border }]}>
                  <View style={[st.toggleCircle, { alignSelf: useAppStore.getState().buttonSoundsEnabled ? 'flex-end' : 'flex-start' }]} />
                </TouchableOpacity>
              </SettingsItem>
              <SettingsItem icon="swap-horizontal-outline" label="Swipe Sounds" colors={colors}>
                <TouchableOpacity onPress={() => {
                  settingsService.updateUserSetting('swipeSoundsEnabled', !useAppStore.getState().swipeSoundsEnabled);
                  soundEngine.play('tap_secondary');
                }} style={[st.toggle, { backgroundColor: useAppStore.getState().swipeSoundsEnabled ? colors.primary : colors.border }]}>
                  <View style={[st.toggleCircle, { alignSelf: useAppStore.getState().swipeSoundsEnabled ? 'flex-end' : 'flex-start' }]} />
                </TouchableOpacity>
              </SettingsItem>
              <SettingsItem icon="happy-outline" label="Emotional Feedback" colors={colors}>
                <TouchableOpacity onPress={() => {
                  settingsService.updateUserSetting('emotionalSoundsEnabled', !useAppStore.getState().emotionalSoundsEnabled);
                  soundEngine.play('tap_secondary');
                }} style={[st.toggle, { backgroundColor: useAppStore.getState().emotionalSoundsEnabled ? colors.primary : colors.border }]}>
                  <View style={[st.toggleCircle, { alignSelf: useAppStore.getState().emotionalSoundsEnabled ? 'flex-end' : 'flex-start' }]} />
                </TouchableOpacity>
              </SettingsItem>
            </>
          )}

          <SettingsItem icon="finger-print-outline" label="Haptic Feedback" subtitle="Tactile physical response" colors={colors} showDivider={true}>
            <TouchableOpacity onPress={() => {
              settingsService.updateUserSetting('hapticsEnabled', !hapticsEnabled);
              soundEngine.play('tap_secondary');
            }} style={[st.toggle, { backgroundColor: hapticsEnabled ? colors.primary : colors.border }]}>
              <View style={[st.toggleCircle, { alignSelf: hapticsEnabled ? 'flex-end' : 'flex-start' }]} />
            </TouchableOpacity>
          </SettingsItem>

          <SettingsItem icon="options-outline" label="Intensity" subtitle="Audio & haptic strength" colors={colors} showDivider={false}>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <Pressable 
                onPress={(e) => {
                  const { locationX } = e.nativeEvent;
                  const newIntensity = Math.max(0.1, Math.min(1, locationX / 150)); 
                  settingsService.updateUserSetting('feedbackIntensity', newIntensity);
                  soundEngine.play('tap_primary');
                }}
                style={{ width: 150, flexDirection: 'row', alignItems: 'center', gap: 10 }}
              >
                <Ionicons name="volume-low" size={16} color={colors.textSecondary} />
                <View style={{ flex: 1, height: 6, backgroundColor: colors.border, borderRadius: 3, overflow: 'hidden' }}>
                  <View style={{ width: `${(feedbackIntensity || 0.6) * 100}%`, height: '100%', backgroundColor: colors.primary }} />
                </View>
                <Ionicons name="volume-high" size={16} color={colors.textSecondary} />
              </Pressable>
            </View>
          </SettingsItem>
        </Card>

        <Text style={[st.sectionTitle, { color: colors.textSecondary }]}>Data & Security</Text>
        <Card style={st.settingsGroup}>
          <SettingsItem icon="cloud-done-outline" label="Cloud Sync" subtitle={lastSync ? `Last: ${new Date(lastSync).toLocaleTimeString()}` : 'Never synced'} colors={colors}>
             <TouchableOpacity onPress={handleManualSync} disabled={syncing} style={[st.syncBtn, { backgroundColor: colors.primary }]}>
                <Ionicons name={syncing ? "refresh" : "sync"} size={16} color="#fff" />
             </TouchableOpacity>
          </SettingsItem>

          {availableVersions.length > 0 && (
            <View style={{ paddingVertical: 12, paddingHorizontal: 16, borderTopWidth: 1, borderTopColor: colors.border + '22' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <View style={[st.iconCircle, { backgroundColor: colors.primaryContainer + '33', width: 32, height: 32 }]}>
                  <Ionicons name="download-outline" size={16} color={colors.primary} />
                </View>
                <Text style={[st.settingsLabel, { color: colors.text, marginLeft: 12, fontSize: 14 }]}>Updates Available</Text>
              </View>
              
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                {availableVersions.map(v => (
                  <TouchableOpacity 
                    key={v.version}
                    onPress={() => downloadAndInstall(v)}
                    disabled={isDownloading}
                    style={{ 
                      backgroundColor: colors.card, 
                      paddingHorizontal: 16, 
                      paddingVertical: 10, 
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: colors.primary + '44',
                      alignItems: 'center',
                      minWidth: 100
                    }}
                  >
                    <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 13 }}>v{v.version}</Text>
                    <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 2 }}>Install Now</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {isDownloading && (
                <View style={{ marginTop: 12 }}>
                  <View style={{ height: 4, backgroundColor: colors.border, borderRadius: 2, overflow: 'hidden' }}>
                    <View style={{ width: `${downloadProgress * 100}%`, height: '100%', backgroundColor: colors.primary }} />
                  </View>
                  <Text style={{ color: colors.primary, fontSize: 10, marginTop: 4, textAlign: 'center' }}>
                    Downloading... {Math.round(downloadProgress * 100)}%
                  </Text>
                </View>
              )}
            </View>
          )}

          <SettingsItem icon="log-out-outline" label="Sign Out" onPress={handleLogout} colors={colors} showDivider={false}>
            <Text style={{ color: colors.error, fontWeight: '700' }}>Logout</Text>
          </SettingsItem>
        </Card>

        <View style={{ alignItems: 'center', marginTop: 32, opacity: 0.4 }}>
          <Text style={{ color: colors.text, fontSize: 13, fontWeight: '700', letterSpacing: 1 }}>
            VERSION {Constants.expoConfig?.version || '1.0.0'}
          </Text>
          <Text style={{ color: colors.textSecondary, fontSize: 10, marginTop: 4 }}>
            GreenMoney © 2026
          </Text>
        </View>

      <View style={{ height: 40 }} />
      </ScrollView>

      {/* Accounts Modal (Bottom Sheet Style) */}
      <Modal visible={showAccountModal} animationType="slide" transparent={true}>
        <View style={st.modalOverlay}>
          <BlurView intensity={20} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          <Pressable style={st.modalDismissArea} onPress={() => setShowAccountModal(false)} />
          
          <Card style={[st.bottomSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={[st.sheetHandle, { backgroundColor: colors.border }]} />
            
            <View style={st.sheetHeader}>
              <View>
                <Text style={[st.sheetTitle, { color: colors.text }]}>Accounts</Text>
                <Text style={[st.sheetSubtitle, { color: colors.textSecondary }]}>Switch or add a new account</Text>
              </View>
              <TouchableOpacity style={st.closeCircle} onPress={() => setShowAccountModal(false)}>
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={st.accountList}>
              {savedAccounts.map((acc) => {
                const isActive = user?.id === acc.id;
                return (
                  <TouchableOpacity 
                    key={acc.id} 
                    onPress={() => !isActive && handleSwitchAccount(acc.id, acc.email)}
                    style={[
                      st.accountRow, 
                      isActive && { backgroundColor: colors.primary + '10', borderColor: colors.primary + '40' }
                    ]}
                  >
                    <View style={st.accountRowLeft}>
                      <View style={[st.accountAvatarWrapper, isActive && { borderColor: colors.primary }]}>
                        {acc.profileImage ? (
                          <Image source={{ uri: acc.profileImage }} style={st.accountAvatarImg} />
                        ) : (
                          <View style={[st.accountAvatarPlaceholder, { backgroundColor: isActive ? colors.primary : colors.primaryContainer }]}>
                            <Text style={st.accountAvatarText}>{(acc.username || acc.email || 'U')[0].toUpperCase()}</Text>
                          </View>
                        )}
                      </View>
                      <View style={st.accountRowText}>
                        <Text style={[st.accountName, { color: colors.text }]}>{acc.username || 'User'}</Text>
                        <Text style={[st.accountEmail, { color: colors.textSecondary }]}>{acc.email}</Text>
                      </View>
                    </View>
                    
                    {isActive ? (
                      <View style={[st.activeBadge, { backgroundColor: colors.primary }]}>
                        <Ionicons name="checkmark" size={12} color="#FFF" />
                        <Text style={st.activeBadgeText}>Current</Text>
                      </View>
                    ) : (
                      <Ionicons name="chevron-forward" size={18} color={colors.border} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity 
              style={[st.addAccountBtn, { borderColor: colors.primary }]}
              onPress={async () => {
                setShowAccountModal(false);
                await accountService.saveCurrentAccount();
                await signOut();
              }}
            >
              <View style={[st.addIconCircle, { backgroundColor: colors.primary + '15' }]}>
                <Ionicons name="add" size={24} color={colors.primary} />
              </View>
              <Text style={[st.addAccountText, { color: colors.primary }]}>Add another account</Text>
            </TouchableOpacity>
            <View style={{ height: insets.bottom + 20 }} />
          </Card>
        </View>
      </Modal>

      {/* Time Picker */}
      {showTimePicker && (
        <DateTimePicker
          value={new Date(new Date().setHours(...(dailyReminderTime.split(':').map(Number) as [number, number])))}
          mode="time"
          is24Hour={false}
          display="default"
          onChange={onTimeChange}
        />
      )}

      <FeedbackSheet 
        isVisible={showFeedback} 
        onClose={() => setShowFeedback(false)} 
      />
    </View>
  );
};

const st = StyleSheet.create({
  container: { flex: 1 },
  header: { fontSize: 32, fontWeight: '900', marginBottom: 24 },
  profileCard: { padding: 24, marginBottom: 24, borderRadius: 32, borderWidth: 1 },
  profileHeader: { flexDirection: 'column', alignItems: 'center', marginBottom: 20 },
  avatarContainer: { position: 'relative', marginBottom: 16, shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 15, elevation: 10 },
  avatarBorder: { width: 100, height: 100, borderRadius: 50, padding: 4, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: '100%', height: '100%', borderRadius: 46, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { color: '#fff', fontSize: 36, fontWeight: '800' },
  editAvatarBtn: { position: 'absolute', bottom: 0, right: 0, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowOpacity: 0.2, shadowRadius: 4, borderWidth: 2 },
  profileMainInfo: { alignItems: 'center', width: '100%' },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  username: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  editIcon: { marginLeft: 8, padding: 4 },
  editNameRow: { flexDirection: 'row', alignItems: 'center', gap: 12, width: '100%', justifyContent: 'center' },
  nameInput: { fontSize: 22, fontWeight: '900', paddingVertical: 4, borderBottomWidth: 2, textAlign: 'center', minWidth: 150 },
  email: { fontSize: 14, marginTop: 4, opacity: 0.7 },
  statsRow: { flexDirection: 'row', gap: 8, marginTop: 16 },
  miniBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, gap: 6 },
  miniBadgeText: { fontSize: 11, fontWeight: '700' },
  glassSwitchBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 12, borderRadius: 20, width: '100%' },
  glassSwitchLeft: { flexDirection: 'row', alignItems: 'center' },
  switchIconCircle: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  glassSwitchText: { fontSize: 14, fontWeight: '700' },
  accountPill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, gap: 6 },
  accountPillText: { fontSize: 11, fontWeight: '800' },
  sectionTitle: { fontSize: 13, fontWeight: '800', marginLeft: 16, marginBottom: 12, marginTop: 24, textTransform: 'uppercase', letterSpacing: 1 },
  settingsGroup: { paddingHorizontal: 4, marginBottom: 8 },
  settingsItem: { flexDirection: 'row', alignItems: 'center', padding: 16 },
  verticalSettingsItem: { padding: 16 },
  settingsRow: { flexDirection: 'row', alignItems: 'center' },
  iconCircle: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  settingsLabel: { fontSize: 15, fontWeight: '700' },
  toggle: { width: 44, height: 24, borderRadius: 12, padding: 2, justifyContent: 'center' },
  miniToggle: { width: 32, height: 18, borderRadius: 9, padding: 2, justifyContent: 'center' },
  toggleCircle: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  privacyToggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingRight: 16 },
  pill: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, borderWidth: 1 },
  colorDot: { width: 24, height: 24, borderRadius: 12 },
  pickerBox: { width: '50%', height: 40, justifyContent: 'center' },
  syncBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  modal: { flex: 1 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20 },
  modalTitle: { fontSize: 20, fontWeight: '800' },
  addCatSection: { padding: 20 },
  catTypeSelector: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  typeBtn: { flex: 1, height: 40, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.05)', alignItems: 'center', justifyContent: 'center' },
  inputRow: { flexDirection: 'row', gap: 10 },
  modalInput: { height: 44, borderRadius: 12, paddingHorizontal: 16, fontSize: 15 },
  addBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  catItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end' },
  modalDismissArea: { flex: 1 },
  bottomSheet: { width: '100%', borderTopLeftRadius: 36, borderTopRightRadius: 36, padding: 24, borderTopWidth: 1, shadowOffset: { width: 0, height: -10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 20 },
  sheetHandle: { width: 40, height: 5, borderRadius: 3, alignSelf: 'center', marginBottom: 20, opacity: 0.2 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  sheetTitle: { fontSize: 24, fontWeight: '900', letterSpacing: -0.5 },
  sheetSubtitle: { fontSize: 14, marginTop: 2, opacity: 0.6 },
  closeCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,0,0,0.05)', alignItems: 'center', justifyContent: 'center' },
  accountList: { maxHeight: 400 },
  accountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 24, marginBottom: 10, borderWidth: 1, borderColor: 'transparent' },
  accountRowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  accountAvatarWrapper: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, borderColor: 'transparent', padding: 2 },
  accountAvatarImg: { width: '100%', height: '100%', borderRadius: 24 },
  accountAvatarPlaceholder: { width: '100%', height: '100%', borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  accountAvatarText: { color: '#FFF', fontSize: 18, fontWeight: '800' },
  accountRowText: { marginLeft: 16, flex: 1 },
  accountName: { fontSize: 16, fontWeight: '800' },
  accountEmail: { fontSize: 12, marginTop: 2, opacity: 0.5 },
  activeBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, gap: 4 },
  activeBadgeText: { color: '#FFF', fontSize: 10, fontWeight: '900', textTransform: 'uppercase' },
  addAccountBtn: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 24, marginTop: 10, borderStyle: 'dashed', borderWidth: 1.5 },
  addIconCircle: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  addAccountText: { fontSize: 16, fontWeight: '800', marginLeft: 16 },
});
