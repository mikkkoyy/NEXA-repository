const LEVEL_CAP = 1000000;

function xpForLevel(level) {
  if (level < 1) return 0;
  if (level > LEVEL_CAP) level = LEVEL_CAP;
  return 25 * (level - 1) * (level + 2);
}

function levelForXP(xp) {
  if (xp <= 0) return 1;
  const scaled = Math.floor(xp / 25);
  const discriminant = 1 + 4 * (scaled + 2);
  let level = Math.floor((Math.sqrt(discriminant) - 1) / 2);
  if (level < 1) level = 1;
  if (level > LEVEL_CAP) level = LEVEL_CAP;
  while (level < LEVEL_CAP && xpForLevel(level + 1) <= xp) level++;
  while (level > 1 && xpForLevel(level) > xp) level--;
  return level;
}

function progressFor(xp, level) {
  const base = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return {
    current: xp - base,
    needed: next - base
  };
}

module.exports = {
  XPForLevel: xpForLevel,
  LevelForXP: levelForXP,
  ProgressFor: progressFor,
  LEVEL_CAP
};