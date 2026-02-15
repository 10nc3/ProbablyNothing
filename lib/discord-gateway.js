const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { runPipeline } = require('./void-pipeline');

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
      const chunks = chunkMessage(response);

      for (const chunk of chunks) {
        await message.reply({ content: chunk, allowedMentions: { repliedUser: false } });
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
    uptime: client.uptime || 0
  };
}

module.exports = { startDiscordGateway, stopDiscordGateway, getDiscordStatus, chunkMessage };
