import React from 'react';
import { View, Text, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { PieChart } from 'react-native-chart-kit';
import { useTheme } from '../hooks/useTheme';
import { useCurrency } from '../hooks/useCurrency';
import { Ionicons } from '@expo/vector-icons';

const screenWidth = Dimensions.get('window').width;

interface Props {
  data: any[];
  total: number;
  type: string;
  onCategoryPress?: (name: string) => void;
}

export const ModernDonutChart = ({ data, total, type, onCategoryPress }: Props) => {
  const { colors, spacing } = useTheme();
  const { format } = useCurrency();

  // PieChart needs a specific format, we already have name, amount, color from analyticsService
  const chartData = data.map(item => ({
    name: item.name,
    amount: item.amount,
    color: item.color,
    legendFontColor: colors.textSecondary,
    legendFontSize: 12
  }));

  return (
    <View style={st.container}>
      <View style={st.chartWrapper}>
        <PieChart
          data={chartData}
          width={screenWidth - 40}
          height={220}
          chartConfig={{
            color: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
          }}
          accessor={"amount"}
          backgroundColor={"transparent"}
          paddingLeft={"15"}
          center={[screenWidth / 4 - 10, 0]}
          hasLegend={false}
          absolute
        />
        
        {/* Center Overlay for Donut Effect */}
        <View style={[st.centerHole, { backgroundColor: colors.card }]}>
          <Text style={[st.centerLabel, { color: colors.textSecondary }]}>Total {type}</Text>
          <Text style={[st.centerValue, { color: colors.text }]}>{format(total)}</Text>
        </View>
      </View>

      {/* Modern Interactive Legend */}
      <View style={st.legendGrid}>
        {data.slice(0, 6).map((item, index) => (
          <TouchableOpacity 
            key={index} 
            style={st.legendItem}
            onPress={() => onCategoryPress?.(item.name)}
          >
            <View style={[st.dot, { backgroundColor: item.color }]} />
            <View style={{ flex: 1 }}>
              <Text style={[st.legendName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
              <Text style={[st.legendPercent, { color: colors.textSecondary }]}>
                {item.percentage.toFixed(1)}% • {format(item.amount)}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={14} color={colors.border} />
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};

const st = StyleSheet.create({
  container: { alignItems: 'center', width: '100%' },
  chartWrapper: { position: 'relative', width: '100%', alignItems: 'center', justifyContent: 'center' },
  centerHole: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    left: screenWidth / 2 - 70, // Align with chart center
  },
  centerLabel: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  centerValue: { fontSize: 16, fontWeight: '800' },
  legendGrid: { width: '100%', marginTop: 10, gap: 8 },
  legendItem: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 12, 
    borderRadius: 12, 
    backgroundColor: 'rgba(0,0,0,0.02)' 
  },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  legendName: { fontSize: 14, fontWeight: '700' },
  legendPercent: { fontSize: 12, fontWeight: '500' },
  empty: { height: 200, justifyContent: 'center', alignItems: 'center' }
});
