/**
 * Demo Payload Shield & Scrambler
 * Obfuscates sensitive proprietary structures (e.g. AI course generation, curriculum trees)
 * so raw network sniffers and API scrapers receive opaque scrambled blobs decoded in memory.
 */

const XOR_KEY = 0x5a;

export function packDemoPayload(data: any): { __shielded: true; payload: string } {
  const jsonStr = typeof data === "string" ? data : JSON.stringify(data);
  const utf8Bytes = Buffer.from(jsonStr, "utf-8");

  // Multi-byte rotating XOR mask
  const maskedBytes = Buffer.alloc(utf8Bytes.length);
  for (let i = 0; i < utf8Bytes.length; i++) {
    maskedBytes[i] = utf8Bytes[i] ^ (XOR_KEY ^ (i % 11));
  }

  return {
    __shielded: true,
    payload: maskedBytes.toString("base64"),
  };
}

export function unpackDemoPayloadServer(payload: string): any {
  const maskedBytes = Buffer.from(payload, "base64");
  const unmaskedBytes = Buffer.alloc(maskedBytes.length);

  for (let i = 0; i < maskedBytes.length; i++) {
    unmaskedBytes[i] = maskedBytes[i] ^ (XOR_KEY ^ (i % 11));
  }

  const jsonStr = unmaskedBytes.toString("utf-8");
  return JSON.parse(jsonStr);
}
