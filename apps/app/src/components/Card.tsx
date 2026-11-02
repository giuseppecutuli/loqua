import { colors, radii, spacing } from '@loqua/ui';
import type { ReactNode } from 'react';
import { YStack } from 'tamagui';

export interface CardProps {
  readonly children: ReactNode;
  readonly testID?: string;
}

export function Card({ children, testID }: CardProps) {
  return (
    <YStack
      testID={testID}
      style={{
        backgroundColor: colors.surface,
        borderRadius: radii.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: spacing.lg,
        gap: spacing.md,
      }}
    >
      {children}
    </YStack>
  );
}

