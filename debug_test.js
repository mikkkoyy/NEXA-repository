const Database = require('./src/database/database');
const { migrate } = require('./src/database/schema');
const { CreatorRepository } = require('./src/creator/repository');
const { CreatorService } = require('./src/creator/service');
const { CreatorContentRepository } = require('./src/creator/content-repository');
const { CreatorContentService } = require('./src/creator/content-service');

async function main() {
  const db = new Database(':memory:');
  migrate(db);

  const creatorRepo = new CreatorRepository(db);
  creatorRepo.ensureSchema();
  const creatorService = new CreatorService(creatorRepo);

  const contentRepo = new CreatorContentRepository(db);
  contentRepo.ensureSchema();
  const contentService = new CreatorContentService(contentRepo);

  // Create member profile
  db.exec(`INSERT INTO member_profiles (guild_id, user_id, username, display_name, xp, level, reputation, message_count, first_seen_at, last_active_at, created_at, updated_at) VALUES ('g1', 'u1', 'TestUser', 'TestUser', 0, 1, 0, 0, datetime('now'), datetime('now'), datetime('now'), datetime('now'))`);

  // Register creator
  const regResult = creatorService.registerCreator('g1', 'u1', 'TestUser');
  console.log('Register result:', JSON.stringify(regResult, null, 2));

  // Debug: check creator profile
  const creator = db.get('SELECT id, status FROM creator_profiles WHERE guild_id = ? AND user_id = ?', ['g1', 'u1']);
  console.log('Creator profile:', creator);

  // Check isCreatorActive
  const isActive = contentService.isCreatorActive('g1', 'u1');
  console.log('Is creator active:', isActive);

  // Check creator lookup in content service
  const creator2 = contentRepo.db.get('SELECT id FROM creator_profiles WHERE guild_id = ? AND user_id = ?', ['g1', 'u1']);
  console.log('Creator from content repo db:', creator2);

  // Try create content with more debugging
  try {
    const contentResult = await contentService.createContent('g1', 'u1', 'Test Content', 'Description');
    console.log('Content result:', JSON.stringify(contentResult, null, 2));
  } catch (e) {
    console.error('Error in createContent:', e);
  }

  db.close();
}

main();