import React, { useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, FlatList } from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../hooks/useTheme';
import { typography, spacing } from '../utils/theme';
import { getTransactions } from '../services/database';

export const FilteredTransactionsScreen = () => {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const { type } = route.params; // 'income' | 'expense'

  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const all = await getTransactions();
      const filtered = all.filter((tx: any) => tx.type === type);
      setTransactions(filtered);
    } catch (error) {
      console.error('Failed to fetch filtered transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [type])
  );

  const renderItem = ({ item }: { item: any }) => {
    const isIncome = item.type === 'income';
    const aColor = isIncome ? '#4CAF50' : '#F44336';
    
    return (
      <TouchableOpacity 
        style={[styles.txCard, { backgroundColor: colors.card, borderColor: colors.border }]}
        onPress={() => {
          // Navigate to main transactions screen and jump to this date
          navigation.navigate('Main', { 
            screen: 'Transactions', 
            params: { initialDate: item.date.split('T')[0], highlightId: item.id } 
          });
        }}
      >
        <View style={{ width: 4, backgroundColor: aColor, borderRadius: 4 }} />
        <View style={styles.txContent}>
          <View style={styles.txHeader}>
            <Text style={[styles.txNote, { color: colors.text }]} numberOfLines={1}>
              {item.note || item.category_name || 'Transaction'}
            </Text>
            <Text style={[styles.txAmount, { color: aColor }]}>
              {isIncome ? '+' : '-'}₹{item.amount.toLocaleString('en-IN')}
            </Text>
          </View>
          <View style={styles.txFooter}>
            <Text style={[styles.txCategory, { color: colors.textSecondary }]}>
              {item.category_name || 'Uncategorized'}
            </Text>
            <Text style={[styles.txDate, { color: colors.textSecondary }]}>
              {new Date(item.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + spacing.m }]}>
      <View style={styles.headerRow}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {type === 'income' ? 'All Income' : 'All Expenses'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      <FlatList
        data={transactions}
        renderItem={renderItem}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={{ paddingBottom: spacing.xl }}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={{ color: colors.textSecondary }}>No {type} transactions found.</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: spacing.m,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.l,
  },
  backBtn: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.header,
    fontSize: 20,
  },
  txCard: {
    flexDirection: 'row',
    borderRadius: 12,
    marginBottom: spacing.s,
    borderWidth: 1,
    height: 70,
  },
  txContent: {
    flex: 1,
    padding: spacing.m,
    justifyContent: 'center',
  },
  txHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  txNote: {
    fontWeight: '600',
    fontSize: 15,
    flex: 1,
    marginRight: spacing.s,
  },
  txAmount: {
    fontWeight: '700',
    fontSize: 16,
  },
  txFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  txCategory: {
    fontSize: 12,
  },
  txDate: {
    fontSize: 12,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 100,
  }
});
