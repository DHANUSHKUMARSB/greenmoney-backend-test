import React from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { useTheme } from '../hooks/useTheme';
import { Card } from './Card';
import { soundEngine } from '../services/soundEngine';

const screenWidth = Dimensions.get('window').width;

interface Props {
  data: any;
  type: 'income' | 'expense' | 'balance';
  range: string;
  onRangeChange: (range: any) => void;
  onTypeChange: (type: any) => void;
  insight: string;
}

export const ModernTrendChart = ({ data, type, range, onRangeChange, onTypeChange, insight }: Props) => {
  const { colors, spacing, borderRadius } = useTheme();

  const chartConfig = {
    backgroundColor: colors.background,
    backgroundGradientFrom: colors.card,
    backgroundGradientTo: colors.card,
    decimalPlaces: 0,
    color: (opacity = 1) => type === 'income' ? colors.income : (type === 'expense' ? colors.expense : colors.primary),
    labelColor: (opacity = 1) => colors.textSecondary,
    style: { borderRadius: 16 },
    propsForDots: {
      r: '4',
      strokeWidth: '2',
      stroke: type === 'income' ? colors.income : (type === 'expense' ? colors.expense : colors.primary),
    },
    propsForLabels: { fontSize: 10 },
    fillShadowGradient: type === 'income' ? colors.income : (type === 'expense' ? colors.expense : colors.primary),
    fillShadowGradientOpacity: 0.2,
    useShadowColorFromDataset: false,
    propsForBackgroundLines: {
      strokeDasharray: '', // solid background lines
      strokeWidth: 1,
      stroke: colors.border + '22',
    }
  };

  const ranges = ['7D', '1M', '3M', '6M', '1Y'];

  return (
    <View style={st.container}>
      <View style={st.insightHeader}>
        <View style={[st.insightIcon, { backgroundColor: colors.primaryContainer + '33' }]}>
          <Text style={{ fontSize: 16 }}>💡</Text>
        </View>
        <Text style={[st.insightText, { color: colors.textSecondary }]}>{insight}</Text>
      </View>

      <Card variant="elevated" style={st.chartCard}>
        <View style={st.headerRow}>
          <View style={[st.toggleContainer, { backgroundColor: colors.background }]}>
            {(['expense', 'income'] as const).map((t) => (
              <TouchableOpacity 
                key={t}
                onPress={() => {
                  onTypeChange(t);
                  soundEngine.play('tap_secondary');
                }}
                style={[
                  st.toggleBtn, 
                  type === t && { backgroundColor: t === 'income' ? colors.income : colors.expense }
                ]}
              >
                <Text style={[st.toggleText, { color: type === t ? '#fff' : colors.textSecondary }]}>
                  {t === 'income' ? 'Earn' : 'Spend'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          
          <View style={st.rangeContainer}>
            {ranges.map((r) => (
              <TouchableOpacity key={r} onPress={() => {
                onRangeChange(r);
                soundEngine.play('tap_nav');
              }}>
                <Text style={[
                  st.rangeText, 
                  { color: range === r ? colors.primary : colors.textSecondary, fontWeight: range === r ? '700' : '500' }
                ]}>
                  {r}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {data ? (
          <LineChart
            data={data}
            width={screenWidth - spacing.m * 4}
            height={200}
            chartConfig={chartConfig}
            bezier
            withVerticalLines={false}
            withHorizontalLines={true}
            style={{ borderRadius: 16, marginTop: 10 }}
            yAxisLabel={type === 'balance' ? '' : '₹'}
            yAxisSuffix=""
            fromZero={true}
          />
        ) : (
          <View style={[st.empty, { height: 200 }]}>
            <Text style={{ color: colors.textSecondary }}>No trend data yet</Text>
          </View>
        )}
      </Card>
    </View>
  );
};

const st = StyleSheet.create({
  container: { marginBottom: 24 },
  insightHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingHorizontal: 4 },
  insightIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginRight: 10 },
  insightText: { flex: 1, fontSize: 13, fontWeight: '600', fontStyle: 'italic' },
  chartCard: { padding: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  toggleContainer: { flexDirection: 'row', borderRadius: 10, padding: 2 },
  toggleBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  toggleText: { fontSize: 12, fontWeight: '700' },
  rangeContainer: { flexDirection: 'row', gap: 12 },
  rangeText: { fontSize: 12 },
  empty: { justifyContent: 'center', alignItems: 'center' }
});
