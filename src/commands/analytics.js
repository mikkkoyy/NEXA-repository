const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('analytics')
    .setDescription('Show server analytics.')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),
  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) {
      return interaction.reply({ content: 'This command must be used in a server.', ephemeral: true });
    }

    const service = interaction.client.analyticsService;
    if (!service) {
      return interaction.reply({ content: 'The analytics system is not available right now.', ephemeral: true });
    }

    const summary = service.getServerSummary(guild.id);

    if (!summary || (summary.messagesToday === 0 && summary.knownMembers === 0)) {
      return interaction.reply({ content: 'No analytics data found for this server.' });
    }

    const lines = [
      `Messages today: ${summary.messagesToday.toLocaleString()}`,
      `Known members: ${summary.knownMembers}`,
      '',
      'Daily activity:'
    ];

    for (const day of summary.messages.slice(0, 7)) {
      lines.push(`  ${day.day}: ${day.messageCount.toLocaleString()} messages`);
    }

    const embed = new EmbedBuilder()
      .setDescription('```\n' + lines.join('\n') + '\n```')
      .setColor(0x5865F2)
      .setFooter({ text: 'NEXA • Analytics' });

    return interaction.reply({ embeds: [embed] });
  }
};