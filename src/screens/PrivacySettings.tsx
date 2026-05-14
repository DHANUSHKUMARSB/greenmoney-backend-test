import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { useAppStore } from '../store';
import { settingsService } from '../services/settingsService';
import { Card } from '../components/Card';
import { useNavigation } from '@react-navigation/native';

export const PrivacySettingsScreen = () => {
  const { colors, spacing } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { hideBalance, hideIncome, hideExpense } = useAppStore();

  const PrivacyItem = ({ label, subtitle, value, onToggle, icon }: any) => (
    <View style={[styles.item, { borderBottomColor: colors.border + '22' }]}>
      <View style={[styles.iconCircle, { backgroundColor: colors.primaryContainer + '33' }]}>
        <Ionicons name={icon} size={20} color={colors.primary} />
      </View>
      <View style={{ flex: 1, marginLeft: 16 }}>
        <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{subtitle}</Text>
      </View>
      <TouchableOpacity 
        onPress={onToggle} 
        style={[styles.toggle, { backgroundColor: value ? colors.primary : colors.border }]}
      >
        <View style={[styles.toggleCircle, { alignSelf: value ? 'flex-end' : 'flex-start' }]} />
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 10, paddingBottom: 20 }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Privacy Control</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Visibility Settings</Text>
        <Card style={styles.card}>
          <PrivacyItem 
            icon="wallet-outline"
            label="Mask Total Balance" 
            subtitle="Hides your net worth on the dashboard" 
            value={hideBalance} 
            onToggle={() => settingsService.updateUserSetting('hideBalance', !hideBalance)} 
          />
          <PrivacyItem 
            icon="trending-up-outline"
            label="Mask Monthly Income" 
            subtitle="Hides income summaries and amounts" 
            value={hideIncome} 
            onToggle={() => settingsService.updateUserSetting('hideIncome', !hideIncome)} 
          />
          <PrivacyItem 
            icon="trending-down-outline"
            label="Mask Monthly Expenses" 
            subtitle="Hides expense summaries and amounts" 
            value={hideExpense} 
            onToggle={() => settingsService.updateUserSetting('hideExpense', !hideExpense)} 
          />
        </Card>

        <View style={[styles.infoBox, { backgroundColor: colors.primary + '10' }]}>
          <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
          <Text style={[styles.infoText, { color: colors.textSecondary }]}>
            These settings only affect the visual display on your dashboard. Your data remains securely stored and synced.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 20, fontWeight: '800' },
  sectionTitle: { fontSize: 13, fontWeight: '800', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 },
  card: { paddingHorizontal: 4 },
  item: { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1 },
  iconCircle: { width: 40, height: 40, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  label: { fontSize: 15, fontWeight: '700' },
  toggle: { width: 44, height: 24, borderRadius: 12, padding: 2, justifyContent: 'center' },
  toggleCircle: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  infoBox: { flexDirection: 'row', padding: 16, borderRadius: 16, marginTop: 24, gap: 12, alignItems: 'center' },
  infoText: { flex: 1, fontSize: 12, lineHeight: 18 }
});
