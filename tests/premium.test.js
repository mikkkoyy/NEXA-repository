const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const Database = require('../src/database/database');
const { migrate } = require('../src/database/schema');
const { PremiumRepository } = require('../src/premium/repository');
const { PremiumService } = require('../src/premium/service');
const { PaymentsRepository } = require('../src/payments/repository');
const { PaymentsService } = require('../src/payments/service');
const { EconomyRepository } = require('../src/economy/repository');
const { EconomyService } = require('../src/economy/service');
const { ProfileRepository } = require('../src/identity/repository');
const IdentityService = require('../src/identity/service');
const premiumCommand = require('../src/commands/premium');

const DAY = 86400000;

function createHarness() {
  const db = new Database(':memory:');
  migrate(db);

  const premiumRepo = new PremiumRepository(db);
  const paymentsRepo = new PaymentsRepository(db);
  const economyRepo = new EconomyRepository(db);
  const profileRepo = new ProfileRepository(db);

  const economyService = new EconomyService(economyRepo);
  const identityService = new IdentityService(profileRepo);

  let now = new Date('2026-01-01T00:00:00.000Z');
  const clock = {
    get now() { return now; },
    advance(millis) { now = new Date(now.getTime() + millis); return now; }
  };

  premiumRepo.ensurePlans(db);
  paymentsRepo.ensurePlans(db);

  const service = new PremiumService(premiumRepo, paymentsRepo, economyService, true, () => clock.now);
  service.setNow(() => clock.now);

  const paymentsService = new PaymentsService(paymentsRepo, true);
  paymentsService.setPremiumService(service);

  identityService.setPremiumService(service);
  identityService.setNow(() => clock.now);

  return { db, premiumRepo, paymentsRepo, economyRepo, profileRepo, economyService, identityService, service, paymentsService, clock };
}

function buy(harness, planKey, userID = 'u1', guildID = 'g1') {
  const { payment } = harness.paymentsService.buyPremium(guildID, userID, planKey);
  return harness.paymentsService.confirmPayment(payment.providerPaymentID, guildID, userID);
}

function fakeInteraction(client, subcommand, opts = {}) {
  return {
    guild: { id: 'g1' },
    user: { id: 'u1' },
    memberPermissions: opts.memberPermissions || { has: () => true },
    options: {
      getSubcommand: () => subcommand,
      getString: (name) => (opts.strings || {})[name] ?? null,
      getInteger: (name) => (opts.ints || {})[name] ?? 1
    },
    client,
    replied: false,
    deferred: false,
    async reply(payload) { this.replied = true; this.lastReply = payload; return payload; },
    async editReply(payload) { this.lastEdit = payload; return payload; }
  };
}

describe('NEXA Premium', () => {
  let harness;

  beforeEach(() => {
    harness = createHarness();
  });

  afterEach(() => {
    harness.db.close();
  });

  describe('1-4. Plan creation & configuration', () => {
    it('creates the premium plan catalog', () => {
      const plans = harness.service.getPlans();
      assert.strictEqual(plans.length, 3);
    });

    it('monthly plan: ₱49 / 30 days', () => {
      const plan = harness.service.getPlan('premium_monthly');
      assert.ok(plan);
      assert.strictEqual(plan.pricePhp, 49);
      assert.strictEqual(plan.priceMinor, 4900);
      assert.strictEqual(plan.durationDays, 30);
      assert.strictEqual(plan.name, 'Monthly');
      assert.strictEqual(plan.enabled, true);
    });

    it('quarterly plan: ₱129 / 90 days', () => {
      const plan = harness.service.getPlan('premium_quarterly');
      assert.ok(plan);
      assert.strictEqual(plan.pricePhp, 129);
      assert.strictEqual(plan.priceMinor, 12900);
      assert.strictEqual(plan.durationDays, 90);
      assert.strictEqual(plan.name, 'Quarterly');
    });

    it('yearly plan: ₱399 / 365 days', () => {
      const plan = harness.service.getPlan('premium_yearly');
      assert.ok(plan);
      assert.strictEqual(plan.pricePhp, 399);
      assert.strictEqual(plan.priceMinor, 39900);
      assert.strictEqual(plan.durationDays, 365);
      assert.strictEqual(plan.name, 'Yearly');
    });

    it('pricing is centralized in economy config, not in services', () => {
      const { economy } = require('../src/config/economy');
      assert.strictEqual(economy.premium.monthly, 49);
      assert.strictEqual(economy.premium.quarterly, 129);
      assert.strictEqual(economy.premium.yearly, 399);
      assert.strictEqual(economy.premiumPlans.monthly.durationDays, 30);
      assert.strictEqual(economy.premiumPlans.quarterly.durationDays, 90);
      assert.strictEqual(economy.premiumPlans.yearly.durationDays, 365);
    });

    it('reconciles persisted plan catalogs with the canonical catalog', () => {
      harness.db.exec(
        `UPDATE premium_plans SET name = 'Wrong', description = 'Wrong', enabled = 0 WHERE plan_key = 'premium_monthly'`
      );
      harness.db.exec(
        `UPDATE payment_plans SET duration_days = 1, price_minor = 1, currency = 'USD', enabled = 0 WHERE plan_key = 'premium_monthly'`
      );

      harness.premiumRepo.ensurePlans(harness.db);
      harness.paymentsRepo.ensurePlans(harness.db);

      const premiumPlan = harness.premiumRepo.getPlan('g1', 'premium_monthly');
      const paymentPlan = harness.paymentsRepo.getPlanByKey('premium_monthly');
      assert.strictEqual(premiumPlan.name, 'Monthly');
      assert.strictEqual(premiumPlan.description, 'NEXA Premium for 30 days');
      assert.strictEqual(premiumPlan.enabled, true);
      assert.strictEqual(paymentPlan.durationDays, 30);
      assert.strictEqual(paymentPlan.priceMinor, 4900);
      assert.strictEqual(paymentPlan.currency, 'PHP');
      assert.strictEqual(paymentPlan.enabled, true);
    });
  });

  describe('5. Premium activation', () => {
    it('activates a user entitlement after a confirmed payment', () => {
      const res = buy(harness, 'premium_monthly');
      assert.strictEqual(res.activated, true);
      const status = harness.service.getStatus('g1', 'u1');
      assert.strictEqual(status.active, true);
      assert.strictEqual(status.entitlement.planKey, 'premium_monthly');
      assert.ok(status.entitlement.expiresAt > harness.clock.now);
    });

    it('activation records plan, status, started_at, expires_at, and payment reference', () => {
      const res = buy(harness, 'premium_yearly');
      const entitlement = harness.service.getStatus('g1', 'u1').entitlement;
      assert.ok(entitlement.userID, 'u1');
      assert.strictEqual(entitlement.status, 'active');
      assert.ok(entitlement.startedAt);
      assert.ok(entitlement.expiresAt);
      assert.ok(entitlement.paymentReference);
      assert.strictEqual(entitlement.paymentReference, res.payment.providerPaymentID);
    });

    it('test activation uses the canonical Monthly plan and duration', () => {
      const entitlement = harness.service.testActivate('g1', 'u1');
      assert.strictEqual(entitlement.planKey, 'premium_monthly');
      assert.strictEqual(entitlement.expiresAt.getTime(), harness.clock.now.getTime() + 30 * DAY);
      assert.strictEqual(harness.paymentsRepo.getPlanByKey('premium_monthly').durationDays, 30);
    });
  });

  describe('6-8. Premium status, expiration, entitlement loss', () => {
    it('status reflects an active premium', () => {
      buy(harness, 'premium_monthly');
      const status = harness.service.getStatus('g1', 'u1');
      assert.strictEqual(status.active, true);
      assert.strictEqual(status.plan.name, 'Monthly');
      assert.ok(status.entitlement.expiresAt);
    });

    it('a past expires_at is no longer treated as premium', () => {
      buy(harness, 'premium_monthly'); // 30 days
      harness.clock.advance(31 * DAY);
      const status = harness.service.getStatus('g1', 'u1');
      assert.strictEqual(status.active, false);
      assert.strictEqual(status.entitlement.status, 'expired');
    });

    it('expired user loses the entitlement check (isPremium false)', () => {
      buy(harness, 'premium_monthly');
      assert.strictEqual(harness.service.isPremium('g1', 'u1'), true);
      harness.clock.advance(31 * DAY);
      assert.strictEqual(harness.service.isPremium('g1', 'u1'), false);
    });
  });

  describe('9. Renewal extends, does not reset', () => {
    it('active renewal extends from current expiry', () => {
      buy(harness, 'premium_monthly');
      const statusAfterFirst = harness.service.getStatus('g1', 'u1');
      const firstExpiresAt = statusAfterFirst.entitlement.expiresAt.getTime();

      // Renew monthly (30d) while still active -> extends from current expiry
      buy(harness, 'premium_monthly');
      const statusAfterSecond = harness.service.getStatus('g1', 'u1');
      const secondExpiresAt = statusAfterSecond.entitlement.expiresAt.getTime();

      assert.strictEqual(secondExpiresAt, firstExpiresAt + 30 * DAY);
      assert.strictEqual(statusAfterSecond.entitlement.startedAt.getTime(), firstExpiresAt);
    });

    it('quarterly renews from expiry for 90 more days', () => {
      buy(harness, 'premium_monthly');
      const first = harness.service.getStatus('g1', 'u1').entitlement.expiresAt.getTime();
      buy(harness, 'premium_quarterly');
      const second = harness.service.getStatus('g1', 'u1').entitlement.expiresAt.getTime();
      assert.strictEqual(second, first + 90 * DAY);
    });
  });

  describe('10. Expired renewal starts from current time', () => {
    it('re-activation after expiry starts the entitlement now', () => {
      buy(harness, 'premium_monthly');
      const expiredStart = harness.service.getStatus('g1', 'u1').entitlement.expiresAt.getTime();
      harness.clock.advance(31 * DAY);
      assert.strictEqual(harness.service.getStatus('g1', 'u1').active, false);

      const res = buy(harness, 'premium_yearly');
      const renewed = harness.service.getStatus('g1', 'u1').entitlement;
      assert.strictEqual(renewed.status, 'active');
      assert.strictEqual(renewed.startedAt.getTime(), harness.clock.now.getTime());
      assert.strictEqual(renewed.expiresAt.getTime(), harness.clock.now.getTime() + 365 * DAY);
      assert.notStrictEqual(renewed.startedAt.getTime(), expiredStart);
    });
  });

  describe('11-12. Payment idempotency and validity', () => {
    it('a duplicated payment cannot grant premium twice', () => {
      const { payment } = harness.paymentsService.buyPremium('g1', 'u1', 'premium_monthly');
      const ref = payment.providerPaymentID;
      harness.paymentsService.confirmPayment(ref, 'g1', 'u1');
      const once = harness.service.getStatus('g1', 'u1').entitlement.expiresAt.getTime();

      harness.paymentsService.confirmPayment(ref, 'g1', 'u1'); // replay
      const twice = harness.service.getStatus('g1', 'u1').entitlement.expiresAt.getTime();

      assert.strictEqual(twice, once);
      assert.strictEqual(harness.paymentsService.getPayment('g1', 'u1', ref).status, 'paid');
    });

    it('an invalid (unpaid) payment does not grant premium', () => {
      const payment = harness.paymentsRepo.createPayment(
        'g1', 'u1', 'premium_monthly', 'mock', 'ref_pending_1', 4900, 'PHP', 'pending'
      );
      assert.throws(() => harness.service.activateFromPayment(payment), /paid/);
      assert.strictEqual(harness.service.getStatus('g1', 'u1').active, false);
    });

    it('a cancelled payment does not grant premium', () => {
      const payment = harness.paymentsRepo.createPayment(
        'g1', 'u1', 'premium_monthly', 'mock', 'ref_cancelled_1', 4900, 'PHP', 'cancelled'
      );
      assert.throws(() => harness.service.activateFromPayment(payment), /paid/);
      assert.strictEqual(harness.service.isPremium('g1', 'u1'), false);
    });

    it('confirmation rejects non-pending payments without granting premium', () => {
      for (const status of ['failed', 'cancelled', 'expired', 'refunded']) {
        const payment = harness.paymentsRepo.createPayment(
          'g1', 'u1', 'premium_monthly', 'mock', `ref_${status}_1`, 4900, 'PHP', status
        );
        assert.throws(() => harness.paymentsService.confirmPayment(payment.providerPaymentID, 'g1', 'u1'), /not pending/);
        assert.strictEqual(harness.service.isPremium('g1', 'u1'), false);
      }
    });

    it('confirmation rejects an amount mismatch before changing status', () => {
      const payment = harness.paymentsRepo.createPayment(
        'g1', 'u1', 'premium_monthly', 'mock', 'ref_amount_mismatch_1', 1, 'PHP', 'pending'
      );
      assert.throws(() => harness.paymentsService.confirmPayment(payment.providerPaymentID, 'g1', 'u1'), /amount/);
      assert.strictEqual(harness.paymentsRepo.getPaymentByID(payment.id).status, 'pending');
      assert.strictEqual(harness.service.isPremium('g1', 'u1'), false);
    });

    it('activation rejects a currency mismatch', () => {
      const payment = harness.paymentsRepo.createPayment(
        'g1', 'u1', 'premium_monthly', 'mock', 'ref_currency_mismatch_1', 4900, 'PHP', 'paid'
      );
      harness.db.exec(`UPDATE payments SET currency = 'USD' WHERE id = ?`, [payment.id]);
      const stored = harness.paymentsRepo.getPaymentByID(payment.id);
      assert.throws(() => harness.service.activateFromPayment(stored), /currency/);
      assert.strictEqual(harness.service.isPremium('g1', 'u1'), false);
    });

    it('activation rejects a disabled payment plan', () => {
      harness.db.exec(`UPDATE payment_plans SET enabled = 0 WHERE plan_key = 'premium_monthly'`);
      const payment = harness.paymentsRepo.createPayment(
        'g1', 'u1', 'premium_monthly', 'mock', 'ref_disabled_plan_1', 4900, 'PHP', 'paid'
      );
      assert.throws(() => harness.service.activateFromPayment(payment), /not purchasable/);
      assert.strictEqual(harness.service.isPremium('g1', 'u1'), false);
    });

    it('pending payment is not active and does not grant benefits', () => {
      const { payment } = harness.paymentsService.buyPremium('g1', 'u1', 'premium_monthly');
      assert.strictEqual(payment.status, 'pending');
      assert.strictEqual(harness.service.isPremium('g1', 'u1'), false);
    });
  });

  describe('13. XP multiplier benefit', () => {
    it('premium users earn the configured XP multiplier on messages', async () => {
      buy(harness, 'premium_monthly');

      await harness.identityService.recordMessage(null, 'g1', 'u1', 'u1', 'u1');
      harness.clock.advance(61000);
      await harness.identityService.recordMessage(null, 'g1', 'u1', 'u1', 'u1');

      await harness.identityService.recordMessage(null, 'g1', 'u2', 'u2', 'u2');

      const premiumProfile = harness.profileRepo.getProfile(null, 'g1', 'u1');
      const freeProfile = harness.profileRepo.getProfile(null, 'g1', 'u2');

      assert.strictEqual(freeProfile.xp, 2); // base reward
      assert.strictEqual(premiumProfile.xp, 6); // ceil(2 * 1.25) = 3 per message
    });

    it('expired premium stops receiving the multiplier', async () => {
      buy(harness, 'premium_monthly');
      harness.clock.advance(31 * DAY);

      await harness.identityService.recordMessage(null, 'g1', 'u1', 'u1', 'u1');
      harness.clock.advance(61000);
      await harness.identityService.recordMessage(null, 'g1', 'u1', 'u1', 'u1');

      const profile = harness.profileRepo.getProfile(null, 'g1', 'u1');
      assert.strictEqual(profile.xp, 4); // base reward only after expiry
    });
  });

  describe('14. Economy premium benefit', () => {
    it('a premium user can claim one daily economy bonus', () => {
      buy(harness, 'premium_monthly');

      const first = harness.service.claimEconomyBonus('g1', 'u1');
      assert.strictEqual(first.claimed, true);
      assert.strictEqual(first.amount, 100);
      assert.strictEqual(harness.economyService.getBalance('g1', 'u1'), 100);

      const second = harness.service.claimEconomyBonus('g1', 'u1');
      assert.strictEqual(second.claimed, false);
      assert.strictEqual(second.reason, 'already_claimed');
      assert.strictEqual(harness.economyService.getBalance('g1', 'u1'), 100);

      harness.clock.advance(DAY);
      const nextDay = harness.service.claimEconomyBonus('g1', 'u1');
      assert.strictEqual(nextDay.claimed, true);
      assert.strictEqual(harness.economyService.getBalance('g1', 'u1'), 200);
    });
  });

  describe('Snapshot compatibility', () => {
    it('restores Premium entitlements and their payment records', () => {
      const result = buy(harness, 'premium_monthly');
      const snapshot = harness.db.serialize();
      const restored = new Database(snapshot);
      try {
        const premiumRepo = new PremiumRepository(restored);
        const paymentsRepo = new PaymentsRepository(restored);
        const service = new PremiumService(premiumRepo, paymentsRepo, null, true, () => new Date('2026-01-01T00:00:00.000Z'));
        const status = service.getStatus('g1', 'u1');

        assert.strictEqual(status.active, true);
        assert.strictEqual(status.entitlement.planKey, 'premium_monthly');
        assert.strictEqual(status.entitlement.paymentReference, result.payment.providerPaymentID);
        assert.ok(paymentsRepo.getPaymentByID(status.entitlement.paymentId));
      } finally {
        restored.close();
      }
    });
  });

  describe('15. User isolation and security', () => {
    it('premium is granted per user, not to everyone in the guild', () => {
      buy(harness, 'premium_monthly', 'u1');
      assert.strictEqual(harness.service.isPremium('g1', 'u1'), true);
      assert.strictEqual(harness.service.isPremium('g1', 'u2'), false);
      assert.strictEqual(harness.service.getStatus('g1', 'u2').active, false);
    });

    it('a payment reference is only visible to its own user and guild', () => {
      const { payment } = harness.paymentsService.buyPremium('g1', 'u1', 'premium_monthly');
      const ref = payment.providerPaymentID;

      assert.ok(harness.paymentsService.getPayment('g1', 'u1', ref));
      assert.strictEqual(harness.paymentsService.getPayment('g1', 'u2', ref), null);
      assert.strictEqual(harness.paymentsService.getPayment('g2', 'u1', ref), null);
    });

    it('confirmation cannot activate a payment for another guild or user', () => {
      const { payment } = harness.paymentsService.buyPremium('g1', 'u1', 'premium_monthly');
      const ref = payment.providerPaymentID;

      assert.throws(() => harness.paymentsService.confirmPayment(ref, 'g2', 'u1'), /different guild/);
      assert.throws(() => harness.paymentsService.confirmPayment(ref, 'g1', 'u2'), /different user/);
      assert.strictEqual(harness.service.isPremium('g1', 'u1'), false);
    });

    it('a non-premium user cannot claim the premium economy bonus', () => {
      const result = harness.service.claimEconomyBonus('g1', 'u2');
      assert.strictEqual(result.claimed, false);
      assert.strictEqual(result.reason, 'not_premium');
    });

    it('client-provided values cannot be used to grant entitlement (server-side plan & duration only)', () => {
      // Activation always derives plan/duration from the payment plan catalog.
      const payment = harness.paymentsRepo.createPayment(
        'g1', 'u1', 'premium_monthly', 'mock', 'ref_bound_1', 4900, 'PHP', 'paid'
      );
      const entitlement = harness.service.activateFromPayment(payment);
      assert.strictEqual(entitlement.planKey, 'premium_monthly');
      const expectedMs = harness.clock.now.getTime() + 30 * DAY;
      assert.strictEqual(entitlement.expiresAt.getTime(), expectedMs);
    });
  });

  describe('16-18. /premium command', () => {
    it('command defines the expected subcommands', () => {
      assert.strictEqual(premiumCommand.data.name, 'premium');
      const subs = premiumCommand.data.options.map(o => o.name);
      assert.ok(subs.includes('status'));
      assert.ok(subs.includes('plans'));
      assert.ok(subs.includes('buy'));
      assert.ok(subs.includes('payment-status'));
      assert.ok(subs.includes('test-activate'));
      assert.ok(subs.includes('claim'));
    });

    it('/premium status shows an active membership', async () => {
      buy(harness, 'premium_monthly');
      const client = { premiumService: harness.service, paymentsService: harness.paymentsService, economyService: harness.economyService };
      const interaction = fakeInteraction(client, 'status');
      await premiumCommand.execute(interaction);
      assert.strictEqual(interaction.replied, true);
      const description = interaction.lastReply.embeds[0].data.description;
      assert.ok(description.includes('Status: Active'));
      assert.ok(description.includes('Monthly'));
    });

    it('/premium status shows inactive state without entitlement', async () => {
      const client = { premiumService: harness.service, paymentsService: harness.paymentsService, economyService: harness.economyService };
      const interaction = fakeInteraction(client, 'status');
      await premiumCommand.execute(interaction);
      const description = interaction.lastReply.embeds[0].data.description;
      assert.ok(description.includes('Status: Not active'));
    });

    it('/premium plans lists pricing and benefits', async () => {
      const client = { premiumService: harness.service, paymentsService: harness.paymentsService, economyService: harness.economyService };
      const interaction = fakeInteraction(client, 'plans');
      await premiumCommand.execute(interaction);
      const description = interaction.lastReply.embeds[0].data.description;
      assert.ok(description.includes('Monthly'));
      assert.ok(description.includes('₱49'));
      assert.ok(description.includes('Quarterly'));
      assert.ok(description.includes('₱129'));
      assert.ok(description.includes('Yearly'));
      assert.ok(description.includes('₱399'));
    });

    it('/premium buy goes through the payment lifecycle in test mode', async () => {
      const client = { premiumService: harness.service, paymentsService: harness.paymentsService, economyService: harness.economyService };
      const interaction = fakeInteraction(client, 'buy', { strings: { plan: 'premium_monthly' } });
      await premiumCommand.execute(interaction);
      assert.strictEqual(interaction.replied, true);
      const description = interaction.lastReply.embeds[0].data.description;
      assert.ok(description.includes('Activated'));
    });

    it('/premium test-activate is restricted and uses the catalog plan', () => {
      const subcommand = premiumCommand.data.options.find(option => option.name === 'test-activate');
      assert.strictEqual(subcommand.options.length, 0);
    });

    it('/premium test-activate rejects a normal member', async () => {
      const client = { premiumService: harness.service, paymentsService: harness.paymentsService, economyService: harness.economyService };
      const interaction = fakeInteraction(client, 'test-activate', {
        memberPermissions: { has: () => false }
      });
      await premiumCommand.execute(interaction);
      assert.ok(interaction.lastReply.content.includes('Manage Server'));
      assert.strictEqual(harness.service.isPremium('g1', 'u1'), false);
    });

    it('/premium test-activate activates the Monthly plan for a manager', async () => {
      const client = { premiumService: harness.service, paymentsService: harness.paymentsService, economyService: harness.economyService };
      const interaction = fakeInteraction(client, 'test-activate');
      await premiumCommand.execute(interaction);
      assert.strictEqual(interaction.replied, true);
      const description = interaction.lastReply.embeds[0].data.description;
      assert.ok(description.includes('Plan: Monthly'));
      assert.strictEqual(harness.service.getStatus('g1', 'u1').entitlement.planKey, 'premium_monthly');
    });
  });
});