// World model and constants.
const WorldMoodCalm = 'Calm';
const WorldMoodBloom = 'Bloom';
const WorldMoodStorm = 'Storm';
const WorldMoodEclipse = 'Eclipse';

// World state represents a guild's pulse/status.
function createWorldState(guildID, pulse, createdAt, updatedAt, status) {
  return {
    guildID, pulse, status, createdAt, updatedAt
  };
}

// Mood lookup by pulse value.
function currentMood(pulse) {
  if (pulse === 0) return WorldMoodCalm;
  if (pulse <= 10) return WorldMoodBloom;
  if (pulse <= 25) return WorldMoodStorm;
  return WorldMoodEclipse;
}

// Status text for pulse = 0 vs pulse > 0.
function statusText(pulse) {
  return pulse === 0 ? 'Awake' : 'Active';
}

module.exports = {
  WorldMoodCalm,
  WorldMoodBloom,
  WorldMoodStorm,
  WorldMoodEclipse,
  currentMood,
  statusText,
  createWorldState
};