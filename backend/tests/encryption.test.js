/**
 * Encryption / Decryption Tests
 *
 * Validates Requirement 15 (Encryption at Rest):
 *   - encrypt() / decrypt() round-trip preserves plaintext
 *   - Sensitive User fields (phone, address fields) are encrypted in MongoDB
 *   - Documents loaded via Mongoose are transparently decrypted
 *   - Tampered or truncated payloads are rejected
 *   - Pre-save hook is idempotent (no double-encryption on resave)
 *
 * Run: npx jest tests/encryption.test.js --runInBand
 */

'use strict';

const crypto = require('crypto');

// ENCRYPTION_KEY must be set BEFORE the encryption util / userModel are required,
// otherwise the cached "missing key" warning path is taken and the model will
// silently skip encryption.
process.env.ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');

const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

const {
  encrypt,
  decrypt,
  isEncrypted,
} = require('../utils/encryptionUtil');
const User = require('../models/userModel');

let mongoServer;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

afterEach(async () => {
  await User.collection.deleteMany({});
});

describe('encryptionUtil (Requirement 15)', () => {
  test('encrypt() then decrypt() returns the original plaintext', () => {
    const plaintext = '9876543210';
    const ciphertext = encrypt(plaintext);

    expect(typeof ciphertext).toBe('string');
    expect(ciphertext).not.toBe(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  test('round-trips unicode and longer plaintext', () => {
    const samples = [
      'simple ascii',
      '12 Main St, Apt 4B, Mumbai 400001',
      'name with spaces and punctuation: O\'Neill-García',
      'unicode: 你好世界 🌍 こんにちは',
      'a'.repeat(2048),
    ];

    for (const sample of samples) {
      const ct = encrypt(sample);
      expect(decrypt(ct)).toBe(sample);
    }
  });

  test('produces a different ciphertext each time (random IV)', () => {
    const plaintext = '9876543210';
    const a = encrypt(plaintext);
    const b = encrypt(plaintext);

    // Random IV means same plaintext -> different payloads, but both decrypt
    // back to the original.
    expect(a).not.toBe(b);
    expect(decrypt(a)).toBe(plaintext);
    expect(decrypt(b)).toBe(plaintext);
  });

  test('isEncrypted() returns true for ciphertext and false for plaintext', () => {
    expect(isEncrypted(encrypt('hello'))).toBe(true);
    expect(isEncrypted('hello')).toBe(false);
    expect(isEncrypted('')).toBe(false);
    expect(isEncrypted(null)).toBe(false);
    expect(isEncrypted(undefined)).toBe(false);
  });

  test('decrypt() rejects a tampered payload', () => {
    const ciphertext = encrypt('sensitive data');
    const buf = Buffer.from(ciphertext, 'base64');

    // Flip one bit deep inside the ciphertext region (after IV + authTag = 28 bytes).
    const flipIndex = buf.length - 1;
    buf[flipIndex] = buf[flipIndex] ^ 0x01;
    const tampered = buf.toString('base64');

    expect(() => decrypt(tampered)).toThrow(/Decryption failed/);
  });

  test('decrypt() rejects a truncated payload', () => {
    const ciphertext = encrypt('sensitive data');
    const truncated = Buffer.from(ciphertext, 'base64')
      .subarray(0, 10) // shorter than IV + authTag
      .toString('base64');

    expect(() => decrypt(truncated)).toThrow(/too short/);
  });

  test('encrypt() rejects non-string input', () => {
    expect(() => encrypt(null)).toThrow();
    expect(() => encrypt(undefined)).toThrow();
    expect(() => encrypt(12345)).toThrow();
  });
});

describe('User model encryption-at-rest (Requirement 15)', () => {
  const buildUser = (overrides = {}) => ({
    name: 'Test User',
    email: `test-${Date.now()}-${Math.random()}@example.com`,
    password: 'irrelevant-for-this-test',
    phone: '9876543210',
    addresses: [
      {
        firstName: 'Test',
        lastName: 'User',
        phone: '8123456789',
        address: '12 Main St, Apt 4B',
        city: 'Mumbai',
        pin: '400001',
      },
    ],
    ...overrides,
  });

  test('phone and address fields are stored encrypted in MongoDB', async () => {
    const original = buildUser();
    const created = await User.create(original);

    // Read the raw document directly from the collection so Mongoose
    // post-init hooks do NOT run; we want to see what is actually on disk.
    const raw = await User.collection.findOne({ _id: created._id });

    // Top-level phone: encrypted, not equal to plaintext, looks like a payload.
    expect(raw.phone).toBeDefined();
    expect(raw.phone).not.toBe(original.phone);
    expect(isEncrypted(raw.phone)).toBe(true);
    expect(decrypt(raw.phone)).toBe(original.phone);

    // Address: encrypted fields are scrambled, plaintext fields kept as-is.
    const rawAddr = raw.addresses[0];
    const origAddr = original.addresses[0];

    for (const field of ['phone', 'address', 'city', 'pin']) {
      expect(rawAddr[field]).not.toBe(origAddr[field]);
      expect(isEncrypted(rawAddr[field])).toBe(true);
      expect(decrypt(rawAddr[field])).toBe(origAddr[field]);
    }

    // firstName / lastName are intentionally left in plaintext.
    expect(rawAddr.firstName).toBe(origAddr.firstName);
    expect(rawAddr.lastName).toBe(origAddr.lastName);
  });

  test('documents loaded through Mongoose are transparently decrypted', async () => {
    const original = buildUser();
    const created = await User.create(original);

    const loaded = await User.findById(created._id);

    expect(loaded.phone).toBe(original.phone);

    const loadedAddr = loaded.addresses[0];
    const origAddr = original.addresses[0];

    expect(loadedAddr.phone).toBe(origAddr.phone);
    expect(loadedAddr.address).toBe(origAddr.address);
    expect(loadedAddr.city).toBe(origAddr.city);
    expect(loadedAddr.pin).toBe(origAddr.pin);
    expect(loadedAddr.firstName).toBe(origAddr.firstName);
    expect(loadedAddr.lastName).toBe(origAddr.lastName);
  });

  test('re-saving does not double-encrypt (decrypt still returns original plaintext)', async () => {
    const original = buildUser();
    const created = await User.create(original);

    // Load via Mongoose (post-init decrypts), mutate an unrelated field, save.
    const loaded = await User.findById(created._id);
    loaded.name = 'Renamed User';
    await loaded.save();

    const rawAfter = await User.collection.findOne({ _id: created._id });

    // The fields must still decrypt to the original plaintext. If the pre-save
    // hook had encrypted-on-top-of-encrypted ciphertext, decrypt() would return
    // the prior ciphertext (or fail authTag verification), not the plaintext.
    expect(isEncrypted(rawAfter.phone)).toBe(true);
    expect(decrypt(rawAfter.phone)).toBe(original.phone);

    expect(isEncrypted(rawAfter.addresses[0].phone)).toBe(true);
    expect(decrypt(rawAfter.addresses[0].phone)).toBe(original.addresses[0].phone);
    expect(decrypt(rawAfter.addresses[0].address)).toBe(original.addresses[0].address);

    // And the round-tripped Mongoose view also matches the original.
    const reloaded = await User.findById(created._id);
    expect(reloaded.phone).toBe(original.phone);
    expect(reloaded.addresses[0].address).toBe(original.addresses[0].address);
  });
});
