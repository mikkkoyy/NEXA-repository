const schemaStatements = [
`CREATE TABLE IF NOT EXISTS creator_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    display_name TEXT,
    bio TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(guild_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS creator_content (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    creator_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    content_type TEXT NOT NULL DEFAULT 'text',
    status TEXT NOT NULL DEFAULT 'draft',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    published_at TEXT,
    UNIQUE(guild_id, creator_id, title),
    FOREIGN KEY (creator_id) REFERENCES creator_profiles(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS member_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    username TEXT NOT NULL,
    display_name TEXT,
    xp INTEGER NOT NULL DEFAULT 0,
    level INTEGER NOT NULL DEFAULT 1,
    reputation INTEGER NOT NULL DEFAULT 0,
    message_count INTEGER NOT NULL DEFAULT 0,
    first_seen_at TEXT NOT NULL,
    last_active_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(guild_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS quests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    quest_key TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    objective_type TEXT NOT NULL,
    target INTEGER NOT NULL,
    xp_reward INTEGER NOT NULL,
    collectible_reward_key TEXT,
    duration_seconds INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(guild_id, quest_key)
  )`,
  `CREATE TABLE IF NOT EXISTS member_quests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    quest_id INTEGER NOT NULL,
    progress INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    started_at TEXT NOT NULL,
    completed_at TEXT,
    expires_at TEXT,
    reward_claimed INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(guild_id, user_id, quest_id),
    FOREIGN KEY (quest_id) REFERENCES quests(id)
  )`,
  `CREATE TABLE IF NOT EXISTS collectibles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    collectible_key TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    rarity TEXT NOT NULL,
    icon TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(guild_id, collectible_key)
  )`,
  `CREATE TABLE IF NOT EXISTS member_collectibles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    collectible_id INTEGER NOT NULL,
    source TEXT NOT NULL,
    obtained_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE(guild_id, user_id, collectible_id),
    FOREIGN KEY (collectible_id) REFERENCES collectibles(id)
  )`,
  `CREATE TABLE IF NOT EXISTS achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    achievement_key TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    objective_type TEXT NOT NULL,
    target INTEGER NOT NULL,
    reward_xp INTEGER NOT NULL DEFAULT 0,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(guild_id, achievement_key)
  )`,
  `CREATE TABLE IF NOT EXISTS member_achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    achievement_id INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'available',
    progress INTEGER NOT NULL DEFAULT 0,
    started_at TEXT NOT NULL,
    completed_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(guild_id, user_id, achievement_id),
    FOREIGN KEY (achievement_id) REFERENCES achievements(id)
  )`,
  `CREATE TABLE IF NOT EXISTS member_wallets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    balance INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(guild_id, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS economy_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    amount INTEGER NOT NULL,
    tx_type TEXT NOT NULL,
    source TEXT NOT NULL,
    reference_id TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS world_states (
    guild_id TEXT PRIMARY KEY,
    pulse INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS moderation_warnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    moderator_id TEXT NOT NULL,
    moderator_name TEXT NOT NULL DEFAULT '',
    reason TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS guild_settings (
    guild_id TEXT PRIMARY KEY,
    server_name TEXT NOT NULL DEFAULT '',
    nexa_name TEXT NOT NULL DEFAULT 'NEXA',
    welcome_enabled INTEGER NOT NULL DEFAULT 1,
    welcome_message TEXT NOT NULL DEFAULT '',
    quests_enabled INTEGER NOT NULL DEFAULT 1,
    collectibles_enabled INTEGER NOT NULL DEFAULT 1,
    achievements_enabled INTEGER NOT NULL DEFAULT 1,
    economy_enabled INTEGER NOT NULL DEFAULT 1,
    world_enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS guild_daily_analytics (
    guild_id TEXT NOT NULL,
    day TEXT NOT NULL,
    message_count INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    PRIMARY KEY (guild_id, day)
  )`,
  `CREATE TABLE IF NOT EXISTS guild_daily_active_members (
    guild_id TEXT NOT NULL,
    day TEXT NOT NULL,
    user_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (guild_id, day, user_id)
  )`,
  `CREATE TABLE IF NOT EXISTS premium_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    plan_key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS guild_premium (
    guild_id TEXT PRIMARY KEY,
    plan_key TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at TEXT NOT NULL,
    expires_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (plan_key) REFERENCES premium_plans(plan_key)
  )`,
  `CREATE TABLE IF NOT EXISTS payment_plans (
    plan_key TEXT PRIMARY KEY,
    duration_days INTEGER NOT NULL,
    price_minor INTEGER NOT NULL,
    currency TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    plan_key TEXT NOT NULL,
    provider TEXT NOT NULL,
    provider_payment_id TEXT NOT NULL,
    amount_minor INTEGER NOT NULL,
    currency TEXT NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT,
    UNIQUE(provider, provider_payment_id),
    FOREIGN KEY (plan_key) REFERENCES premium_plans(plan_key)
  )`,
  `CREATE TABLE IF NOT EXISTS marketplace_products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_key TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    product_type TEXT NOT NULL,
    duration_days INTEGER NOT NULL,
    price_minor INTEGER NOT NULL,
    currency TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    creator_id INTEGER,
    content_id INTEGER,
    listing_status TEXT NOT NULL DEFAULT 'unlisted',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS marketplace_purchases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    product_id INTEGER NOT NULL,
    payment_id INTEGER,
    status TEXT NOT NULL,
    amount_minor INTEGER NOT NULL,
    currency TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    completed_at TEXT,
    UNIQUE(guild_id, user_id, product_id, payment_id)
  )`,
  `CREATE TABLE IF NOT EXISTS creator_earnings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    creator_id INTEGER NOT NULL,
    purchase_id INTEGER NOT NULL,
    payment_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    gross_amount_minor INTEGER NOT NULL,
    platform_fee_minor INTEGER NOT NULL,
    net_amount_minor INTEGER NOT NULL,
    currency TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(purchase_id)
  )`,
  `CREATE TABLE IF NOT EXISTS creator_marketplace (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guild_id TEXT NOT NULL,
    creator_id INTEGER NOT NULL,
    content_id INTEGER NOT NULL,
    price_minor INTEGER NOT NULL,
    currency TEXT NOT NULL,
    listing_status TEXT NOT NULL DEFAULT 'unlisted',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(guild_id, creator_id, content_id)
  )`,
  `CREATE INDEX IF NOT EXISTS idx_quests_guild ON quests(guild_id)`,
  `CREATE INDEX IF NOT EXISTS idx_member_quests_lookup ON member_quests(guild_id, user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_collectibles_guild ON collectibles(guild_id)`,
  `CREATE INDEX IF NOT EXISTS idx_member_collectibles_lookup ON member_collectibles(guild_id, user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_member_collectibles_collectible ON member_collectibles(collectible_id)`,
  `CREATE INDEX IF NOT EXISTS idx_achievements_guild ON achievements(guild_id)`,
  `CREATE INDEX IF NOT EXISTS idx_member_achievements_lookup ON member_achievements(guild_id, user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_member_wallets_lookup ON member_wallets(guild_id, user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_economy_transactions_lookup ON economy_transactions(guild_id, user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_creator_content_guild ON creator_content(guild_id)`,
  `CREATE INDEX IF NOT EXISTS idx_creator_content_creator ON creator_content(creator_id)`,
  `CREATE INDEX IF NOT EXISTS idx_creator_content_status ON creator_content(status)`,
  `CREATE INDEX IF NOT EXISTS idx_marketplace_products_creator ON marketplace_products(creator_id)`,
  `CREATE INDEX IF NOT EXISTS idx_marketplace_products_content ON marketplace_products(content_id)`,
  `CREATE INDEX IF NOT EXISTS idx_marketplace_products_listing ON marketplace_products(listing_status)`,
  `CREATE INDEX IF NOT EXISTS idx_creator_marketplace_creator ON creator_marketplace(creator_id)`,
  `CREATE INDEX IF NOT EXISTS idx_creator_marketplace_content ON creator_marketplace(content_id)`,
  `CREATE INDEX IF NOT EXISTS idx_creator_marketplace_guild ON creator_marketplace(guild_id)`,
  `CREATE INDEX IF NOT EXISTS idx_creator_earnings_creator ON creator_earnings(creator_id)`,
  `CREATE INDEX IF NOT EXISTS idx_creator_earnings_purchase ON creator_earnings(purchase_id)`,
  `CREATE INDEX IF NOT EXISTS idx_creator_earnings_guild ON creator_earnings(guild_id)`
];

function migrate(db) {
  for (const statement of schemaStatements) {
    db.exec(statement);
  }
  // Add collectible_reward_key column if missing (migration for existing databases)
  try {
    const result = db.db.prepare("PRAGMA table_info('quests')").all();
    const columns = result.map(r => r.name);
    if (!columns.includes('collectible_reward_key')) {
      db.exec('ALTER TABLE quests ADD COLUMN collectible_reward_key TEXT');
    }
  } catch (e) {
    // Column may already exist
  }
  // Add enabled column to premium_plans if missing
  try {
    const result = db.db.prepare("PRAGMA table_info('premium_plans')").all();
    const columns = result.map(r => r.name);
    if (!columns.includes('enabled')) {
      db.exec('ALTER TABLE premium_plans ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1');
    }
  } catch (e) {
    // Column may already exist
  }
  // Add enabled column to guild_premium if missing
  try {
    const result = db.db.prepare("PRAGMA table_info('guild_premium')").all();
    const columns = result.map(r => r.name);
    if (!columns.includes('enabled')) {
      db.exec('ALTER TABLE guild_premium ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1');
    }
  } catch (e) {
    // Column may already exist
  }
  // Add status column to guild_premium if missing
  try {
    const result = db.db.prepare("PRAGMA table_info('guild_premium')").all();
    const columns = result.map(r => r.name);
    if (!columns.includes('status')) {
      db.exec('ALTER TABLE guild_premium ADD COLUMN status TEXT NOT NULL');
    }
  } catch (e) {
    // Column may already exist
  }
  // Add columns to payments if missing
  try {
    const result = db.db.prepare("PRAGMA table_info('payments')").all();
    const columns = result.map(r => r.name);
    if (!columns.includes('provider')) {
      db.exec('ALTER TABLE payments ADD COLUMN provider TEXT NOT NULL');
    }
    if (!columns.includes('provider_payment_id')) {
      db.exec('ALTER TABLE payments ADD COLUMN provider_payment_id TEXT NOT NULL');
    }
    if (!columns.includes('completed_at')) {
      db.exec('ALTER TABLE payments ADD COLUMN completed_at TEXT');
    }
  } catch (e) {
    // Column may already exist
  }
  // Add columns to marketplace_products if missing
  try {
    const result = db.db.prepare("PRAGMA table_info('marketplace_products')").all();
    const columns = result.map(r => r.name);
    if (!columns.includes('product_key')) {
      db.exec('ALTER TABLE marketplace_products ADD COLUMN product_key TEXT NOT NULL UNIQUE');
    }
    if (!columns.includes('enabled')) {
      db.exec('ALTER TABLE marketplace_products ADD COLUMN enabled INTEGER NOT NULL DEFAULT 1');
    }
    if (!columns.includes('creator_id')) {
      db.exec('ALTER TABLE marketplace_products ADD COLUMN creator_id INTEGER');
    }
    if (!columns.includes('content_id')) {
      db.exec('ALTER TABLE marketplace_products ADD COLUMN content_id INTEGER');
    }
    if (!columns.includes('listing_status')) {
      db.exec('ALTER TABLE marketplace_products ADD COLUMN listing_status TEXT NOT NULL');
      db.exec("UPDATE marketplace_products SET listing_status = 'unlisted' WHERE listing_status IS NULL");
    }
  } catch (e) {
    // Column may already exist
  }
// Add earnings columns to creator_earnings if missing
  try {
    const result = db.db.prepare("PRAGMA table_info('creator_earnings')").all();
    const columns = result.map(r => r.name);
    if (!columns.includes('gross_amount_minor')) {
      db.exec('ALTER TABLE creator_earnings ADD COLUMN gross_amount_minor INTEGER');
    }
    if (!columns.includes('platform_fee_minor')) {
      db.exec('ALTER TABLE creator_earnings ADD COLUMN platform_fee_minor INTEGER');
    }
    if (!columns.includes('net_amount_minor')) {
      db.exec('ALTER TABLE creator_earnings ADD COLUMN net_amount_minor INTEGER');
    }
    if (!columns.includes('currency')) {
      db.exec('ALTER TABLE creator_earnings ADD COLUMN currency TEXT');
      db.exec("UPDATE creator_earnings SET currency = 'PHP' WHERE currency IS NULL");
    }
    if (!columns.includes('status')) {
      db.exec('ALTER TABLE creator_earnings ADD COLUMN status TEXT');
    }
    if (!columns.includes('purchase_id')) {
      db.exec('ALTER TABLE creator_earnings ADD COLUMN purchase_id INTEGER');
    }
    if (!columns.includes('payment_id')) {
      db.exec('ALTER TABLE creator_earnings ADD COLUMN payment_id INTEGER');
    }
    if (!columns.includes('product_id')) {
      db.exec('ALTER TABLE creator_earnings ADD COLUMN product_id INTEGER');
    }
    if (!columns.includes('creator_id')) {
      db.exec('ALTER TABLE creator_earnings ADD COLUMN creator_id INTEGER');
    }
if (!columns.includes('guild_id')) {
      db.exec('ALTER TABLE creator_earnings ADD COLUMN guild_id TEXT');
    }
  } catch (e) {
    // Column may already exist
  }
  // Add creator_marketplace table if missing
  try {
    const result = db.db.prepare("PRAGMA table_info('creator_marketplace')").all();
    const columns = result.map(r => r.name);
    if (columns.length === 0) {
      db.exec(`CREATE TABLE IF NOT EXISTS creator_marketplace (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        guild_id TEXT NOT NULL,
        creator_id INTEGER NOT NULL,
        content_id INTEGER NOT NULL,
        price_minor INTEGER NOT NULL,
        currency TEXT NOT NULL,
        listing_status TEXT NOT NULL DEFAULT 'unlisted',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        UNIQUE(guild_id, creator_id, content_id)
      )`);
    }
  } catch (e) {
    // Table may already exist
  }
  // Add columns to marketplace_purchases if missing
  try {
    const result = db.db.prepare("PRAGMA table_info('marketplace_purchases')").all();
    const columns = result.map(r => r.name);
    if (!columns.includes('product_id')) {
      db.exec('ALTER TABLE marketplace_purchases ADD COLUMN product_id INTEGER NOT NULL');
    }
    if (!columns.includes('payment_id')) {
      db.exec('ALTER TABLE marketplace_purchases ADD COLUMN payment_id INTEGER');
    }
    if (!columns.includes('status')) {
      db.exec('ALTER TABLE marketplace_purchases ADD COLUMN status TEXT NOT NULL');
    }
    if (!columns.includes('currency')) {
      db.exec('ALTER TABLE marketplace_purchases ADD COLUMN currency TEXT NOT NULL');
    }
    if (!columns.includes('amount_minor')) {
      db.exec('ALTER TABLE marketplace_purchases ADD COLUMN amount_minor INTEGER NOT NULL');
    }
  } catch (e) {
    // Column may already exist
  }
}

module.exports = { migrate };