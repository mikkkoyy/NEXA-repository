const { migrate } = require('./src/database/schema');
const Database = require('./src/database/database');
const db = new Database(':memory:');
migrate(db);
console.log('Schema applied successfully');
const row = db.db.prepare('SELECT name FROM sqlite_master WHERE type="table" AND name="creator_profiles"').get();
console.log('Table creator_profiles exists:', row ? 'YES' : 'NO');
db.close();