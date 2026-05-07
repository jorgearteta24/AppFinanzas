import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { COLORS, SPACING, RADIUS, SHADOWS } from '@/constants/theme';

interface CardProps extends ViewProps {
  variant?: 'elevated' | 'outlined' | 'filled';
  padding?: keyof typeof SPACING;
}

export function Card({
  variant = 'elevated',
  padding = 'md',
  style,
  children,
  ...props
}: CardProps) {
  return (
    <View
      style={[
        styles.base,
        styles[variant],
        { padding: SPACING[padding] },
        style,
      ]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: RADIUS.lg,
  },
  elevated: {
    backgroundColor: COLORS.surface,
    ...SHADOWS.md,
  },
  outlined: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filled: {
    backgroundColor: COLORS.backgroundSecondary,
  },
});
