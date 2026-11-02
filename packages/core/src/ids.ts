const UUID_V7_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

export function isUuidV7(value: unknown): value is string {
  return typeof value === 'string' && UUID_V7_PATTERN.test(value);
}

export function generateUuidV7(nowMs: number = Date.now()): string {
  if (!Number.isFinite(nowMs) || nowMs < 0) {
    throw new RangeError('generateUuidV7 requires a non-negative finite timestamp');
  }

  const bytes = new Uint8Array(16);
  globalThis.crypto.getRandomValues(bytes);
  const view = new DataView(bytes.buffer);
  const timestamp = BigInt(Math.floor(nowMs));

  view.setUint8(0, Number((timestamp >> 40n) & 0xffn));
  view.setUint8(1, Number((timestamp >> 32n) & 0xffn));
  view.setUint8(2, Number((timestamp >> 24n) & 0xffn));
  view.setUint8(3, Number((timestamp >> 16n) & 0xffn));
  view.setUint8(4, Number((timestamp >> 8n) & 0xffn));
  view.setUint8(5, Number(timestamp & 0xffn));
  view.setUint8(6, (view.getUint8(6) & 0x0f) | 0x70);
  view.setUint8(8, (view.getUint8(8) & 0x3f) | 0x80);

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
