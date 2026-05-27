/**
 * CSP Violation Middleware
 * Handles Content Security Policy violation reports
 */

/**
 * Middleware to receive and log CSP violation reports
 */
const cspViolationHandler = (req, res, next) => {
  // This middleware should be used for POST /api/csp-report endpoint
  
  if (req.method !== 'POST') {
    return next();
  }
  
  try {
    const violation = req.body;
    
    // Log CSP violation
    const violationLog = {
      timestamp: new Date().toISOString(),
      type: 'CSP_VIOLATION',
      documentUri: violation['document-uri'],
      violatedDirective: violation['violated-directive'],
      effectiveDirective: violation['effective-directive'],
      originalPolicy: violation['original-policy'],
      blockedUri: violation['blocked-uri'],
      sourceFile: violation['source-file'],
      lineNumber: violation['line-number'],
      columnNumber: violation['column-number'],
      statusCode: violation['status-code'],
      disposition: violation['disposition'],
    };
    
    // Log to console in development
    if (process.env.NODE_ENV !== 'production') {
      console.warn('CSP Violation:', JSON.stringify(violationLog, null, 2));
    } else {
      // Log to file in production
      const fs = require('fs');
      const path = require('path');
      const logsDir = path.join(__dirname, '../logs');
      
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }
      
      const cspLogStream = fs.createWriteStream(
        path.join(logsDir, 'csp-violations.log'),
        { flags: 'a' }
      );
      cspLogStream.write(JSON.stringify(violationLog) + '\n');
      cspLogStream.end();
    }
    
    // Return 204 No Content (standard for CSP reports)
    res.status(204).send();
  } catch (error) {
    console.error('Error processing CSP violation:', error.message);
    res.status(204).send();
  }
};

module.exports = {
  cspViolationHandler,
};
