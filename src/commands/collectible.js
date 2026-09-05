const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const { memberCollectibleDisplayIcon, rarityLabel } = require('../collectibles/model');
const { DefaultCollectibles } = require('../collectibles/seed');
const questColor = 0x6c5ce7;

function formatProgressText(mq) {
  switch (mq.objectiveType) {
    case 'message_count':
      if (mq.target === 1) return 'Send 1 message';
      return `Send ${mq.target} messages`;
    default:
      return '';
  }
}

function questStatusLabel(status) {
  switch (status) {
    case 'active': return 'ACTIVE';
    case 'completed': return 'COMPLETED';
    case 'expired': return 'EXPIRED';
    default: return status;
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName('collectible')
    .setDescription('Show your NEXA collectible information.')
    .setDMPermission(false)
    .addStringOption(option =>
      option
        .setName('collectible')
        .setDescription('Collectible to inspect (optional).')
        .setRequired(false)
        .addChoices(...DefaultCollectibles().map(d => ({ name: d.Name, value: d.Key })))
    ),
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

    const key = interaction.options.getString('collectible') || '';

    if (key) {
      return handleCollectibleDetail(interaction, service, interaction.guildId, user.id, key);
    }
    return handleCollectibleSummary(interaction, service, interaction.guildId, user.id);
  }
};

async function handleCollectibleDetail(interaction, service, guildID, userID, key) {
  const c = service.getCollectibleByKey(guildID, key);
  if (!c) {
    return interaction.reply({ content: `No collectible named "${key}" was found. Try \`collectibles\` to see what is available.`, ephemeral: true });
  }

  const owned = service.hasCollectible(guildID, userID, key);

  const status = owned ? 'Collected' : 'Not yet discovered';

  const lines = [
    `${c.icon} ${c.name}`,
    rarityLabel(c.rarity),
    c.description,
    '',
    'Status:',
    status
  ];

  const embed = new EmbedBuilder()
    .setDescription('```\n' + lines.join('\n') + '\n```')
    .setColor(questColor)
    .setFooter({ text: 'NEXA • Collectible details' });

  return interaction.reply({ embeds: [embed] });
}

async function handleCollectibleSummary(interaction, service, guildID, userID) {
  const { collected, total } = service.getCollection(guildID, userID);

  const lines = [
    `Collected: ${collected.length}`,
    `Available: ${total}`
  ];

  if (collected.length > 0) {
    lines.push('');
    lines.push('Recently collected:');
    for (let i = 0; i < collected.length && i < 3; i++) {
      const mc = collected[i];
      const icon = memberCollectibleDisplayIcon(mc);
      lines.push(`  • ${icon} ${mc.name} (${rarityLabel(mc.rarity)})`);
    }
    if (collected.length > 3) {
      lines.push('  • ...');
    }
  } else {
    lines.push('');
    lines.push('Your collection is empty.');
  }
  lines.push('');
  lines.push('Use `/collectibles` for full details.');

  const embed = new EmbedBuilder()
    .setDescription('```\n' + lines.join('\n') + '\n```')
    .setColor(questColor)
    .setFooter({ text: 'NEXA • Your server\'s world engine' });

  return interaction.reply({ embeds: [embed] });
}