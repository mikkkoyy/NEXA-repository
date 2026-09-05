const { CreatorEarningsRepository } = require('../creator/earnings-repository');
const { PaymentsRepository } = require('../payments/repository');
const { StatusPaid, StatusPending, StatusFailed, StatusCancelled, StatusRefunded } = require('../payments/model');

class CreatorEarningsService {
  constructor(earningsRepo, paymentsRepo) {
    this.repo = earningsRepo;
    this.paymentsRepo = paymentsRepo;
  }

  async createEarning(guildId, userId, productId) {
    // Step 1: Verify creator exists and is active
    const creator = this._getCreator(guildId, userId);
    if (!creator) {
      return { success: false, error: 'NOT_CREATOR', message: 'You must be an active creator.' };
    }

    // Step 2: Verify the marketplace product exists and belongs to this creator
    const product = this._getProduct(guildId, productId);
    if (!product) {
      return { success: false, error: 'PRODUCT_NOT_FOUND', message: 'Marketplace product not found.' };
    }

    if (product.creatorId !== userId) {
      return { success: false, error: 'NOT_PRODUCT_OWNER', message: 'You do not own this product.' };
    }

    // Step 3: Verify the product is listed (active marketplace listing)
    if (product.listingStatus !== 'listed') {
      return { success: false, error: 'PRODUCT_NOT_LISTED', message: 'Product is not currently listed on the marketplace.' };
    }

    // Step 4: Verify the purchase exists and is linked to this product
    const purchase = this._getPurchaseForProduct(guildId, productId);
    if (!purchase) {
      return { success: false, error: 'PURCHASE_NOT_FOUND', message: 'No valid purchase found for this product.' };
    }

    // Step 5: Verify the payment is confirmed/paid
    const payment = this._getConfirmedPayment(purchase.paymentId);
    if (!payment) {
      return { success: false, error: 'PAYMENT_NOT_CONFIRMED', message: 'Payment has not been confirmed.' };
    }

    // Step 6: Calculate earnings
    const grossAmountMinor = purchase.amountMinor;
    const platformFeeMinor = Math.floor(grossAmountMinor * 20 / 100);
    const netAmountMinor = grossAmountMinor - platformFeeMinor;

    // Step 7: Create the earning record (idempotent - unique constraint on purchase_id)
    const createResult = this.repo.createEarning(
      guildId,
      userId,
      purchase.id,
      payment.id,
      productId,
      grossAmountMinor,
      purchase.currency
    );

    if (createResult.duplicate) {
      return {
        success: true,
        earning: createResult.earning,
        message: 'Earning already exists for this purchase (idempotent).',
      };
    }

    return {
      success: true,
      earning: createResult.earning,
      message: 'Earning recorded successfully.',
    };
  }

  _getCreator(guildId, userId) {
    try {
      const row = this.repo.db.db.prepare(
        'SELECT id, guild_id, user_id, status FROM creator_profiles WHERE guild_id = ? AND user_id = ?'
      ).get(guildId, userId);
      if (!row || row.status !== 'active') return null;
      return { id: row.id, guildId: row.guild_id, userId: row.userId };
    } catch {
      return null;
    }
  }

  _getProduct(guildId, productId) {
    try {
      const row = this.repo.db.db.prepare(
        'SELECT id, guild_id, creator_id, content_id, listing_status, created_at, updated_at FROM marketplace_products WHERE guild_id = ? AND id = ?'
      ).get(guildId, productId);
      if (!row) return null;
      return { id: row.id, guildId: row.guild_id, creatorId: row.creator_id, contentId: row.content_id, listingStatus: row.listing_status };
    } catch {
      return null;
    }
  }

  _getPurchaseForProduct(guildId, productId) {
    // Find the marketplace purchase linked to this product via product_id
    try {
      const row = this.repo.db.db.prepare(
        'SELECT id, guild_id, user_id, product_id, payment_id, amount_minor, currency, status as purchase_status FROM marketplace_purchases WHERE guild_id = ? AND product_id = ? AND status = ?'
      ).get(guildId, productId, 'paid');

      if (!row) return null;

      return {
        id: row.id,
        guildId: row.guild_id,
        userId: row.user_id,
        productId: row.product_id,
        paymentId: row.payment_id,
        amountMinor: row.amount_minor,
        currency: row.currency,
      };
    } catch {
      return null;
    }
  }

  _getConfirmedPayment(paymentId) {
    if (!paymentId) return null;
    try {
      const row = this.repo.db.db.prepare(
        'SELECT id, guild_id, user_id, amount_minor, currency, status, created_at, updated_at, completed_at FROM payments WHERE id = ?'
      ).get(paymentId);

      if (!row) return null;

      // Only allow earnings from paid or pending payments that can be confirmed
      if (row.status !== StatusPaid && row.status !== StatusPending) return null;

      return {
        id: row.id,
        guildId: row.guild_id,
        userId: row.user_id,
        amountMinor: row.amount_minor,
        currency: row.currency,
      };
    } catch {
      return null;
    }
  }

  getCreatorEarnings(guildId, userId) {
    // Verify creator owns this
    const creator = this._getCreator(guildId, userId);
    if (!creator) return { success: false, error: 'NOT_CREATOR', message: 'You are not a creator.' };

    const earnings = this.repo.getCreatorEarnings(guildId, userId);

    const grossTotal = earnings.reduce((sum, e) => sum + e.grossAmountMinor, 0);
    const feeTotal = earnings.reduce((sum, e) => sum + e.platformFeeMinor, 0);
    const netTotal = earnings.reduce((sum, e) => sum + e.netAmountMinor, 0);

    return {
      success: true,
      earnings,
      summary: {
        earningCount: earnings.length,
        grossTotal,
        platformFeeTotal: feeTotal,
        netTotal,
      },
    };
  }
}

module.exports = { CreatorEarningsService };