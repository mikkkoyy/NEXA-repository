// Premium model and constants.
const PlanKeyFree = 'free';
const PlanKeyPremium = 'premium';

const StatusActive = 'active';
const StatusExpired = 'expired';
const StatusCancelled = 'cancelled';

const ErrPlanNotFound = new Error('plan not found');
const ErrPlanDisabled = new Error('plan disabled');
const ErrUnknownPlan = new Error('unknown plan');
const ErrTestModeDisabled = new Error('test mode disabled');
const ErrInvalidDuration = new Error('invalid duration');

const errGuildRequired = new Error('guild id is required');

const DefaultDurationDays = 30;

// Plan represents a premium plan definition.
function createPlan(id, key, name, description, enabled, createdAt, updatedAt) {
  return {
    id, key, name, description, enabled, createdAt, updatedAt
  };
}

// MemberPremium represents a guild's premium entitlement.
function createMemberPremium(id, guildID, key, status, startedAt, expiresAt, createdAt, updatedAt) {
  return {
    id, guildID, key, status, startedAt, expiresAt, createdAt, updatedAt
  };
}

function formatTime(t) {
  return t.toISOString();
}

function parseTime(raw) {
  return new Date(raw);
}

module.exports = {
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
  createPlan,
  createMemberPremium,
  formatTime,
  parseTime
};