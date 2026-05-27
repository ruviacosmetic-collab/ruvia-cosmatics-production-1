/**
 * MongoDB connection monitor.
 *
 * Wires standard Mongoose connection lifecycle events to the logger so we can
 * observe connect/disconnect/reconnect/error states during dev and in prod.
 *
 * Exposed as `setupConnectionEventHandlers()` so it's idempotent — calling it
 * more than once won't double-register listeners.
 */

const mongoose = require('mongoose');

let handlersRegistered = false;

const setupConnectionEventHandlers = () => {
  if (handlersRegistered) return;
  handlersRegistered = true;

  const conn = mongoose.connection;

  conn.on('connected', () => {
    console.log('🟢 Mongoose: connected');
  });

  conn.on('open', () => {
    console.log('🟢 Mongoose: connection open');
  });

  conn.on('disconnected', () => {
    console.warn('🟡 Mongoose: disconnected');
  });

  conn.on('reconnected', () => {
    console.log('🟢 Mongoose: reconnected');
  });

  conn.on('reconnectFailed', () => {
    console.error('🔴 Mongoose: reconnect failed');
  });

  conn.on('error', (err) => {
    console.error(`🔴 Mongoose connection error: ${err && err.message ? err.message : err}`);
  });

  // Graceful shutdown — close the connection on process termination.
  const gracefulClose = async (signal) => {
    try {
      await mongoose.connection.close();
      console.log(`Mongoose connection closed (${signal})`);
    } catch (err) {
      console.error(`Error closing Mongoose connection on ${signal}:`, err);
    } finally {
      process.exit(0);
    }
  };

  process.once('SIGINT', () => gracefulClose('SIGINT'));
  process.once('SIGTERM', () => gracefulClose('SIGTERM'));
};

module.exports = { setupConnectionEventHandlers };
