module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'models/**/*.js',
    'middleware/**/*.js',
    'utils/**/*.js',
    'controllers/**/*.js',
    '!**/node_modules/**',
  ],
  testTimeout: 30000,
  verbose: true,
};
