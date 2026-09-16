const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('creator')
    .setDescription('Creator Ecosystem management'),
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();

    if (subcommand === 'register') {
      return await this.handleRegister(interaction);
    }

    if (subcommand === 'status') {
      return await this.handleStatus(interaction);
    }

    if (subcommand === 'content-create') {
      return await this.handleContentCreate(interaction);
    }

    if (subcommand === 'content-list') {
      return await this.handleContentList(interaction);
    }

    if (subcommand === 'content-view') {
      return await this.handleContentView(interaction);
    }

    if (subcommand === 'content-publish') {
      return await this.handleContentPublish(interaction);
    }

    if (subcommand === 'content-unpublish') {
      return await this.handleContentUnpublish(interaction);
    }

    if (subcommand === 'product-create') {
      return await this.handleProductCreate(interaction);
    }

    if (subcommand === 'product-list') {
      return await this.handleProductList(interaction);
    }

    if (subcommand === 'product-view') {
      return await this.handleProductView(interaction);
    }

    if (subcommand === 'product-listing') {
      return await this.handleProductListing(interaction);
    }

    if (subcommand === 'product-unlist') {
      return await this.handleProductUnlist(interaction);
    }

    if (subcommand === 'earnings') {
      return await this.handleEarnings(interaction);
    }
  },

  async handleRegister(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const username = interaction.user.username;
    const displayName = interaction.member?.nickname || interaction.user.displayName || username;

    const service = interaction.client.creatorService;
    if (!service) {
      return interaction.reply({ content: 'The creator system is not available right now.', ephemeral: true });
    }

    const result = service.registerCreator(guildId, userId, displayName);

    if (!result.success) {
      return interaction.reply({ content: result.message, ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('Creator Registration Successful')
      .setColor(0x00FF00)
      .addFields(
        { name: 'Status', value: result.creator.status, inline: true },
        { name: 'Display Name', value: result.creator.displayName, inline: true }
      )
      .addFields({ name: 'Created At', value: result.creator.createdAt ? result.creator.createdAt.toLocaleString() : 'N/A', inline: true });

    await interaction.reply({ embeds: [embed] });
  },

  async handleStatus(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const service = interaction.client.creatorService;
    if (!service) {
      return interaction.reply({ content: 'The creator system is not available right now.', ephemeral: true });
    }

    const creator = service.getCreator(guildId, userId);

    if (!creator) {
      return interaction.reply({ content: 'You are not registered as a creator. Use /creator register to become one.', ephemeral: true });
    }

    const isActive = creator.status === 'active';

    const lines = [
      `Status: ${creator.status}`,
      `Display Name: ${creator.displayName || 'N/A'}`,
      `Bio: ${creator.bio || 'N/A'}`,
      `Member Since: ${creator.createdAt ? creator.createdAt.toLocaleDateString() : 'N/A'}`
    ];

    const embed = new EmbedBuilder()
      .setDescription('```\n' + lines.join('\n') + '\n```')
      .setColor(isActive ? 0x00FF00 : 0xFFAA00)
      .setFooter({ text: 'NEXA • Creator Status' });

    await interaction.reply({ embeds: [embed] });
  },

  async handleContentCreate(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const username = interaction.user.username;
    const displayName = interaction.member?.nickname || interaction.user.displayName || username;

    const title = interaction.options.getString('title');
    const description = interaction.options.getString('description') || '';

    const service = interaction.client.creatorService;
    const contentService = interaction.client.creatorContentService;
    if (!service || !contentService) {
      return interaction.reply({ content: 'The creator system is not available right now.', ephemeral: true });
    }

    const createResult = await contentService.createContent(guildId, userId, title, description);

    if (!createResult.success) {
      return interaction.reply({ content: createResult.message, ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('Content Created')
      .setColor(0x00FF00)
      .addFields(
        { name: 'Title', value: createResult.content.title, inline: true },
        { name: 'Status', value: createResult.content.status, inline: true },
        { name: 'Content Type', value: createResult.content.contentType, inline: true }
      )
      .addFields({ name: 'Created At', value: createResult.content.createdAt ? createResult.content.createdAt.toLocaleString() : 'N/A', inline: true });

    await interaction.reply({ embeds: [embed] });
  },

  async handleContentList(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const service = interaction.client.creatorService;
    const contentService = interaction.client.creatorContentService;
    if (!service || !contentService) {
      return interaction.reply({ content: 'The creator system is not available right now.', ephemeral: true });
    }

    const creatorCheck = service.isCreator(guildId, userId);
    if (!creatorCheck) {
      return interaction.reply({ content: 'You are not registered as a creator. Use /creator register to become one.', ephemeral: true });
    }

    const listResult = contentService.getCreatorContent(guildId, userId);

    if (listResult.content.length === 0) {
      return interaction.reply({ content: 'You have no content records yet. Use /creator content-create to create some.', ephemeral: true });
    }

    const lines = listResult.content.map(content => [
      `Title: ${content.title}`,
      `Status: ${content.status}`,
      `Created: ${content.createdAt ? content.createdAt.toLocaleDateString() : 'N/A'}`
    ].join(' | '));

    const embed = new EmbedBuilder()
      .setTitle('Your Content')
      .setDescription('```\n' + lines.join('\n') + '\n```')
      .setColor(0x00FF00)
      .setFooter({ text: 'NEXA • Creator Content' });

    await interaction.reply({ embeds: [embed] });
  },

  async handleContentView(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const contentId = interaction.options.getString('content_id');

    const service = interaction.client.creatorService;
    const contentService = interaction.client.creatorContentService;
    if (!service || !contentService) {
      return interaction.reply({ content: 'The creator system is not available right now.', ephemeral: true });
    }

    const creatorCheck = service.isCreator(guildId, userId);
    if (!creatorCheck) {
      return interaction.reply({ content: 'You are not registered as a creator.', ephemeral: true });
    }

    const content = contentService.getContent(guildId, contentId);

    if (!content) {
      return interaction.reply({ content: 'Content not found.', ephemeral: true });
    }

    const creator = service.getCreator(guildId, userId);
    if (!creator || content.creatorId !== creator.id) {
      return interaction.reply({ content: 'You do not own this content.', ephemeral: true });
    }

    const isPublished = content.status === 'published';
    const lines = [
      `Title: ${content.title}`,
      `Description: ${content.description || 'N/A'}`,
      `Status: ${content.status}`,
      `Content Type: ${content.contentType}`,
      `Created: ${content.createdAt ? content.createdAt.toLocaleDateString() : 'N/A'}`,
      `Published: ${content.publishedAt ? content.publishedAt.toLocaleDateString() : 'Not published'}`
    ];

    const embed = new EmbedBuilder()
      .setDescription('```\n' + lines.join('\n') + '\n```')
      .setColor(isPublished ? 0x00FF00 : 0xFFAA00)
      .setFooter({ text: 'NEXA • Creator Content View' });

    await interaction.reply({ embeds: [embed] });
  },

  async handleContentPublish(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const contentId = interaction.options.getString('content_id');

    const service = interaction.client.creatorService;
    const contentService = interaction.client.creatorContentService;
    if (!service || !contentService) {
      return interaction.reply({ content: 'The creator system is not available right now.', ephemeral: true });
    }

    const creatorCheck = service.isCreator(guildId, userId);
    if (!creatorCheck) {
      return interaction.reply({ content: 'You must be an active creator to publish content.', ephemeral: true });
    }

    const publishResult = contentService.publishContent(guildId, userId, contentId);

    if (!publishResult.success) {
      return interaction.reply({ content: publishResult.message, ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('Content Published')
      .setColor(0x00FF00)
      .addFields(
        { name: 'Title', value: publishResult.content.title, inline: true },
        { name: 'Status', value: publishResult.content.status, inline: true },
        { name: 'Published At', value: publishResult.content.publishedAt ? publishResult.content.publishedAt.toLocaleString() : 'N/A', inline: true }
      );

    await interaction.reply({ embeds: [embed] });
  },

  async handleContentUnpublish(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const contentId = interaction.options.getString('content_id');

    const service = interaction.client.creatorService;
    const contentService = interaction.client.creatorContentService;
    if (!service || !contentService) {
      return interaction.reply({ content: 'The creator system is not available right now.', ephemeral: true });
    }

    const creatorCheck = service.isCreator(guildId, userId);
    if (!creatorCheck) {
      return interaction.reply({ content: 'You must be an active creator to unpublish content.', ephemeral: true });
    }

    const unpublishResult = contentService.unpublishContent(guildId, userId, contentId);

    if (!unpublishResult.success) {
      return interaction.reply({ content: unpublishResult.message, ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('Content Unpublished')
      .setColor(0xFFAA00)
      .addFields(
        { name: 'Title', value: unpublishResult.content.title, inline: true },
        { name: 'Status', value: unpublishResult.content.status, inline: true }
      );

    await interaction.reply({ embeds: [embed] });
  },

  async handleProductCreate(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const username = interaction.user.username;
    const displayName = interaction.member?.nickname || interaction.user.displayName || username;

    const contentId = interaction.options.getString('content_id');
    const priceMinor = interaction.options.getInteger('price');

    const service = interaction.client.creatorService;
    const marketplaceService = interaction.client.creatorMarketplaceService;
    if (!service || !marketplaceService) {
      return interaction.reply({ content: 'The creator system is not available right now.', ephemeral: true });
    }

    const createResult = await marketplaceService.createProduct(guildId, userId, contentId, priceMinor, 'PHP');

    if (!createResult.success) {
      return interaction.reply({ content: createResult.message, ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('Marketplace Product Created')
      .setColor(0x00FF00)
      .addFields(
        { name: 'Content', value: createResult.product.contentId ? 'Linked content' : 'N/A', inline: true },
        { name: 'Price', value: `${createResult.product.priceMinor} PHP`, inline: true },
        { name: 'Listing Status', value: createResult.product.listingStatus, inline: true }
      );

    await interaction.reply({ embeds: [embed] });
  },

  async handleProductList(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const service = interaction.client.creatorService;
    const marketplaceService = interaction.client.creatorMarketplaceService;
    if (!service || !marketplaceService) {
      return interaction.reply({ content: 'The creator system is not available right now.', ephemeral: true });
    }

    const creatorCheck = service.isCreator(guildId, userId);
    if (!creatorCheck) {
      return interaction.reply({ content: 'You are not registered as a creator. Use /creator register to become one.', ephemeral: true });
    }

    const listResult = marketplaceService.getCreatorProducts(guildId, userId);

    if (listResult.products.length === 0) {
      return interaction.reply({ content: 'You have no marketplace products yet. Use /creator product-create to create some.', ephemeral: true });
    }

    const lines = listResult.products.map(product => [
      `Product ID: ${product.id}`,
      `Price: ${product.priceMinor} PHP`,
      `Status: ${product.listingStatus}`
    ].join(' | '));

    const embed = new EmbedBuilder()
      .setTitle('Your Marketplace Products')
      .setDescription('```\n' + lines.join('\n') + '\n```')
      .setColor(0x00FF00)
      .setFooter({ text: 'NEXA • Creator Marketplace' });

    await interaction.reply({ embeds: [embed] });
  },

  async handleProductView(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const productId = interaction.options.getString('product_id');

    const service = interaction.client.creatorService;
    const marketplaceService = interaction.client.creatorMarketplaceService;
    if (!service || !marketplaceService) {
      return interaction.reply({ content: 'The creator system is not available right now.', ephemeral: true });
    }

    const creatorCheck = service.isCreator(guildId, userId);
    if (!creatorCheck) {
      return interaction.reply({ content: 'You must be a creator to view products.', ephemeral: true });
    }

    const product = marketplaceService.getProduct(guildId, productId);

    if (!product) {
      return interaction.reply({ content: 'Product not found.', ephemeral: true });
    }

    const creator = service.getCreator(guildId, userId);
    if (!creator || product.creatorId !== creator.id) {
      return interaction.reply({ content: 'You do not own this product.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('Product Details')
      .setDescription(`Product ID: ${product.id}\nPrice: ${product.priceMinor} PHP\nListing Status: ${product.listingStatus}`)
      .setColor(0x00FF00)
      .setFooter({ text: 'NEXA • Creator Marketplace' });

    await interaction.reply({ embeds: [embed] });
  },

  async handleProductListing(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const productId = interaction.options.getString('product_id');

    const service = interaction.client.creatorService;
    const marketplaceService = interaction.client.creatorMarketplaceService;
    if (!service || !marketplaceService) {
      return interaction.reply({ content: 'The creator system is not available right now.', ephemeral: true });
    }

    const creatorCheck = service.isCreator(guildId, userId);
    if (!creatorCheck) {
      return interaction.reply({ content: 'You must be an active creator to list products.', ephemeral: true });
    }

    const listResult = marketplaceService.listProduct(guildId, productId, userId);

    if (!listResult.success) {
      return interaction.reply({ content: listResult.message, ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('Product Listed')
      .setColor(0x00FF00)
      .addFields(
        { name: 'Product ID', value: listResult.product.id, inline: true },
        { name: 'Price', value: `${listResult.product.priceMinor} PHP`, inline: true },
        { name: 'Listing Status', value: listResult.product.listingStatus, inline: true }
      );

    await interaction.reply({ embeds: [embed] });
  },

  async handleProductUnlist(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const productId = interaction.options.getString('product_id');

    const service = interaction.client.creatorService;
    const marketplaceService = interaction.client.creatorMarketplaceService;
    if (!service || !marketplaceService) {
      return interaction.reply({ content: 'The creator system is not available right now.', ephemeral: true });
    }

    const creatorCheck = service.isCreator(guildId, userId);
    if (!creatorCheck) {
      return interaction.reply({ content: 'You must be an active creator to unlist products.', ephemeral: true });
    }

    const unlistResult = marketplaceService.unlistProduct(guildId, productId, userId);

    if (!unlistResult.success) {
      return interaction.reply({ content: unlistResult.message, ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('Product Unlisted')
      .setColor(0xFFAA00)
      .addFields(
        { name: 'Product ID', value: unlistResult.product.id, inline: true },
        { name: 'Listing Status', value: unlistResult.product.listingStatus, inline: true }
      );

    await interaction.reply({ embeds: [embed] });
  },

  async handleEarnings(interaction) {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;

    const service = interaction.client.creatorService;
    const earningsService = interaction.client.creatorEarningsService;
    if (!service || !earningsService) {
      return interaction.reply({ content: 'The creator system is not available right now.', ephemeral: true });
    }

    const creatorCheck = service.isCreator(guildId, userId);
    if (!creatorCheck) {
      return interaction.reply({ content: 'You must be an active creator to view earnings.', ephemeral: true });
    }

    const result = earningsService.getCreatorEarnings(guildId, userId);

    if (!result.success) {
      return interaction.reply({ content: result.message, ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('Creator Earnings')
      .setColor(0x00FF00)
      .addFields(
        { name: 'Earnings Count', value: result.summary.earningCount.toString(), inline: true },
        { name: 'Gross Total', value: `${result.summary.grossTotal} PHP`, inline: true },
        { name: 'Platform Fee', value: `${result.summary.platformFeeTotal} PHP`, inline: true }
      )
      .addFields(
        { name: 'Net Total', value: `${result.summary.netTotal} PHP`, inline: true }
      );

    if (result.earnings.length > 0) {
      const recentEarnings = result.earnings.slice(0, 5).map(e => 
        `ID: ${e.id} | Gross: ${e.grossAmountMinor} | Fee: ${e.platformFeeMinor} | Net: ${e.netAmountMinor} | Date: ${e.createdAt}`
      ).join('\n');
      
      embed.addFields({
        name: 'Recent Earnings',
        value: '```\n' + recentEarnings + '\n```'
      });
    }

    await interaction.reply({ embeds: [embed] });
  }
};