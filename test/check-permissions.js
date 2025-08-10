/**
 * Check bot permissions in the guild
 */

import { REST, API } from '../dist/index.js';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.DISCORD_TOKEN;
const guildId = process.env.GUILD_ID;
const voiceChannelId = process.env.VOICE_CHANNEL_ID;

if (!token || !guildId) {
  console.error('Required: DISCORD_TOKEN, GUILD_ID');
  process.exit(1);
}

async function checkPermissions() {
  const rest = new REST().setToken(token);
  const api = new API(rest);

  try {
    // Get bot user info
    console.log('Getting bot info...');
    const user = await rest.get('/users/@me');
    console.log(`Bot: ${user.username}#${user.discriminator || '0000'} (ID: ${user.id})\n`);

    // Get guild info
    console.log('Getting guild info...');
    const guild = await api.guilds.get(guildId);
    console.log(`Guild: ${guild.name} (ID: ${guild.id})\n`);

    // Get bot member in guild
    console.log('Getting bot member info...');
    const member = await rest.get(`/guilds/${guildId}/members/${user.id}`);
    console.log('Bot roles:', member.roles);

    // Get voice channel info
    if (voiceChannelId) {
      console.log('\nGetting voice channel info...');
      const channel = await api.channels.get(voiceChannelId);
      console.log(`Voice Channel: ${channel.name} (Type: ${channel.type})`);
      console.log(`Bitrate: ${channel.bitrate}, User limit: ${channel.user_limit || 'none'}`);
      
      // Check permissions (simplified)
      console.log('\n=== Required Permissions for Voice ===');
      console.log('✓ VIEW_CHANNEL (1024)');
      console.log('✓ CONNECT (1048576)'); 
      console.log('✓ SPEAK (2097152)');
      console.log('\nNote: Make sure the bot has these permissions in the voice channel');
    }

  } catch (error) {
    console.error('Error:', error.message);
    if (error.rawError) {
      console.error('Details:', error.rawError);
    }
  }
}

checkPermissions();