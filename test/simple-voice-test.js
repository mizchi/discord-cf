/**
 * Simple Voice Channel Connection Test
 * 
 * This tests basic voice channel connection without UDP
 */

import WebSocket from 'ws';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.DISCORD_TOKEN;
const voiceChannelId = process.env.VOICE_CHANNEL_ID;
const guildId = process.env.GUILD_ID;

console.log('===== Discord Voice Channel Connection Test =====\n');
console.log('Settings:');
console.log('- Voice Channel ID:', voiceChannelId);
console.log('- Guild ID:', guildId);
console.log('');

let ws;
let sessionId;
let userId;

// Connect to main gateway
function connectGateway() {
  return new Promise((resolve, reject) => {
    ws = new WebSocket('wss://gateway.discord.gg/?v=10&encoding=json');
    
    ws.on('open', () => {
      console.log('✅ Connected to Discord Gateway');
    });
    
    ws.on('message', (data) => {
      const payload = JSON.parse(data);
      
      // Log all opcodes for debugging
      if (payload.op !== 11) { // Skip heartbeat acks
        console.log(`📦 Received opcode ${payload.op}${payload.t ? ` (${payload.t})` : ''}`);
      }
      
      switch (payload.op) {
        case 10: // HELLO
          console.log('📩 Received HELLO, sending IDENTIFY...');
          // Send IDENTIFY
          const identifyPayload = {
            op: 2,
            d: {
              token,
              intents: 0x80 | 0x1, // GUILD_VOICE_STATES | GUILDS
              properties: {
                os: 'linux',
                browser: 'discord-cf',
                device: 'discord-cf'
              }
            }
          };
          console.log('Sending IDENTIFY with token:', token.substring(0, 20) + '...');
          ws.send(JSON.stringify(identifyPayload));
          break;
          
        case 9: // INVALID_SESSION
          console.error('❌ Invalid session received');
          reject(new Error('Invalid session'));
          break;
          
        case 0: // DISPATCH
          console.log(`📨 Event: ${payload.t}`);
          
          if (payload.t === 'READY') {
            sessionId = payload.d.session_id;
            userId = payload.d.user.id;
            console.log(`✅ Bot ready! Session: ${sessionId}, User: ${userId}`);
            resolve();
          }
          
          if (payload.t === 'VOICE_STATE_UPDATE') {
            console.log('🎤 Voice State Update:');
            console.log('  - Channel:', payload.d.channel_id);
            console.log('  - Session:', payload.d.session_id);
            console.log('  - User:', payload.d.user_id);
            
            if (payload.d.user_id === userId && payload.d.session_id) {
              sessionId = payload.d.session_id;
              console.log('✅ Got our session ID for voice');
            }
          }
          
          if (payload.t === 'VOICE_SERVER_UPDATE') {
            console.log('🎵 Voice Server Update:');
            console.log('  - Token:', payload.d.token?.substring(0, 20) + '...');
            console.log('  - Endpoint:', payload.d.endpoint);
            console.log('  - Guild:', payload.d.guild_id);
            console.log('\n✅ Voice connection info received!');
            console.log('At this point, we would connect to:', `wss://${payload.d.endpoint}`);
          }
          break;
      }
    });
    
    ws.on('error', (error) => {
      console.error('❌ WebSocket error:', error.message);
      reject(error);
    });
    
    ws.on('close', (code, reason) => {
      console.log(`🔌 WebSocket closed with code: ${code}, reason: ${reason || 'none'}`);
      if (code === 4004) {
        console.error('❌ Authentication failed - Invalid token');
      } else if (code === 4010) {
        console.error('❌ Invalid shard');
      } else if (code === 4013) {
        console.error('❌ Invalid intents');
      } else if (code === 4014) {
        console.error('❌ Disallowed intents - bot may need privileged intents enabled');
      }
    });
  });
}

// Send Voice State Update
function joinVoiceChannel() {
  console.log('\n📤 Sending Voice State Update to join channel...');
  
  const payload = {
    op: 4, // VOICE_STATE_UPDATE
    d: {
      guild_id: guildId,
      channel_id: voiceChannelId,
      self_mute: false,
      self_deaf: false
    }
  };
  
  console.log('Payload:', JSON.stringify(payload, null, 2));
  ws.send(JSON.stringify(payload));
}

// Leave voice channel
function leaveVoiceChannel() {
  console.log('\n📤 Leaving voice channel...');
  
  ws.send(JSON.stringify({
    op: 4, // VOICE_STATE_UPDATE
    d: {
      guild_id: guildId,
      channel_id: null,
      self_mute: false,
      self_deaf: false
    }
  }));
}

// Main test
async function main() {
  try {
    // Connect to gateway
    await connectGateway();
    
    // Wait a bit
    await new Promise(r => setTimeout(r, 1000));
    
    // Try to join voice channel
    joinVoiceChannel();
    
    // Wait for events
    console.log('\n⏳ Waiting 10 seconds for voice events...\n');
    await new Promise(r => setTimeout(r, 10000));
    
    // Leave channel
    leaveVoiceChannel();
    
    // Wait a bit then close
    await new Promise(r => setTimeout(r, 2000));
    
    console.log('\n✅ Test complete!');
    ws.close();
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

main();