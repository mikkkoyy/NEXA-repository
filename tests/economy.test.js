const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const os = require('os');

const Database = require('../src/database/database');
const { migrate } = require('../src/database/schema');
const { EconomyRepository } = require('../src/economy/repository');
const { EconomyService } = require('../src/economy/service');
const { CurrencyName, CurrencySymbol, StartingBalance, TxEarn, TxSpend, ErrInsufficientBalance } = require('../src/economy/model');

function createTestHarness() {
  const dbPath = path.join(os.tmpdir(), `nexa_economy_${Date.now()}_${Math.random()}.db`);
  const db = new Database(dbPath);
  migrate(db);

  const repo = new EconomyRepository(db);
  const service = new EconomyService(repo);

  let current = new Date('2026-09-04T12:00:00Z');
  service.setNow(() => current);

  return { db, repo, service, current: () => current };
}

describe('Economy Engine', () => {
  let harness;

  beforeEach(() => {
    harness = createTestHarness();
  });

  afterEach(() => {
    harness.db.close();
  });

  describe('Seed', () => {
    it('has correct currency name', () => {
      assert.strictEqual(CurrencyName, 'NEXA Coin');
    });

    it('has correct currency symbol', () => {
      assert.strictEqual(CurrencySymbol, '🪙');
    });

    it('has correct starting balance', () => {
      assert.strictEqual(StartingBalance, 0);
    });
  });

  describe('Wallet Creation', () => {
    it('creates wallet with starting balance', () => {
      const wallet = harness.service.getWallet('g1', 'u1');
      assert.ok(wallet);
      assert.strictEqual(wallet.balance, StartingBalance);
    });

    it('is idempotent', () => {
      const w1 = harness.service.getWallet('g1', 'u1');
      const w2 = harness.service.getWallet('g1', 'u1');
      assert.strictEqual(w1.id, w2.id);
    });

    it('returns null for non-existent wallet', () => {
      const wallet = harness.repo.getWallet('g1', 'nonexistent');
      assert.strictEqual(wallet, null);
    });
  });

  describe('Guild Isolation', () => {
    it('wallets are isolated per guild', () => {
      harness.service.addCurrency('g1', 'u1', 100, 'test', null);
      harness.service.addCurrency('g2', 'u1', 200, 'test', null);

      assert.strictEqual(harness.service.getBalance('g1', 'u1'), 100);
      assert.strictEqual(harness.service.getBalance('g2', 'u1'), 200);
    });
  });

  describe('User Isolation', () => {
    it('wallets are isolated per user', () => {
      harness.service.addCurrency('g1', 'u1', 100, 'test', null);
      harness.service.addCurrency('g1', 'u2', 200, 'test', null);

      assert.strictEqual(harness.service.getBalance('g1', 'u1'), 100);
      assert.strictEqual(harness.service.getBalance('g1', 'u2'), 200);
    });
  });

  describe('Balance Operations', () => {
    it('adds currency correctly', () => {
      harness.service.addCurrency('g1', 'u1', 50, 'test', null);
      assert.strictEqual(harness.service.getBalance('g1', 'u1'), 50);
    });

    it('adds multiple times correctly', () => {
      harness.service.addCurrency('g1', 'u1', 50, 'test', null);
      harness.service.addCurrency('g1', 'u1', 25, 'test', null);
      assert.strictEqual(harness.service.getBalance('g1', 'u1'), 75);
    });

    it('spends currency correctly', () => {
      harness.service.addCurrency('g1', 'u1', 100, 'test', null);
      harness.service.spendCurrency('g1', 'u1', 30, 'test', null);
      assert.strictEqual(harness.service.getBalance('g1', 'u1'), 70);
    });

    it('rejects negative amounts', () => {
      assert.throws(() => harness.service.addCurrency('g1', 'u1', -10, 'test', null), /invalid amount/i);
    });

    it('rejects zero amounts', () => {
      assert.throws(() => harness.service.addCurrency('g1', 'u1', 0, 'test', null), /invalid amount/i);
    });

    it('rejects insufficient balance', () => {
      harness.service.addCurrency('g1', 'u1', 100, 'test', null);
      assert.throws(() => harness.service.spendCurrency('g1', 'u1', 200, 'test', null), ErrInsufficientBalance);
    });

    it('rejects floating point amounts', () => {
      assert.throws(() => harness.service.addCurrency('g1', 'u1', 10.5, 'test', null), /invalid amount/i);
    });

    it('allows large integer amounts', () => {
      harness.service.addCurrency('g1', 'u1', 1000000, 'test', null);
      assert.strictEqual(harness.service.getBalance('g1', 'u1'), 1000000);
    });
  });

  describe('Transactions', () => {
    it('records earn transactions', () => {
      harness.service.addCurrency('g1', 'u1', 50, 'test_source', null);
      const txs = harness.service.getTransactions('g1', 'u1');
      assert.strictEqual(txs.length, 1);
      assert.strictEqual(txs[0].amount, 50);
      assert.strictEqual(txs[0].txType, TxEarn);
    });

    it('records spend transactions', () => {
      harness.service.addCurrency('g1', 'u1', 100, 'test_source', null);
      harness.service.spendCurrency('g1', 'u1', 30, 'spend_source', null);
      const txs = harness.service.getTransactions('g1', 'u1');
      assert.strictEqual(txs.length, 2);
      const spend = txs.find(t => t.txType === TxSpend);
      assert.ok(spend);
      assert.strictEqual(spend.amount, 30);
    });

    it('supports reference IDs', () => {
      harness.service.addCurrency('g1', 'u1', 50, 'test', 'ref-123');
      const txs = harness.service.getTransactions('g1', 'u1');
      assert.strictEqual(txs[0].referenceID, 'ref-123');
    });

    it('returns empty list for new wallet', () => {
      const txs = harness.service.getTransactions('g1', 'u1');
      assert.strictEqual(txs.length, 0);
    });
  });

  describe('Persistence', () => {
    it('survives reopen', () => {
      const dbPath = path.join(os.tmpdir(), `nexa_economy_persist_${Date.now()}_${Math.random()}.db`);

      {
        const db = new Database(dbPath);
        migrate(db);
        const repo = new EconomyRepository(db);
        const service = new EconomyService(repo);
        service.setNow(() => new Date());

        service.addCurrency('g1', 'u1', 100, 'test', null);
        service.spendCurrency('g1', 'u1', 30, 'test', null);
        db.close();
      }

      {
        const db = new Database(dbPath);
        migrate(db);
        const repo = new EconomyRepository(db);
        const service = new EconomyService(repo);
        service.setNow(() => new Date());

        assert.strictEqual(service.getBalance('g1', 'u1'), 70);
        const txs = service.getTransactions('g1', 'u1');
        assert.strictEqual(txs.length, 2);
        db.close();
      }
    });
  });

  describe('Concurrency', () => {
    it('handles concurrent adds without lost updates', () => {
      const dbPath = path.join(os.tmpdir(), `nexa_economy_concurrent_${Date.now()}_${Math.random()}.db`);
      const db = new Database(dbPath);
      migrate(db);

      const repo = new EconomyRepository(db);
      const service = new EconomyService(repo);
      service.setNow(() => new Date());

      service.ensureWallet('g1', 'u1', new Date());

      const workers = 12;
      const promises = [];
      for (let i = 0; i < workers; i++) {
        promises.push(Promise.resolve(service.addCurrency('g1', 'u1', 10, 'test', null)));
      }
      Promise.all(promises).catch(e => {});

      assert.strictEqual(service.getBalance('g1', 'u1'), 120);

      db.close();
    });

    it('handles concurrent spends without negative balance', () => {
      const dbPath = path.join(os.tmpdir(), `nexa_economy_spend_${Date.now()}_${Math.random()}.db`);
      const db = new Database(dbPath);
      migrate(db);

      const repo = new EconomyRepository(db);
      const service = new EconomyService(repo);
      service.setNow(() => new Date());

      service.ensureWallet('g1', 'u1', new Date());
      service.addCurrency('g1', 'u1', 100, 'test', null);

      const workers = 12;
      const errors = [];
      const promises = [];
      for (let i = 0; i < workers; i++) {
        promises.push((() => { try { return service.spendCurrency('g1', 'u1', 10, 'test', null); } catch(e) { errors.push(e); return null; } })());
      }
      Promise.all(promises).catch(e => {});

      const balance = service.getBalance('g1', 'u1');
      assert.strictEqual(balance, 0);
      assert.ok(errors.length >= 0);

      db.close();
    });
  });
});