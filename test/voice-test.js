/**
 * Discord Voice Connection Test
 * 
 * This test requires Node.js environment with dgram support.
 * Run with: node test/voice-test.js
 */

import { REST, API } from '../dist/index.js';
import { VoiceConnection } from '../dist/voice/VoiceConnection.js';
import WebSocket from 'ws';
import dgram from 'dgram';
import dotenv from 'dotenv';
import { 
  GatewayOpcodes, 
  GatewayDispatchEvents,
  GatewayIntentBits 
} from 'discord-api-types/v10';

dotenv.config();

const token = process.env.DISCORD_TOKEN;
const voiceChannelId = process.env.VOICE_CHANNEL_ID;
const textChannelId = process.env.DISCORD_CHANNEL_ID;
const guildId = process.env.GUILD_ID; // Must be an actual guild ID for voice

if (!token || !voiceChannelId || !guildId) {
  console.error('必要な環境変数を設定してください:');
  console.error('DISCORD_TOKEN, VOICE_CHANNEL_ID, GUILD_ID');
  console.error('\n注意: GUILD_ID は実際のサーバーIDである必要があります（DMチャンネルでは音声接続できません）');
  process.exit(1);
}

// Create mock gateway for testing
class MockGateway {
  constructor() {
    this.ws = null;
    this.sequence = null;
    this.sessionId = null;
    this.heartbeatInterval = null;
    this.lastHeartbeatAck = true;
    this.listeners = new Map();
  }

  on(event, handler) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(handler);
  }

  off(event, handler) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index >= 0) {
        handlers.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  send(payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(payload);
    }
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket('wss://gateway.discord.gg/?v=10&encoding=json');

      this.ws.on('open', () => {
        console.log('Gateway connected');
      });

      this.ws.on('message', (data) => {
        const payload = JSON.parse(data);
        
        if (payload.s) {
          this.sequence = payload.s;
        }

        switch (payload.op) {
          case GatewayOpcodes.Hello:
            this.startHeartbeat(payload.d.heartbeat_interval);
            this.identify();
            break;

          case GatewayOpcodes.HeartbeatAck:
            this.lastHeartbeatAck = true;
            break;

          case GatewayOpcodes.Dispatch:
            this.handleDispatch(payload);
            break;

          case GatewayOpcodes.Reconnect:
            console.log('Reconnect requested');
            this.ws.close();
            break;
        }
      });

      this.ws.on('error', (error) => {
        console.error('Gateway error:', error);
        reject(error);
      });

      this.ws.on('close', () => {
        console.log('Gateway closed');
        if (this.heartbeatInterval) {
          clearInterval(this.heartbeatInterval);
        }
      });

      // Wait for READY
      this.once('READY', () => {
        resolve();
      });
    });
  }

  identify() {
    this.send(JSON.stringify({
      op: GatewayOpcodes.Identify,
      d: {
        token,
        intents: 
          GatewayIntentBits.Guilds |
          GatewayIntentBits.GuildVoiceStates,
        properties: {
          os: 'linux',
          browser: 'discord-cf-voice-test',
          device: 'discord-cf-voice-test'
        }
      }
    }));
  }

  startHeartbeat(interval) {
    this.heartbeatInterval = setInterval(() => {
      if (!this.lastHeartbeatAck) {
        console.error('Heartbeat ACK not received');
        this.ws.close();
        return;
      }

      this.lastHeartbeatAck = false;
      this.send(JSON.stringify({
        op: GatewayOpcodes.Heartbeat,
        d: this.sequence
      }));
    }, interval);
  }

  handleDispatch(payload) {
    switch (payload.t) {
      case GatewayDispatchEvents.Ready:
        this.sessionId = payload.d.session_id;
        this.userId = payload.d.user.id;
        console.log(`Gateway ready! User ID: ${this.userId}`);
        this.emit('READY', payload.d);
        break;

      case GatewayDispatchEvents.VoiceStateUpdate:
        console.log('Voice State Update received');
        this.emit('VOICE_STATE_UPDATE', payload.d);
        break;

      case GatewayDispatchEvents.VoiceServerUpdate:
        console.log('Voice Server Update received');
        console.log('- Token:', payload.d.token?.substring(0, 10) + '...');
        console.log('- Endpoint:', payload.d.endpoint);
        this.emit('VOICE_SERVER_UPDATE', payload.d);
        break;
    }
  }

  once(event, handler) {
    const wrapper = (data) => {
      this.off(event, wrapper);
      handler(data);
    };
    this.on(event, wrapper);
  }

  close() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Test voice connection
async function testVoiceConnection() {
  console.log('Starting voice connection test...\n');

  // Create and connect gateway
  const gateway = new MockGateway();
  
  try {
    console.log('1. Connecting to Discord Gateway...');
    await gateway.connect();
    console.log('✅ Gateway connected\n');

    // Wait a bit for the connection to stabilize
    await new Promise(resolve => setTimeout(resolve, 1000));

    console.log('2. Creating voice connection...');
    const voiceConnection = new VoiceConnection({
      guildId: guildId,
      channelId: voiceChannelId,
      userId: gateway.userId,
      selfMute: false,
      selfDeaf: false
    }, gateway);

    // Listen for state changes
    voiceConnection.on('stateChange', (oldState, newState) => {
      console.log(`Voice state: ${oldState} -> ${newState}`);
    });

    voiceConnection.on('ready', () => {
      console.log('✅ Voice connection ready!');
    });

    voiceConnection.on('error', (error) => {
      console.error('Voice error:', error);
    });

    console.log('3. Connecting to voice channel...');
    await voiceConnection.connect();
    
    console.log('\n=== Voice Connection Established ===');
    console.log('State:', voiceConnection.getState());
    console.log('Ping:', voiceConnection.getPing(), 'ms');
    
    // Test speaking state
    console.log('\n4. Testing speaking state...');
    voiceConnection.startSpeaking();
    console.log('✅ Started speaking');
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    voiceConnection.stopSpeaking();
    console.log('✅ Stopped speaking');

    // Test sending audio (silence frames)
    console.log('\n5. Testing audio packet sending...');
    const silenceFrame = Buffer.from([0xF8, 0xFF, 0xFE]);
    for (let i = 0; i < 5; i++) {
      voiceConnection.sendAudioPacket(silenceFrame);
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    console.log('✅ Sent 5 silence frames');

    // Keep connection alive for a bit
    console.log('\n6. Maintaining connection for 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Disconnect
    console.log('\n7. Disconnecting...');
    voiceConnection.disconnect();
    console.log('✅ Disconnected from voice channel');

    // Clean up
    gateway.close();
    console.log('\n=== Test Complete ===');
    process.exit(0);

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    gateway.close();
    process.exit(1);
  }
}

// Test REST API voice endpoints
async function testVoiceAPI() {
  console.log('Testing Voice REST API endpoints...\n');

  const rest = new REST().setToken(token);
  const api = new API(rest);

  try {
    // Test 1: List voice regions
    console.log('1. Fetching voice regions...');
    const regions = await api.voice.listVoiceRegions();
    console.log(`✅ Found ${regions.length} voice regions`);
    regions.slice(0, 3).forEach(region => {
      console.log(`   - ${region.name} (${region.id})${region.optimal ? ' [optimal]' : ''}`);
    });

    // Test 2: Get voice state
    console.log('\n2. Fetching voice state...');
    try {
      // Note: gateway.userId won't be available here since gateway isn't connected yet
      // This is just for API testing
      console.log('ℹ️ Voice state check skipped (requires active gateway connection)');
    } catch (error) {
      console.log('ℹ️ Voice state not available');
    }

    console.log('\n=== API Test Complete ===');
  } catch (error) {
    console.error('API test error:', error);
  }
}

// Main test runner
async function main() {
  console.log('=====================================');
  console.log('Discord Voice Connection Test Suite');
  console.log('=====================================\n');
  
  console.log('Environment:');
  console.log('- Node.js:', process.version);
  console.log('- Platform:', process.platform);
  console.log('- Voice Channel ID:', voiceChannelId);
  console.log('- Guild ID:', guildId);
  console.log('\n');

  // Check if running in Node.js
  if (typeof process === 'undefined' || !process.versions || !process.versions.node) {
    console.error('❌ This test requires Node.js environment');
    process.exit(1);
  }

  // Check for dgram support
  try {
    const testSocket = dgram.createSocket('udp4');
    testSocket.close();
    console.log('✅ UDP support available\n');
  } catch (error) {
    console.error('❌ UDP not supported:', error.message);
    console.error('Voice transmission will not work\n');
  }

  // Run tests
  await testVoiceAPI();
  await testVoiceConnection();
}

// Run the test
main().catch(console.error);