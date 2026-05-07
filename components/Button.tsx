import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacityProps,
} from 'react-native';
import { COLORS, TYPOGRAPHY, SPACING, RADIUS } from '@/constants/theme';

interface ButtonProps extends TouchableOpacityProps {
  title: string;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
}

export function Button({
  title,
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  disabled,
  icon,
  style,
  ...props
}: ButtonProps) {
  return (
    <TouchableOpacity
      style={[
        styles.base,
        styles[variant],
        styles[size],
        fullWidth && styles.fullWidth,
        (disabled || loading) && styles.disabled,
        style,
      ]}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' ? COLORS.primary : COLORS.textInverse}
        />
      ) : (
        <React.Fragment>
          {icon ? icon : null}
          <Text style={[styles.text, styles[`text_${variant}`], styles[`text_${size}`], icon ? { marginLeft: SPACING.xs } as any : undefined]}>
            {title}
          </Text>
        </React.Fragment>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.lg,
    flexDirection: 'row',
  },
  primary: {
    backgroundColor: COLORS.primary,
  },
  secondary: {
    backgroundColor: COLORS.secondary,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: COLORS.primary,
  },
  ghost: {
    backgroundColor: 'transparent',
  },
  sm: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    minHeight: 36,
  },
  md: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    minHeight: 48,
  },
  lg: {
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md + 2,
    minHeight: 56,
  },
  fullWidth: {
    width: '100%',
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    fontWeight: TYPOGRAPHY.fontWeight.semibold,
  },
  text_primary: {
    color: COLORS.textInverse,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  text_secondary: {
    color: COLORS.textInverse,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  text_outline: {
    color: COLORS.primary,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  text_ghost: {
    color: COLORS.primary,
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  text_sm: {
    fontSize: TYPOGRAPHY.fontSize.sm,
  },
  text_md: {
    fontSize: TYPOGRAPHY.fontSize.base,
  },
  text_lg: {
    fontSize: TYPOGRAPHY.fontSize.lg,
  },
});
