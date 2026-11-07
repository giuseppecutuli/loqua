import { colors, layout, radii, spacing, typography } from '@loqua/ui';
import { Button as TamaguiButton, Text } from 'tamagui';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps {
  readonly label: string;
  readonly variant?: Variant;
  readonly disabled?: boolean;
  readonly onPress?: () => void;
  readonly testID?: string;
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

export function Button({ label, variant = 'primary', disabled, onPress, testID }: ButtonProps) {
  return (
    <TamaguiButton
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled === true }}
      disabled={disabled}
      onPress={onPress}
      backgroundColor={BACKGROUND[variant]}
      borderColor={variant === 'secondary' ? colors.border : BACKGROUND[variant]}
      borderWidth={1}
      borderRadius={radii.pill}
      height={layout.minTouchTarget}
      minHeight={layout.minTouchTarget}
      paddingHorizontal={spacing.lg}
      paddingVertical={spacing.md}
      opacity={disabled ? 0.5 : 1}
    >
      <Text
        color={TEXT_COLOR[variant]}
        fontSize={typography.button.fontSize}
        lineHeight={`${typography.button.lineHeight}px`}
        fontWeight={typography.button.fontWeight}
      >
        {label}
      </Text>
    </TamaguiButton>
  );
}
