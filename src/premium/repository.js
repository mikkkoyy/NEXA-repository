const Database = require('../database/database');
const {
  PlanKeyFree,
  PlanKeyPremium,
  StatusActive,
  StatusExpired,
  StatusCancelled,
  ErrPlanNotFound,
  ErrPlanDisabled,
  ErrUnknownPlan,
  ErrTestModeDisabled,
  ErrInvalidDuration,
  errGuildRequired,
  DefaultDurationDays,
  formatTime,
  parseTime
} = require('./model');

class PremiumRepository {
  constructor(db) {
    this.db = db; // Database instance
  }

  ensurePlans(dbRef) {
    const plans = [
      {
        key: PlanKeyPremium,
        name: 'Premium',
        description: 'Premium membership',
        enabled: true
      }
    ];

    for (const p of plans) {
      const existing = dbRef.db.prepare(
        `SELECT id FROM premium_plans WHERE plan_key = ?`
      ).get(p.key);

      if (!existing) {
        dbRef.db.exec(
          `INSERT INTO premium_plans (plan_key, name, description, enabled, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
          [p.key, p.name, p.description, p.enabled, formatTime(new Date()), formatTime(new Date())]
        );
      }
    }
  }

  getPlan(guildID, key) {
    if (!key) {
      return null;
    }
    const row = this.db.db.prepare(
      `SELECT id, plan_key, name, description, enabled, created_at, updated_at FROM premium_plans WHERE plan_key = ?`
    ).get(key);

    if (!row) return null;

    return {
      id: row.id,
      key: row.plan_key,
      name: row.name,
      description: row.description,
      enabled: row.enabled === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
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
      // No entitlement = free default
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

    // Lazy expiration
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

  isPremium(guildID) {
    if (!guildID) {
      return false;
    }
    const view = this.getGuildPremium(guildID);
    return view && view.key === PlanKeyPremium && view.status === StatusActive;
  }

  activatePremiumTx(guildID, planKey, durationDays, now) {
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

    // Upsert the entitlement
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

  activateTestPremium(guildID, durationDays) {
    if (!guildID) {
      return false;
    }
    if (!this.repo) {
      // Check test mode
      return false;
    }
    if (durationDays <= 0) {
      return false;
    }
    if (durationDays > 90) {
      return false;
    }

    return this.activatePremiumTx(guildID, PlanKeyPremium, durationDays, new Date());
  }
}

module.exports = { PremiumRepository };