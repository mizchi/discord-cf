/**
 * Discord Voice Connection Manager
 * 
 * Manages the complete voice connection flow including:
 * - Gateway voice state updates
 * - Voice WebSocket connection
 * - UDP socket for audio transmission
 * 
 * Note: UDP functionality requires Node.js runtime
 */

import { EventEmitter } from 'events';
import { VoiceWebSocket, VoiceWebSocketOptions } from './VoiceWebSocket.js';
import { VoiceUDPSocket, EncryptionMode, SpeakingFlags, createSilenceFrame } from './udp.js';
import type { GatewayOpcodes } from 'discord-api-types/v10';

export enum VoiceConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  AUTHENTICATING = 'authenticating',
  READY = 'ready',
  RECONNECTING = 'reconnecting',
  DESTROYED = 'destroyed',
}

export interface VoiceConnectionOptions {
  guildId: string;
  channelId: string;
  userId: string;
  selfMute?: boolean;
  selfDeaf?: boolean;
}

export interface VoiceServerUpdate {
  token: string;
  guild_id: string;
  endpoint: string;
}

export interface VoiceStateUpdate {
  guild_id: string;
  channel_id: string | null;
  user_id: string;
  session_id: string;
  deaf: boolean;
  mute: boolean;
  self_deaf: boolean;
  self_mute: boolean;
}

/**
 * Complete voice connection implementation
 */
export class VoiceConnection extends EventEmitter {
  private state: VoiceConnectionState = VoiceConnectionState.DISCONNECTED;
  private voiceWebSocket?: VoiceWebSocket;
  private voiceUDP?: VoiceUDPSocket;
  private gateway: any; // Main gateway connection
  private sessionId?: string;
  private token?: string;
  private endpoint?: string;
  private speaking = false;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectTimeout?: ReturnType<typeof setTimeout>;
  private silenceFrameInterval?: ReturnType<typeof setInterval>;
  private isNodeEnvironment: boolean;

  constructor(
    private options: VoiceConnectionOptions,
    gateway: any
  ) {
    super();
    this.gateway = gateway;
    this.isNodeEnvironment = typeof process !== 'undefined' && 
                           process.versions && 
                           process.versions.node !== undefined;
  }

  /**
   * Connect to voice channel
   */
  async connect(): Promise<void> {
    if (this.state !== VoiceConnectionState.DISCONNECTED) {
      throw new Error(`Cannot connect in state: ${this.state}`);
    }

    this.setState(VoiceConnectionState.CONNECTING);

    try {
      // Step 1: Send Voice State Update to main gateway
      await this.sendVoiceStateUpdate();

      // Step 2: Wait for Voice Server Update and Voice State Update
      await this.waitForVoiceInfo();

      // Step 3: Connect to Voice WebSocket
      await this.connectVoiceWebSocket();

      // Step 4: Connect UDP socket (Node.js only)
      if (this.isNodeEnvironment) {
        await this.connectUDP();
      } else {
        console.warn('UDP voice transmission not available in Workers/Browser environment');
      }

      this.setState(VoiceConnectionState.READY);
      this.emit('ready');

    } catch (error) {
      this.setState(VoiceConnectionState.DISCONNECTED);
      throw error;
    }
  }

  /**
   * Send Voice State Update to main gateway
   */
  private async sendVoiceStateUpdate(): Promise<void> {
    const payload = {
      op: 4, // VOICE_STATE_UPDATE
      d: {
        guild_id: this.options.guildId,
        channel_id: this.options.channelId,
        self_mute: this.options.selfMute || false,
        self_deaf: this.options.selfDeaf || false,
      },
    };

    // Send to main gateway
    if (this.gateway && this.gateway.send) {
      this.gateway.send(JSON.stringify(payload));
    } else {
      throw new Error('Gateway not available');
    }
  }

  /**
   * Wait for Voice Server Update and Voice State Update events
   */
  private async waitForVoiceInfo(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for voice server info'));
      }, 10000);

      let receivedServerUpdate = false;
      let receivedStateUpdate = false;

      const checkComplete = () => {
        if (receivedServerUpdate && receivedStateUpdate) {
          clearTimeout(timeout);
          resolve();
        }
      };

      // Listen for Voice Server Update
      const serverUpdateHandler = (data: VoiceServerUpdate) => {
        if (data.guild_id === this.options.guildId) {
          this.token = data.token;
          this.endpoint = data.endpoint;
          receivedServerUpdate = true;
          checkComplete();
        }
      };

      // Listen for Voice State Update
      const stateUpdateHandler = (data: VoiceStateUpdate) => {
        if (data.guild_id === this.options.guildId && 
            data.user_id === this.options.userId) {
          this.sessionId = data.session_id;
          receivedStateUpdate = true;
          checkComplete();
        }
      };

      // Register listeners
      this.gateway.on('VOICE_SERVER_UPDATE', serverUpdateHandler);
      this.gateway.on('VOICE_STATE_UPDATE', stateUpdateHandler);

      // Cleanup on completion
      this.once('cleanup', () => {
        this.gateway.off('VOICE_SERVER_UPDATE', serverUpdateHandler);
        this.gateway.off('VOICE_STATE_UPDATE', stateUpdateHandler);
      });
    });
  }

  /**
   * Connect to Voice WebSocket
   */
  private async connectVoiceWebSocket(): Promise<void> {
    if (!this.endpoint || !this.token || !this.sessionId) {
      throw new Error('Missing voice connection info');
    }

    this.setState(VoiceConnectionState.AUTHENTICATING);

    const wsOptions: VoiceWebSocketOptions = {
      endpoint: this.endpoint.replace('wss://', ''),
      serverId: this.options.guildId,
      userId: this.options.userId,
      sessionId: this.sessionId,
      token: this.token,
    };

    this.voiceWebSocket = new VoiceWebSocket(wsOptions);

    // Listen for ready event
    this.voiceWebSocket.once('ready', (data) => {
      console.log('Voice WebSocket ready:', data);
    });

    // Listen for session description
    this.voiceWebSocket.once('session_description', (data) => {
      console.log('Received session description');
      if (this.voiceUDP) {
        this.voiceUDP.setSecretKey(data.secret_key);
      }
    });

    await this.voiceWebSocket.connect();
  }

  /**
   * Connect UDP socket (Node.js only)
   */
  private async connectUDP(): Promise<void> {
    if (!this.isNodeEnvironment) {
      console.warn('UDP connection skipped - not in Node.js environment');
      return;
    }

    const connectionInfo = this.voiceWebSocket!.getConnectionInfo();
    
    if (!connectionInfo.ssrc || !connectionInfo.ip || !connectionInfo.port) {
      throw new Error('Missing UDP connection info');
    }

    // Select best encryption mode
    const encryptionMode = this.selectEncryptionMode(connectionInfo.modes || []);

    this.voiceUDP = new VoiceUDPSocket({
      ip: connectionInfo.ip,
      port: connectionInfo.port,
      ssrc: connectionInfo.ssrc,
      encryptionMode,
    });

    try {
      await this.voiceUDP.connect();
      
      // Perform IP discovery
      const discovered = await this.voiceUDP.performIPDiscovery();
      console.log('IP Discovery result:', discovered);

      // Send protocol selection
      this.voiceWebSocket!.selectProtocol(
        discovered.ip,
        discovered.port,
        encryptionMode
      );

      // Wait for secret key
      await new Promise((resolve) => {
        this.voiceWebSocket!.once('session_description', resolve);
      });

    } catch (error) {
      console.error('UDP connection failed:', error);
      // Continue without UDP - WebSocket still works
    }
  }

  /**
   * Select best available encryption mode
   */
  private selectEncryptionMode(available: EncryptionMode[]): EncryptionMode {
    const preferred = [
      EncryptionMode.XSALSA20_POLY1305_LITE,
      EncryptionMode.XSALSA20_POLY1305_SUFFIX,
      EncryptionMode.XSALSA20_POLY1305,
    ];

    for (const mode of preferred) {
      if (available.includes(mode)) {
        return mode;
      }
    }

    return available[0] || EncryptionMode.XSALSA20_POLY1305;
  }

  /**
   * Start speaking
   */
  startSpeaking(): void {
    if (!this.speaking && this.voiceWebSocket?.isReady()) {
      this.speaking = true;
      this.voiceWebSocket.setSpeaking(true);
      this.stopSilenceFrames();
    }
  }

  /**
   * Stop speaking
   */
  stopSpeaking(): void {
    if (this.speaking && this.voiceWebSocket?.isReady()) {
      this.speaking = false;
      this.voiceWebSocket.setSpeaking(false);
      this.startSilenceFrames();
    }
  }

  /**
   * Send audio packet
   */
  sendAudioPacket(opusPacket: Buffer): void {
    if (this.state !== VoiceConnectionState.READY) {
      return;
    }

    if (!this.speaking) {
      this.startSpeaking();
    }

    if (this.voiceUDP) {
      this.voiceUDP.sendAudioPacket(opusPacket);
    }
  }

  /**
   * Start sending silence frames
   */
  private startSilenceFrames(): void {
    if (this.silenceFrameInterval) return;

    // Send 5 silence frames to signal end of speech
    let count = 0;
    this.silenceFrameInterval = setInterval(() => {
      if (count++ < 5) {
        const silence = createSilenceFrame();
        if (this.voiceUDP) {
          this.voiceUDP.sendAudioPacket(silence);
        }
      } else {
        this.stopSilenceFrames();
      }
    }, 20); // 20ms intervals
  }

  /**
   * Stop sending silence frames
   */
  private stopSilenceFrames(): void {
    if (this.silenceFrameInterval) {
      clearInterval(this.silenceFrameInterval);
      this.silenceFrameInterval = undefined;
    }
  }

  /**
   * Reconnect to voice
   */
  async reconnect(): Promise<void> {
    if (this.state === VoiceConnectionState.DESTROYED) {
      throw new Error('Connection is destroyed');
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.destroy();
      throw new Error('Max reconnection attempts reached');
    }

    this.setState(VoiceConnectionState.RECONNECTING);
    this.reconnectAttempts++;

    // Clean up existing connections
    this.cleanup();

    // Wait before reconnecting
    await new Promise(resolve => setTimeout(resolve, 1000 * this.reconnectAttempts));

    try {
      await this.connect();
      this.reconnectAttempts = 0;
    } catch (error) {
      console.error('Reconnection failed:', error);
      
      // Schedule next reconnection attempt
      this.reconnectTimeout = setTimeout(() => {
        this.reconnect().catch(console.error);
      }, 5000);
    }
  }

  /**
   * Set connection state
   */
  private setState(state: VoiceConnectionState): void {
    if (this.state !== state) {
      const oldState = this.state;
      this.state = state;
      this.emit('stateChange', oldState, state);
    }
  }

  /**
   * Get current state
   */
  getState(): VoiceConnectionState {
    return this.state;
  }

  /**
   * Get ping to voice server
   */
  getPing(): number {
    return this.voiceUDP?.getPing() || -1;
  }

  /**
   * Disconnect from voice channel
   */
  disconnect(): void {
    if (this.state === VoiceConnectionState.DESTROYED) {
      return;
    }

    // Send disconnect voice state
    const payload = {
      op: 4, // VOICE_STATE_UPDATE
      d: {
        guild_id: this.options.guildId,
        channel_id: null,
        self_mute: false,
        self_deaf: false,
      },
    };

    if (this.gateway && this.gateway.send) {
      this.gateway.send(JSON.stringify(payload));
    }

    this.cleanup();
    this.setState(VoiceConnectionState.DISCONNECTED);
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    this.stopSilenceFrames();

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = undefined;
    }

    if (this.voiceWebSocket) {
      this.voiceWebSocket.close();
      this.voiceWebSocket = undefined;
    }

    if (this.voiceUDP) {
      this.voiceUDP.close();
      this.voiceUDP = undefined;
    }

    this.emit('cleanup');
  }

  /**
   * Destroy the connection
   */
  destroy(): void {
    this.cleanup();
    this.setState(VoiceConnectionState.DESTROYED);
    this.removeAllListeners();
  }
}