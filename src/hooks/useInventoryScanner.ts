import { useEffect, useRef, useCallback } from 'react';

/**
 * Asset tag pattern.  Matches PREFIX-YYRRRR where:
 *   PREFIX  = 3 uppercase letters
 *   YY      = 2 hex digits (year)
 *   RRRR    = 4 hex digits (random)
 *
 * Case-insensitive (scanners may output mixed case).
 */
const ASSET_TAG_PATTERN = /^[A-Z]{3}-[0-9A-Fa-f]{6}$/;

/**
 * Barcode scanners work by rapidly firing keyboard events — typically
 * completing an entire scan in < 100 ms.  We treat a sequence of keystrokes
 * that ends with Enter and arrives faster than SCANNER_MAX_INTERVAL_MS as a
 * scanner input rather than manual typing.
 */
const SCANNER_MAX_INTERVAL_MS = 50;

/**
 * useInventoryScanner
 *
 * Attaches a global keydown listener that detects barcode-scanner input and
 * calls `onScan` with the decoded asset tag.
 *
 * @param onScan  Callback invoked with the normalised (uppercase) tag string.
 * @param enabled When false the listener is not attached.
 */
export function useInventoryScanner(
  onScan: (tag: string) => void,
  enabled: boolean,
) {
  const buffer = useRef<string>('');
  const lastTime = useRef<number>(0);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    const now = Date.now();

    // Reset buffer if the gap is too long (user is typing manually)
    if (now - lastTime.current > SCANNER_MAX_INTERVAL_MS + 20 && buffer.current.length > 0) {
      buffer.current = '';
    }
    lastTime.current = now;

    if (e.key === 'Enter') {
      const candidate = buffer.current.trim().toUpperCase();
      buffer.current = '';
      if (ASSET_TAG_PATTERN.test(candidate)) {
        e.preventDefault();
        onScanRef.current(candidate);
      }
      return;
    }

    // Ignore modifier-only keys and function keys
    if (e.key.length !== 1) return;

    // Don't intercept input focused inside a text field
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable
    ) {
      buffer.current = '';
      return;
    }

    buffer.current += e.key;
  }, []);

  useEffect(() => {
    if (!enabled) return;
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [enabled, handleKeyDown]);
}
