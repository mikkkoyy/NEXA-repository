const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { RarityCommon, RarityUncommon, RarityRare, RarityEpic, RarityLegendary, memberCollectibleDisplayIcon, rarityLabel, formatTime } = require('../collectibles/model');
const { DefaultCollectibles } = require('../collectibles/seed');
const questColor = 0x6c5ce7;

function collectibleListLines(all) {
  const lines = [];
  for (const mc of all) {
    if (lines.length > 0) lines.push('');
    const icon = memberCollectibleDisplayIcon(mc);
    lines.push(`${icon} ${mc.name}`);
    lines.push(`  ${rarityLabel(mc.rarity)}`);
    lines.push(`  ${mc.description}`);
  }
  return lines.length ? lines : [];
}

function renderCollectibleBox(title, lines, collected, total) {
  let width = title.length;
  for (const l of lines) {
    if (l.length > width) width = l.length;
  }
  const bar = '─'.repeat(width + 2);
  let b = `╭${bar}╮\n`;
  b += `│${' '.repeat(Math.floor((width - title.length) / 2))}${title}${' '.repeat(Math.ceil((width - title.length) / 2))}│\n`;
  b += `├${bar}┤\n`;
  for (const l of lines) {
    b += `│${l}${' '.repeat(width - l.length)}│\n`;
  }
  b += `╰${bar}╯\n`;
  if (total > 0) {
    b += `  Collection: ${collected} / ${total}\n`;
  }
  return b;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('collectibles')
    .setDescription('Show your NEXA collectible collection.')
    .setDMPermission(false),
  async execute(interaction) {
    const service = interaction.client.collectibleService;
    if (!service) {
      return interaction.reply({ content: 'The collectible system is not available right now.', ephemeral: true });
    }
    if (!interaction.guildId) {
      return interaction.reply({ content: 'Collectibles live inside servers. Try this command in a guild.', ephemeral: true });
    }

    const user = interaction.user;
    if (!user) {
      return interaction.reply({ content: 'Could not determine user information.', ephemeral: true });
    }

    const { collected, total } = service.getCollection(interaction.guildId, user.id);
    const lines = collectibleListLines(collected);

    if (lines.length === 0) {
      const embed = new EmbedBuilder()
        .setDescription('Your collection is empty.\nComplete quests and discover what NEXA has hidden.')
        .setColor(questColor)
        .setFooter({ text: 'NEXA • Your server\'s world engine' });
      return interaction.reply({ embeds: [embed] });
    }

    const embed = new EmbedBuilder()
      .setDescription('```\n' + renderCollectibleBox('NEXA COLLECTION', lines, collected.length, total) + '\n```')
      .setColor(questColor)
      .setFooter({ text: 'NEXA • Your server\'s world engine' });

    return interaction.reply({ embeds: [embed] });
  }
};