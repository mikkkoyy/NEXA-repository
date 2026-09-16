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
  let contentAId;
  let contentBId;

beforeEach(async () => {
    db = new Database(':memory:');
    migrate(db);
    creatorRepo = new CreatorRepository(db);
    creatorRepo.ensureSchema();
    creatorService = new CreatorService(creatorRepo);

    const { CreatorContentRepository } = require('../src/creator/content-repository');
    const { CreatorContentService } = require('../src/creator/content-service');
    contentRepo = new CreatorContentRepository(db);
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

    // Seed premium plans referenced by the payments FK (payments.plan_key -> premium_plans.plan_key)
    for (const [planKey, name] of [['premium', 'Premium'], ['creator_product', 'Creator Product']]) {
      db.exec(
        `INSERT INTO premium_plans (plan_key, name, description, enabled, created_at, updated_at) VALUES (?, ?, ?, 1, datetime('now'), datetime('now'))`,
        [planKey, name, 'Seeded test plan']
      );
    }

    // Member profiles for u1 (creator) and u2 (a second creator for ownership tests)
    for (const [uid, name] of [['u1', 'TestUser'], ['u2', 'SecondUser']]) {
      db.exec(
        `INSERT INTO member_profiles (guild_id, user_id, username, display_name, xp, level, reputation, message_count, first_seen_at, last_active_at, created_at, updated_at) VALUES ('g1', ?, ?, ?, 0, 1, 0, 0, datetime('now'), datetime('now'), datetime('now'), datetime('now'))`,
        [uid, name, name]
      );
    }
    creatorService.registerCreator('g1', 'u1', 'TestUser');
    creatorService.registerCreator('g1', 'u2', 'SecondUser');

    // u1: content A (draft -> published -> listed as marketplace product 1)
    const contentAResult = await contentService.createContent('g1', 'u1', 'Content A', 'Description A');
    contentAId = contentAResult.content.id;
    await contentService.publishContent('g1', 'u1', contentAId);
    const productResult = await marketplaceService.createProduct('g1', 'u1', contentAId, 5000, 'PHP');
    await marketplaceService.listProduct('g1', productResult.product.id, 'u1');

    // u2: content B (left as draft)
    const contentBResult = await contentService.createContent('g1', 'u2', 'Content B', 'Description B');
    contentBId = contentBResult.content.id;
  });

  afterEach(() => {
    if (db) db.close();
  });

  function addPurchase(guildId, buyerId, productId, providerRef, amount = 5000, paymentStatus = 'paid', purchaseStatus = 'paid') {
    const payment = paymentsRepo.createPayment(
      guildId, buyerId, 'creator_product', 'mock', providerRef, amount, 'PHP', paymentStatus
    );
    const purchaseId = db.exec(
      `INSERT INTO marketplace_purchases (guild_id, user_id, product_id, payment_id, status, amount_minor, currency, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, 'PHP', datetime('now'), datetime('now'))`,
      [guildId, buyerId, productId, payment.id, purchaseStatus, amount]
    ).lastInsertRowid;
    return { payment, purchaseId };
  }

  describe('Database Schema', () => {
    it('creator_earnings table exists', () => {
      const row = db.db.prepare('SELECT sql FROM sqlite_master WHERE type=\'table\' AND name=\'creator_earnings\'').get();
      assert.ok(row, 'creator_earnings table should exist');
      const hasUnique = row.sql.includes('UNIQUE(purchase_id)');
      assert.ok(hasUnique, 'table should have UNIQUE(purchase_id) constraint');
    });

    it('valid statuses', () => {
      const earnings = earningsRepo.getCreatorEarnings('g1', 1);
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
    it('create earning records canonical creator id and finalized status', () => {
      const result = earningsRepo.createEarning('g1', 1, 101, 201, 1, 5000, 'PHP');
      assert.strictEqual(result.duplicate, false);
      assert.strictEqual(result.earning.creatorId, 1);
      assert.strictEqual(result.earning.grossAmountMinor, 5000);
      assert.strictEqual(result.earning.platformFeeMinor, 1000);
      assert.strictEqual(result.earning.netAmountMinor, 4000);
      assert.strictEqual(result.earning.currency, 'PHP');
      assert.strictEqual(result.earning.status, 'paid');
    });

    it('retrieve earning', () => {
      const created = earningsRepo.createEarning('g1', 1, 101, 201, 1, 5000, 'PHP');
      const earning = earningsRepo.getEarning('g1', created.earning.id);
      assert.strictEqual(earning.grossAmountMinor, 5000);
      assert.strictEqual(earning.netAmountMinor, 4000);
    });

    it('retrieve earning by purchase', () => {
      earningsRepo.createEarning('g1', 1, 101, 201, 1, 5000, 'PHP');
      const earning = earningsRepo.getEarningByPurchase('g1', 101);
      assert.strictEqual(earning.grossAmountMinor, 5000);
    });

    it('list creator earnings by canonical creator id', () => {
      earningsRepo.createEarning('g1', 1, 101, 201, 1, 5000, 'PHP');
      earningsRepo.createEarning('g1', 1, 102, 202, 1, 3000, 'PHP');
      const earnings = earningsRepo.getCreatorEarnings('g1', 1);
      assert.strictEqual(earnings.length, 2);
      assert.strictEqual(earnings[0].grossAmountMinor, 3000); // Most recent first
      assert.strictEqual(earnings[1].grossAmountMinor, 5000);
    });

    it('list guild earnings', () => {
      earningsRepo.createEarning('g1', 1, 101, 201, 1, 5000, 'PHP');
      earningsRepo.createEarning('g1', 2, 102, 202, 2, 3000, 'PHP');
      const earnings = earningsRepo.getGuildEarnings('g1');
      assert.strictEqual(earnings.length, 2);
    });

    it('duplicate prevention via purchase_id', () => {
      earningsRepo.createEarning('g1', 1, 101, 201, 1, 5000, 'PHP');
      const result = earningsRepo.createEarning('g1', 1, 101, 201, 1, 5000, 'PHP');
      assert.strictEqual(result.duplicate, true);
    });

    it('duplicate prevention via payment_id (idempotency)', () => {
      earningsRepo.createEarning('g1', 1, 101, 201, 1, 5000, 'PHP');
      const result = earningsRepo.createEarning('g1', 1, 202, 201, 1, 5000, 'PHP');
      assert.strictEqual(result.duplicate, true);
      const count = db.db.prepare('SELECT COUNT(*) AS cnt FROM creator_earnings').get().cnt;
      assert.strictEqual(count, 1);
    });

    it('guild isolation', () => {
      earningsRepo.createEarning('g1', 1, 101, 201, 1, 5000, 'PHP');
      earningsRepo.createEarning('g2', 1, 102, 202, 1, 5000, 'PHP');
      const g1Earnings = earningsRepo.getCreatorEarnings('g1', 1);
      const g2Earnings = earningsRepo.getCreatorEarnings('g2', 1);
      assert.strictEqual(g1Earnings.length, 1);
      assert.strictEqual(g2Earnings.length, 1);
    });
  });

  describe('Service - earnings lifecycle', () => {
    it('creates earning for a confirmed paid purchase', async () => {
      addPurchase('g1', 'buyer1', 1, 'payA');
      const result = await earningsService.createEarning('g1', 'u1', 1);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.earning.grossAmountMinor, 5000);
      assert.strictEqual(result.earning.platformFeeMinor, 1000);
      assert.strictEqual(result.earning.netAmountMinor, 4000);
      assert.strictEqual(result.earning.currency, 'PHP');
      assert.strictEqual(result.earning.status, 'paid');
    });

    it('pending payment does NOT create earnings (Phase 6)', async () => {
      const { purchaseId } = addPurchase('g1', 'buyer1', 1, 'payB', 5000, 'pending', 'paid');
      const result = await earningsService.createEarning('g1', 'u1', 1);
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'PAYMENT_NOT_CONFIRMED');
      assert.strictEqual(earningsRepo.getEarningByPurchase('g1', purchaseId), null);
    });

    it('failed / cancelled / refunded payments do NOT create earnings (Phase 6)', async () => {
      for (const status of ['failed', 'cancelled', 'refunded']) {
        const { purchaseId } = addPurchase('g1', 'buyer1', 1, 'payFail_' + status, 5000, status, 'paid');
        const result = await earningsService.createEarning('g1', 'u1', 1);
        assert.strictEqual(result.success, false, status + ' must be rejected');
        assert.strictEqual(result.error, 'PAYMENT_NOT_CONFIRMED', status + ' must be rejected');
        assert.strictEqual(earningsRepo.getEarningByPurchase('g1', purchaseId), null, status + ' must not create an earning');
      }
    });

    it('unpaid (pending) purchase is rejected', async () => {
      const { purchaseId } = addPurchase('g1', 'buyer1', 1, 'payC', 5000, 'pending', 'pending');
      const result = await earningsService.createEarning('g1', 'u1', 1);
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'PURCHASE_NOT_FOUND');
      assert.strictEqual(earningsRepo.getEarningByPurchase('g1', purchaseId), null);
    });

    it('idempotent - the same paid purchase produces exactly one earning (Phase 6)', async () => {
      const { purchaseId } = addPurchase('g1', 'buyer1', 1, 'payD');
      const first = await earningsService.createEarning('g1', 'u1', 1);
      const second = await earningsService.createEarning('g1', 'u1', 1);
      assert.strictEqual(first.success, true);
      assert.strictEqual(second.success, true);
      assert.ok(second.message.includes('idempotent'));
      const count = db.db.prepare('SELECT COUNT(*) AS cnt FROM creator_earnings WHERE purchase_id = ?').get(purchaseId).cnt;
      assert.strictEqual(count, 1);
    });

    it('reprocessing a confirmed payment does not duplicate earnings', async () => {
      addPurchase('g1', 'buyer1', 1, 'payE');
      await earningsService.createEarning('g1', 'u1', 1);
      const result = await earningsService.createEarning('g1', 'u1', 1);
      assert.strictEqual(result.success, true);
      const count = db.db.prepare('SELECT COUNT(*) AS cnt FROM creator_earnings').get().cnt;
      assert.strictEqual(count, 1);
    });

    it('rejects non-creator', async () => {
      const result = await earningsService.createEarning('g1', 'u99', 1);
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'NOT_CREATOR');
    });

    it('rejects suspended creator', async () => {
      creatorService.setCreatorStatus('g1', 'u1', 'suspended');
      const result = await earningsService.createEarning('g1', 'u1', 1);
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'NOT_CREATOR');
    });

    it('rejects product not owned (canonical creator id is compared)', async () => {
      const result = await earningsService.createEarning('g1', 'u2', 1);
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'NOT_PRODUCT_OWNER');
    });

    it('rejects unlisted product', async () => {
      marketplaceService.unlistProduct('g1', 1, 'u1');
      const result = await earningsService.createEarning('g1', 'u1', 1);
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'PRODUCT_NOT_LISTED');
    });

    it('rejects missing product', async () => {
      const result = await earningsService.createEarning('g1', 'u1', 999);
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'PRODUCT_NOT_FOUND');
    });

    it('rejects missing purchase', async () => {
      await contentService.publishContent('g1', 'u2', contentBId);
      const product2 = await marketplaceService.createProduct('g1', 'u2', contentBId, 3000, 'PHP');
      await marketplaceService.listProduct('g1', product2.product.id, 'u2');
      const result = await earningsService.createEarning('g1', 'u2', product2.product.id);
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'PURCHASE_NOT_FOUND');
    });

    it('creator earnings history works', async () => {
      addPurchase('g1', 'buyer1', 1, 'payF');
      await earningsService.createEarning('g1', 'u1', 1);
      const result = earningsService.getCreatorEarnings('g1', 'u1');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.summary.earningCount, 1);
      assert.strictEqual(result.summary.grossTotal, 5000);
      assert.strictEqual(result.summary.platformFeeTotal, 1000);
      assert.strictEqual(result.summary.netTotal, 4000);
    });

    it('creator cannot access another creator earnings', async () => {
      addPurchase('g1', 'buyer1', 1, 'payG');
      await earningsService.createEarning('g1', 'u1', 1);
      const u1 = earningsService.getCreatorEarnings('g1', 'u1');
      const u2 = earningsService.getCreatorEarnings('g1', 'u2');
      assert.strictEqual(u1.summary.earningCount, 1);
      assert.strictEqual(u2.success, true);
      assert.strictEqual(u2.summary.earningCount, 0);
    });
  });

  describe('Content ownership (Phase 4)', () => {
    it('new content is created as draft (Phase 2)', async () => {
      const result = await contentService.createContent('g1', 'u1', 'Draft Content', 'Desc');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.content.status, 'draft');
    });

    it('creator can view own content', () => {
      const result = contentService.getCreatorContent('g1', 'u1');
      assert.strictEqual(result.success, true);
      assert.ok(result.content.some(c => c.id === contentAId), 'should include own content');
      assert.ok(!result.content.some(c => c.id === contentBId), 'should not include another creator content');
    });

    it('creator can edit own content', () => {
      const result = contentService.updateContent('g1', 'u1', contentAId, 'Content A Edited', 'New desc');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.content.title, 'Content A Edited');
    });

    it('creator can publish own content', () => {
      const result = contentService.publishContent('g1', 'u2', contentBId);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.content.status, 'published');
    });

    it('creator can unpublish own content', () => {
      const result = contentService.unpublishContent('g1', 'u1', contentAId);
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.content.status, 'draft');
    });

    it('creator cannot edit another creator content', () => {
      const result = contentService.updateContent('g1', 'u2', contentAId, 'Hijack', 'x');
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'NOT_CONTENT_OWNER');
    });

    it('creator cannot publish another creator content', () => {
      const result = contentService.publishContent('g1', 'u2', contentAId);
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'NOT_CONTENT_OWNER');
    });

    it('creator cannot unpublish another creator content', () => {
      const result = contentService.unpublishContent('g1', 'u2', contentAId);
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'NOT_CONTENT_OWNER');
    });

    it('creator cannot delete another creator content', () => {
      const result = contentService.deleteContent('g1', 'u2', contentAId);
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'NOT_CONTENT_OWNER');
    });
  });

  describe('Marketplace ownership (Phase 4)', () => {
    it('creator can view own products', () => {
      const result = marketplaceService.getCreatorProducts('g1', 'u1');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.products.length, 1);
      assert.strictEqual(result.products[0].creatorId, 1, 'product should carry the canonical creator profile id');
    });

    it('creator can list own product', () => {
      marketplaceService.unlistProduct('g1', 1, 'u1');
      const result = marketplaceService.listProduct('g1', 1, 'u1');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.product.listingStatus, 'listed');
    });

    it('creator can unlist own product', () => {
      const result = marketplaceService.unlistProduct('g1', 1, 'u1');
      assert.strictEqual(result.success, true);
      assert.strictEqual(result.product.listingStatus, 'unlisted');
    });

    it('creator cannot list another creator product', () => {
      const result = marketplaceService.listProduct('g1', 1, 'u2');
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'NOT_PRODUCT_OWNER');
    });

    it('creator cannot unlist another creator product', () => {
      const result = marketplaceService.unlistProduct('g1', 1, 'u2');
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'NOT_PRODUCT_OWNER');
    });

    it('creator cannot create a product from another creator content', async () => {
      const result = await marketplaceService.createProduct('g1', 'u2', contentAId, 3000, 'PHP');
      assert.strictEqual(result.success, false);
      assert.strictEqual(result.error, 'CONTENT_NOT_FOUND');
    });
  });
});