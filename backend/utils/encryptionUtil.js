/**
 * Encryption utility (AES-256-GCM)
 *
 * Provides authenticated symmetric encryption for sensitive data at rest
 * (e.g., user phone numbers, addresses). The key is derived from the
 * `ENCRYPTION_KEY` environment variable and must represent 32 bytes of
 * key material, encoded as either:
 *   - 64-character hex string (preferred), or
 *   - 44-character base64 string (with or without padding)
 *
 * Output format: a single base64 string containing
 *   IV (12 bytes) || authTag (16 bytes) || ciphertext (variable)
 *
 * Generate a key with:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 *
 * Requirements: 15
 */

'use strict';

const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32; // AES-256
const IV_BYTES = 12;  // GCM standard IV length
const AUTH_TAG_BYTES = 16;

let cachedKey = null;
let cachedKeySource = null;

/**
 * Decode a key string that may be hex or base64 into a 32-byte Buffer.
 * Throws if the decoded length is not exactly 32 bytes.
 *
 * @param {string} rawKey
 * @returns {Buffer}
 */
function decodeKey(rawKey) {
  if (typeof rawKey !== 'string' || rawKey.length === 0) {
    throw new Error('ENCRYPTION_KEY must be a non-empty string');
  }

  const trimmed = rawKey.trim();

  // Try hex first when the string looks like hex of the correct length.
  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length === KEY_BYTES * 2) {
    return Buffer.from(trimmed, 'hex');
  }

  // Fall back to base64 (supports standard and URL-safe variants).
  const normalized = trimmed.replace(/-/g, '+').replace(/_/g, '/');
  const padded =
    normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const decoded = Buffer.from(padded, 'base64');

  if (decoded.length !== KEY_BYTES) {
    throw new Error(
      `ENCRYPTION_KEY must decode to ${KEY_BYTES} bytes (got ${decoded.length}). ` +
        'Provide 64 hex chars or 44 base64 chars.'
    );
  }

  return decoded;
}

/**
 * Resolve the encryption key from the environment, caching the decoded
 * Buffer so repeated calls are cheap. The cache is invalidated automatically
 * when `process.env.ENCRYPTION_KEY` changes (useful in tests).
 *
 * @returns {Buffer}
 */
function getKey() {
  const source = process.env.ENCRYPTION_KEY;
  if (!source) {
    throw new Error(
      'ENCRYPTION_KEY environment variable is not set. ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }

  if (cachedKey && cachedKeySource === source) {
    return cachedKey;
  }

  const key = decodeKey(source);
  cachedKey = key;
  cachedKeySource = source;
  return key;
}

/**
 * Encrypt a UTF-8 string with AES-256-GCM.
 *
 * The returned ciphertext is a base64 string containing the random IV,
 * the authentication tag, and the ciphertext concatenated together.
 *
 * @param {string} plaintext
 * @returns {string} base64-encoded payload
 */
function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined) {
    throw new Error('encrypt() requires a string input');
  }
  if (typeof plaintext !== 'string') {
    throw new Error('encrypt() requires a string input');
  }

  const key = getKey();
  const iv = crypto.randomBytes(IV_BYTES);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

/**
 * Decrypt a payload produced by `encrypt()`. The authentication tag is
 * verified; tampered or truncated payloads throw an error.
 *
 * @param {string} payload base64-encoded IV || authTag || ciphertext
 * @returns {string} original plaintext
 */
function decrypt(payload) {
  if (typeof payload !== 'string' || payload.length === 0) {
    throw new Error('decrypt() requires a non-empty string payload');
  }

  const buffer = Buffer.from(payload, 'base64');
  if (buffer.length < IV_BYTES + AUTH_TAG_BYTES) {
    throw new Error('Invalid encrypted payload: too short');
  }

  const iv = buffer.subarray(0, IV_BYTES);
  const authTag = buffer.subarray(IV_BYTES, IV_BYTES + AUTH_TAG_BYTES);
  const ciphertext = buffer.subarray(IV_BYTES + AUTH_TAG_BYTES);

  const key = getKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  try {
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return plaintext.toString('utf8');
  } catch (err) {
    // Surface a clear, non-leaking error for callers/logs.
    throw new Error('Decryption failed: data may be tampered or key is wrong');
  }
}

/**
 * Heuristic check for whether a string looks like an `encrypt()` payload.
 * Useful for migrations / pre-save hooks that should be idempotent.
 *
 * @param {string} value
 * @returns {boolean}
 */
function isEncrypted(value) {
  if (typeof value !== 'string' || value.length === 0) return false;
  if (!/^[A-Za-z0-9+/=]+$/.test(value)) return false;
  try {
    const buf = Buffer.from(value, 'base64');
    return buf.length >= IV_BYTES + AUTH_TAG_BYTES + 1;
  } catch (_) {
    return false;
  }
}

module.exports = {
  encrypt,
  decrypt,
  isEncrypted,
  // Exported for tests / advanced callers; not part of the model API.
  _internals: { decodeKey, getKey, ALGORITHM, IV_BYTES, AUTH_TAG_BYTES },
};
