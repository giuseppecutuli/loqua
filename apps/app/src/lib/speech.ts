import * as Speech from 'expo-speech';

export function speakText(text: string, language: string, onDone?: () => void): void {
  void Speech.stop();
  Speech.speak(text, {
    language: language === 'en' ? 'en-US' : language,
    rate: 0.9,
    onDone,
    onStopped: onDone,
    onError: onDone,
  });
}

export function stopSpeaking(): void {
  void Speech.stop();
}
