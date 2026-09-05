const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('settings')
    .setDescription('Server settings configuration.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addBooleanOption(option =>
      option.setName('welcome').setDescription('Enable welcome messages').setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('quests').setDescription('Enable quest system').setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('collectibles').setDescription('Enable collectibles').setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('achievements').setDescription('Enable achievements').setRequired(false)
    )
    .addBooleanOption(option =>
      option.setName('world').setDescription('Enable world pulse').setRequired(false)
    ),
  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) {
      return interaction.reply({ content: 'This command must be used in a server.', ephemeral: true });
    }

    const welcome = interaction.options.getBoolean('welcome');
    const quests = interaction.options.getBoolean('quests');
    const collectibles = interaction.options.getBoolean('collectibles');
    const achievements = interaction.options.getBoolean('achievements');
    const world = interaction.options.getBoolean('world');

    const moderator = interaction.member;
    if (!moderator) {
      return interaction.reply({ content: 'Could not determine moderator information.', ephemeral: true });
    }

    const service = interaction.client.moderationService;
    if (!service) {
      return interaction.reply({ content: 'The moderation system is not available right now.', ephemeral: true });
    }

    // Record the settings change as a warning-like audit log entry
    if (welcome !== undefined) {
      service.warn(guild.id, moderator.id, moderator.id, moderator.displayName || moderator.user.name, `Settings: welcome=${welcome}`);
    }
    if (quests !== undefined) {
      service.warn(guild.id, moderator.id, moderator.id, moderator.displayName || moderator.user.name, `Settings: quests=${quests}`);
    }
    if (collectibles !== undefined) {
      service.warn(guild.id, moderator.id, moderator.id, moderator.displayName || moderator.user.name, `Settings: collectibles=${collectibles}`);
    }
    if (achievements !== undefined) {
      service.warn(guild.id, moderator.id, moderator.id, moderator.displayName || moderator.user.name, `Settings: achievements=${achievements}`);
    }
    if (world !== undefined) {
      service.warn(guild.id, moderator.id, moderator.id, moderator.displayName || moderator.user.name, `Settings: world=${world}`);
    }

    return interaction.reply({ content: 'Server settings updated.' });
  }
};