import React from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Transaction, localStorage } from '../services/localStorage';
import { useTheme } from '../hooks/useTheme';
import { spacing, typography } from '../utils/theme';
import { Card } from './Card';
import { Button } from './Button';
import { useCurrency } from '../hooks/useCurrency';
import { api } from '../services/api';
import { useAuthStore } from '../store/authStore';

interface SyncConflictModalProps {
  transaction: Transaction | null;
  onResolve: () => void;
  onClose: () => void;
}

export const SyncConflictModal = ({ transaction, onResolve, onClose }: SyncConflictModalProps) => {
  const { colors } = useTheme();
  const { format } = useCurrency();
  const user = useAuthStore(state => state.user);
  const [cloudVersion, setCloudVersion] = React.useState<Transaction | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (transaction && user) {
      fetchCloudVersion();
    }
  }, [transaction]);

  const fetchCloudVersion = async () => {
    if (!transaction || !user) return;
    setLoading(true);
    try {
      // Pull latest from cloud to compare
      const updates = await api.pullSync(user.id, null);
      const remote = updates.find((t: any) => t.local_id === transaction.id);
      if (remote) setCloudVersion(remote);
    } catch (e) {
      console.error('Failed to fetch cloud version for conflict', e);
    } finally {
      setLoading(false);
    }
  };

  const handleResolve = async (winner: 'local' | 'cloud') => {
    if (!transaction || !user) return;

    if (winner === 'local') {
      // Keep local: Increment version to ensure it overwrites cloud on next sync
      await localStorage.updateTransaction(transaction.id, {
        sync_status: 'pending',
        version: (cloudVersion?.version || transaction.version) + 1
      }, true);
    } else if (cloudVersion) {
      // Keep cloud: Overwrite local with cloud data
      await localStorage.updateTransaction(transaction.id, {
        ...cloudVersion,
        sync_status: 'synced'
      }, true);
    }

    onResolve();
  };

  if (!transaction) return null;

  return (
    <Modal visible={!!transaction} transparent animationType="fade">
      <View style={st.overlay}>
        <View style={[st.content, { backgroundColor: colors.background }]}>
          <View style={st.header}>
            <Ionicons name="warning-outline" size={24} color="#AB47BC" />
            <Text style={[st.title, { color: colors.text }]}>Sync Conflict</Text>
          </View>
          
          <Text style={[st.subtitle, { color: colors.textSecondary }]}>
            This transaction was modified on another device. Which version would you like to keep?
          </Text>

          <ScrollView style={st.scroll}>
            <View style={st.comparison}>
              {/* Local Version */}
              <TouchableOpacity 
                style={[st.versionCard, { borderColor: colors.primary, backgroundColor: colors.card }]}
                onPress={() => handleResolve('local')}
              >
                <View style={st.badge}><Text style={st.badgeText}>LOCAL</Text></View>
                <Text style={[st.amount, { color: transaction.type === 'income' ? '#4CAF50' : '#F44336' }]}>
                  {transaction.type === 'income' ? '+' : '-'}{format(transaction.amount)}
                </Text>
                <Text style={[st.detail, { color: colors.text }]}>{transaction.category}</Text>
                <Text style={[st.detail, { color: colors.textSecondary }]}>{transaction.description || 'No description'}</Text>
                <Text style={[st.date, { color: colors.textSecondary }]}>{new Date(transaction.date).toLocaleDateString()}</Text>
                <Text style={[st.time, { color: colors.textSecondary }]}>Updated: {new Date(transaction.updated_at).toLocaleString()}</Text>
              </TouchableOpacity>

              <View style={st.vs}><Text style={{ color: colors.textSecondary }}>VS</Text></View>

              {/* Cloud Version */}
              {loading ? (
                <View style={st.loading}><Text style={{ color: colors.textSecondary }}>Loading cloud version...</Text></View>
              ) : cloudVersion ? (
                <TouchableOpacity 
                  style={[st.versionCard, { borderColor: '#AB47BC', backgroundColor: colors.card }]}
                  onPress={() => handleResolve('cloud')}
                >
                  <View style={[st.badge, { backgroundColor: '#AB47BC' }]}><Text style={st.badgeText}>CLOUD</Text></View>
                  <Text style={[st.amount, { color: cloudVersion.type === 'income' ? '#4CAF50' : '#F44336' }]}>
                    {cloudVersion.type === 'income' ? '+' : '-'}{format(cloudVersion.amount)}
                  </Text>
                  <Text style={[st.detail, { color: colors.text }]}>{cloudVersion.category}</Text>
                  <Text style={[st.detail, { color: colors.textSecondary }]}>{cloudVersion.description || 'No description'}</Text>
                  <Text style={[st.date, { color: colors.textSecondary }]}>{new Date(cloudVersion.date).toLocaleDateString()}</Text>
                  <Text style={[st.time, { color: colors.textSecondary }]}>Updated: {new Date(cloudVersion.updated_at).toLocaleString()}</Text>
                </TouchableOpacity>
              ) : (
                <View style={st.loading}><Text style={{ color: colors.textSecondary }}>Cloud version not found.</Text></View>
              )}
            </View>
          </ScrollView>

          <View style={st.footer}>
            <Button title="Decide Later" variant="outline" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const st = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: spacing.l },
  content: { borderRadius: 24, padding: spacing.l, maxHeight: '85%' },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.s },
  title: { ...typography.title, marginLeft: spacing.s },
  subtitle: { fontSize: 14, marginBottom: spacing.l },
  scroll: { marginBottom: spacing.l },
  comparison: { gap: spacing.m },
  versionCard: { padding: spacing.m, borderRadius: 16, borderWidth: 2 },
  badge: { backgroundColor: '#42A5F5', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginBottom: spacing.s },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: 'bold' },
  amount: { fontSize: 20, fontWeight: 'bold', marginBottom: 4 },
  detail: { fontSize: 15, fontWeight: '600' },
  date: { fontSize: 12, marginTop: 4 },
  time: { fontSize: 10, marginTop: 2, opacity: 0.7 },
  vs: { alignSelf: 'center', paddingVertical: 4 },
  loading: { height: 150, justifyContent: 'center', alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderRadius: 16, borderColor: '#ccc' },
  footer: { gap: spacing.m },
});
