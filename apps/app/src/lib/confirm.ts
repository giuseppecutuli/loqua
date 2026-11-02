import { Alert, Platform } from 'react-native';

export function confirmDestructive(
  title: string,
  message: string,
  confirmLabel: string,
  cancelLabel: string,
  onConfirm: () => void,
): void {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }

  Alert.alert(title, message, [
    { text: cancelLabel, style: 'cancel' },
    { text: confirmLabel, style: 'destructive', onPress: onConfirm },
  ]);
}
