import { colors, layout, spacing, typography } from '@loqua/ui';
import type { ReactNode } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ScrollView, Text, YStack } from 'tamagui';

export interface ScreenProps {
  readonly title: string;
  readonly subtitle?: string;
  readonly children: ReactNode;
  readonly footer?: ReactNode;
  readonly scroll?: boolean;
}

export function Screen({ title, subtitle, children, footer, scroll = true }: ScreenProps) {
  const content = (
    <YStack
      style={{
        width: '100%',
        maxWidth: layout.maxContentWidth,
        alignSelf: 'center',
        paddingTop: spacing.lg,
        gap: spacing.lg,
      }}
    >
      <YStack gap={spacing.xs}>
        <Text
          accessibilityRole="header"
          color={colors.text}
          fontSize={typography.display.fontSize}
          lineHeight={`${typography.display.lineHeight}px`}
          fontWeight={typography.display.fontWeight}
        >
          {title}
        </Text>
        {subtitle ? (
          <Text
            color={colors.textMuted}
            fontSize={typography.body.fontSize}
            lineHeight={`${typography.body.lineHeight}px`}
          >
            {subtitle}
          </Text>
        ) : null}
      </YStack>
      {children}
    </YStack>
  );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.background }}
      edges={['top', 'left', 'right']}
    >
      {scroll ? (
        <ScrollView
          flex={1}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{
            flexGrow: 1,
            paddingHorizontal: spacing.lg,
            paddingBottom: layout.tabBarHeight + spacing.xxl,
          }}
        >
          {content}
        </ScrollView>
      ) : (
        <YStack
          style={{
            flex: 1,
            paddingHorizontal: spacing.lg,
            paddingBottom: layout.tabBarHeight + spacing.xxl,
          }}
        >
          {content}
        </YStack>
      )}
      {footer ? (
        <YStack
          style={{
            padding: spacing.lg,
            borderTopWidth: 1,
            borderTopColor: colors.border,
            backgroundColor: colors.background,
          }}
        >
          {footer}
        </YStack>
      ) : null}
    </SafeAreaView>
  );
}
