/**
 * src/config/economy.js
 *
 * Single source of truth for NEXA economy prices and rewards.
 *
 * Use these values instead of hardcoding prices in commands, services, or
 * repositories. The Discord-facing currency is NEXA Coin (integer amounts);
 * premium is billed in PHP minor units (1 PHP = 100 minor units).
 */

const economy = {
  currency: 'NEXA Coin',
  currencySymbol: '🪙',

  daily_reward: 100,

  shop: {
    xp_boost_2x_1h: 500,
    xp_boost_2x_24h: 2500,
    common_collectible: 1000,
    rare_collectible: 5000
  },

  premium: {
    currency: 'PHP',
    monthly: 49,
    quarterly: 129,
    yearly: 399
  },

  premiumPlans: {
    monthly: { durationDays: 30 },
    quarterly: { durationDays: 90 },
    yearly: { durationDays: 365 }
  },

  premiumBenefits: {
    xpMultiplier: 1.25,
    reputationMultiplier: 1.25,
    economyDailyBonus: 100,
    economyClaimSource: 'premium_daily'
  }
};

// Payment plans store prices in minor units. Premium prices are expressed in
// whole PHP units, so convert to minor units when storing.
const MinorUnitsPerPhp = 100;

function premiumMonthlyMinor() {
  return economy.premium.monthly * MinorUnitsPerPhp;
}

function premiumQuarterlyMinor() {
  return economy.premium.quarterly * MinorUnitsPerPhp;
}

function premiumYearlyMinor() {
  return economy.premium.yearly * MinorUnitsPerPhp;
}

const PlanKeyPremiumMonthly = 'premium_monthly';
const PlanKeyPremiumQuarterly = 'premium_quarterly';
const PlanKeyPremiumYearly = 'premium_yearly';

// Canonical premium plan definitions shared by the payments and premium modules.
function premiumPlanDefinitions() {
  return [
    {
      key: PlanKeyPremiumMonthly,
      name: 'Monthly',
      description: 'NEXA Premium for 30 days',
      pricePhp: economy.premium.monthly,
      durationDays: economy.premiumPlans.monthly.durationDays
    },
    {
      key: PlanKeyPremiumQuarterly,
      name: 'Quarterly',
      description: 'NEXA Premium for 90 days',
      pricePhp: economy.premium.quarterly,
      durationDays: economy.premiumPlans.quarterly.durationDays
    },
    {
      key: PlanKeyPremiumYearly,
      name: 'Yearly',
      description: 'NEXA Premium for 365 days',
      pricePhp: economy.premium.yearly,
      durationDays: economy.premiumPlans.yearly.durationDays
    }
  ];
}

module.exports = {
  economy,
  MinorUnitsPerPhp,
  premiumMonthlyMinor,
  premiumQuarterlyMinor,
  premiumYearlyMinor,
  PlanKeyPremiumMonthly,
  PlanKeyPremiumQuarterly,
  PlanKeyPremiumYearly,
  premiumPlanDefinitions
};