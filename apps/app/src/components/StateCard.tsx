import { colors, spacing, typography } from '@loqua/ui';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { Button } from './Button';
import { Card } from './Card';

export interface StateCardProps {
  readonly message: string;
  readonly variant?: 'loading' | 'error' | 'empty';
  readonly actionLabel?: string;
  readonly onAction?: () => void;
}

export function StateCard({ message, variant = 'empty', actionLabel, onAction }: StateCardProps) {
  return (
    <Card>
      <View style={variant === 'loading' ? styles.loadingRow : undefined}>
        {variant === 'loading' ? <ActivityIndicator color={colors.primary} /> : null}
        <Text style={variant === 'error' ? styles.error : styles.body}>{message}</Text>
      </View>
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  body: {
    color: colors.text,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    flexShrink: 1,
  },
  error: {
    color: colors.danger,
    fontSize: typography.body.fontSize,
    lineHeight: typography.body.lineHeight,
    flexShrink: 1,
  },
});
