/**
 * Secure Client Storage Provider
 * 
 * Enforces token encryption / obfuscation and automatic TTL expiration.
 * Guarantees that raw JWT bearer tokens are NEVER persisted in plaintext inside localStorage.
 */

const STORAGE_KEY = '__tn_sec_session__';
const XOR_SALT = 0x7b;
const DEFAULT_TTL_MS = 15 * 60 * 1000; // 15 minutes, matching JWT access token lifetime

interface SecureTokenEnvelope {
  _e: string;
  exp: number;
  created: number;
  v: 1;
}

function obfuscate(plainText: string): string {
  if (!plainText) return '';
  try {
    const chars = plainText.split('');
    const masked = chars.map((char, index) => {
      const charCode = char.charCodeAt(0);
      const saltOffset = (index * 7 + 13) % 256;
      return String.fromCharCode(charCode ^ XOR_SALT ^ saltOffset);
    }).join('');

    if (typeof window !== 'undefined' && typeof window.btoa === 'function') {
      return `__SEC_v1:${window.btoa(encodeURIComponent(masked))}`;
    }
    if (typeof Buffer !== 'undefined') {
      return `__SEC_v1:${Buffer.from(masked, 'utf-8').toString('base64')}`;
    }
    return `__SEC_v1:${masked}`;
  } catch {
    return '';
  }
}

function deobfuscate(encryptedText: string): string | null {
  if (!encryptedText || !encryptedText.startsWith('__SEC_v1:')) return null;
  try {
    const rawB64 = encryptedText.replace('__SEC_v1:', '');
    let decoded = '';

    if (typeof window !== 'undefined' && typeof window.atob === 'function') {
      decoded = decodeURIComponent(window.atob(rawB64));
    } else if (typeof Buffer !== 'undefined') {
      decoded = Buffer.from(rawB64, 'base64').toString('utf-8');
    } else {
      decoded = rawB64;
    }

    const chars = decoded.split('');
    const unmasked = chars.map((char, index) => {
      const charCode = char.charCodeAt(0);
      const saltOffset = (index * 7 + 13) % 256;
      return String.fromCharCode(charCode ^ XOR_SALT ^ saltOffset);
    }).join('');

    return unmasked;
  } catch {
    return null;
  }
}

export const secureStorage = {
  /**
   * Persists the token inside an encrypted envelope with an explicit expiration timestamp.
   */
  setToken: (token: string, ttlMs: number = DEFAULT_TTL_MS): void => {
    if (typeof localStorage === 'undefined') return;
    if (!token) {
      secureStorage.removeToken();
      return;
    }

    try {
      const envelope: SecureTokenEnvelope = {
        _e: obfuscate(token),
        exp: Date.now() + ttlMs,
        created: Date.now(),
        v: 1,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope));
      // Remove raw plaintext legacy auth_token if present
      localStorage.removeItem('auth_token');
    } catch {
      // Storage quota or private browsing restriction
    }
  },

  /**
   * Retrieves and decrypts the stored token.
   * Purges and returns null immediately if the token has expired.
   */
  getToken: (): string | null => {
    if (typeof localStorage === 'undefined') return null;

    try {
      // Clean legacy raw token if found
      const legacyRaw = localStorage.getItem('auth_token');
      if (legacyRaw && !legacyRaw.startsWith('__SEC_v1:')) {
        // Migrate to secure storage and purge plaintext key
        secureStorage.setToken(legacyRaw);
        localStorage.removeItem('auth_token');
      }

      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return null;

      const envelope: SecureTokenEnvelope = JSON.parse(stored);
      if (!envelope || envelope.v !== 1 || !envelope._e || !envelope.exp) {
        secureStorage.removeToken();
        return null;
      }

      // Check TTL expiration
      if (Date.now() > envelope.exp) {
        secureStorage.removeToken();
        return null;
      }

      return deobfuscate(envelope._e);
    } catch {
      secureStorage.removeToken();
      return null;
    }
  },

  /**
   * Clears the encrypted token envelope and any residual raw tokens from storage.
   */
  removeToken: (): void => {
    if (typeof localStorage === 'undefined') return;
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem('auth_token');
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem('auth_token');
      }
    } catch {
      // ignore
    }
  },

  /**
   * Checks whether an unexpired secure session exists.
   */
  hasActiveSession: (): boolean => {
    return secureStorage.getToken() !== null;
  },

  /**
   * Scrub any plaintext tokens from local and session storage.
   */
  cleanseAllRawTokens: (): void => {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem('auth_token');
      if (raw && !raw.startsWith('__SEC_v1:')) {
        localStorage.removeItem('auth_token');
      }
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('auth_token');
      }
    } catch {
      // ignore
    }
  },
};

export default secureStorage;
