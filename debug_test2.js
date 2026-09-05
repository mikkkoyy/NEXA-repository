const Database = require('./src/database/database');
const { migrate } = require('./src/database/schema');
const { CreatorRepository } = require('./src/creator/repository');
const { CreatorService } = require('./src/creator/service');
const { CreatorContentRepository } = require('./src/creator/content-repository');
const { CreatorContentService } = require('./src/creator/content-service');
const { CreatorMarketplaceRepository } = require('./src/creator/marketplace-repository');
const { CreatorMarketplaceService } = require('./src/creator/marketplace-service');

async function main() {
  const db = new Database(':memory:');
  migrate(db);

  const creatorRepo = new CreatorRepository(db);
  creatorRepo.ensureSchema();
  const creatorService = new CreatorService(creatorRepo);

  const contentRepo = new CreatorContentRepository(db);
  contentRepo.ensureSchema();
  const contentService = new CreatorContentService(contentRepo);

  const marketplaceRepo = new CreatorMarketplaceRepository(db);
  const marketplaceService = new CreatorMarketplaceService(marketplaceRepo);

  // Create member profile
  db.exec(`INSERT INTO member_profiles (guild_id, user_id, username, display_name, xp, level, reputation, message_count, first_seen_at, last_active_at, created_at, updated_at) VALUES ('g1', 'u1', 'TestUser', 'TestUser', 0, 1, 0, 0, datetime('now'), datetime('now'), datetime('now'), datetime('now'))`);

  // Register creator
  const regResult = creatorService.registerCreator('g1', 'u1', 'TestUser');
  console.log('Register result:', JSON.stringify(regResult, null, 2));

  // Create content
  const contentResult = await contentService.createContent('g1', 'u1', 'Test Content', 'Description');
  console.log('Content result:', JSON.stringify(contentResult, null, 2));

  // Publish content
  const publishResult = await contentService.publishContent('g1', 'u1', contentResult.content.id);
  console.log('Publish result:', JSON.stringify(publishResult, null, 2));

  // Create product
  const productResult = await marketplaceService.createProduct('g1', 'u1', contentResult.content.id, 5000, 'PHP');
  console.log('Product result:', JSON.stringify(productResult, null, 2));

  // List product
  const listResult = await marketplaceService.listProduct('g1', productResult.product.id, 'u1');
  console.log('List result:', JSON.stringify(listResult, null, 2));

  db.close();
}

main();