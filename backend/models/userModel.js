const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { encrypt, decrypt, isEncrypted } = require('../utils/encryptionUtil');

// Fields on each address subdocument that should be encrypted at rest
// (Requirements: 15). firstName / lastName are intentionally left in
// plaintext so order summaries and shipping-label rendering paths that
// rely on them keep working without per-request decryption.
const ENCRYPTED_ADDRESS_FIELDS = ['phone', 'address', 'city', 'pin'];

// One-time warning flags so we don't spam the logs in dev environments
// where ENCRYPTION_KEY may not be configured.
let warnedEncryptMissingKey = false;
let warnedDecryptMissingKey = false;

/**
 * Encrypt a value if it is a non-empty string and not already encrypted.
 * Failures (e.g. missing ENCRYPTION_KEY in dev) are swallowed and the
 * original value is returned so application flows are not broken.
 */
function encryptIfPossible(value) {
  if (typeof value !== 'string' || value.length === 0) return value;
  if (isEncrypted(value)) return value;
  try {
    return encrypt(value);
  } catch (err) {
    if (!warnedEncryptMissingKey) {
      warnedEncryptMissingKey = true;
      // eslint-disable-next-line no-console
      console.warn(
        `[userModel] Skipping field encryption: ${err.message}. ` +
          'Set ENCRYPTION_KEY to enable encryption at rest.'
      );
    }
    return value;
  }
}

/**
 * Decrypt a value if it looks encrypted. Failures are swallowed so a
 * single corrupt or legacy plaintext field cannot break document loads.
 */
function decryptIfPossible(value) {
  if (typeof value !== 'string' || value.length === 0) return value;
  if (!isEncrypted(value)) return value;
  try {
    return decrypt(value);
  } catch (err) {
    if (!warnedDecryptMissingKey) {
      warnedDecryptMissingKey = true;
      // eslint-disable-next-line no-console
      console.warn(
        `[userModel] Skipping field decryption: ${err.message}. ` +
          'Verify ENCRYPTION_KEY matches the key used at write time.'
      );
    }
    return value;
  }
}

const userSchema = mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  phone: { type: String },
  addresses: [{
    firstName: String,
    lastName: String,
    phone: String,
    address: String,
    city: String,
    pin: String,
  }],
  // Security fields
  isBlocked: { type: Boolean, default: false },
  lastLogout: { type: Date },
  emailVerified: { type: Boolean, default: false },
  emailVerificationToken: { type: String },
  emailVerificationExpiry: { type: Date },
  passwordResetToken: { type: String },
  passwordResetExpiry: { type: Date },
  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },
}, { timestamps: true });

// Indexes for efficient querying.
// NOTE: the `email` index is created automatically by `unique: true` on the
// field definition above, so we don't redeclare it here.
userSchema.index({ emailVerificationToken: 1 });
userSchema.index({ passwordResetToken: 1 });

// Password hash middleware
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  if (this.password) {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
  }
});

// Encryption-at-rest middleware for sensitive PII (phone + address line).
// Runs on every save when the relevant paths are dirty so newly-added or
// updated addresses are encrypted before they hit the database.
userSchema.pre('save', function () {
  if (this.isModified('phone') && this.phone) {
    this.phone = encryptIfPossible(this.phone);
  }

  if (this.isModified('addresses') && Array.isArray(this.addresses)) {
    this.addresses.forEach((addr) => {
      if (!addr) return;
      ENCRYPTED_ADDRESS_FIELDS.forEach((field) => {
        if (addr[field]) {
          addr[field] = encryptIfPossible(addr[field]);
        }
      });
    });
  }
});

// Decrypt sensitive fields after a document is loaded from MongoDB.
// `init` fires for every document hydrated by find / findOne / findById /
// findOneAndUpdate (when `new: true`), making this the canonical place
// for transparent decryption.
userSchema.post('init', function () {
  if (this.phone) {
    this.phone = decryptIfPossible(this.phone);
  }

  if (Array.isArray(this.addresses)) {
    this.addresses.forEach((addr) => {
      if (!addr) return;
      ENCRYPTED_ADDRESS_FIELDS.forEach((field) => {
        if (addr[field]) {
          addr[field] = decryptIfPossible(addr[field]);
        }
      });
    });
  }
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

// Check if account is locked due to too many login attempts
userSchema.methods.isAccountLocked = function () {
  return this.lockUntil && this.lockUntil > Date.now();
};

// Increment login attempts
userSchema.methods.incLoginAttempts = async function () {
  // Reset attempts if lock has expired
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 }
    });
  }

  // Increment attempts
  const updates = { $inc: { loginAttempts: 1 } };

  // Lock account after 5 failed attempts for 30 minutes
  const maxAttempts = 5;
  const lockTime = 30 * 60 * 1000; // 30 minutes

  if (this.loginAttempts + 1 >= maxAttempts && !this.isAccountLocked()) {
    updates.$set = { lockUntil: new Date(Date.now() + lockTime) };
  }

  return this.updateOne(updates);
};

// Reset login attempts
userSchema.methods.resetLoginAttempts = async function () {
  return this.updateOne({
    $set: { loginAttempts: 0 },
    $unset: { lockUntil: 1 }
  });
};

const User = mongoose.model('User', userSchema);
module.exports = User;
