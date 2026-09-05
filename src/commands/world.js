const { SlashCommandBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('world')
    .setDescription('Show the world state and pulse.'),
  async execute(interaction) {
    const service = interaction.client.worldService;
    if (!service) {
      return interaction.reply({ content: 'The world system is not available right now.', ephemeral: true });
    }
    if (!interaction.guildId) {
      return interaction.reply({ content: 'World lives inside servers. Try this command in a guild.', ephemeral: true });
    }

    const view = service.getWorldState(interaction.guildId);
    if (!view) {
      return interaction.reply({ content: 'No world state found for this server.', ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle('NEXA WORLD')
      .setColor(0x5865F2)
      .addFields(
        { name: 'Pulse', value: `${view.pulse}`, inline: true },
        { name: 'Status', value: view.pulse === 0 ? 'Awake' : 'Active', inline: true }
      )
      .setFooter({ text: 'NEXA • Your server\'s world engine' });

    return interaction.reply({ embeds: [embed] });
  }
};