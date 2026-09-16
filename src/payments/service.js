const { PaymentsRepository } = require('./repository');
const {
  StatusPending,
  StatusPaid,
  ErrGuildRequired,
  ErrUserRequired,
  ErrPlanNotPurchasable,
  ErrPaymentProviderUnavailable,
  ErrPaymentNotFound,
  ErrReferenceRequired,
  ErrPaymentNotPending,
  createCheckout
} = require('./model');
const {
  ErrPaymentBelongsToGuild,
  ErrPaymentBelongsToUser
} = require('../premium/model');

class PaymentsService {
  constructor(paymentsRepo, testMode) {
    this.repo = paymentsRepo;
    this.testMode = testMode || false;
    this.premiumService = null;
  }

  setTestMode(enabled) {
    this.testMode = enabled;
  }

  setPremiumService(premiumService) {
    this.premiumService = premiumService;
  }

  getPlan(planKey) {
    return this.repo.getPlanByKey(planKey);
  }

  buyPremium(guildID, userID, planKey) {
    if (!guildID) {
      throw new Error(ErrGuildRequired);
    }
    if (!userID) {
      throw new Error(ErrUserRequired);
    }

    const plan = this.repo.getPlanByKey(planKey);
    if (!plan || !plan.enabled) {
      throw new Error(ErrPlanNotPurchasable);
    }

    if (this.testMode) {
      const providerPaymentID = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const payment = this.repo.createPayment(
        guildID, userID, planKey, 'mock', providerPaymentID,
        plan.priceMinor, plan.currency, StatusPending
      );

      const checkout = createCheckout('mock', providerPaymentID, StatusPending, null);

      return { checkout, payment };
    }

    throw new Error(ErrPaymentProviderUnavailable);
  }

  confirmPayment(reference, guildID, userID) {
    if (!reference) {
      throw new Error(ErrReferenceRequired);
    }
    if (!guildID) {
      throw new Error(ErrGuildRequired);
    }
    if (!userID) {
      throw new Error(ErrUserRequired);
    }
    if (!this.testMode) {
      throw new Error(ErrPaymentProviderUnavailable);
    }

    const payment = this.repo.getPaymentByReference('mock', reference);
    if (!payment) {
      throw new Error(ErrPaymentNotFound);
    }
    if (guildID && payment.guildID !== guildID) {
      throw ErrPaymentBelongsToGuild;
    }
    if (userID && payment.userID !== userID) {
      throw ErrPaymentBelongsToUser;
    }

    if (this.premiumService && this.premiumService.isPremiumPlanKey(payment.planKey)) {
      this.premiumService.assertPaymentMatchesPlan(payment);
    }

    if (payment.status === StatusPaid) {
      return { payment, activated: false };
    }
    if (payment.status !== StatusPending) {
      throw ErrPaymentNotPending;
    }

    const updated = this.repo.updatePaymentStatus(payment.id, StatusPaid, new Date());
    if (!updated) {
      throw ErrPaymentNotPending;
    }

    let activated = false;
    if (this.premiumService && this.premiumService.isPremiumPlanKey(payment.planKey)) {
      this.premiumService.activateFromPayment(this.repo.getPaymentByID(payment.id));
      activated = true;
    }

    return { payment: this.repo.getPaymentByID(payment.id), activated };
  }

  getPayment(guildID, userID, reference) {
    if (!reference) {
      return null;
    }
    const payment = this.repo.getPaymentByReference('mock', reference);
    if (!payment) {
      return null;
    }
    if (payment.guildID !== guildID || payment.userID !== userID) {
      return null;
    }
    return payment;
  }

  testModeEnabled() {
    return this.testMode;
  }
}

module.exports = { PaymentsService };