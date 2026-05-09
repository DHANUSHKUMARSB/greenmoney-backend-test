import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { Card } from './Card';
import { Button } from './Button';

interface ConflictData {
  collection: string;
  local: any;
  cloud: any;
}

interface Props {
  conflict: ConflictData | null;
  onResolve: (choice: 'local' | 'cloud') => void;
  onClose: () => void;
}

export const ConflictResolutionModal = ({ conflict, onResolve, onClose }: Props) => {
  const { colors, spacing, borderRadius, typography } = useTheme();

  if (!conflict) return null;

  const { collection, local, cloud } = conflict;

  const renderPreview = (data: any, title: string, accent: string) => (
    <Card style={[st.previewCard, { borderColor: accent, borderWidth: 1 }]}>
      <Text style={[st.previewTitle, { color: accent }]}>{title}</Text>
      <View style={st.dataContainer}>
        {Object.entries(data).map(([key, val]) => {
          if (['id', 'user_id', 'sync_status', 'version', 'updated_at', 'deleted_at', 'cloud_id'].includes(key)) return null;
          return (
            <View key={key} style={st.dataRow}>
              <Text style={[st.dataKey, { color: colors.textSecondary }]}>{key}:</Text>
              <Text style={[st.dataVal, { color: colors.text }]} numberOfLines={1}>
                {typeof val === 'object' ? JSON.stringify(val) : String(val)}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={[st.versionText, { color: colors.textSecondary }]}>
        Version: {data.version} • {new Date(data.updated_at).toLocaleTimeString()}
      </Text>
    </Card>
  );

  return (
    <Modal visible={!!conflict} transparent animationType="fade">
      <View style={st.overlay}>
        <View style={[st.container, { backgroundColor: colors.background, borderRadius: borderRadius.xl }]}>
          <View style={st.header}>
            <Ionicons name="warning" size={28} color="#FFA726" />
            <Text style={[st.title, { color: colors.text }]}>Sync Conflict</Text>
            <TouchableOpacity onPress={onClose}><Ionicons name="close" size={24} color={colors.textSecondary} /></TouchableOpacity>
          </View>

          <Text style={[st.description, { color: colors.textSecondary }]}>
            Changes were made to this {collection.toLowerCase()} on both this device and the cloud. Which version should we keep?
          </Text>

          <ScrollView style={st.scroll} showsVerticalScrollIndicator={false}>
            {renderPreview(local, 'LOCAL VERSION (This Device)', colors.primary)}
            <View style={{ height: spacing.m }} />
            {renderPreview(cloud, 'CLOUD VERSION (Remote)', '#AB47BC')}
          </ScrollView>

          <View style={st.footer}>
            <Button 
              title="Keep Local" 
              onPress={() => onResolve('local')} 
              style={{ flex: 1, backgroundColor: colors.primary }} 
            />
            <View style={{ width: spacing.m }} />
            <Button 
              title="Keep Cloud" 
              onPress={() => onResolve('cloud')} 
              style={{ flex: 1, backgroundColor: '#AB47BC' }} 
            />
          </View>
        </View>
      </View>
    </Modal>
  );
};

const st = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 20 },
  container: { maxHeight: '85%', padding: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '800', flex: 1, marginLeft: 12 },
  description: { fontSize: 14, lineHeight: 20, marginBottom: 20 },
  scroll: { flexGrow: 0, marginBottom: 20 },
  previewCard: { padding: 16 },
  previewTitle: { fontSize: 12, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  dataContainer: { gap: 6 },
  dataRow: { flexDirection: 'row', justifyContent: 'space-between' },
  dataKey: { fontSize: 13, textTransform: 'capitalize' },
  dataVal: { fontSize: 13, fontWeight: '700', flex: 1, textAlign: 'right', marginLeft: 12 },
  versionText: { fontSize: 11, marginTop: 12, fontStyle: 'italic' },
  footer: { flexDirection: 'row' }
});
