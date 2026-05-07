import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '@/constants/theme';

interface BarChartData {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarChartData[];
  maxValue?: number;
  height?: number;
  showValues?: boolean;
}

export function BarChart({
  data,
  maxValue,
  height = 200,
  showValues = true,
}: BarChartProps) {
  const max = maxValue || Math.max(...data.map((d) => d.value), 1);

  return (
    <View style={styles.container}>
      <View style={[styles.chartContainer, { height }]}>
        {data.map((item, index) => {
          const barHeight = (item.value / max) * (height - 40);
          const barColor = item.color || COLORS.primary;

          return (
            <View key={index} style={styles.barWrapper}>
              <View style={styles.barContainer}>
                {showValues && item.value > 0 && (
                  <Text style={styles.valueText} numberOfLines={1}>
                    {item.value.toLocaleString('es-CO', {
                      maximumFractionDigits: 0,
                    })}
                  </Text>
                )}
                <View style={styles.barBackground}>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: barHeight,
                        backgroundColor: barColor,
                      },
                    ]}
                  />
                </View>
              </View>
              <Text style={styles.labelText} numberOfLines={2}>
                {item.label}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-around',
    gap: SPACING.xs,
  },
  barWrapper: {
    flex: 1,
    alignItems: 'center',
    minWidth: 40,
  },
  barContainer: {
    flex: 1,
    width: '100%',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  valueText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
    color: COLORS.text,
    marginBottom: SPACING.xs / 2,
  },
  barBackground: {
    width: '100%',
    justifyContent: 'flex-end',
  },
  bar: {
    width: '100%',
    borderTopLeftRadius: RADIUS.sm,
    borderTopRightRadius: RADIUS.sm,
    minHeight: 4,
  },
  labelText: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
    textAlign: 'center',
  },
});
