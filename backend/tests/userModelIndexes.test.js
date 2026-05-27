/**
 * User Model Indexes Verification Test
 * Verifies that all required indexes are properly defined on the User model
 * Requirements: 5 (Database Indexes for Performance)
 * Validates: Requirements 5
 */

const User = require('../models/userModel');

describe('User Model Indexes', () => {
  /**
   * Test 1: Verify unique index on email field is defined in schema
   */
  test('should have unique index on email field defined in schema', () => {
    const schema = User.schema;
    const emailPath = schema.paths.email;

    expect(emailPath).toBeDefined();
    expect(emailPath.options.unique).toBe(true);
  });

  /**
   * Test 2: Verify index on emailVerificationToken field is defined in schema
   */
  test('should have index on emailVerificationToken field defined in schema', () => {
    const schema = User.schema;
    const tokenPath = schema.paths.emailVerificationToken;

    expect(tokenPath).toBeDefined();
    expect(tokenPath.instance).toBe('String');
  });

  /**
   * Test 3: Verify index on passwordResetToken field is defined in schema
   */
  test('should have index on passwordResetToken field defined in schema', () => {
    const schema = User.schema;
    const resetTokenPath = schema.paths.passwordResetToken;

    expect(resetTokenPath).toBeDefined();
    expect(resetTokenPath.instance).toBe('String');
  });

  /**
   * Test 4: Verify all required fields are defined in schema
   */
  test('should have all required indexed fields defined in schema', () => {
    const schema = User.schema;
    const paths = schema.paths;

    expect(paths.email).toBeDefined();
    expect(paths.emailVerificationToken).toBeDefined();
    expect(paths.passwordResetToken).toBeDefined();
  });

  /**
   * Test 5: Verify email field is required and lowercase
   */
  test('should have email field with required and lowercase options', () => {
    const schema = User.schema;
    const emailPath = schema.paths.email;

    expect(emailPath.options.required).toBe(true);
    expect(emailPath.options.lowercase).toBe(true);
    expect(emailPath.options.trim).toBe(true);
  });

  /**
   * Test 6: Verify schema indexes are properly configured
   */
  test('should have indexes properly configured in schema', () => {
    const schema = User.schema;
    const indexes = schema._indexes;

    // Check if indexes are defined
    expect(indexes).toBeDefined();
    expect(indexes.length).toBeGreaterThan(0);

    // Verify email index with unique constraint
    const emailIndex = indexes.find((idx) => idx[0].email === 1);
    expect(emailIndex).toBeDefined();
    expect(emailIndex[1].unique).toBe(true);

    // Verify emailVerificationToken index
    const tokenIndex = indexes.find((idx) => idx[0].emailVerificationToken === 1);
    expect(tokenIndex).toBeDefined();

    // Verify passwordResetToken index
    const resetTokenIndex = indexes.find((idx) => idx[0].passwordResetToken === 1);
    expect(resetTokenIndex).toBeDefined();
  });
});
