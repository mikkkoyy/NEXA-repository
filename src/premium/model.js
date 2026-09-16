// Premium model and constants.
const PlanKeyFree = 'free';
const PlanKeyPremium = 'premium';
const PlanKeyPremiumMonthly = 'premium_monthly';
const PlanKeyPremiumQuarterly = 'premium_quarterly';
const PlanKeyPremiumYearly = 'premium_yearly';

const StatusActive = 'active';
const StatusExpired = 'expired';
const StatusCancelled = 'cancelled';

const ErrPlanNotFound = new Error('plan not found');
const ErrPlanDisabled = new Error('plan disabled');
const ErrUnknownPlan = new Error('unknown plan');
const ErrTestModeDisabled = new Error('test mode disabled');
const ErrInvalidDuration = new Error('invalid duration');
const ErrNotPremium = new Error('user is not premium');
const ErrPaymentNotPaid = new Error('payment is not confirmed as paid');
const ErrPaymentBelongsToGuild = new Error('payment belongs to a different guild');
const ErrPaymentBelongsToUser = new Error('payment belongs to a different user');
const ErrEconomyServiceRequired = new Error('economy service is required for premium claims');

const errGuildRequired = new Error('guild id is required');
const errUserRequired = new Error('user id is required');

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

// UserPremium represents a user's premium entitlement inside a guild.
function createUserPremium(id, guildID, userID, planKey, status, startedAt, expiresAt, paymentId, paymentReference, economyClaimDate, createdAt, updatedAt) {
  return {
    id, guildID, userID, planKey, status, startedAt, expiresAt,
    paymentId, paymentReference, economyClaimDate, createdAt, updatedAt
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
  ErrNotPremium,
  ErrPaymentNotPaid,
  ErrPaymentBelongsToGuild,
  ErrPaymentBelongsToUser,
  ErrEconomyServiceRequired,
  errGuildRequired,
  errUserRequired,
  DefaultDurationDays,
  createPlan,
  createMemberPremium,
  createUserPremium,
  formatTime,
  parseTime
};