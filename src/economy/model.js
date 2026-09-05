// Economy model and constants.
// Currency: NEXA Coin (integer-based, guild-scoped).

const CurrencyName = 'NEXA Coin';
const CurrencySymbol = '🪙';

// Starting balance for new members.
const StartingBalance = 0;

// Transaction types.
const TxEarn = 'earn';
const TxSpend = 'spend';

// Sentinels returned by the service to guide command behavior.
const ErrInsufficientBalance = new Error('insufficient balance');
const ErrInvalidAmount = new Error('invalid amount');
const ErrNoSuchWallet = new Error('no such wallet');

const errGuildRequired = new Error('guild id is required');
const errGuildUserRequired = new Error('guild id and user id are required');

// Wallet represents a member's currency balance in a guild.
function createWallet(id, guildID, userID, balance, createdAt, updatedAt) {
  return {
    id, guildID, userID, balance, createdAt, updatedAt
  };
}

// Transaction represents a single currency movement.
function createTransaction(id, guildID, userID, amount, txType, source, referenceID, createdAt) {
  return {
    id, guildID, userID, amount, txType, source, referenceID, createdAt
  };
}

function formatTime(t) {
  return t.toISOString();
}

function parseTime(raw) {
  return new Date(raw);
}

module.exports = {
  CurrencyName,
  CurrencySymbol,
  StartingBalance,
  TxEarn,
  TxSpend,
  ErrInsufficientBalance,
  ErrInvalidAmount,
  ErrNoSuchWallet,
  errGuildRequired,
  errGuildUserRequired,
  createWallet,
  createTransaction,
  formatTime,
  parseTime
};