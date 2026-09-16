const { PaymentsRepository } = require('./repository');
const {
  CurrencyPHP,
  StatusPending,
  StatusPaid,
  ErrGuildRequired,
  ErrUserRequired,
  ErrPlanNotPurchasable,
  ErrPaymentProviderUnavailable,
  ErrPaymentNotFound,
  ErrReferenceRequired,
  DefaultPricePremiumMinor,
  createCheckout
} = require('./model');

class PaymentsService {
  constructor(paymentsRepo, testMode) {
    this.repo = paymentsRepo;
    this.testMode = testMode || false;
  }

  setTestMode(enabled) {
    this.testMode = enabled;
  }

  buyPremium(guildID, userID, planKey) {
    if (!guildID) {
      throw new Error(ErrGuildRequired);
    }
    if (!userID) {
      throw new Error(ErrUserRequired);
    }

    // Get the product/plan
    const product = this.repo.getPaymentByID(1); // Simplified - would look up by plan key
    if (!product) {
      throw new Error(ErrPlanNotPurchasable);
    }

    // In test mode with mock provider, create a mock checkout
    if (this.testMode) {
      const providerPaymentID = `mock_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const payment = this.repo.createPayment(
        guildID, userID, planKey, 'mock', providerPaymentID,
        product ? product.priceMinor : DefaultPricePremiumMinor,
        product ? product.currency : CurrencyPHP,
        StatusPending
      );

      // Create a mock checkout
      const checkout = createCheckout('mock', providerPaymentID, StatusPending, null);

      return { checkout, payment };
    }

    // In production, would require actual provider
    throw new Error(ErrPaymentProviderUnavailable);
  }

  confirmPayment(reference) {
    if (!reference) {
      throw new ErrReferenceRequired;
    }

    const payment = this.repo.getPaymentByReference(null, 'mock', reference);
    if (!payment) {
      throw new ErrPaymentNotFound;
    }

    // In test mode, simulate payment verification
    if (this.testMode) {
      // Simulate successful payment
      this.repo.updatePaymentStatus(payment.id, StatusPaid, new Date());
      return { payment, activated: true };
    }

    // In production, would verify with provider
    throw new ErrPaymentProviderUnavailable;
  }

  testModeEnabled() {
    return this.testMode;
  }
}

module.exports = { PaymentsService };