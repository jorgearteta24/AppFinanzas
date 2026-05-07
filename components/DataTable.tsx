import React from 'react';
import { View, Text, StyleSheet, ScrollView, Platform, TouchableOpacity } from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '@/constants/theme';
import { ChevronUp, ChevronDown } from 'lucide-react-native';

export interface Column<T> {
  key: string;
  header: string;
  width?: number;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
  align?: 'left' | 'center' | 'right';
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowPress?: (item: T) => void;
  keyExtractor: (item: T) => string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  emptyMessage?: string;
}

export function DataTable<T>({
  data,
  columns,
  onRowPress,
  keyExtractor,
  sortBy,
  sortOrder,
  onSort,
  emptyMessage = 'No hay datos para mostrar',
}: DataTableProps<T>) {
  const isWeb = Platform.OS === 'web';

  const handleSort = (key: string) => {
    if (onSort) {
      onSort(key);
    }
  };

  const getAlignStyle = (align?: 'left' | 'center' | 'right') => {
    switch (align) {
      case 'center':
        return { justifyContent: 'center', alignItems: 'center' } as const;
      case 'right':
        return { justifyContent: 'flex-end', alignItems: 'flex-end' } as const;
      default:
        return { justifyContent: 'flex-start', alignItems: 'flex-start' } as const;
    }
  };

  if (!isWeb) {
    return (
      <View style={styles.mobileContainer}>
        {data.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>{emptyMessage}</Text>
          </View>
        ) : (
          data.map(item => (
            <TouchableOpacity
              key={keyExtractor(item)}
              style={styles.mobileCard}
              onPress={() => onRowPress?.(item)}
              activeOpacity={onRowPress ? 0.7 : 1}
            >
              {columns.map(column => (
                <View key={column.key} style={styles.mobileRow}>
                  <Text style={styles.mobileLabel}>{column.header}</Text>
                  <View style={styles.mobileValue}>
                    {column.render ? column.render(item) : <Text>{String(item[column.key as keyof T])}</Text>}
                  </View>
                </View>
              ))}
            </TouchableOpacity>
          ))
        )}
      </View>
    );
  }

  return (
    <View style={styles.webContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.table}>
          <View style={styles.headerRow}>
            {columns.map(column => (
              <TouchableOpacity
                key={column.key}
                style={[
                  styles.headerCell,
                  { width: column.width || 150 },
                  getAlignStyle(column.align),
                ]}
                onPress={() => column.sortable && handleSort(column.key)}
                disabled={!column.sortable}
              >
                <Text style={styles.headerText}>{column.header}</Text>
                {column.sortable && sortBy === column.key && (
                  <View style={styles.sortIcon}>
                    {sortOrder === 'asc' ? (
                      <ChevronUp size={16} color={COLORS.primary} />
                    ) : (
                      <ChevronDown size={16} color={COLORS.primary} />
                    )}
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>

          {data.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>{emptyMessage}</Text>
            </View>
          ) : (
            data.map((item, index) => (
              <TouchableOpacity
                key={keyExtractor(item)}
                style={[styles.dataRow, index % 2 === 0 && styles.dataRowEven]}
                onPress={() => onRowPress?.(item)}
                activeOpacity={onRowPress ? 0.7 : 1}
              >
                {columns.map(column => (
                  <View
                    key={column.key}
                    style={[
                      styles.dataCell,
                      { width: column.width || 150 },
                      getAlignStyle(column.align),
                    ]}
                  >
                    {column.render ? column.render(item) : <Text style={styles.cellText}>{String(item[column.key as keyof T])}</Text>}
                  </View>
                ))}
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  mobileContainer: {
    flex: 1,
  },
  mobileCard: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  mobileRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.xs / 2,
  },
  mobileLabel: {
    fontSize: TYPOGRAPHY.fontSize.xs,
    color: COLORS.textSecondary,
    fontWeight: TYPOGRAPHY.fontWeight.medium,
    flex: 1,
  },
  mobileValue: {
    flex: 2,
    alignItems: 'flex-end',
  },
  webContainer: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  table: {
    minWidth: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: COLORS.backgroundSecondary,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.border,
  },
  headerCell: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  headerText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    fontWeight: TYPOGRAPHY.fontWeight.bold,
    color: COLORS.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sortIcon: {
    marginLeft: SPACING.xs / 2,
  },
  dataRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  dataRowEven: {
    backgroundColor: COLORS.backgroundSecondary + '40',
  },
  dataCell: {
    padding: SPACING.md,
  },
  cellText: {
    fontSize: TYPOGRAPHY.fontSize.sm,
    color: COLORS.text,
  },
  emptyContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: TYPOGRAPHY.fontSize.base,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});
