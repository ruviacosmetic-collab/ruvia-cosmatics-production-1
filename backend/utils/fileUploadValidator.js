const fs = require('fs');
const path = require('path');

/**
 * File Upload Validator
 * Validates file type, size, and content
 */

// Allowed MIME types and their magic bytes
const ALLOWED_TYPES = {
  'image/jpeg': {
    mimeType: 'image/jpeg',
    extensions: ['.jpg', '.jpeg'],
    magicBytes: [0xFF, 0xD8, 0xFF],
  },
  'image/png': {
    mimeType: 'image/png',
    extensions: ['.png'],
    magicBytes: [0x89, 0x50, 0x4E, 0x47],
  },
  'image/webp': {
    mimeType: 'image/webp',
    extensions: ['.webp'],
    magicBytes: [0x52, 0x49, 0x46, 0x46], // RIFF header
  },
};

// Maximum file size: 5MB
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Validate file type by checking magic bytes
 * @param {Buffer} buffer - File buffer
 * @param {string} mimeType - Declared MIME type
 * @returns {Object} { isValid: boolean, error: string }
 */
const validateFileType = (buffer, mimeType) => {
  if (!buffer || buffer.length === 0) {
    return {
      isValid: false,
      error: 'File is empty',
    };
  }
  
  // Check if MIME type is allowed
  const allowedType = ALLOWED_TYPES[mimeType];
  if (!allowedType) {
    return {
      isValid: false,
      error: `File type ${mimeType} is not allowed. Allowed types: jpeg, png, webp`,
    };
  }
  
  // Check magic bytes
  const magicBytes = allowedType.magicBytes;
  const fileHeader = Array.from(buffer.slice(0, magicBytes.length));
  
  const magicBytesMatch = magicBytes.every((byte, index) => byte === fileHeader[index]);
  
  if (!magicBytesMatch) {
    return {
      isValid: false,
      error: `File magic bytes do not match declared type ${mimeType}`,
    };
  }
  
  return {
    isValid: true,
  };
};

/**
 * Validate file size
 * @param {number} fileSize - File size in bytes
 * @returns {Object} { isValid: boolean, error: string }
 */
const validateFileSize = (fileSize) => {
  if (fileSize > MAX_FILE_SIZE) {
    return {
      isValid: false,
      error: `File size exceeds maximum allowed size of ${MAX_FILE_SIZE / 1024 / 1024}MB`,
    };
  }
  
  return {
    isValid: true,
  };
};

/**
 * Validate file extension
 * @param {string} filename - Original filename
 * @param {string} mimeType - Declared MIME type
 * @returns {Object} { isValid: boolean, error: string }
 */
const validateFileExtension = (filename, mimeType) => {
  if (!filename) {
    return {
      isValid: false,
      error: 'Filename is required',
    };
  }
  
  const allowedType = ALLOWED_TYPES[mimeType];
  if (!allowedType) {
    return {
      isValid: false,
      error: `File type ${mimeType} is not allowed`,
    };
  }
  
  const ext = path.extname(filename).toLowerCase();
  const isAllowed = allowedType.extensions.includes(ext);
  
  if (!isAllowed) {
    return {
      isValid: false,
      error: `File extension ${ext} does not match declared type ${mimeType}`,
    };
  }
  
  return {
    isValid: true,
  };
};

/**
 * Sanitize filename to prevent path traversal
 * @param {string} filename - Original filename
 * @returns {string} Sanitized filename
 */
const sanitizeFilename = (filename) => {
  if (!filename) {
    return 'file';
  }
  
  // Remove path separators and special characters
  let sanitized = filename
    .replace(/\.\./g, '') // Remove ..
    .replace(/[\/\\]/g, '') // Remove path separators
    .replace(/[^a-zA-Z0-9._-]/g, '_'); // Replace special chars with underscore
  
  // Limit length
  if (sanitized.length > 255) {
    sanitized = sanitized.substring(0, 255);
  }
  
  return sanitized;
};

/**
 * Validate uploaded file
 * @param {Object} file - Multer file object
 * @returns {Object} { isValid: boolean, error: string }
 */
const validateUploadedFile = (file) => {
  if (!file) {
    return {
      isValid: false,
      error: 'No file provided',
    };
  }
  
  // Validate file size
  const sizeValidation = validateFileSize(file.size);
  if (!sizeValidation.isValid) {
    return sizeValidation;
  }
  
  // Validate file extension
  const extValidation = validateFileExtension(file.originalname, file.mimetype);
  if (!extValidation.isValid) {
    return extValidation;
  }
  
  // Validate file type by magic bytes
  const typeValidation = validateFileType(file.buffer, file.mimetype);
  if (!typeValidation.isValid) {
    return typeValidation;
  }
  
  return {
    isValid: true,
  };
};

/**
 * Get safe filename for storage
 * @param {string} originalFilename - Original filename
 * @returns {string} Safe filename with timestamp
 */
const getSafeFilename = (originalFilename) => {
  const sanitized = sanitizeFilename(originalFilename);
  const timestamp = Date.now();
  const ext = path.extname(sanitized);
  const name = path.basename(sanitized, ext);
  
  return `${name}-${timestamp}${ext}`;
};

module.exports = {
  validateFileType,
  validateFileSize,
  validateFileExtension,
  sanitizeFilename,
  validateUploadedFile,
  getSafeFilename,
  ALLOWED_TYPES,
  MAX_FILE_SIZE,
};
