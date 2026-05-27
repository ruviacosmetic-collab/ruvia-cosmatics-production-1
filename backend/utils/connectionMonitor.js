const mongoose = require('mongoose');

/**
 * Connection Monitor Utility
 * Monitors MongoDB connection pool health
 */

/**
 * Get connection pool statistics
 * @returns {Object} Connection pool statistics
 */
const getConnectionStats = () => {
  const connection = mongoose.connection;

  return {
    state: connection.readyState,
    stateDescription: getConnectionStateDescription(connection.readyState),
    host: connection.host,
    port: connection.port,
    name: connection.name,
    collections: Object.keys(connection.collections).length,
    models: Object.keys(connection.models).length,
  };
};

/**
 * Get human-readable connection state description
 * @param {number} state - Connection state code
 * @returns {string} State description
 */
const getConnectionStateDescription = (state) => {
  const states = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };

  return states[state] || 'unknown';
};

/**
 * Check if connection is healthy
 * @returns {boolean} True if connection is healthy
 */
const isConnectionHealthy = () => {
  const connection = mongoose.connection;
  return connection.readyState === 1; // 1 = connected
};

/**
 * Monitor connection health
 * Logs connection status and alerts on failures
 * @param {number} intervalMs - Monitoring interval in milliseconds
 */
const startHealthMonitoring = (intervalMs = 30000) => {
  const monitoringInterval = setInterval(() => {
    const stats = getConnectionStats();

    if (!isConnectionHealthy()) {
      console.error('⚠️  Database connection unhealthy:', stats);

      // In production, send alert to monitoring service
      if (process.env.NODE_ENV === 'production') {
        // Example: sendAlert('Database connection unhealthy', stats);
      }
    } else {
      if (process.env.LOG_DB_HEALTH === 'true') {
        console.log('✅ Database connection healthy:', stats);
      }
    }
  }, intervalMs);

  // Prevent interval from keeping process alive
  monitoringInterval.unref();

  return monitoringInterval;
};

/**
 * Stop health monitoring
 * @param {NodeJS.Timeout} monitoringInterval - Interval to stop
 */
const stopHealthMonitoring = (monitoringInterval) => {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
  }
};

/**
 * Get connection pool info
 * @returns {Object} Connection pool information
 */
const getPoolInfo = () => {
  const connection = mongoose.connection;

  return {
    minPoolSize: connection.client?.options?.minPoolSize || 5,
    maxPoolSize: connection.client?.options?.maxPoolSize || 10,
    currentConnections: connection.client?.topology?.s?.pool?.totalConnectionCount || 0,
    availableConnections: connection.client?.topology?.s?.pool?.availableConnectionCount || 0,
  };
};

/**
 * Log connection pool info
 */
const logPoolInfo = () => {
  const poolInfo = getPoolInfo();
  console.log('Connection Pool Info:', poolInfo);
};

/**
 * Handle connection events
 */
const setupConnectionEventHandlers = () => {
  const connection = mongoose.connection;

  connection.on('connected', () => {
    console.log('✅ MongoDB connected');
  });

  connection.on('error', (err) => {
    console.error('❌ MongoDB connection error:', err.message);
  });

  connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB disconnected');
  });

  connection.on('reconnected', () => {
    console.log('✅ MongoDB reconnected');
  });
};

module.exports = {
  getConnectionStats,
  getConnectionStateDescription,
  isConnectionHealthy,
  startHealthMonitoring,
  stopHealthMonitoring,
  getPoolInfo,
  logPoolInfo,
  setupConnectionEventHandlers,
};
