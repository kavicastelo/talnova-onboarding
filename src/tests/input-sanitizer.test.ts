import { describe, it, expect } from 'vitest';
import {
  stripControlCharacters,
  stripBidiOverrides,
  normalizeUnicode,
  clampLength,
  sanitizeInput,
  sanitizeTextarea,
} from '../utils/inputSanitizer';
import { Input } from '../components/Input';
import { Textarea } from '../components/Textarea';

describe('SEC-INPUT-SANITIZER: Universal Input & Textarea Sanitization, Clamping & Unicode Normalizer', () => {
  // =========================================================================
  // 1. CONTROL CHARACTER STRIPPING
  // =========================================================================
  describe('stripControlCharacters', () => {
    it('strips null bytes from input string', () => {
      expect(stripControlCharacters('Hello\0World')).toBe('HelloWorld');
      expect(stripControlCharacters('\x00\x00Admin\x00')).toBe('Admin');
    });

    it('strips non-printable ASCII control characters [\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', () => {
      const malicious = 'Test\x01\x02\x03\x04\x05\x06\x07\x08Payload\x0B\x0CBreak\x0E\x1F\x7FEnd';
      expect(stripControlCharacters(malicious)).toBe('TestPayloadBreakEnd');
    });

    it('preserves valid whitespace: line breaks (\\n), carriage returns (\\r), and tabs (\\t)', () => {
      const multiline = 'Line 1\r\n\tLine 2 with tab\nLine 3';
      expect(stripControlCharacters(multiline)).toBe(multiline);
    });

    it('handles empty or non-string inputs safely', () => {
      expect(stripControlCharacters('')).toBe('');
      expect(stripControlCharacters(null as any)).toBe('');
      expect(stripControlCharacters(undefined as any)).toBe('');
    });
  });

  // =========================================================================
  // 2. TROJAN SOURCE BIDI OVERRIDES STRIPPING
  // =========================================================================
  describe('stripBidiOverrides', () => {
    it('strips Right-to-Left override (RLO \\u202E) Trojan Source attack vector', () => {
      // Classic CVE-2021-42574 disguised executable extension
      const filename = 'file\u202Efdp.exe';
      expect(stripBidiOverrides(filename)).toBe('filefdp.exe');
    });

    it('strips all dangerous Unicode bidirectional overrides and directional marks', () => {
      const bidiContaminated =
        'Prefix' +
        '\u200E' + // LRM
        '\u200F' + // RLM
        '\u202A' + // LRE
        '\u202B' + // RLE
        '\u202C' + // PDF
        '\u202D' + // LRO
        '\u202E' + // RLO
        '\u2066' + // LRI
        '\u2067' + // RLI
        '\u2068' + // FSI
        '\u2069' + // PDI
        'Suffix';

      expect(stripBidiOverrides(bidiContaminated)).toBe('PrefixSuffix');
    });

    it('preserves regular international and RTL script characters without marks', () => {
      const arabicText = 'مرحبا بالعالم';
      const hebrewText = 'שלום עולם';
      expect(stripBidiOverrides(arabicText)).toBe(arabicText);
      expect(stripBidiOverrides(hebrewText)).toBe(hebrewText);
    });
  });

  // =========================================================================
  // 3. UNICODE NORMALIZATION (NFKC)
  // =========================================================================
  describe('normalizeUnicode', () => {
    it('normalizes fullwidth Latin homoglyphs to standard ASCII characters', () => {
      const fullwidth = 'Ｈｅｌｌｏ Ｗｏｒｌｄ';
      expect(normalizeUnicode(fullwidth)).toBe('Hello World');
    });

    it('normalizes Unicode ligature homoglyphs into canonical decomposition', () => {
      const ligature = 'ﬁle'; // U+FB01
      expect(normalizeUnicode(ligature)).toBe('file');
    });

    it('normalizes circled alphanumeric characters', () => {
      const circled = '①②③';
      expect(normalizeUnicode(circled)).toBe('123');
    });

    it('handles empty or undefined inputs safely', () => {
      expect(normalizeUnicode('')).toBe('');
      expect(normalizeUnicode(null as any)).toBe('');
    });
  });

  // =========================================================================
  // 4. LENGTH CLAMPING
  // =========================================================================
  describe('clampLength', () => {
    it('clamps 10,000 character strings to specified threshold', () => {
      const hugeString = 'A'.repeat(10000);
      expect(clampLength(hugeString, 255)).toHaveLength(255);
      expect(clampLength(hugeString, 5000)).toHaveLength(5000);
    });

    it('leaves strings shorter than maxLength untouched', () => {
      const shortStr = 'Valid Short String';
      expect(clampLength(shortStr, 255)).toBe(shortStr);
    });

    it('returns empty string if maxLength is 0 or negative', () => {
      expect(clampLength('Hello', 0)).toBe('');
      expect(clampLength('Hello', -10)).toBe('');
    });
  });

  // =========================================================================
  // 5. COMPOSED SANITIZATION (sanitizeInput & sanitizeTextarea)
  // =========================================================================
  describe('sanitizeInput', () => {
    it('composes Unicode normalization, control stripping, Bidi removal, and length clamping', () => {
      const malicious =
        'Ａｄｍｉｎ\x00\x08' +
        '\u202E' +
        'User\tPreserved' +
        'X'.repeat(500);

      const sanitized = sanitizeInput(malicious, 50);
      expect(sanitized).toHaveLength(50);
      expect(sanitized).not.toContain('\x00');
      expect(sanitized).not.toContain('\u202E');
      expect(sanitized.startsWith('AdminUser\tPreserved')).toBe(true);
    });

    it('defaults to 255 characters maximum length for single line inputs', () => {
      const longInput = 'A'.repeat(500);
      expect(sanitizeInput(longInput)).toHaveLength(255);
    });

    it('handles non-string arguments gracefully', () => {
      expect(sanitizeInput(null as any)).toBe('');
      expect(sanitizeInput(undefined as any)).toBe('');
      expect(sanitizeInput(12345 as any)).toBe('');
    });
  });

  describe('sanitizeTextarea', () => {
    it('defaults to 5,000 characters and preserves multi-line linefeeds', () => {
      const longMultiline = ('Line 1\r\nLine 2\nLine 3\tTabbed\n' + 'B'.repeat(6000));
      const sanitized = sanitizeTextarea(longMultiline);

      expect(sanitized).toHaveLength(5000);
      expect(sanitized).toContain('Line 1\r\nLine 2\nLine 3\tTabbed\n');
    });

    it('strips Trojan Source bidi overrides and null bytes while preserving newlines', () => {
      const multilineWithAttack = 'Header\nAttack:\0\u202Ereversed\nFooter';
      const sanitized = sanitizeTextarea(multilineWithAttack);

      expect(sanitized).toBe('Header\nAttack:reversed\nFooter');
    });
  });

  // =========================================================================
  // 6. COMPONENT INTEGRATION (Input & Textarea)
  // =========================================================================
  describe('Input & Textarea Component Hardening', () => {
    it('Input sets default maxLength to 255 for text inputs', () => {
      const element = (Input as any).render({ type: 'text' }, null);
      expect(element.props.maxLength).toBe(255);
    });

    it('Input honors custom maxLength override', () => {
      const element = (Input as any).render({ type: 'text', maxLength: 100 }, null);
      expect(element.props.maxLength).toBe(100);
    });

    it('Input onChange event automatically sanitizes malicious value', () => {
      let capturedValue = '';
      const element = (Input as any).render(
        {
          type: 'text',
          onChange: (e: any) => {
            capturedValue = e.target.value;
          },
        },
        null
      );

      const fakeEvent = {
        target: {
          value: 'Admin\0\u202EUser\x07',
        },
      };

      element.props.onChange(fakeEvent);
      expect(capturedValue).toBe('AdminUser');
      expect(fakeEvent.target.value).toBe('AdminUser');
    });

    it('Textarea sets default maxLength to 5000', () => {
      const element = (Textarea as any).render({}, null);
      expect(element.props.maxLength).toBe(5000);
    });

    it('Textarea honors custom maxLength override', () => {
      const element = (Textarea as any).render({ maxLength: 1500 }, null);
      expect(element.props.maxLength).toBe(1500);
    });

    it('Textarea onChange and onBlur sanitize multiline values', () => {
      let capturedChange = '';
      let capturedBlur = '';

      const element = (Textarea as any).render(
        {
          onChange: (e: any) => {
            capturedChange = e.target.value;
          },
          onBlur: (e: any) => {
            capturedBlur = e.target.value;
          },
        },
        null
      );

      const changeEvent = {
        target: {
          value: 'Line 1\nAttack:\0\u202ESpoof\nLine 2',
        },
      };
      element.props.onChange(changeEvent);
      expect(capturedChange).toBe('Line 1\nAttack:Spoof\nLine 2');

      const blurEvent = {
        target: {
          value: 'Blur\0\u200FTest',
        },
      };
      element.props.onBlur(blurEvent);
      expect(capturedBlur).toBe('BlurTest');
    });
  });
});


