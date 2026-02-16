const { Client, GatewayIntentBits, Partials, InteractionType } = require('discord.js');
const { runPipeline } = require('./void-pipeline');
const {
  buildComponentSpec,
  consumeComponent,
  peekComponent,
  consumeModal,
  COMPONENT_ID_PREFIX,
  MODAL_ID_PREFIX,
} = require('./discord-components');

let client = null;
let _envChain = null;

const DISCORD_MAX_LENGTH = 2000;

function chunkMessage(text, maxLen = DISCORD_MAX_LENGTH) {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    let splitAt = remaining.lastIndexOf('\n', maxLen);
    if (splitAt < maxLen * 0.3) splitAt = remaining.lastIndexOf(' ', maxLen);
    if (splitAt < maxLen * 0.3) splitAt = maxLen;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }
  return chunks;
}

async function sendComponentMessage(channel, spec, meta = {}) {
  const built = buildComponentSpec(spec, meta);
  if (!built) return null;

  const payload = { allowedMentions: { repliedUser: false } };
  if (built.content) payload.content = built.content;
  if (built.components && built.components.length > 0) payload.components = built.components;

  const sent = await channel.send(payload);

  if (built.modal) {
    built.modal.modalEntry.messageId = sent.id;
  }
  for (const entry of built.entries) {
    entry.messageId = sent.id;
  }

  return { message: sent, built };
}

async function handleComponentInteraction(interaction) {
  const customId = interaction.customId;
  if (!customId) return false;

  const isOurs = customId.startsWith(COMPONENT_ID_PREFIX) || customId.startsWith(MODAL_ID_PREFIX);
  if (!isOurs) return false;

  const entry = consumeComponent(customId);
  if (!entry) {
    try {
      await interaction.reply({ content: 'This interaction has expired.', ephemeral: true });
    } catch (_) {}
    return true;
  }

  if (entry.kind === 'modal-trigger' && entry.modalId) {
    const modalEntry = peekComponent(entry.modalId);
    if (modalEntry && modalEntry.modal) {
      try {
        await interaction.showModal(modalEntry.modal);
      } catch (e) {
        console.error(`[discord] modal show failed: ${e.message}`);
        try {
          await interaction.reply({ content: '[error] could not open form', ephemeral: true });
        } catch (_) {}
      }
      return true;
    }

    try {
      await interaction.reply({ content: 'This form has expired.', ephemeral: true });
    } catch (_) {}
    return true;
  }

  if (entry.kind === 'button') {
    const sessionId = `discord:${interaction.channel?.id || interaction.channelId}`;
    const callerId = `discord:${interaction.user.id}`;
    const query = `[button: ${entry.label}]`;

    try {
      await interaction.deferReply();

      const result = await runPipeline({
        query,
        sessionId,
        callerId,
        chain: _envChain || undefined,
        options: { source: 'discord-component', componentLabel: entry.label }
      });

      const response = result.response || 'nyan~';
      const chunks = chunkMessage(response);
      await interaction.editReply({ content: chunks[0] });
      for (let i = 1; i < chunks.length; i++) {
        await interaction.followUp({ content: chunks[i] });
      }
    } catch (e) {
      console.error(`[discord] button handler error: ${e.message}`);
      try {
        await interaction.editReply({ content: `[error] ${e.message}` });
      } catch (_) {}
    }
    return true;
  }

  if (entry.kind === 'select') {
    const sessionId = `discord:${interaction.channel?.id || interaction.channelId}`;
    const callerId = `discord:${interaction.user.id}`;
    const values = interaction.values || [];
    const query = `[select: ${entry.label}] ${values.join(', ')}`;

    try {
      await interaction.deferReply();

      const result = await runPipeline({
        query,
        sessionId,
        callerId,
        chain: _envChain || undefined,
        options: { source: 'discord-component', selectValues: values }
      });

      const response = result.response || 'nyan~';
      const chunks = chunkMessage(response);
      await interaction.editReply({ content: chunks[0] });
      for (let i = 1; i < chunks.length; i++) {
        await interaction.followUp({ content: chunks[i] });
      }
    } catch (e) {
      console.error(`[discord] select handler error: ${e.message}`);
      try {
        await interaction.editReply({ content: `[error] ${e.message}` });
      } catch (_) {}
    }
    return true;
  }

  return false;
}

async function handleModalSubmit(interaction) {
  const customId = interaction.customId;
  if (!customId || !customId.startsWith(MODAL_ID_PREFIX)) return false;

  const entry = consumeModal(customId);
  if (!entry) {
    try {
      await interaction.reply({ content: 'This form has expired.', ephemeral: true });
    } catch (_) {}
    return true;
  }

  const sessionId = `discord:${interaction.channel?.id || interaction.channelId}`;
  const callerId = `discord:${interaction.user.id}`;

  const fields = {};
  for (const fieldDef of (entry.fields || [])) {
    try {
      fields[fieldDef.name] = interaction.fields.getTextInputValue(fieldDef.id) || '';
    } catch (_) {
      fields[fieldDef.name] = '';
    }
  }

  const fieldSummary = Object.entries(fields)
    .map(([k, v]) => `${k}: ${v}`)
    .join(', ');
  const query = `[form: ${entry.title}] ${fieldSummary}`;

  try {
    await interaction.deferReply();

    const result = await runPipeline({
      query,
      sessionId,
      callerId,
      chain: _envChain || undefined,
      options: { source: 'discord-modal', formTitle: entry.title, formFields: fields }
    });

    const response = result.response || 'nyan~';
    const chunks = chunkMessage(response);
    await interaction.editReply({ content: chunks[0] });
    for (let i = 1; i < chunks.length; i++) {
      await interaction.followUp({ content: chunks[i] });
    }
  } catch (e) {
    console.error(`[discord] modal submit error: ${e.message}`);
    try {
      await interaction.editReply({ content: `[error] ${e.message}` });
    } catch (_) {}
  }
  return true;
}

function startDiscordGateway(options = {}) {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) {
    console.log('[discord] no DISCORD_BOT_TOKEN — gateway disabled');
    return null;
  }

  _envChain = options.chain || null;

  client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.DirectMessages,
    ],
    partials: [Partials.Channel],
  });

  client.once('ready', () => {
    console.log(`[discord] gateway connected as ${client.user.tag}`);
    console.log(`[discord] listening in ${client.guilds.cache.size} guild(s)`);
    console.log(`[discord] components v2 enabled (buttons, selects, modals)`);
  });

  client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const isMentioned = message.mentions.has(client.user);
    const isDM = !message.guild;

    if (!isMentioned && !isDM) return;

    let query = message.content;
    if (isMentioned) {
      query = query.replace(/<@!?\d+>/g, '').trim();
    }
    if (!query) return;

    const sessionId = `discord:${message.channel.id}`;
    const callerId = `discord:${message.author.id}`;

    try {
      await message.channel.sendTyping();

      const result = await runPipeline({
        query,
        sessionId,
        callerId,
        chain: _envChain || undefined,
        options: {}
      });

      const response = result.response || 'nyan~';

      if (result.components) {
        const meta = { sessionId, callerId };
        try {
          await sendComponentMessage(message.channel, result.components, meta);
          if (response && response !== 'nyan~') {
            const chunks = chunkMessage(response);
            for (const chunk of chunks) {
              await message.reply({ content: chunk, allowedMentions: { repliedUser: false } });
            }
          }
        } catch (compErr) {
          console.error(`[discord] component send failed, falling back to text: ${compErr.message}`);
          const chunks = chunkMessage(response);
          for (const chunk of chunks) {
            await message.reply({ content: chunk, allowedMentions: { repliedUser: false } });
          }
        }
      } else {
        const chunks = chunkMessage(response);
        for (const chunk of chunks) {
          await message.reply({ content: chunk, allowedMentions: { repliedUser: false } });
        }
      }
    } catch (e) {
      console.error(`[discord] pipeline error: ${e.message}`);
      try {
        await message.reply({ content: `[error] ${e.message}`, allowedMentions: { repliedUser: false } });
      } catch (replyErr) {
        console.error(`[discord] reply failed: ${replyErr.message}`);
      }
    }
  });

  client.on('interactionCreate', async (interaction) => {
    try {
      if (interaction.isButton() || interaction.isAnySelectMenu()) {
        const handled = await handleComponentInteraction(interaction);
        if (handled) return;
      }

      if (interaction.type === InteractionType.ModalSubmit) {
        const handled = await handleModalSubmit(interaction);
        if (handled) return;
      }
    } catch (e) {
      console.error(`[discord] interaction error: ${e.message}`);
      try {
        if (!interaction.replied && !interaction.deferred) {
          await interaction.reply({ content: '[error] interaction failed', ephemeral: true });
        }
      } catch (_) {}
    }
  });

  client.on('error', (err) => {
    console.error(`[discord] client error: ${err.message}`);
  });

  client.login(token).catch(e => {
    console.error(`[discord] login failed: ${e.message}`);
  });

  return client;
}

function stopDiscordGateway() {
  if (client) {
    client.destroy();
    client = null;
    console.log('[discord] gateway disconnected');
  }
}

function getDiscordStatus() {
  if (!client) return { connected: false, reason: 'not started' };
  return {
    connected: client.isReady(),
    tag: client.user?.tag || null,
    guilds: client.guilds?.cache.size || 0,
    uptime: client.uptime || 0,
    componentsV2: true,
  };
}

module.exports = {
  startDiscordGateway,
  stopDiscordGateway,
  getDiscordStatus,
  chunkMessage,
  sendComponentMessage,
  handleComponentInteraction,
  handleModalSubmit,
};
