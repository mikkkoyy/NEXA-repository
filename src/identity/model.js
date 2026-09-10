/**
 * src/identity/model.js
 * 
 * Shared mathematical utilities and invariants for the NEXA Identity system.
 */

// Cap level calculations to prevent integer overflow or infinite loops
const LEVEL_CAP = 1_000_000;

/**
 * Calculates the total cumulative XP required to reach a specific level.
 * Formula: 25 * (level - 1) * (level + 2)
 * 
 * @param {number} level - The target level 
 * @returns {number} The total cumulative XP required
 */
function xpForLevel(level) {
  if (level < 1) return 0;
  if (level > LEVEL_CAP) level = LEVEL_CAP;

  return 25 * (level - 1) * (level + 2);
}

/**
 * Calculates the current level based on total cumulative XP.
 * Derived using the quadratic formula from the xpForLevel equation.
 * 
 * @param {number} xp - The total cumulative XP 
 * @returns {number} The current level (minimum of 1)
 */
function levelForXP(xp) {
  if (xp <= 0) return 1;

  const scaled = Math.floor(xp / 25);
  const discriminant = 1 + 4 * (scaled + 2);

  let level = Math.floor((Math.sqrt(discriminant) - 1) / 2);

  if (level < 1) level = 1;
  if (level > LEVEL_CAP) level = LEVEL_CAP;

  // Bound check safety loops to handle floating-point precision edge cases
  while (level < LEVEL_CAP && xpForLevel(level + 1) <= xp) {
    level++;
  }

  while (level > 1 && xpForLevel(level) > xp) {
    level--;
  }

  return level;
}

/**
 * Calculates progress metrics toward the next level milestone.
 * Useful for building progress bars or display embeds.
 * 
 * @param {number} xp - Total current cumulative XP 
 * @param {number} level - Current calculated level 
 * @returns {Object} Progress values relative to the level boundaries
 */
function progressFor(xp, level) {
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  
  return {
    current: Math.max(0, xp - base),
    needed: next - base
  };
}

// CommonJS Exports matching the layout expected by your profile command
module.exports = {
  XPForLevel: xpForLevel,
  LevelForXP: levelForXP,
  ProgressFor: progressFor,
  LEVEL_CAP
};
