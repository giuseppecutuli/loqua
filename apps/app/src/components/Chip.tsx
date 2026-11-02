import { colors, radii, spacing, typography } from '@loqua/ui';
import { Button, Text } from 'tamagui';

export interface ChipProps {
  readonly label: string;
  readonly selected?: boolean;
  readonly onPress?: () => void;
  readonly disabled?: boolean;
  readonly testID?: string;
}

export function Chip({ label, selected = false, onPress, disabled, testID }: ChipProps) {
  return (
    <Button
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled: disabled === true }}
      disabled={disabled}
      onPress={onPress}
      height={36}
      minHeight={36}
      paddingHorizontal={spacing.md}
      paddingVertical={spacing.sm}
      borderRadius={radii.pill}
      borderWidth={1}
      borderColor={selected ? colors.primary : colors.border}
      backgroundColor={selected ? colors.primary : colors.surface}
      opacity={disabled ? 0.5 : 1}
    >
      <Text
        color={selected ? colors.primaryContrast : colors.text}
        fontSize={typography.caption.fontSize}
        lineHeight={`${typography.caption.lineHeight}px`}
        fontWeight="600"
      >
        {label}
      </Text>
    </Button>
  );
}



