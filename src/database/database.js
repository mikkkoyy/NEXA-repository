const sqlite = require('better-sqlite3');

class Database {
  constructor(dbPath) {
    this.db = sqlite(dbPath);
    this.db.pragma('busy_timeout = 5000');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('journal_mode = WAL');
  }

  exec(statement, params = []) {
    const stmt = this.db.prepare(statement);
    return stmt.run(...params);
  }

  get(statement, params = []) {
    const stmt = this.db.prepare(statement);
    return stmt.get(...params);
  }

  all(statement, params = []) {
    const stmt = this.db.prepare(statement);
    return stmt.all(...params);
  }

  close() {
    this.db.close();
  }

  serialize() {
    return this.db.serialize();
  }
}

module.exports = Database;