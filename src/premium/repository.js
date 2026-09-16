const Database = require('../database/database');
const { premiumPlanDefinitions } = require('../config/economy');
const {
  PlanKeyFree,
  PlanKeyPremium,
  PlanKeyPremiumMonthly,
  PlanKeyPremiumQuarterly,
  PlanKeyPremiumYearly,
  StatusActive,
  StatusExpired,
  StatusCancelled,
  ErrPlanNotFound,
  ErrPlanDisabled,
  ErrUnknownPlan,
  ErrTestModeDisabled,
  ErrInvalidDuration,
  errGuildRequired,
  errUserRequired,
  DefaultDurationDays,
  createPlan,
  createMemberPremium,
  createUserPremium,
  formatTime,
  parseTime
} = require('./model');

class PremiumRepository {
  constructor(db) {
    this.db = db; // Database instance
  }

  ensurePlans(dbRef) {
    const planDefs = premiumPlanDefinitions();
    const plans = [
      {
        key: PlanKeyPremium,
        name: 'Premium',
        description: 'Premium membership',
        enabled: true
      },
      ...planDefs.map(p => ({
        key: p.key,
        name: p.name,
        description: p.description,
        enabled: true
      }))
    ];

    for (const p of plans) {
      const existing = dbRef.get(
        `SELECT id FROM premium_plans WHERE plan_key = ?`,
        [p.key]
      );

      if (!existing) {
        dbRef.exec(
          `INSERT INTO premium_plans (plan_key, name, description, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
          [p.key, p.name, p.description, p.enabled ? 1 : 0, formatTime(new Date()), formatTime(new Date())]
        );
      }
    }
  }

  isPremiumPlanKey(planKey) {
    return [
      PlanKeyPremium,
      PlanKeyPremiumMonthly,
      PlanKeyPremiumQuarterly,
      PlanKeyPremiumYearly
    ].includes(planKey);
  }

  getPlan(guildID, key) {
    if (!key) {
      return null;
    }
    const row = this.db.db.prepare(
      `SELECT id, plan_key, name, description, enabled, created_at, updated_at FROM premium_plans WHERE plan_key = ?`
    ).get(key);

    if (!row) return null;

    return createPlan(
      row.id, row.plan_key, row.name, row.description,
      row.enabled === 1, row.created_at, row.updated_at
    );
  }

  getGuildPremium(guildID) {
    if (!guildID) {
      return null;
    }
    const row = this.db.db.prepare(
      `SELECT gp.guild_id, gp.plan_key, gp.status, gp.started_at, gp.expires_at, gp.created_at, gp.updated_at,
              p.name, p.description, p.enabled
       FROM guild_premium gp
       JOIN premium_plans p ON gp.plan_key = p.plan_key
       WHERE gp.guild_id = ?`
    ).get(guildID);

    if (!row) {
      const plan = this.getPlan(guildID, PlanKeyFree);
      if (!plan) return null;

      return createMemberPremium(
        null, guildID, PlanKeyFree, StatusActive,
        formatTime(new Date()),
        null,
        formatTime(new Date()),
        formatTime(new Date())
      );
    }

    const plan = this.getPlan(guildID, row.plan_key);
    if (!plan) return null;

    let status = row.status;
    let expiresAt = row.expires_at ? new Date(row.expires_at) : null;

    if (status === StatusActive && expiresAt && new Date() > expiresAt) {
      status = StatusExpired;
    }

    return createMemberPremium(
      row.id, guildID, row.plan_key, status,
      row.started_at ? row.started_at : formatTime(new Date()),
      expiresAt,
      row.created_at,
      row.updated_at
    );
  }

  isGuildPremium(guildID) {
    if (!guildID) {
      return false;
    }
    const view = this.getGuildPremium(guildID);
    return view && view.key === PlanKeyPremium && view.status === StatusActive;
  }

  activateGuildPremiumTx(guildID, planKey, durationDays, now) {
    if (!guildID) {
      return false;
    }
    if (!planKey) {
      return false;
    }
    if (durationDays <= 0) {
      return false;
    }

    const startedAt = formatTime(now);
    const expiresAt = new Date(now.getTime() + durationDays * 86400000).toISOString();

    this.db.exec(
      `INSERT INTO guild_premium (guild_id, plan_key, status, started_at, expires_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(guild_id) DO UPDATE SET
         plan_key = excluded.plan_key,
         status = excluded.status,
         started_at = excluded.started_at,
         expires_at = excluded.expires_at,
         updated_at = excluded.updated_at`,
      [guildID, planKey, StatusActive, startedAt, expiresAt, formatTime(now), formatTime(now)]
    );

    return this.getGuildPremium(guildID);
  }

  activateTestGuildPremium(guildID, durationDays) {
    if (!guildID) {
      return false;
    }
    if (durationDays <= 0) {
      return false;
    }
    if (durationDays > 90) {
      return false;
    }

    return this.activateGuildPremiumTx(guildID, PlanKeyPremium, durationDays, new Date());
  }

  getUserPremium(guildID, userID, now) {
    if (!guildID || !userID) {
      return null;
    }
    const row = this.db.db.prepare(
      `SELECT up.id, up.guild_id, up.user_id, up.plan_key, up.status, up.started_at, up.expires_at,
              up.payment_id, up.payment_reference, up.economy_claim_date, up.created_at, up.updated_at
       FROM user_premium up
       WHERE up.guild_id = ? AND up.user_id = ?`
    ).get(guildID, userID);

    if (!row) return null;

    let status = row.status;
    let expiresAt = row.expires_at ? parseTime(row.expires_at) : null;
    const current = now || new Date();

    // Lazy expiration: entitlement is expired the moment expires_at passes.
    if (status === StatusActive && expiresAt && current > expiresAt) {
      status = StatusExpired;
    }

    return createUserPremium(
      row.id, row.guild_id, row.user_id, row.plan_key, status,
      row.started_at ? parseTime(row.started_at) : null,
      expiresAt,
      row.payment_id, row.payment_reference, row.economy_claim_date || null,
      row.created_at, row.updated_at
    );
  }

  isPremium(guildID, userID, now) {
    if (!guildID || !userID) {
      return false;
    }
    const view = this.getUserPremium(guildID, userID, now);
    return !!view && view.status === StatusActive && view.expiresAt && (now || new Date()) < view.expiresAt;
  }

  activateAfterPayment(guildID, userID, planKey, durationDays, paymentId, paymentReference, now) {
    if (!guildID || !userID || !planKey) {
      return null;
    }
    if (durationDays <= 0) {
      return null;
    }

    const baseNow = now || new Date();
    const existing = this.getUserPremium(guildID, userID, baseNow);
    const active = !!existing && existing.status === StatusActive && !!existing.expiresAt && existing.expiresAt > baseNow;

    // Renewal: an active entitlement is extended from its current expiry date.
    const base = active ? existing.expiresAt : baseNow;
    const expiresAt = new Date(base.getTime() + durationDays * 86400000);
    const ts = formatTime(baseNow);

    const tx = this.db.db.transaction(() => {
      // A payment may only activate premium once.
      if (paymentId != null) {
        const used = this.db.db.prepare(
          `SELECT id FROM user_premium WHERE payment_id = ?`
        ).get(paymentId);
        if (used) {
          return this.getUserPremium(guildID, userID, baseNow);
        }
      }

      this.db.exec(
        `INSERT INTO user_premium (guild_id, user_id, plan_key, status, started_at, expires_at, payment_id, payment_reference, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(guild_id, user_id) DO UPDATE SET
           plan_key = excluded.plan_key,
           status = excluded.status,
           started_at = excluded.started_at,
           expires_at = excluded.expires_at,
           payment_id = COALESCE(user_premium.payment_id, excluded.payment_id),
           payment_reference = COALESCE(user_premium.payment_reference, excluded.payment_reference),
           updated_at = excluded.updated_at`,
        [guildID, userID, planKey, StatusActive, formatTime(base), expiresAt.toISOString(), paymentId, paymentReference || null, ts, ts]
      );

      return this.getUserPremium(guildID, userID, baseNow);
    });

    return tx();
  }

  canClaimEconomyBonus(guildID, userID, date, now) {
    const view = this.getUserPremium(guildID, userID, now);
    if (!view || view.status !== StatusActive || !view.expiresAt) {
      return false;
    }
    return !view.economyClaimDate || view.economyClaimDate !== date;
  }

  markEconomyClaim(guildID, userID, date, now) {
    if (!guildID || !userID || !date) {
      return false;
    }
    const result = this.db.exec(
      `UPDATE user_premium SET economy_claim_date = ?, updated_at = ? WHERE guild_id = ? AND user_id = ?`,
      [date, formatTime(now || new Date()), guildID, userID]
    );
    return result.changes > 0;
  }
}

module.exports = { PremiumRepository };