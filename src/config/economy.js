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
    monthly: 99
  }
};

// Payment plans store prices in minor units. Premium.monthly is expressed in
// whole PHP units, so convert to minor units when storing.
const MinorUnitsPerPhp = 100;

function premiumMonthlyMinor() {
  return economy.premium.monthly * MinorUnitsPerPhp;
}

module.exports = {
  economy,
  MinorUnitsPerPhp,
  premiumMonthlyMinor
};