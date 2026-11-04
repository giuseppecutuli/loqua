import { Platform } from 'react-native';

export interface StreamingCaptureHandlers {
  readonly onChunk: (chunk: Uint8Array) => void;
  readonly onSpeechStart?: () => void;
  readonly onSilence?: () => void;
  readonly onPartial?: (text: string) => void;
  readonly onError?: () => void;
}

export interface StreamingCapture {
  stop(): void;
}

export const STREAMING_SAMPLE_RATE = 16_000;

const SPEECH_RMS_THRESHOLD = 0.02;
const SILENCE_MS = 800;
const MAX_CAPTURE_MS = 30_000;
const PROCESSOR_BUFFER_SIZE = 4_096;

export function isStreamingAudioSupported(): boolean {
  if (Platform.OS !== 'web') return false;
  if (typeof navigator === 'undefined') return false;
  if (typeof AudioContext === 'undefined') return false;
  const media = navigator.mediaDevices;
  return typeof media === 'object' && typeof media.getUserMedia === 'function';
}

function computeRms(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const sample of samples) {
    sum += sample * sample;
  }
  return Math.sqrt(sum / samples.length);
}

function floatToPcm16(samples: Float32Array): Int16Array {
  const output = new Int16Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    const sample = samples[index] ?? 0;
    const clamped = Math.max(-1, Math.min(1, sample));
    output[index] = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
  }
  return output;
}

function resampleTo16k(samples: Float32Array, inputRate: number): Float32Array {
  if (inputRate === STREAMING_SAMPLE_RATE) return samples;
  const ratio = inputRate / STREAMING_SAMPLE_RATE;
  const length = Math.max(1, Math.floor(samples.length / ratio));
  const output = new Float32Array(length);
  for (let index = 0; index < length; index += 1) {
    const position = index * ratio;
    const lower = Math.floor(position);
    const upper = Math.min(samples.length - 1, lower + 1);
    const weight = position - lower;
    const a = samples[lower] ?? 0;
    const b = samples[upper] ?? a;
    output[index] = a + (b - a) * weight;
  }
  return output;
}

function pcm16ToBytes(samples: Int16Array): Uint8Array {
  const bytes = new Uint8Array(samples.length * 2);
  const view = new DataView(bytes.buffer);
  for (let index = 0; index < samples.length; index += 1) {
    view.setInt16(index * 2, samples[index] ?? 0, true);
  }
  return bytes;
}

export function encodePcm16Wav(chunks: readonly Uint8Array[], sampleRate: number): Uint8Array {
  let dataLength = 0;
  for (const chunk of chunks) dataLength += chunk.byteLength;
  const wav = new Uint8Array(44 + dataLength);
  const view = new DataView(wav.buffer);
  const writeText = (offset: number, text: string): void => {
    for (let index = 0; index < text.length; index += 1) {
      wav[offset + index] = text.charCodeAt(index);
    }
  };

  writeText(0, 'RIFF');
  view.setUint32(4, 36 + dataLength, true);
  writeText(8, 'WAVE');
  writeText(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeText(36, 'data');
  view.setUint32(40, dataLength, true);

  let offset = 44;
  for (const chunk of chunks) {
    wav.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return wav;
}

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const slice = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return globalThis.btoa(binary);
}

export function startStreamingCapture(
  handlers: StreamingCaptureHandlers,
): StreamingCapture | null {
  if (!isStreamingAudioSupported()) return null;

  let stopped = false;
  let speechActive = false;
  let stream: MediaStream | null = null;
  let context: AudioContext | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let processor: ScriptProcessorNode | null = null;
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;
  let maxTimer: ReturnType<typeof setTimeout> | null = null;

  const clearTimers = (): void => {
    if (silenceTimer) {
      clearTimeout(silenceTimer);
      silenceTimer = null;
    }
    if (maxTimer) {
      clearTimeout(maxTimer);
      maxTimer = null;
    }
  };

  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    clearTimers();
    try {
      processor?.disconnect();
      source?.disconnect();
    } catch {
      // Audio graph may already be torn down.
    }
    stream?.getTracks().forEach((track) => track.stop());
    stream = null;
    if (context) {
      const closing = context;
      context = null;
      void closing.close().catch(() => {});
    }
  };

  const markSilence = (): void => {
    if (stopped) return;
    speechActive = false;
    handlers.onSilence?.();
    stop();
  };

  const scheduleSilence = (): void => {
    if (silenceTimer) clearTimeout(silenceTimer);
    silenceTimer = setTimeout(markSilence, SILENCE_MS);
  };

  const setup = async (): Promise<void> => {
    try {
      const media = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      if (stopped) {
        media.getTracks().forEach((track) => track.stop());
        return;
      }
      stream = media;

      const audioContext = new AudioContext({ sampleRate: STREAMING_SAMPLE_RATE });
      context = audioContext;
      if (audioContext.state === 'suspended') {
        await audioContext.resume().catch(() => {});
      }
      source = audioContext.createMediaStreamSource(media);
      processor = audioContext.createScriptProcessor(PROCESSOR_BUFFER_SIZE, 1, 1);
      const mute = audioContext.createGain();
      mute.gain.value = 0;

      processor.onaudioprocess = (event) => {
        if (stopped) return;
        const input = event.inputBuffer.getChannelData(0);
        if (computeRms(input) >= SPEECH_RMS_THRESHOLD) {
          if (!speechActive) {
            speechActive = true;
            handlers.onSpeechStart?.();
          }
          if (silenceTimer) {
            clearTimeout(silenceTimer);
            silenceTimer = null;
          }
        } else if (speechActive) {
          scheduleSilence();
        }
        const resampled = resampleTo16k(input, event.inputBuffer.sampleRate);
        handlers.onChunk(pcm16ToBytes(floatToPcm16(resampled)));
      };

      source.connect(processor);
      processor.connect(mute);
      mute.connect(audioContext.destination);
      maxTimer = setTimeout(() => {
        if (!stopped) handlers.onSilence?.();
        stop();
      }, MAX_CAPTURE_MS);
    } catch {
      handlers.onError?.();
      stop();
    }
  };

  void setup();

  return { stop };
}
