const Database = require('../database/database');
const { premiumPlanDefinitions } = require('../config/economy');
const {
  CurrencyPHP,
  StatusPending,
  StatusPaid,
  StatusFailed,
  StatusCancelled,
  StatusRefunded,
  StatusExpired,
  DefaultPricePremiumMinor,
  DefaultPremiumDurationDays,
  ProductPlanKey,
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
  formatTime,
  parseTime
} = require('./model');

const allowedStatusTransitions = {
  [StatusPending]: new Set([StatusPaid, StatusFailed, StatusCancelled, StatusExpired]),
  [StatusPaid]: new Set([StatusRefunded]),
  [StatusFailed]: new Set([StatusPending]),
  [StatusCancelled]: new Set(),
  [StatusRefunded]: new Set(),
  [StatusExpired]: new Set()
};

class PaymentsRepository {
  constructor(db) {
    this.db = db; // Database instance
  }

  ensurePlans(dbRef) {
    const planDefs = premiumPlanDefinitions();
    const plans = [
      {
        planKey: ProductPlanKey,
        durationDays: DefaultPremiumDurationDays,
        priceMinor: DefaultPricePremiumMinor,
        currency: CurrencyPHP,
        enabled: true
      },
      ...planDefs.map(p => ({
        planKey: p.key,
        durationDays: p.durationDays,
        priceMinor: p.pricePhp * 100,
        currency: CurrencyPHP,
        enabled: true
      }))
    ];
    const now = formatTime(new Date());

    for (const p of plans) {
      const existing = dbRef.get(
        `SELECT plan_key FROM payment_plans WHERE plan_key = ?`,
        [p.planKey]
      );

      if (!existing) {
        dbRef.exec(
          `INSERT INTO payment_plans (plan_key, duration_days, price_minor, currency, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?)`,
          [p.planKey, p.durationDays, p.priceMinor, p.currency, now, now]
        );
      } else {
        dbRef.exec(
          `UPDATE payment_plans SET duration_days = ?, price_minor = ?, currency = ?, enabled = ?, updated_at = ? WHERE plan_key = ?`,
          [p.durationDays, p.priceMinor, p.currency, p.enabled ? 1 : 0, now, p.planKey]
        );
      }
    }
  }

  getPlanByKey(planKey) {
    if (!planKey) {
      return null;
    }
    const row = this.db.db.prepare(
      `SELECT plan_key, duration_days, price_minor, currency, enabled, created_at, updated_at FROM payment_plans WHERE plan_key = ?`
    ).get(planKey);

    if (!row) return null;

    return {
      planKey: row.plan_key,
      durationDays: row.duration_days,
      priceMinor: row.price_minor,
      currency: row.currency,
      enabled: row.enabled === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  createPayment(guildID, userID, planKey, provider, providerPaymentID, amountMinor, currency, status) {
    if (!guildID) {
      throw new Error(ErrGuildRequired);
    }
    if (!userID) {
      throw new Error(ErrUserRequired);
    }
    if (!providerPaymentID) {
      throw new Error(ErrReferenceRequired);
    }
    if (amountMinor < 0) {
      throw new Error(ErrInvalidAmount);
    }
    if (currency !== CurrencyPHP && currency) {
      throw new Error(ErrInvalidCurrency);
    }

    const ts = new Date().toISOString();
    const finalStatus = status || StatusPending;

    const result = this.db.exec(
      `INSERT INTO payments (guild_id, user_id, plan_key, provider, provider_payment_id, amount_minor, currency, status, created_at, updated_at, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [guildID, userID, planKey, provider, providerPaymentID, amountMinor, currency, finalStatus, ts, ts, null]
    );

    return {
      id: result.lastInsertRowid,
      guildID, userID, planKey, provider, providerPaymentID, amountMinor, currency, status: finalStatus,
      createdAt: ts, updatedAt: ts, completedAt: null
    };
  }

  getPaymentByID(paymentID) {
    if (!paymentID) {
      return null;
    }
    const row = this.db.db.prepare(
      `SELECT id, guild_id, user_id, plan_key, provider, provider_payment_id, amount_minor, currency, status, created_at, updated_at, completed_at FROM payments WHERE id = ?`
    ).get(paymentID);

    if (!row) return null;

    return {
      id: row.id,
      guildID: row.guild_id,
      userID: row.user_id,
      planKey: row.plan_key,
      provider: row.provider,
      providerPaymentID: row.provider_payment_id,
      amountMinor: row.amount_minor,
      currency: row.currency,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at
    };
  }

  getPaymentByReference(provider, reference) {
    if (!reference) {
      return null;
    }
    const row = this.db.db.prepare(
      `SELECT id, guild_id, user_id, plan_key, provider, provider_payment_id, amount_minor, currency, status, created_at, updated_at, completed_at FROM payments WHERE provider = ? AND provider_payment_id = ?`
    ).get(provider, reference);

    if (!row) return null;

    return {
      id: row.id,
      guildID: row.guild_id,
      userID: row.user_id,
      planKey: row.plan_key,
      provider: row.provider,
      providerPaymentID: row.provider_payment_id,
      amountMinor: row.amount_minor,
      currency: row.currency,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at
    };
  }

  getPaymentsByGuildUser(guildID, userID, limit = 20) {
    if (!guildID || !userID) {
      return [];
    }
    const rows = this.db.db.prepare(
      `SELECT id, guild_id, user_id, plan_key, provider, provider_payment_id, amount_minor, currency, status, created_at, updated_at, completed_at FROM payments WHERE guild_id = ? AND user_id = ? ORDER BY created_at DESC LIMIT ?`
    ).all(guildID, userID, limit);

    return rows.map(row => ({
      id: row.id,
      guildID: row.guild_id,
      userID: row.user_id,
      planKey: row.plan_key,
      provider: row.provider,
      providerPaymentID: row.provider_payment_id,
      amountMinor: row.amount_minor,
      currency: row.currency,
      status: row.status,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at
    }));
  }

  updatePaymentStatus(paymentID, status, now) {
    if (!paymentID) {
      return false;
    }
    if (![StatusPending, StatusPaid, StatusFailed, StatusCancelled, StatusRefunded, StatusExpired].includes(status)) {
      return false;
    }
    const current = this.db.db.prepare(
      `SELECT status FROM payments WHERE id = ?`
    ).get(paymentID);
    if (!current) {
      return false;
    }
    if (current.status === status) {
      return true;
    }
    if (!allowedStatusTransitions[current.status]?.has(status)) {
      return false;
    }

    const ts = now.toISOString();

    const result = this.db.exec(
      `UPDATE payments SET status = ?, updated_at = ?, completed_at = CASE WHEN ? IN ('paid', 'cancelled', 'refunded') THEN ? ELSE completed_at END WHERE id = ?`,
      [status, ts, status, ts, paymentID]
    );

    return result.changes > 0;
  }
}

module.exports = { PaymentsRepository };