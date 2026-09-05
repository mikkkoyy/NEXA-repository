const { SlashCommandBuilder } = require('discord.js');

const AVAILABLE_COMMANDS = ['/ping', '/help'];

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Show available NEXA commands'),
  async execute(interaction) {
    const commandList = AVAILABLE_COMMANDS.join('\n');
    await interaction.reply(`NEXA commands:\n${commandList}`);
  }
};