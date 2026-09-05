const Database = require('../database/database');
const {
  CurrencyName,
  StartingBalance,
  TxEarn,
  TxSpend,
  ErrInsufficientBalance,
  ErrInvalidAmount,
  ErrNoSuchWallet,
  errGuildRequired,
  errGuildUserRequired,
  formatTime,
  parseTime,
  createWallet,
  createTransaction
} = require('./model');

class EconomyRepository {
  constructor(db) {
    this.db = db; // Database instance
  }

  ensureWallet(guildID, userID, now) {
    if (!guildID || !userID) {
      throw new Error('guild id and user id are required');
    }
    const ts = formatTime(now);

    const existing = this.db.db.prepare(
      `SELECT id FROM member_wallets WHERE guild_id = ? AND user_id = ?`
    ).get(guildID, userID);

    if (existing) {
      return existing.id;
    }

    const result = this.db.exec(
      `INSERT INTO member_wallets
        (guild_id, user_id, balance, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)`,
      [guildID, userID, StartingBalance, ts, ts]
    );
    return result.lastInsertRowid;
  }

  getWallet(guildID, userID) {
    const row = this.db.db.prepare(
      `SELECT id, guild_id, user_id, balance, created_at, updated_at
       FROM member_wallets WHERE guild_id = ? AND user_id = ?`
    ).get(guildID, userID);

    if (!row) return null;
    return createWallet(
      row.id, row.guild_id, row.user_id, row.balance,
      parseTime(row.created_at), parseTime(row.updated_at)
    );
  }

  getBalance(guildID, userID) {
    const wallet = this.getWallet(guildID, userID);
    if (!wallet) {
      return StartingBalance;
    }
    return wallet.balance;
  }

  addBalanceTx(guildID, userID, amount, source, referenceID, now) {
    if (!guildID || !userID) {
      throw new Error('guild id and user id are required');
    }
    if (typeof amount !== 'number' || amount <= 0 || !Number.isInteger(amount)) {
      throw new Error('Invalid amount: must be a positive integer');
    }

    const ts = formatTime(now);
    const walletID = this.ensureWallet(guildID, userID, now);

    this.db.exec(
      `UPDATE member_wallets SET balance = balance + ?, updated_at = ? WHERE id = ?`,
      [amount, ts, walletID]
    );

    this.db.exec(
      `INSERT INTO economy_transactions
        (guild_id, user_id, amount, tx_type, source, reference_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [guildID, userID, amount, TxEarn, source, referenceID || null, ts]
    );

    return this.getBalance(guildID, userID);
  }

  subtractBalanceTx(guildID, userID, amount, source, referenceID, now) {
    if (!guildID || !userID) {
      throw new Error('guild id and user id are required');
    }
    if (typeof amount !== 'number' || amount <= 0 || !Number.isInteger(amount)) {
      throw new Error('Invalid amount: must be a positive integer');
    }

    const ts = formatTime(now);
    const walletID = this.ensureWallet(guildID, userID, now);

    const wallet = this.getWallet(guildID, userID);
    if (wallet.balance < amount) {
      throw ErrInsufficientBalance;
    }

    this.db.exec(
      `UPDATE member_wallets SET balance = balance - ?, updated_at = ? WHERE id = ?`,
      [amount, ts, walletID]
    );

    this.db.exec(
      `INSERT INTO economy_transactions
        (guild_id, user_id, amount, tx_type, source, reference_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [guildID, userID, amount, TxSpend, source, referenceID || null, ts]
    );

    return this.getBalance(guildID, userID);
  }

  getTransactions(guildID, userID, limit = 20) {
    const rows = this.db.db.prepare(
      `SELECT id, guild_id, user_id, amount, tx_type, source, reference_id, created_at
       FROM economy_transactions
       WHERE guild_id = ? AND user_id = ?
       ORDER BY created_at DESC
       LIMIT ?`
    ).all(guildID, userID, limit);

    return rows.map(row => createTransaction(
      row.id, row.guild_id, row.user_id, row.amount, row.tx_type,
      row.source, row.reference_id, parseTime(row.created_at)
    ));
  }

  getTransactionCount(guildID, userID) {
    const row = this.db.db.prepare(
      `SELECT COUNT(*) as cnt FROM economy_transactions WHERE guild_id = ? AND user_id = ?`
    ).get(guildID, userID);

    return row ? row.cnt : 0;
  }
}

module.exports = { EconomyRepository };