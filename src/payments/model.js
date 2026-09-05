// Payments model and constants.
const CurrencyPHP = 'PHP';

const StatusPending = 'pending';
const StatusPaid = 'paid';
const StatusFailed = 'failed';
const StatusCancelled = 'cancelled';
const StatusRefunded = 'refunded';

const DefaultPricePremiumMinor = 5000; // PHP 50.00
const DefaultPremiumDurationDays = 30;
const ProductPlanKey = 'premium';
const DefaultPlatformFeePercent = 20; // 20% platform fee on creator sales

const ErrNoPaymentProvider = new Error('no payment provider configured');
const ErrPaymentProviderUnknown = new Error('configured payment provider is not implemented');
const ErrPaymentProviderUnavailable = new Error('configured payment provider is not available in this configuration');
const ErrPlanNotPurchasable = new Error('plan is not purchasable');
const ErrPaymentNotFound = new Error('payment not found');
const ErrPaymentNotPending = new Error('payment is not pending');
const ErrAmountMismatch = new Error('payment amount does not match the configured price');
const ErrCurrencyMismatch = new Error('payment currency does not match the configured currency');
const ErrGuildRequired = new Error('guild id is required');
const ErrUserRequired = new Error('user id is required');
const ErrReferenceRequired = new Error('payment reference is required');
const ErrInvalidStatus = new Error('invalid payment status');
const ErrInvalidCurrency = new Error('invalid currency');
const ErrInvalidAmount = new Error('invalid payment amount');

// Payment record.
function createPayment(id, guildID, userID, planKey, provider, providerPaymentID, amountMinor, currency, status, createdAt, updatedAt, completedAt) {
  return {
    id, guildID, userID, planKey, provider, providerPaymentID, amountMinor, currency, status, createdAt, updatedAt, completedAt
  };
}

// Checkout request.
function createCheckoutRequest(guildID, userID, planKey, amountMinor, currency) {
  return { guildID, userID, planKey, amountMinor, currency };
}

// Checkout response.
function createCheckout(provider, providerPaymentID, status, url) {
  return { provider, providerPaymentID, status, url };
}

module.exports = {
  CurrencyPHP,
  StatusPending,
  StatusPaid,
  StatusFailed,
  StatusCancelled,
  StatusRefunded,
  DefaultPricePremiumMinor,
  DefaultPremiumDurationDays,
  ProductPlanKey,
  DefaultPlatformFeePercent,
  ErrNoPaymentProvider,
  ErrPaymentProviderUnknown,
  ErrPaymentProviderUnavailable,
  ErrPlanNotPurchasable,
  ErrPaymentNotFound,
  ErrPaymentNotPending,
  ErrAmountMismatch,
  ErrCurrencyMismatch,
  ErrGuildRequired,
  ErrUserRequired,
  ErrReferenceRequired,
  ErrInvalidStatus,
  ErrInvalidCurrency,
  ErrInvalidAmount,
  createPayment,
  createCheckoutRequest,
  createCheckout
};