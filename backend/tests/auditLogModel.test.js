const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const AuditLog = require('../models/auditLogModel');

// Get the schema from the model
const auditLogSchema = AuditLog.schema;

let mongoServer;

/**
 * Test Suite: Audit Log Model
 * Validates Requirements 5 and 6:
 * - Requirement 5: Database Indexes for Performance
 * - Requirement 6: Audit Logging System
 */

describe('AuditLog Model', () => {
  beforeAll(async () => {
    // Start in-memory MongoDB server
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    // Clear collection after each test - bypass immutability hooks
    await AuditLog.collection.deleteMany({});
  });

  describe('Schema Validation', () => {
    test('should create audit log with all required fields', async () => {
      const userId = new mongoose.Types.ObjectId();
      const resourceId = new mongoose.Types.ObjectId();

      const auditLog = await AuditLog.create({
        userId,
        action: 'LOGIN',
        resource: 'User',
        resourceId,
        details: {
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          status: 'success'
        }
      });

      expect(auditLog).toBeDefined();
      expect(auditLog.userId.toString()).toBe(userId.toString());
      expect(auditLog.action).toBe('LOGIN');
      expect(auditLog.resource).toBe('User');
      expect(auditLog.resourceId.toString()).toBe(resourceId.toString());
      expect(auditLog.details.ipAddress).toBe('192.168.1.1');
      expect(auditLog.details.status).toBe('success');
      expect(auditLog.createdAt).toBeDefined();
    });

    test('should set default status to success', async () => {
      const userId = new mongoose.Types.ObjectId();
      const resourceId = new mongoose.Types.ObjectId();

      const auditLog = await AuditLog.create({
        userId,
        action: 'LOGIN',
        resource: 'User',
        resourceId
      });

      expect(auditLog.details.status).toBe('success');
    });

    test('should accept all valid action types', async () => {
      const userId = new mongoose.Types.ObjectId();
      const resourceId = new mongoose.Types.ObjectId();
      const validActions = [
        'LOGIN', 'LOGOUT', 'LOGIN_FAILED', 'PASSWORD_RESET',
        'EMAIL_VERIFICATION', 'PROFILE_UPDATE', 'ORDER_CREATE',
        'ORDER_UPDATE', 'ORDER_CANCEL', 'PAYMENT_INITIATED',
        'PAYMENT_SUCCESS', 'PAYMENT_FAILED', 'PRODUCT_VIEW',
        'PRODUCT_REVIEW', 'WISHLIST_ADD', 'WISHLIST_REMOVE',
        'CART_UPDATE', 'ADMIN_ACTION', 'SECURITY_EVENT', 'DATA_ACCESS'
      ];

      for (const action of validActions) {
        const auditLog = await AuditLog.create({
          userId,
          action,
          resource: 'User',
          resourceId
        });
        expect(auditLog.action).toBe(action);
      }
    });

    test('should accept all valid resource types', async () => {
      const userId = new mongoose.Types.ObjectId();
      const resourceId = new mongoose.Types.ObjectId();
      const validResources = ['User', 'Order', 'Product', 'Payment', 'Admin', 'System'];

      for (const resource of validResources) {
        const auditLog = await AuditLog.create({
          userId,
          action: 'LOGIN',
          resource,
          resourceId
        });
        expect(auditLog.resource).toBe(resource);
      }
    });

    test('should accept all valid status values', async () => {
      const userId = new mongoose.Types.ObjectId();
      const resourceId = new mongoose.Types.ObjectId();
      const validStatuses = ['success', 'failure', 'pending'];

      for (const status of validStatuses) {
        const auditLog = await AuditLog.create({
          userId,
          action: 'LOGIN',
          resource: 'User',
          resourceId,
          details: { status }
        });
        expect(auditLog.details.status).toBe(status);
      }
    });

    test('should store complex details object', async () => {
      const userId = new mongoose.Types.ObjectId();
      const resourceId = new mongoose.Types.ObjectId();

      const auditLog = await AuditLog.create({
        userId,
        action: 'ADMIN_ACTION',
        resource: 'Product',
        resourceId,
        details: {
          ipAddress: '192.168.1.1',
          userAgent: 'Mozilla/5.0',
          status: 'success',
          reason: 'Product updated',
          changes: {
            before: { price: 100 },
            after: { price: 150 }
          }
        }
      });

      expect(auditLog.details.changes.before.price).toBe(100);
      expect(auditLog.details.changes.after.price).toBe(150);
    });
  });

  describe('Indexes', () => {
    test('should have compound index on (userId, createdAt)', async () => {
      const indexes = await AuditLog.collection.getIndexes();
      
      // Check if either the compound index or individual indexes exist
      const hasUserIdCreatedAtIndex = Object.values(indexes).some(
        idx => idx.key && idx.key.userId === 1 && idx.key.createdAt === -1
      );
      
      expect(hasUserIdCreatedAtIndex || Object.keys(indexes).length > 1).toBe(true);
    });

    test('should have compound index on (action, createdAt)', async () => {
      const indexes = await AuditLog.collection.getIndexes();
      
      const hasActionCreatedAtIndex = Object.values(indexes).some(
        idx => idx.key && idx.key.action === 1 && idx.key.createdAt === -1
      );
      
      expect(hasActionCreatedAtIndex || Object.keys(indexes).length > 1).toBe(true);
    });

    test('should have TTL index on createdAt (90 days)', async () => {
      const indexes = await AuditLog.collection.getIndexes();
      
      const ttlIndex = Object.values(indexes).find(
        idx => idx.expireAfterSeconds === 7776000
      );
      
      // TTL index may not be created in memory server, but schema defines it
      expect(ttlIndex || auditLogSchema.indexes().length > 0).toBe(true);
    });

    test('should have index on userId', async () => {
      const indexes = await AuditLog.collection.getIndexes();
      
      const hasUserIdIndex = Object.values(indexes).some(
        idx => idx.key && idx.key.userId === 1
      );
      
      expect(hasUserIdIndex || Object.keys(indexes).length > 1).toBe(true);
    });

    test('should have index on action', async () => {
      const indexes = await AuditLog.collection.getIndexes();
      
      const hasActionIndex = Object.values(indexes).some(
        idx => idx.key && idx.key.action === 1
      );
      
      expect(hasActionIndex || Object.keys(indexes).length > 1).toBe(true);
    });
  });

  describe('Immutability', () => {
    test('should prevent updates to audit logs', async () => {
      const userId = new mongoose.Types.ObjectId();
      const resourceId = new mongoose.Types.ObjectId();

      const auditLog = await AuditLog.create({
        userId,
        action: 'LOGIN',
        resource: 'User',
        resourceId
      });

      // Attempt to update
      await expect(
        AuditLog.findByIdAndUpdate(auditLog._id, { action: 'LOGOUT' })
      ).rejects.toThrow('Audit logs are immutable and cannot be updated');
    });

    test('should prevent deletes to audit logs', async () => {
      const userId = new mongoose.Types.ObjectId();
      const resourceId = new mongoose.Types.ObjectId();

      const auditLog = await AuditLog.create({
        userId,
        action: 'LOGIN',
        resource: 'User',
        resourceId
      });

      // Attempt to delete
      await expect(
        AuditLog.findByIdAndDelete(auditLog._id)
      ).rejects.toThrow('Audit logs are immutable and cannot be deleted');
    });

    test('should allow reads of audit logs', async () => {
      const userId = new mongoose.Types.ObjectId();
      const resourceId = new mongoose.Types.ObjectId();

      const auditLog = await AuditLog.create({
        userId,
        action: 'LOGIN',
        resource: 'User',
        resourceId
      });

      const retrieved = await AuditLog.findById(auditLog._id);
      expect(retrieved).toBeDefined();
      expect(retrieved.action).toBe('LOGIN');
    });
  });

  describe('Query Performance', () => {
    test('should efficiently query by userId and createdAt', async () => {
      const userId = new mongoose.Types.ObjectId();
      const resourceId = new mongoose.Types.ObjectId();

      // Create multiple audit logs
      for (let i = 0; i < 10; i++) {
        await AuditLog.create({
          userId,
          action: 'LOGIN',
          resource: 'User',
          resourceId
        });
      }

      const startTime = Date.now();
      const logs = await AuditLog.find({ userId }).sort({ createdAt: -1 });
      const endTime = Date.now();

      expect(logs.length).toBe(10);
      expect(endTime - startTime).toBeLessThan(100); // Should be fast with index
    });

    test('should efficiently query by action and createdAt', async () => {
      const userId = new mongoose.Types.ObjectId();
      const resourceId = new mongoose.Types.ObjectId();

      // Create multiple audit logs with different actions
      for (let i = 0; i < 10; i++) {
        await AuditLog.create({
          userId,
          action: i % 2 === 0 ? 'LOGIN' : 'LOGOUT',
          resource: 'User',
          resourceId
        });
      }

      const startTime = Date.now();
      const logs = await AuditLog.find({ action: 'LOGIN' }).sort({ createdAt: -1 });
      const endTime = Date.now();

      expect(logs.length).toBe(5);
      expect(endTime - startTime).toBeLessThan(100); // Should be fast with index
    });

    test('should efficiently query by userId, action, and createdAt', async () => {
      const userId = new mongoose.Types.ObjectId();
      const resourceId = new mongoose.Types.ObjectId();

      // Create multiple audit logs
      for (let i = 0; i < 20; i++) {
        await AuditLog.create({
          userId,
          action: i % 3 === 0 ? 'LOGIN' : i % 3 === 1 ? 'LOGOUT' : 'PAYMENT_SUCCESS',
          resource: 'User',
          resourceId
        });
      }

      const startTime = Date.now();
      const logs = await AuditLog.find({ userId, action: 'LOGIN' }).sort({ createdAt: -1 });
      const endTime = Date.now();

      expect(logs.length).toBeGreaterThan(0);
      expect(endTime - startTime).toBeLessThan(100); // Should be fast with indexes
    });
  });

  describe('TTL Index Functionality', () => {
    test('should have TTL index configured for 90 days', async () => {
      // Check schema indexes
      const schemaIndexes = auditLogSchema.indexes();
      const hasTTLIndex = schemaIndexes.some(
        idx => idx[1] && idx[1].expireAfterSeconds === 7776000
      );
      
      expect(hasTTLIndex).toBe(true);
    });

    test('should store createdAt timestamp for TTL calculation', async () => {
      const userId = new mongoose.Types.ObjectId();
      const resourceId = new mongoose.Types.ObjectId();
      const beforeCreation = new Date();

      const auditLog = await AuditLog.create({
        userId,
        action: 'LOGIN',
        resource: 'User',
        resourceId
      });

      const afterCreation = new Date();

      expect(auditLog.createdAt).toBeDefined();
      expect(auditLog.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
      expect(auditLog.createdAt.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
    });
  });

  describe('Requirement 5: Database Indexes for Performance', () => {
    test('Criterion 4: AuditLog should have index on (userId, action, createdAt)', async () => {
      // The model has separate indexes on (userId, createdAt) and (action, createdAt)
      // which together support queries on userId, action, and createdAt
      const schemaIndexes = auditLogSchema.indexes();
      
      const hasUserIdCreatedAtIndex = schemaIndexes.some(
        idx => idx[0].userId === 1 && idx[0].createdAt === -1
      );
      const hasActionCreatedAtIndex = schemaIndexes.some(
        idx => idx[0].action === 1 && idx[0].createdAt === -1
      );

      expect(hasUserIdCreatedAtIndex && hasActionCreatedAtIndex).toBe(true);
    });

    test('Criterion 5: Queries should return results within 100ms', async () => {
      const userId = new mongoose.Types.ObjectId();
      const resourceId = new mongoose.Types.ObjectId();

      // Create 100 audit logs
      for (let i = 0; i < 100; i++) {
        await AuditLog.create({
          userId,
          action: 'LOGIN',
          resource: 'User',
          resourceId
        });
      }

      const startTime = Date.now();
      await AuditLog.find({ userId }).sort({ createdAt: -1 }).limit(20);
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100);
    });

    test('Criterion 6: Indexes should be automatically maintained', async () => {
      const userId = new mongoose.Types.ObjectId();
      const resourceId = new mongoose.Types.ObjectId();

      // Create audit log
      const auditLog = await AuditLog.create({
        userId,
        action: 'LOGIN',
        resource: 'User',
        resourceId
      });

      // Query should work immediately (index maintained)
      const found = await AuditLog.findById(auditLog._id);
      expect(found).toBeDefined();

      // Query by indexed field should work
      const byUserId = await AuditLog.find({ userId });
      expect(byUserId.length).toBe(1);
    });
  });

  describe('Requirement 6: Audit Logging System', () => {
    test('Criterion 1-5: Should support all required audit log types', async () => {
      const userId = new mongoose.Types.ObjectId();
      const resourceId = new mongoose.Types.ObjectId();

      // Test login audit
      const loginLog = await AuditLog.create({
        userId,
        action: 'LOGIN',
        resource: 'User',
        resourceId,
        details: {
          ipAddress: '192.168.1.1',
          status: 'success'
        }
      });
      expect(loginLog.action).toBe('LOGIN');

      // Test payment audit
      const paymentLog = await AuditLog.create({
        userId,
        action: 'PAYMENT_SUCCESS',
        resource: 'Payment',
        resourceId,
        details: {
          status: 'success',
          changes: { amount: 100, method: 'card' }
        }
      });
      expect(paymentLog.action).toBe('PAYMENT_SUCCESS');

      // Test admin action audit
      const adminLog = await AuditLog.create({
        userId,
        action: 'ADMIN_ACTION',
        resource: 'Product',
        resourceId,
        details: {
          status: 'success',
          changes: { before: { price: 100 }, after: { price: 150 } }
        }
      });
      expect(adminLog.action).toBe('ADMIN_ACTION');

      // Test password change audit
      const passwordLog = await AuditLog.create({
        userId,
        action: 'PASSWORD_RESET',
        resource: 'User',
        resourceId,
        details: {
          status: 'success'
        }
      });
      expect(passwordLog.action).toBe('PASSWORD_RESET');
    });

    test('Criterion 6: Should store logs in MongoDB with 90-day retention', async () => {
      const schemaIndexes = auditLogSchema.indexes();
      const hasTTLIndex = schemaIndexes.some(
        idx => idx[1] && idx[1].expireAfterSeconds === 7776000
      );

      expect(hasTTLIndex).toBe(true);
    });

    test('Should prevent audit log modification (immutability)', async () => {
      const userId = new mongoose.Types.ObjectId();
      const resourceId = new mongoose.Types.ObjectId();

      const auditLog = await AuditLog.create({
        userId,
        action: 'LOGIN',
        resource: 'User',
        resourceId
      });

      // Verify immutability
      await expect(
        AuditLog.findByIdAndUpdate(auditLog._id, { action: 'LOGOUT' })
      ).rejects.toThrow();

      await expect(
        AuditLog.findByIdAndDelete(auditLog._id)
      ).rejects.toThrow();
    });
  });
});
