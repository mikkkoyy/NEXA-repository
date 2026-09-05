const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Ban a member.')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(option =>
      option.setName('user').setDescription('User to ban').setRequired(true)
    )
    .addStringOption(option =>
      option.setName('reason').setDescription('Reason for the ban').setRequired(false)
    ),
  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) {
      return interaction.reply({ content: 'This command must be used in a server.', ephemeral: true });
    }

    const target = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided';

    const moderator = interaction.member;
    if (!moderator) {
      return interaction.reply({ content: 'Could not determine moderator information.', ephemeral: true });
    }

    await guild.members.ban(target, { reason });

    const service = interaction.client.moderationService;
    if (!service) {
      return interaction.reply({ content: 'Moderation system unavailable.', ephemeral: true });
    }

    service.warn(guild.id, target.id, moderator.id, moderator.displayName || moderator.user.name, `Banned: ${reason}`);

    return interaction.reply({ content: `Banned ${target.tag}: ${reason}` });
  }
};