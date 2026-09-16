const { PremiumRepository } = require('./repository');
const {
  StatusPaid,
  StatusPending,
  ErrPaymentNotPaid,
  ErrPlanNotPurchasable,
  ErrAmountMismatch,
  ErrCurrencyMismatch
} = require('../payments/model');
const {
  economy,
  premiumPlanDefinitions,
  PlanKeyPremiumMonthly,
  MinorUnitsPerPhp
} = require('../config/economy');
const {
  ErrEconomyServiceRequired,
  ErrTestModeDisabled
} = require('./model');

class PremiumService {
  constructor(premiumRepo, paymentsRepo, economyService, testMode, nowFn) {
    this.repo = premiumRepo;
    this.paymentsRepo = paymentsRepo;
    this.economyService = economyService || null;
    this.testMode = testMode || false;
    this.now = nowFn || (() => new Date());
  }

  setTestMode(enabled) {
    this.testMode = enabled;
  }

  setNow(fn) {
    this.now = fn;
  }

  setEconomyService(economyService) {
    this.economyService = economyService;
  }

  getConfig() {
    return {
      plans: this.getPlans(),
      benefits: economy.premiumBenefits,
      currency: economy.premium.currency
    };
  }

  getPlans() {
    return premiumPlanDefinitions().map(def => {
      const paymentPlan = this.paymentsRepo ? this.paymentsRepo.getPlanByKey(def.key) : null;
      const enabled = paymentPlan === null ? def.enabled !== false : paymentPlan.enabled;
      return {
        key: def.key,
        name: def.name,
        description: def.description,
        durationDays: ((paymentPlan && paymentPlan.durationDays) || def.durationDays),
        priceMinor: (paymentPlan && paymentPlan.priceMinor) || (def.pricePhp * MinorUnitsPerPhp),
        pricePhp: ((paymentPlan && paymentPlan.priceMinor) || (def.pricePhp * MinorUnitsPerPhp)) / MinorUnitsPerPhp,
        currency: (paymentPlan && paymentPlan.currency) || economy.premium.currency,
        enabled
      };
    });
  }

  getPlan(planKey) {
    if (!planKey) {
      return null;
    }
    return this.getPlans().find(p => p.key === planKey) || null;
  }

  isPremiumPlanKey(planKey) {
    return this.repo.isPremiumPlanKey(planKey);
  }

  isPremium(guildID, userID) {
    if (!guildID || !userID) {
      return false;
    }
    return this.repo.isPremium(guildID, userID, this.now());
  }

  getStatus(guildID, userID) {
    if (!guildID || !userID) {
      return null;
    }
    const entitlement = this.repo.getUserPremium(guildID, userID, this.now());
    if (!entitlement) {
      return { active: false, entitlement: null, plan: null };
    }
    const plan = this.getPlan(entitlement.planKey);
    const now = this.now();
    return {
      active: entitlement.status === 'active' && !!entitlement.expiresAt && entitlement.expiresAt > now,
      entitlement,
      plan
    };
  }

  assertPaymentMatchesPlan(payment) {
    const paymentPlan = this.paymentsRepo ? this.paymentsRepo.getPlanByKey(payment.planKey) : null;
    if (!paymentPlan || !paymentPlan.enabled) {
      throw new Error(ErrPlanNotPurchasable);
    }
    if (payment.amountMinor !== paymentPlan.priceMinor) {
      throw new Error(ErrAmountMismatch);
    }
    if (payment.currency !== paymentPlan.currency) {
      throw new Error(ErrCurrencyMismatch);
    }
    return paymentPlan;
  }

  activateFromPayment(payment) {
    if (!payment) {
      throw new Error('payment not found');
    }
    if (payment.status !== StatusPaid) {
      throw ErrPaymentNotPaid;
    }
    if (!this.repo.isPremiumPlanKey(payment.planKey)) {
      throw new Error(ErrPlanNotPurchasable);
    }

    const paymentPlan = this.assertPaymentMatchesPlan(payment);
    const durationDays = paymentPlan.durationDays;

    return this.repo.activateAfterPayment(
      payment.guildID,
      payment.userID,
      payment.planKey,
      durationDays,
      payment.id,
      payment.providerPaymentID,
      this.now()
    );
  }

  testActivate(guildID, userID) {
    if (!this.testMode) {
      throw ErrTestModeDisabled;
    }
    if (!guildID || !userID) {
      return null;
    }

    const planKey = PlanKeyPremiumMonthly;
    const paymentPlan = this.paymentsRepo.getPlanByKey(planKey);
    if (!paymentPlan || !paymentPlan.enabled) {
      throw new Error(ErrPlanNotPurchasable);
    }

    const providerPaymentID = `mock_test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const payment = this.paymentsRepo.createPayment(
      guildID, userID, planKey, 'mock', providerPaymentID,
      paymentPlan.priceMinor, paymentPlan.currency, StatusPending
    );
    this.paymentsRepo.updatePaymentStatus(payment.id, StatusPaid, this.now());

    return this.repo.activateAfterPayment(
      guildID, userID, planKey, paymentPlan.durationDays,
      payment.id, payment.providerPaymentID, this.now()
    );
  }

  claimEconomyBonus(guildID, userID) {
    if (!this.economyService) {
      throw ErrEconomyServiceRequired;
    }
    if (!this.isPremium(guildID, userID)) {
      return { claimed: false, reason: 'not_premium' };
    }

    const now = this.now();
    const date = now.toISOString().slice(0, 10);
    if (!this.repo.canClaimEconomyBonus(guildID, userID, date, now)) {
      return { claimed: false, reason: 'already_claimed', date };
    }

    const amount = economy.premiumBenefits.economyDailyBonus;
    const source = economy.premiumBenefits.economyClaimSource || 'premium_daily';
    this.economyService.addCurrency(guildID, userID, amount, source, `${source}:${date}`);
    this.repo.markEconomyClaim(guildID, userID, date, now);

    return { claimed: true, amount, date };
  }
}

module.exports = { PremiumService };