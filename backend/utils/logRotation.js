/**
 * Log Rotation Utility
 *
 * Provides daily rotation and retention management for application log files.
 * Designed to work alongside `middleware/requestLoggingMiddleware.js` which
 * writes to `access.log` and `error.log` inside the backend logs directory.
 *
 * Capabilities:
 *  - rotateLogs({ logsDir }): rename current log files with a YYYY-MM-DD suffix
 *    and re-create empty access.log / error.log files.
 *  - pruneOldLogs({ logsDir, retentionDays }): delete rotated log files older
 *    than the configured retention window (default: 30 days).
 *  - scheduleDailyRotation({ logsDir, retentionDays, hour, minute }): schedule
 *    rotateLogs + pruneOldLogs to run once per day. Timers are unref'd so they
 *    do not keep the Node.js event loop alive.
 *
 * Requirements: 22 (request logging, log rotation, 30-day retention).
 */

const fs = require('fs');
const path = require('path');

const DEFAULT_LOGS_DIR = path.join(__dirname, '../logs');
const DEFAULT_RETENTION_DAYS = 30;
const DAY_IN_MS = 24 * 60 * 60 * 1000;

// Log file basenames managed by this utility. Keep in sync with
// requestLoggingMiddleware.js which writes to these filenames.
const MANAGED_LOG_FILES = ['access.log', 'error.log'];

/**
 * Format a Date as YYYY-MM-DD using local time.
 * @param {Date} date
 * @returns {string}
 */
const formatDateStamp = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Ensure the logs directory exists. Creates it (recursively) if missing.
 * @param {string} logsDir
 */
const ensureLogsDir = (logsDir) => {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
};

/**
 * Rotate the active log files in `logsDir`.
 *
 * For each managed log file (access.log, error.log) that exists and is
 * non-empty, rename it to `<base>-YYYY-MM-DD.log`. If a rotated file with the
 * same name already exists for today, append a numeric suffix to avoid
 * overwriting.
 *
 * After rotation, fresh empty `access.log` and `error.log` files are created
 * so that subsequent writes by the request logger have a target to append to.
 *
 * @param {object} [options]
 * @param {string} [options.logsDir] - Directory containing the log files.
 *   Defaults to `<backend>/logs`.
 * @returns {{ rotated: string[], skipped: string[] }}
 */
const rotateLogs = ({ logsDir = DEFAULT_LOGS_DIR } = {}) => {
  ensureLogsDir(logsDir);

  const stamp = formatDateStamp(new Date());
  const rotated = [];
  const skipped = [];

  for (const filename of MANAGED_LOG_FILES) {
    const sourcePath = path.join(logsDir, filename);

    let stats;
    try {
      stats = fs.statSync(sourcePath);
    } catch (err) {
      // File doesn't exist - nothing to rotate. Still create a fresh empty
      // file below so writers can append.
      if (err && err.code === 'ENOENT') {
        skipped.push(filename);
        try {
          fs.writeFileSync(sourcePath, '', { flag: 'a' });
        } catch (_writeErr) {
          // Ignore - we tried our best
        }
        continue;
      }
      throw err;
    }

    if (!stats.isFile() || stats.size === 0) {
      // Don't rotate empty files; nothing meaningful to preserve.
      skipped.push(filename);
      continue;
    }

    const ext = path.extname(filename); // ".log"
    const base = path.basename(filename, ext); // "access" or "error"

    let candidate = path.join(logsDir, `${base}-${stamp}${ext}`);
    let counter = 1;
    while (fs.existsSync(candidate)) {
      candidate = path.join(logsDir, `${base}-${stamp}.${counter}${ext}`);
      counter += 1;
    }

    fs.renameSync(sourcePath, candidate);
    rotated.push(path.basename(candidate));

    // Re-create the active log file so writers can continue to append.
    fs.writeFileSync(sourcePath, '', { flag: 'a' });
  }

  return { rotated, skipped };
};

/**
 * Delete rotated log files older than `retentionDays` days.
 *
 * Only files matching the managed rotation naming pattern
 * (`access-*.log`, `error-*.log`) are considered. The active `access.log`
 * and `error.log` are never deleted.
 *
 * @param {object} [options]
 * @param {string} [options.logsDir] - Directory to scan. Defaults to
 *   `<backend>/logs`.
 * @param {number} [options.retentionDays] - Files with mtime older than
 *   this many days are deleted. Defaults to 30.
 * @returns {{ deleted: string[] }}
 */
const pruneOldLogs = ({
  logsDir = DEFAULT_LOGS_DIR,
  retentionDays = DEFAULT_RETENTION_DAYS,
} = {}) => {
  ensureLogsDir(logsDir);

  const cutoff = Date.now() - retentionDays * DAY_IN_MS;
  const deleted = [];

  let entries;
  try {
    entries = fs.readdirSync(logsDir);
  } catch (err) {
    if (err && err.code === 'ENOENT') return { deleted };
    throw err;
  }

  // Match files like access-2024-05-01.log, error-2024-05-01.1.log, etc.
  const rotatedPattern = /^(access|error)-\d{4}-\d{2}-\d{2}(?:\.\d+)?\.log$/;

  for (const entry of entries) {
    if (!rotatedPattern.test(entry)) continue;

    const fullPath = path.join(logsDir, entry);
    let stats;
    try {
      stats = fs.statSync(fullPath);
    } catch (_err) {
      continue;
    }

    if (!stats.isFile()) continue;

    if (stats.mtimeMs < cutoff) {
      try {
        fs.unlinkSync(fullPath);
        deleted.push(entry);
      } catch (_err) {
        // Best-effort: skip files we cannot delete.
      }
    }
  }

  return { deleted };
};

/**
 * Compute milliseconds from `from` until the next occurrence of `hour:minute`
 * in local time. If the time today has already passed, returns the delay until
 * the same time tomorrow.
 *
 * Exported for testability.
 *
 * @param {number} hour - 0-23
 * @param {number} minute - 0-59
 * @param {Date} [from] - Reference time. Defaults to now.
 * @returns {number}
 */
const millisUntilNext = (hour, minute, from = new Date()) => {
  const target = new Date(
    from.getFullYear(),
    from.getMonth(),
    from.getDate(),
    hour,
    minute,
    0,
    0
  );
  if (target.getTime() <= from.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target.getTime() - from.getTime();
};

/**
 * Schedule daily log rotation + retention pruning.
 *
 * Behavior:
 *  - Computes the delay until the next `hour:minute` (local time).
 *  - At that time, runs rotateLogs + pruneOldLogs.
 *  - Then runs the same task every 24 hours via setInterval.
 *  - Both the timeout and the interval are .unref()'d so this scheduler
 *    does not prevent the Node.js process from exiting.
 *
 * The returned object exposes a `cancel()` method that clears any pending
 * timers, which is useful in tests or during graceful shutdown.
 *
 * @param {object} [options]
 * @param {string} [options.logsDir] - Logs directory. Defaults to
 *   `<backend>/logs`.
 * @param {number} [options.retentionDays] - Retention window in days.
 *   Defaults to 30.
 * @param {number} [options.hour] - Hour (0-23) to run rotation. Defaults to 0.
 * @param {number} [options.minute] - Minute (0-59) to run rotation.
 *   Defaults to 0.
 * @param {function} [options.onError] - Optional callback invoked with any
 *   error thrown by rotateLogs or pruneOldLogs. Defaults to console.error.
 * @returns {{ cancel: () => void }}
 */
const scheduleDailyRotation = ({
  logsDir = DEFAULT_LOGS_DIR,
  retentionDays = DEFAULT_RETENTION_DAYS,
  hour = 0,
  minute = 0,
  onError,
} = {}) => {
  const handleError = (err) => {
    if (typeof onError === 'function') {
      onError(err);
      return;
    }
    // eslint-disable-next-line no-console
    console.error('[logRotation] scheduled task failed:', err);
  };

  const runOnce = () => {
    try {
      rotateLogs({ logsDir });
      pruneOldLogs({ logsDir, retentionDays });
    } catch (err) {
      handleError(err);
    }
  };

  let intervalHandle = null;
  const initialDelay = millisUntilNext(hour, minute);

  const timeoutHandle = setTimeout(() => {
    runOnce();
    intervalHandle = setInterval(runOnce, DAY_IN_MS);
    if (intervalHandle && typeof intervalHandle.unref === 'function') {
      intervalHandle.unref();
    }
  }, initialDelay);

  if (timeoutHandle && typeof timeoutHandle.unref === 'function') {
    timeoutHandle.unref();
  }

  return {
    cancel: () => {
      clearTimeout(timeoutHandle);
      if (intervalHandle) clearInterval(intervalHandle);
    },
  };
};

module.exports = {
  rotateLogs,
  pruneOldLogs,
  scheduleDailyRotation,
  // Exported for tests / advanced callers
  millisUntilNext,
  DEFAULT_LOGS_DIR,
  DEFAULT_RETENTION_DAYS,
  MANAGED_LOG_FILES,
};
