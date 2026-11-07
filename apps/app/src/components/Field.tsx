import { colors, radii, spacing, typography } from '@loqua/ui';
import { Input, Text, YStack, type InputProps } from 'tamagui';

export interface FieldProps extends Omit<InputProps, 'style'> {
  readonly label: string;
}

export function Field({ label, ...rest }: FieldProps) {
  return (
    <YStack gap={spacing.xs}>
      <Text
        color={colors.textMuted}
        fontSize={typography.caption.fontSize}
        lineHeight={`${typography.caption.lineHeight}px`}
        fontWeight="600"
      >
        {label}
      </Text>
      <Input
        accessibilityLabel={label}
        minHeight={44}
        borderWidth={1}
        borderColor={colors.border}
        borderRadius={radii.md}
        backgroundColor={colors.surface}
        paddingHorizontal={spacing.md}
        color={colors.text}
        fontSize={typography.body.fontSize}
        placeholderTextColor={colors.textMuted}
        autoCapitalize="none"
        {...rest}
      />
    </YStack>
  );
}
