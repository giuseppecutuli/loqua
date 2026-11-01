import { colors, layout, radii, spacing, typography } from '@loqua/ui';
import {
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  readonly label: string;
  readonly variant?: Variant;
  readonly style?: StyleProp<ViewStyle>;
}

const BACKGROUND: Record<Variant, string> = {
  primary: colors.primary,
  secondary: colors.surface,
  ghost: 'transparent',
  danger: colors.danger,
};

const TEXT_COLOR: Record<Variant, string> = {
  primary: colors.primaryContrast,
  secondary: colors.text,
  ghost: colors.primary,
  danger: colors.primaryContrast,
};

export function Button({ label, variant = 'primary', disabled, style, ...rest }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled === true }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: BACKGROUND[variant],
          borderColor: variant === 'secondary' ? colors.border : BACKGROUND[variant],
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
      {...rest}
    >
      <Text style={[styles.label, { color: TEXT_COLOR[variant] }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: layout.minTouchTarget,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: typography.button.fontSize,
    lineHeight: typography.button.lineHeight,
    fontWeight: typography.button.fontWeight,
  },
});
