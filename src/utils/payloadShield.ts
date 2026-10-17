/**
 * Talnova Payload Shield
 * Decodes obfuscated payloads received from the demo server in memory,
 * preventing raw network scraping of proprietary schemas and curricula.
 */

const XOR_KEY = 0x5a;

export function isShieldedPayload(data: any): boolean {
  return typeof data === 'object' && data !== null && data.__shielded === true && typeof data.payload === 'string';
}

export function unpackDemoPayload(payload: string): any {
  if (typeof window === 'undefined' && typeof Buffer !== 'undefined') {
    // Node environment fallback (for tests)
    const maskedBytes = Buffer.from(payload, 'base64');
    const unmasked = Buffer.alloc(maskedBytes.length);
    for (let i = 0; i < maskedBytes.length; i++) {
      unmasked[i] = maskedBytes[i] ^ (XOR_KEY ^ (i % 11));
    }
    return JSON.parse(unmasked.toString('utf-8'));
  }

  // Browser environment using atob
  const binaryString = atob(payload);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i) ^ (XOR_KEY ^ (i % 11));
  }

  const decoder = new TextDecoder('utf-8');
  const jsonStr = decoder.decode(bytes);
  return JSON.parse(jsonStr);
}
