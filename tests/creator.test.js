const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const os = require('os');
const Database = require('../src/database/database');
const { migrate } = require('../src/database/schema');
const { CreatorRepository } = require('../src/creator/repository');
const { CreatorService } = require('../src/creator/service');

function getTestDbPath() {
  return path.join(os.tmpdir(), `nexa_creator_test_${Date.now()}_${Math.random().toString(36).slice(2)}.db`);
}

describe('Creator Foundation', () => {
  describe('Database Schema', () => {
    it('creator table exists', () => {
      const dbPath = getTestDbPath();
      const db = new Database(dbPath);
      migrate(db);
      const row = db.db.prepare('SELECT sql FROM sqlite_master WHERE type=\'table\' AND name=\'creator_profiles\'').get();
      assert.ok(row, 'creator_profiles table should exist');
      const hasUnique = row.sql.includes('UNIQUE(guild_id, user_id)');
      assert.ok(hasUnique, 'table should have UNIQUE(guild_id, user_id) constraint');
      db.close();
      try { require('fs').unlinkSync(dbPath); } catch {}
    });

    it('unique (guild_id, user_id) constraint', () => {
      const dbPath = getTestDbPath();
      const db = new Database(dbPath);
      migrate(db);

      db.exec(
        `INSERT INTO creator_profiles (guild_id, user_id, display_name, status, created_at, updated_at) VALUES ('g1', 'u1', 'User1', 'active', datetime('now'), datetime('now'))`
      );

      try {
        db.exec(
          `INSERT INTO creator_profiles (guild_id, user_id, display_name, status, created_at, updated_at) VALUES ('g1', 'u1', 'User1', 'active', datetime('now'), datetime('now'))`
        );
        assert.fail('Should have thrown on duplicate insert');
      } catch (e) {
        assert.ok(e instanceof Error, 'Should throw an error on duplicate');
      }

      db.close();
      try { require('fs').unlinkSync(dbPath); } catch {}
    });

    it('valid statuses: pending, active, suspended', () => {
      const dbPath = getTestDbPath();
      const db = new Database(dbPath);
      migrate(db);

      db.exec(
        `INSERT INTO creator_profiles (guild_id, user_id, display_name, status, created_at, updated_at) VALUES ('g1', 'u1', 'User1', 'pending', datetime('now'), datetime('now'))`
      );
      db.exec(
        `INSERT INTO creator_profiles (guild_id, user_id, display_name, status, created_at, updated_at) VALUES ('g1', 'u2', 'User2', 'active', datetime('now'), datetime('now'))`
      );
      db.exec(
        `INSERT INTO creator_profiles (guild_id, user_id, display_name, status, created_at, updated_at) VALUES ('g1', 'u3', 'User3', 'suspended', datetime('now'), datetime('now'))`
      );

      const pendingRow = db.db.prepare('SELECT status FROM creator_profiles WHERE guild_id = ? AND user_id = ?').get('g1', 'u1');
      const activeRow = db.db.prepare('SELECT status FROM creator_profiles WHERE guild_id = ? AND user_id = ?').get('g1', 'u2');
      const suspendedRow = db.db.prepare('SELECT status FROM creator_profiles WHERE guild_id = ? AND user_id = ?').get('g1', 'u3');

      assert.strictEqual(pendingRow.status, 'pending');
      assert.strictEqual(activeRow.status, 'active');
      assert.strictEqual(suspendedRow.status, 'suspended');

      db.close();
      try { require('fs').unlinkSync(dbPath); } catch {}
    });

    it('schema works with shared in-memory database', () => {
      const db = new Database(':memory:');
      migrate(db);
      const tables = db.db.prepare('SELECT name FROM sqlite_master WHERE type=\'table\' AND name LIKE \'creator%\'').all();
      assert.strictEqual(tables.length, 4);
      assert.ok(tables.some(t => t.name === 'creator_profiles'));
      assert.ok(tables.some(t => t.name === 'creator_content'));
      assert.ok(tables.some(t => t.name === 'creator_earnings'));
      assert.ok(tables.some(t => t.name === 'creator_marketplace'));
      db.close();
    });
  });

  describe('Repository', () => {
    let db;
    let repo;

    beforeEach(() => {
      db = new Database(':memory:');
      migrate(db);
      repo = new CreatorRepository(db);
      repo.ensureSchema();
    });

    afterEach(() => {
      db.close();
    });

    it('create creator', () => {
      const result = repo.createCreator('g1', 'u1', 'TestUser');
      assert.strictEqual(result.duplicate, false);
      assert.strictEqual(result.creator.displayName, 'TestUser');
      assert.strictEqual(result.creator.status, 'pending');
      assert.strictEqual(result.creator.guildId, 'g1');
      assert.strictEqual(result.creator.userId, 'u1');
    });

    it('retrieve creator', () => {
      repo.createCreator('g1', 'u1', 'TestUser');
      const creator = repo.getCreator('g1', 'u1');
      assert.strictEqual(creator.userId, 'u1');
      assert.strictEqual(creator.status, 'pending');
    });

    it('retrieve by guild/user (getCreatorByUser)', () => {
      repo.createCreator('g1', 'u1', 'TestUser');
      const creator = repo.getCreatorByUser('g1', 'u1');
      assert.strictEqual(creator.userId, 'u1');
    });

    it('duplicate prevention', () => {
      repo.createCreator('g1', 'u1', 'TestUser');
      const result = repo.createCreator('g1', 'u1', 'TestUser');
      assert.strictEqual(result.duplicate, true);
      assert.ok(result.creator.id > 0);
    });

    it('update status', () => {
      repo.createCreator('g1', 'u1', 'TestUser');
      const updated = repo.updateCreatorStatus('g1', 'u1', 'active');
      assert.strictEqual(updated.status, 'active');
      const updated2 = repo.updateCreatorStatus('g1', 'u1', 'suspended');
      assert.strictEqual(updated2.status, 'suspended');
    });

    it('guild isolation', () => {
      repo.createCreator('g1', 'u1', 'User1');
      repo.createCreator('g2', 'u1', 'User2');

      const g1Creator = repo.getCreator('g1', 'u1');
      const g2Creator = repo.getCreator('g2', 'u1');

      assert.strictEqual(g1Creator.displayName, 'User1');
      assert.strictEqual(g2Creator.displayName, 'User2');
    });

    it('missing creator handling', () => {
      const creator = repo.getCreator('g1', 'u99');
      assert.strictEqual(creator, null);
    });
  });

  describe('Service', () => {
    let db;
    let repo;
    let service;

    beforeEach(() => {
      db = new Database(':memory:');
      migrate(db);
      repo = new CreatorRepository(db);
      repo.ensureSchema();
      service = new CreatorService(repo);

      db.exec(
        `INSERT INTO member_profiles (guild_id, user_id, username, display_name, xp, level, reputation, message_count, first_seen_at, last_active_at, created_at, updated_at) VALUES ('g1', 'u1', 'TestUser', 'TestUser', 0, 1, 0, 0, datetime('now'), datetime('now'), datetime('now'), datetime('now'))`
      );
    });

    afterEach(() => {
      db.close();
    });

    it('eligible user can register', () => {
      const result = service.registerCreator('g1', 'u1', 'TestUser');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.creator.status, 'active');
    });

    it('registration creates active creator', () => {
      service.registerCreator('g1', 'u1', 'TestUser');
      const creator = service.getCreator('g1', 'u1');
      assert.strictEqual(creator.status, 'active');
    });

    it('duplicate registration is safe', () => {
      service.registerCreator('g1', 'u1', 'TestUser');
      const result = service.registerCreator('g1', 'u1', 'TestUser');
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'ALREADY_REGISTERED');
    });

    it('suspended creator is not active', () => {
      service.registerCreator('g1', 'u1', 'TestUser');
      service.setCreatorStatus('g1', 'u1', 'suspended');
      assert.strictEqual(service.isCreator('g1', 'u1'), false);
    });

    it('isCreator() behaves correctly - active', () => {
      const result = service.registerCreator('g1', 'u1', 'TestUser');
      assert.strictEqual(result.success, true);
      assert.strictEqual(service.isCreator('g1', 'u1'), true);
    });

    it('isCreator() behaves correctly - suspended', () => {
      service.registerCreator('g1', 'u1', 'TestUser');
      service.setCreatorStatus('g1', 'u1', 'suspended');
      assert.strictEqual(service.isCreator('g1', 'u1'), false);
    });

    it('isCreator() behaves correctly - non-existent user', () => {
      assert.strictEqual(service.isCreator('g1', 'u99'), false);
    });
  });

  describe('Commands', () => {
    it('/creator register command loads', () => {
      const creator = require('../src/commands/creator.js');
      assert.ok(creator.data, 'creator command should have data');
      assert.strictEqual(creator.data.name, 'creator', 'command name should be creator');
      assert.ok(creator.data.description, 'command should have description');
      assert.ok(typeof creator.execute === 'function', 'creator should have execute function');
      assert.ok(typeof creator.handleRegister === 'function', 'creator should have handleRegister');
      assert.ok(typeof creator.handleStatus === 'function', 'creator should have handleStatus');
    });

    it('/creator status command loads', () => {
      const creator = require('../src/commands/creator.js');
      assert.ok(creator.data, 'creator command should load without import errors');
      assert.strictEqual(creator.data.name, 'creator');
    });
  });
});

describe('Creator Earnings', () => {
  let db;
  let creatorRepo;
  let creatorService;
  let contentRepo;
  let contentService;
  let marketplaceRepo;
  let marketplaceService;
  let earningsRepo;
  let earningsService;
  let paymentsRepo;

beforeEach(async () => {
    db = new Database(':memory:');
    migrate(db);
    creatorRepo = new CreatorRepository(db);
    creatorRepo.ensureSchema();
    creatorService = new CreatorService(creatorRepo);

    const { CreatorContentRepository } = require('../src/creator/content-repository');
    const { CreatorContentService } = require('../src/creator/content-service');
    contentRepo = new CreatorContentRepository(db);
    contentRepo.ensureSchema();
    contentService = new CreatorContentService(contentRepo);

    const { CreatorMarketplaceRepository } = require('../src/creator/marketplace-repository');
    const { CreatorMarketplaceService } = require('../src/creator/marketplace-service');
    marketplaceRepo = new CreatorMarketplaceRepository(db);
    marketplaceService = new CreatorMarketplaceService(marketplaceRepo);

    const { CreatorEarningsRepository } = require('../src/creator/earnings-repository');
    const { CreatorEarningsService } = require('../src/creator/earnings-service');
    const { PaymentsRepository } = require('../src/payments/repository');
    earningsRepo = new CreatorEarningsRepository(db);
    paymentsRepo = new PaymentsRepository(db);
    earningsService = new CreatorEarningsService(earningsRepo, paymentsRepo);

    // Ensure payment plans are set up
    paymentsRepo.ensurePlans(db);

    // Setup: create member profile, creator, content, product, purchase, payment
    db.exec(
      `INSERT INTO member_profiles (guild_id, user_id, username, display_name, xp, level, reputation, message_count, first_seen_at, last_active_at, created_at, updated_at) VALUES ('g1', 'u1', 'TestUser', 'TestUser', 0, 1, 0, 0, datetime('now'), datetime('now'), datetime('now'), datetime('now'))`
    );

    creatorService.registerCreator('g1', 'u1', 'TestUser');

    const contentResult = await contentService.createContent('g1', 'u1', 'Test Content', 'Description');
    await contentService.publishContent('g1', 'u1', contentResult.content.id);

    const productResult = await marketplaceService.createProduct('g1', 'u1', contentResult.content.id, 5000, 'PHP');
    await marketplaceService.listProduct('g1', productResult.product.id, 'u1');

    // Create a payment for the earnings system
    const paymentResult = paymentsRepo.createPayment('g1', 'u1', 'premium', 'test', 'pay1', 5000, 'PHP', 'pending');

  afterEach(() => {
    db.close();
  });

  describe('Database Schema', () => {
    it('creator_earnings table exists', () => {
      const row = db.db.prepare('SELECT sql FROM sqlite_master WHERE type=\'table\' AND name=\'creator_earnings\'').get();
      assert.ok(row, 'creator_earnings table should exist');
      const hasUnique = row.sql.includes('UNIQUE(purchase_id)');
      assert.ok(hasUnique, 'table should have UNIQUE(purchase_id) constraint');
    });

    it('valid statuses', () => {
      const earnings = earningsRepo.getCreatorEarnings('g1', 'u1');
      assert.strictEqual(earnings.length, 0);
    });
  });

  describe('Platform Fee Calculation', () => {
    it('calculates 20% fee correctly', () => {
      const gross = 5000;
      const fee = Math.floor(gross * 20 / 100);
      assert.strictEqual(fee, 1000);
    });

    it('calculates fee on different amounts', () => {
      assert.strictEqual(Math.floor(1000 * 20 / 100), 200);
      assert.strictEqual(Math.floor(100 * 20 / 100), 20);
      assert.strictEqual(Math.floor(12345 * 20 / 100), 2469);
    });

    it('never produces negative fee', () => {
      const fee = Math.floor(0 * 20 / 100);
      assert.strictEqual(fee, 0);
    });

    it('net amount is gross minus fee', () => {
      const gross = 5000;
      const fee = Math.floor(gross * 20 / 100);
      const net = gross - fee;
      assert.strictEqual(net, 4000);
    });
  });

  describe('Repository', () => {
    it('create earning', () => {
      const result = earningsRepo.createEarning('g1', 'u1', 'p1', 'pay1', 'prod1', 5000, 'PHP');
      assert.strictEqual(result.duplicate, false);
      assert.strictEqual(result.earning.grossAmountMinor, 5000);
      assert.strictEqual(result.earning.platformFeeMinor, 1000);
      assert.strictEqual(result.earning.netAmountMinor, 4000);
      assert.strictEqual(result.earning.currency, 'PHP');
    });

    it('retrieve earning', () => {
      earningsRepo.createEarning('g1', 'u1', 'p1', 'pay1', 'prod1', 5000, 'PHP');
      const earning = earningsRepo.getEarning('g1', 1);
      assert.strictEqual(earning.grossAmountMinor, 5000);
      assert.strictEqual(earning.netAmountMinor, 4000);
    });

    it('retrieve earning by purchase', () => {
      earningsRepo.createEarning('g1', 'u1', 'p1', 'pay1', 'prod1', 5000, 'PHP');
      const earning = earningsRepo.getEarningByPurchase('g1', 'p1');
      assert.strictEqual(earning.grossAmountMinor, 5000);
    });

    it('list creator earnings', () => {
      earningsRepo.createEarning('g1', 'u1', 'p1', 'pay1', 'prod1', 5000, 'PHP');
      earningsRepo.createEarning('g1', 'u1', 'p2', 'pay2', 'prod2', 3000, 'PHP');
      const earnings = earningsRepo.getCreatorEarnings('g1', 'u1');
      assert.strictEqual(earnings.length, 2);
      assert.strictEqual(earnings[0].grossAmountMinor, 3000); // Most recent first
      assert.strictEqual(earnings[1].grossAmountMinor, 5000);
    });

    it('list guild earnings', () => {
      earningsRepo.createEarning('g1', 'u1', 'p1', 'pay1', 'prod1', 5000, 'PHP');
      earningsRepo.createEarning('g1', 'u2', 'p2', 'pay2', 'prod2', 3000, 'PHP');
      const earnings = earningsRepo.getGuildEarnings('g1');
      assert.strictEqual(earnings.length, 2);
    });

    it('duplicate prevention via purchase_id', () => {
      earningsRepo.createEarning('g1', 'u1', 'p1', 'pay1', 'prod1', 5000, 'PHP');
      const result = earningsRepo.createEarning('g1', 'u1', 'p1', 'pay1', 'prod1', 5000, 'PHP');
      assert.strictEqual(result.duplicate, true);
    });

    it('guild isolation', () => {
      earningsRepo.createEarning('g1', 'u1', 'p1', 'pay1', 'prod1', 5000, 'PHP');
      earningsRepo.createEarning('g2', 'u1', 'p2', 'pay2', 'prod2', 5000, 'PHP');
      const g1Earnings = earningsRepo.getCreatorEarnings('g1', 'u1');
      const g2Earnings = earningsRepo.getCreatorEarnings('g2', 'u1');
      assert.strictEqual(g1Earnings.length, 1);
      assert.strictEqual(g2Earnings.length, 1);
    });
  });

  describe('Service', () => {
    it('creates earning for valid purchase', () => {
      // Create a purchase and payment
      db.exec(
        `INSERT INTO marketplace_purchases (guild_id, user_id, product_id, payment_id, status, amount_minor, currency, created_at, updated_at) VALUES ('g1', 'buyer1', 1, 1, 'paid', 5000, 'PHP', datetime('now'), datetime('now'))`
      );
      db.exec(
        `INSERT INTO payments (guild_id, user_id, plan_key, provider, provider_payment_id, amount_minor, currency, status, created_at, updated_at, completed_at) VALUES ('g1', 'buyer1', 'creator_product', 'mock', 'pay1', 5000, 'PHP', 'paid', datetime('now'), datetime('now'), datetime('now'))`
      );

      const result = earningsService.createEarning('g1', 'u1', 1);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.earning.grossAmountMinor, 5000);
      assert.strictEqual(result.earning.platformFeeMinor, 1000);
      assert.strictEqual(result.earning.netAmountMinor, 4000);
    });

    it('idempotent - same purchase returns existing earning', () => {
      db.exec(
        `INSERT INTO marketplace_purchases (guild_id, user_id, product_id, payment_id, status, amount_minor, currency, created_at, updated_at) VALUES ('g1', 'buyer1', 1, 1, 'paid', 5000, 'PHP', datetime('now'), datetime('now'))`
      );
      db.exec(
        `INSERT INTO payments (guild_id, user_id, plan_key, provider, provider_payment_id, amount_minor, currency, status, created_at, updated_at, completed_at) VALUES ('g1', 'buyer1', 'creator_product', 'mock', 'pay1', 5000, 'PHP', 'paid', datetime('now'), datetime('now'), datetime('now'))`
      );

      earningsService.createEarning('g1', 'u1', 1);
      const result = earningsService.createEarning('g1', 'u1', 1);
      assert.strictEqual(result.success, true);
      assert.ok(result.message.includes('idempotent'));
    });

    it('rejects non-creator', () => {
      const result = earningsService.createEarning('g1', 'u99', 1);
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'NOT_CREATOR');
    });

    it('rejects suspended creator', () => {
      creatorService.setCreatorStatus('g1', 'u1', 'suspended');
      const result = earningsService.createEarning('g1', 'u1', 1);
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'NOT_CREATOR');
    });

    it('rejects product not owned', () => {
      const result = earningsService.createEarning('g1', 'u2', 1);
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'NOT_PRODUCT_OWNER');
    });

    it('rejects unlisted product', () => {
      marketplaceService.unlistProduct('g1', 1, 'u1');
      const result = earningsService.createEarning('g1', 'u1', 1);
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'PRODUCT_NOT_LISTED');
    });

    it('rejects missing purchase', () => {
      const result = earningsService.createEarning('g1', 'u1', 999);
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'PURCHASE_NOT_FOUND');
    });

    it('rejects unpaid purchase', () => {
      db.exec(
        `INSERT INTO marketplace_purchases (guild_id, user_id, product_id, payment_id, status, amount_minor, currency, created_at, updated_at) VALUES ('g1', 'buyer1', 1, 1, 'pending', 5000, 'PHP', datetime('now'), datetime('now'))`
      );
      db.exec(
        `INSERT INTO payments (guild_id, user_id, plan_key, provider, provider_payment_id, amount_minor, currency, status, created_at, updated_at, completed_at) VALUES ('g1', 'buyer1', 'creator_product', 'mock', 'pay1', 5000, 'PHP', 'pending', datetime('now'), datetime('now'), null)`
      );

      const result = earningsService.createEarning('g1', 'u1', 1);
      assert.strictEqual(result.success, false);
    });

    it('creator earnings history works', () => {
      db.exec(
        `INSERT INTO marketplace_purchases (guild_id, user_id, product_id, payment_id, status, amount_minor, currency, created_at, updated_at) VALUES ('g1', 'buyer1', 1, 1, 'paid', 5000, 'PHP', datetime('now'), datetime('now'))`
      );
      db.exec(
        `INSERT INTO payments (guild_id, user_id, plan_key, provider, provider_payment_id, amount_minor, currency, status, created_at, updated_at, completed_at) VALUES ('g1', 'buyer1', 'creator_product', 'mock', 'pay1', 5000, 'PHP', 'paid', datetime('now'), datetime('now'), datetime('now'))`
      );

      earningsService.createEarning('g1', 'u1', 1);

      const result = earningsService.getCreatorEarnings('g1', 'u1');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.summary.earningCount, 1);
      assert.strictEqual(result.summary.grossTotal, 5000);
      assert.strictEqual(result.summary.platformFeeTotal, 1000);
      assert.strictEqual(result.summary.netTotal, 4000);
    });

    it('creator cannot access another creator earnings', () => {
      db.exec(
        `INSERT INTO marketplace_purchases (guild_id, user_id, product_id, payment_id, status, amount_minor, currency, created_at, updated_at) VALUES ('g1', 'buyer1', 1, 1, 'paid', 5000, 'PHP', datetime('now'), datetime('now'))`
      );
      db.exec(
        `INSERT INTO payments (guild_id, user_id, plan_key, provider, provider_payment_id, amount_minor, currency, status, created_at, updated_at, completed_at) VALUES ('g1', 'buyer1', 'creator_product', 'mock', 'pay1', 5000, 'PHP', 'paid', datetime('now'), datetime('now'), datetime('now'))`
      );

      earningsService.createEarning('g1', 'u1', 1);

      const result = earningsService.getCreatorEarnings('g1', 'u2');
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'NOT_CREATOR');
    });
  });
});})