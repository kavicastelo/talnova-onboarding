import { useEffect, useRef, useCallback } from 'react';

export interface UseBarcodeScannerOptions {
  onScan: (barcode: string) => void;
  maxInterKeyDelayMs?: number; // Default: 50ms for USB/Bluetooth HID scanners
  minBarcodeLength?: number; // Default: 3 characters
  enabled?: boolean;
  preventDefault?: boolean;
}

/**
 * useBarcodeScanner
 *
 * Detects rapid keystroke input from USB / Bluetooth HID barcode & RFID badge scanners.
 * Hardware scanners emit rapid characters (<50ms inter-character delay) followed by an 'Enter' key.
 */
export function useBarcodeScanner({
  onScan,
  maxInterKeyDelayMs = 50,
  minBarcodeLength = 3,
  enabled = true,
  preventDefault = false
}: UseBarcodeScannerOptions) {
  const bufferRef = useRef<string>('');
  const lastKeyTimeRef = useRef<number>(0);
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // Ignore modifier keys
      if (event.ctrlKey || event.altKey || event.metaKey) return;

      // When Enter is received, check if buffered input meets barcode length criteria
      if (event.key === 'Enter') {
        const barcode = bufferRef.current.trim();
        bufferRef.current = '';
        lastKeyTimeRef.current = 0;

        if (barcode.length >= minBarcodeLength) {
          if (preventDefault) {
            event.preventDefault();
          }
          onScanRef.current(barcode);
        }
        return;
      }

      // Only accumulate printable single characters
      if (event.key.length === 1) {
        const now = Date.now();
        const timeDiff = now - lastKeyTimeRef.current;

        // If delay between keystrokes exceeds threshold, this is human manual typing.
        // Reset the buffer and start new sequence with the current character.
        if (lastKeyTimeRef.current !== 0 && timeDiff > maxInterKeyDelayMs) {
          bufferRef.current = event.key;
        } else {
          bufferRef.current += event.key;
        }

        lastKeyTimeRef.current = now;
      }
    },
    [enabled, maxInterKeyDelayMs, minBarcodeLength, preventDefault]
  );

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === 'undefined') return;

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [enabled, handleKeyDown]);

  const clearBuffer = useCallback(() => {
    bufferRef.current = '';
    lastKeyTimeRef.current = 0;
  }, []);

  return {
    clearBuffer
  };
}

export default useBarcodeScanner;
