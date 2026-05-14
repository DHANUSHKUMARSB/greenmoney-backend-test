import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { getTransactions } from '../services/database';
import { useCurrency } from '../hooks/useCurrency';
import { duplicateDetectionService, DuplicateMatch, ConfidenceLevel } from '../services/duplicateDetectionService';

export const DuplicateDetectionScreen = () => {
  const { colors, spacing, typography, borderRadius } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { format } = useCurrency();
  
  const importedTxs = route.params?.transactions || [];
  const [duplicateMatches, setDuplicateMatches] = useState<DuplicateMatch[]>([]);
  const [markedDuplicateIndices, setMarkedDuplicateIndices] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    runDetection();
  }, []);

  const runDetection = async () => {
    setIsLoading(true);
    try {
      const existing = await getTransactions();
      const matches = duplicateDetectionService.detectDuplicates(importedTxs, existing);
      setDuplicateMatches(matches);
      
      // Auto-mark HIGH confidence matches as duplicates by default
      const initialDupes = new Set<number>();
      matches.forEach(m => {
        if (m.confidence === 'HIGH') initialDupes.add(m.importedIndex);
      });
      setMarkedDuplicateIndices(initialDupes);
    } catch (error) {
      Alert.alert('Error', 'Failed to run duplicate detection.');
    } finally {
      setIsLoading(false);
    }
  };

  const highConfIndices = useMemo(() => 
    duplicateMatches.filter(m => m.confidence === 'HIGH').map(m => m.importedIndex), 
  [duplicateMatches]);

  const medConfIndices = useMemo(() => 
    duplicateMatches.filter(m => m.confidence === 'MEDIUM').map(m => m.importedIndex), 
  [duplicateMatches]);

  const allIndices = useMemo(() => 
    duplicateMatches.map(m => m.importedIndex), 
  [duplicateMatches]);

  const toggleHighConf = () => {
    const allSelected = highConfIndices.every(idx => markedDuplicateIndices.has(idx));
    const next = new Set(markedDuplicateIndices);
    if (allSelected) {
      highConfIndices.forEach(idx => next.delete(idx));
    } else {
      highConfIndices.forEach(idx => next.add(idx));
    }
    setMarkedDuplicateIndices(next);
  };

  const toggleMedConf = () => {
    const allSelected = medConfIndices.every(idx => markedDuplicateIndices.has(idx));
    const next = new Set(markedDuplicateIndices);
    if (allSelected) {
      medConfIndices.forEach(idx => next.delete(idx));
    } else {
      medConfIndices.forEach(idx => next.add(idx));
    }
    setMarkedDuplicateIndices(next);
  };

  const toggleAll = () => {
    if (markedDuplicateIndices.size === allIndices.length) {
      setMarkedDuplicateIndices(new Set());
    } else {
      setMarkedDuplicateIndices(new Set(allIndices));
    }
  };

  const toggleDuplicate = (idx: number) => {
    const next = new Set(markedDuplicateIndices);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setMarkedDuplicateIndices(next);
  };

  const handleProceed = () => {
    const cleaned = importedTxs.filter((_: any, idx: number) => !markedDuplicateIndices.has(idx));
    navigation.navigate('BulkImportReview', { 
      transactions: cleaned,
      duplicatesRemoved: markedDuplicateIndices.size 
    });
  };

  const getConfidenceColor = (level: ConfidenceLevel) => {
    if (level === 'HIGH') return colors.error;
    if (level === 'MEDIUM') return '#FF9800';
    return colors.textSecondary;
  };

  const dynamicStyles = useMemo(() => ({
    colLabel: { fontSize: 10, fontWeight: '800', color: colors.textSecondary, marginBottom: 8 },
    valAmount: { fontSize: 18, fontWeight: '800', color: colors.text },
    valDate: { fontSize: 12, color: colors.textSecondary, marginBottom: 4 },
    valDesc: { fontSize: 13, fontWeight: '500', color: colors.text },
    vsText: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.border + '22', alignItems: 'center', justifyContent: 'center' },
  }), [colors]);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ color: colors.textSecondary }}>Scanning for duplicates...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + spacing.m }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View>
          <Text style={[styles.title, { color: colors.text }]}>Duplicate Review</Text>
          <Text style={{ color: colors.textSecondary, fontSize: 13 }}>{duplicateMatches.length} possible duplicates found</Text>
        </View>
      </View>

      {duplicateMatches.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={[styles.successIcon, { backgroundColor: colors.income + '22' }]}>
            <Ionicons name="checkmark-circle" size={60} color={colors.income} />
          </View>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Duplicates Detected</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>All imported transactions seem unique. You can proceed to preview.</Text>
          <Button title="Continue to Preview" onPress={handleProceed} style={{ width: '100%', marginTop: 32 }} />
        </View>
      ) : (
        <>
          <View style={[styles.stickyActions, { backgroundColor: colors.background, borderBottomColor: colors.border + '22' }]}>
            <View style={styles.actionRow}>
              <TouchableOpacity style={styles.selectAllBtn} onPress={toggleAll}>
                <View style={[styles.checkboxBase, { backgroundColor: markedDuplicateIndices.size === allIndices.length ? colors.primary : 'transparent', borderColor: colors.primary }]}>
                  {markedDuplicateIndices.size === allIndices.length && <Ionicons name="checkmark" size={12} color="#fff" />}
                </View>
                <Text style={{ color: colors.text, fontWeight: '600', marginLeft: 10, fontSize: 14 }}>Select all</Text>
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TouchableOpacity 
                  onPress={toggleHighConf}
                  style={[styles.filterChip, { backgroundColor: colors.error + '12', borderColor: colors.error + '33' }]}
                >
                  <Ionicons name="shield-checkmark-outline" size={14} color={colors.error} style={{ marginRight: 6 }} />
                  <Text style={{ color: colors.error, fontSize: 12, fontWeight: '600' }}>High Conf.</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  onPress={toggleMedConf}
                  style={[styles.filterChip, { backgroundColor: '#FF980012', borderColor: '#FF980033' }]}
                >
                  <Ionicons name="alert-circle-outline" size={14} color="#FF9800" style={{ marginRight: 6 }} />
                  <Text style={{ color: '#FF9800', fontSize: 12, fontWeight: '600' }}>Med. Conf.</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {duplicateMatches.map((match, i) => {
              const imported = importedTxs[match.importedIndex];
              const existing = match.existingTx;
              const isMarked = markedDuplicateIndices.has(match.importedIndex);

              return (
                <Card 
                  key={i} 
                  style={[
                    styles.matchCard, 
                    isMarked && { 
                      opacity: 0.6, 
                      borderColor: getConfidenceColor(match.confidence), 
                      borderWidth: 1 
                    }
                  ]}
                >
                  <View style={styles.matchHeader}>
                    <View style={[styles.confidenceBadge, { backgroundColor: getConfidenceColor(match.confidence) + '22' }]}>
                      <Text style={[styles.confidenceText, { color: getConfidenceColor(match.confidence) }]}>{match.confidence} CONFIDENCE</Text>
                    </View>
                    <TouchableOpacity onPress={() => toggleDuplicate(match.importedIndex)}>
                      <Ionicons 
                        name={isMarked ? "checkbox" : "square-outline"} 
                        size={24} 
                        color={isMarked ? colors.error : colors.textSecondary} 
                      />
                    </TouchableOpacity>
                  </View>

                  <View style={styles.comparisonRow}>
                    <View style={styles.compareCol}>
                      <Text style={dynamicStyles.colLabel}>EXISTING</Text>
                      <Text style={dynamicStyles.valAmount}>{format(existing.amount)}</Text>
                      <Text style={dynamicStyles.valDate}>{existing.date.slice(0, 10)}</Text>
                      <Text style={dynamicStyles.valDesc} numberOfLines={2}>{existing.note || 'No description'}</Text>
                    </View>

                    <View style={styles.vsLine}><View style={dynamicStyles.vsText}><Text style={{ fontSize: 10, color: colors.textSecondary }}>VS</Text></View></View>

                    <View style={styles.compareCol}>
                      <Text style={dynamicStyles.colLabel}>IMPORTED</Text>
                      <Text style={dynamicStyles.valAmount}>{format(imported.amount)}</Text>
                      <Text style={dynamicStyles.valDate}>{imported.date}</Text>
                      <Text style={dynamicStyles.valDesc} numberOfLines={2}>{imported.description}</Text>
                    </View>
                  </View>

                  <Text style={[styles.advice, { color: isMarked ? colors.error : colors.textSecondary }]}>
                    {isMarked ? "This transaction will be REMOVED from the import." : "This transaction will be IMPORTED anyway."}
                  </Text>
                </Card>
              );
            })}
          </ScrollView>

          <View style={[styles.footer, { paddingBottom: insets.bottom + 20, backgroundColor: colors.background }]}>
            <View style={styles.footerStats}>
              <Text style={{ color: colors.textSecondary }}>Total: {importedTxs.length}</Text>
              <Text style={{ color: colors.error, fontWeight: '700' }}>Removing: {markedDuplicateIndices.size}</Text>
            </View>
            <Button 
              title="Confirm & Preview" 
              onPress={handleProceed} 
              style={{ flex: 1, marginLeft: 20 }}
            />
          </View>
        </>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, marginBottom: 20 },
  backBtn: { padding: 8, marginRight: 12 },
  title: { fontSize: 24, fontWeight: '800' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 100 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  successIcon: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  emptyTitle: { fontSize: 22, fontWeight: '800', marginBottom: 12 },
  emptyText: { textAlign: 'center', fontSize: 16, lineHeight: 24 },
  bulkActionCard: { padding: 16, marginBottom: 16 },
  matchCard: { padding: 16, marginBottom: 16 },
  matchHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  confidenceBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  confidenceText: { fontSize: 10, fontWeight: '900' },
  comparisonRow: { flexDirection: 'row', alignItems: 'center' },
  compareCol: { flex: 1 },
  vsLine: { width: 40, alignItems: 'center' },
  advice: { fontSize: 12, fontWeight: '700', marginTop: 16, textAlign: 'center' },
  footer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  footerStats: { alignItems: 'flex-start' },
  stickyActions: { paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, zIndex: 10 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectAllBtn: { flexDirection: 'row', alignItems: 'center' },
  checkboxBase: { width: 20, height: 20, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  filterChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
});
