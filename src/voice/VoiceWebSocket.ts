/**
 * Discord Voice WebSocket Gateway Implementation
 * 
 * Handles WebSocket connection to Discord Voice servers
 * This part can work in both Node.js and Workers environment
 */

import { EventEmitter } from 'events';
import type { EncryptionMode } from './udp.js';

// Voice Gateway Opcodes
export enum VoiceGatewayOpcodes {
  IDENTIFY = 0,
  SELECT_PROTOCOL = 1,
  READY = 2,
  HEARTBEAT = 3,
  SESSION_DESCRIPTION = 4,
  SPEAKING = 5,
  HEARTBEAT_ACK = 6,
  RESUME = 7,
  HELLO = 8,
  RESUMED = 9,
  CLIENT_DISCONNECT = 13,
}

// Voice Close Event Codes
export enum VoiceCloseEventCodes {
  UNKNOWN_OPCODE = 4001,
  DECODE_ERROR = 4002,
  NOT_AUTHENTICATED = 4003,
  AUTHENTICATION_FAILED = 4004,
  ALREADY_AUTHENTICATED = 4005,
  SESSION_NO_LONGER_VALID = 4006,
  SESSION_TIMEOUT = 4009,
  SERVER_NOT_FOUND = 4011,
  UNKNOWN_PROTOCOL = 4012,
  DISCONNECTED = 4014,
  VOICE_SERVER_CRASHED = 4015,
  UNKNOWN_ENCRYPTION_MODE = 4016,
}

export interface VoiceIdentify {
  server_id: string;
  user_id: string;
  session_id: string;
  token: string;
}

export interface VoiceReady {
  ssrc: number;
  ip: string;
  port: number;
  modes: EncryptionMode[];
  heartbeat_interval: number;
}

export interface VoiceSessionDescription {
  mode: EncryptionMode;
  secret_key: Uint8Array;
}

export interface SelectProtocol {
  protocol: 'udp';
  data: {
    address: string;
    port: number;
    mode: EncryptionMode;
  };
}

export interface VoiceWebSocketOptions {
  endpoint: string;
  serverId: string;
  userId: string;
  sessionId: string;
  token: string;
}

/**
 * Voice WebSocket Gateway handler
 */
export class VoiceWebSocket extends EventEmitter {
  private ws?: WebSocket;
  private heartbeatInterval?: ReturnType<typeof setInterval>;
  private lastHeartbeatAck = true;
  private heartbeatMissed = 0;
  private sequence = 0;
  private ready = false;
  private ssrc?: number;
  private ip?: string;
  private port?: number;
  private modes?: EncryptionMode[];
  private encryptionMode?: EncryptionMode;
  private secretKey?: Uint8Array;
  private connectionTimeout?: ReturnType<typeof setTimeout>;

  constructor(private options: VoiceWebSocketOptions) {
    super();
  }

  /**
   * Connect to Voice Gateway
   */
  async connect(): Promise<void> {
    const url = `wss://${this.options.endpoint}/?v=4`;
    
    return new Promise((resolve, reject) => {
      // Set connection timeout
      this.connectionTimeout = setTimeout(() => {
        reject(new Error('Voice WebSocket connection timeout'));
        this.close(VoiceCloseEventCodes.SESSION_TIMEOUT);
      }, 30000);

      try {
        // Create WebSocket connection
        if (typeof WebSocket !== 'undefined') {
          // Browser/Workers environment
          this.ws = new WebSocket(url);
        } else {
          // Node.js environment
          const WS = require('ws');
          this.ws = new WS(url);
        }

        (this.ws as any).onopen = () => {
          console.log('Voice WebSocket connected');
          this.emit('open');
        };

        (this.ws as any).onmessage = (event: any) => {
          this.handleMessage(event.data);
        };

        (this.ws as any).onerror = (error: any) => {
          console.error('Voice WebSocket error:', error);
          this.emit('error', error);
          reject(error);
        };

        (this.ws as any).onclose = (event: any) => {
          console.log(`Voice WebSocket closed: ${event.code} - ${event.reason}`);
          this.cleanup();
          this.emit('close', event.code, event.reason);
        };

        // Wait for HELLO
        this.once('hello', (interval: number) => {
          this.startHeartbeat(interval);
          this.identify();
        });

        // Wait for READY
        this.once('ready', (data: VoiceReady) => {
          clearTimeout(this.connectionTimeout);
          this.ready = true;
          this.ssrc = data.ssrc;
          this.ip = data.ip;
          this.port = data.port;
          this.modes = data.modes;
          resolve();
        });

      } catch (error) {
        clearTimeout(this.connectionTimeout);
        reject(error);
      }
    });
  }

  /**
   * Handle incoming WebSocket message
   */
  private handleMessage(data: string | ArrayBuffer): void {
    let payload: any;
    
    try {
      if (typeof data === 'string') {
        payload = JSON.parse(data);
      } else {
        // Handle binary data if needed
        const decoder = new TextDecoder();
        payload = JSON.parse(decoder.decode(data));
      }
    } catch (error) {
      console.error('Failed to parse voice gateway message:', error);
      return;
    }

    // Update sequence if present
    if (payload.s !== undefined) {
      this.sequence = payload.s;
    }

    // Handle opcodes
    switch (payload.op) {
      case VoiceGatewayOpcodes.HELLO:
        this.emit('hello', payload.d.heartbeat_interval);
        break;

      case VoiceGatewayOpcodes.READY:
        this.emit('ready', payload.d as VoiceReady);
        break;

      case VoiceGatewayOpcodes.SESSION_DESCRIPTION:
        this.handleSessionDescription(payload.d);
        break;

      case VoiceGatewayOpcodes.HEARTBEAT_ACK:
        this.lastHeartbeatAck = true;
        this.heartbeatMissed = 0;
        this.emit('heartbeat_ack');
        break;

      case VoiceGatewayOpcodes.SPEAKING:
        this.emit('speaking', payload.d);
        break;

      case VoiceGatewayOpcodes.CLIENT_DISCONNECT:
        this.emit('client_disconnect', payload.d);
        break;

      case VoiceGatewayOpcodes.RESUMED:
        this.emit('resumed');
        break;

      default:
        console.warn('Unknown voice gateway opcode:', payload.op);
    }
  }

  /**
   * Send IDENTIFY payload
   */
  private identify(): void {
    const payload = {
      op: VoiceGatewayOpcodes.IDENTIFY,
      d: {
        server_id: this.options.serverId,
        user_id: this.options.userId,
        session_id: this.options.sessionId,
        token: this.options.token,
      },
    };

    this.send(payload);
  }

  /**
   * Select voice protocol
   */
  selectProtocol(address: string, port: number, mode: EncryptionMode): void {
    if (!this.ready) {
      throw new Error('Voice WebSocket not ready');
    }

    const payload = {
      op: VoiceGatewayOpcodes.SELECT_PROTOCOL,
      d: {
        protocol: 'udp',
        data: {
          address,
          port,
          mode,
        },
      },
    };

    this.encryptionMode = mode;
    this.send(payload);
  }

  /**
   * Handle session description
   */
  private handleSessionDescription(data: any): void {
    this.secretKey = new Uint8Array(data.secret_key);
    this.emit('session_description', {
      mode: data.mode,
      secret_key: this.secretKey,
    } as VoiceSessionDescription);
  }

  /**
   * Send speaking state
   */
  setSpeaking(speaking: boolean, delay = 0): void {
    const payload = {
      op: VoiceGatewayOpcodes.SPEAKING,
      d: {
        speaking: speaking ? 1 : 0,
        delay,
        ssrc: this.ssrc,
      },
    };

    this.send(payload);
  }

  /**
   * Start heartbeat interval
   */
  private startHeartbeat(interval: number): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      if (!this.lastHeartbeatAck) {
        this.heartbeatMissed++;
        
        if (this.heartbeatMissed >= 3) {
          console.error('Voice heartbeat ACK not received, closing connection');
          this.close(VoiceCloseEventCodes.SESSION_TIMEOUT);
          return;
        }
      }

      this.lastHeartbeatAck = false;
      this.sendHeartbeat();
    }, interval);
  }

  /**
   * Send heartbeat
   */
  private sendHeartbeat(): void {
    const payload = {
      op: VoiceGatewayOpcodes.HEARTBEAT,
      d: this.sequence,
    };

    this.send(payload);
  }

  /**
   * Send payload to gateway
   */
  private send(payload: any): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.error('Voice WebSocket not connected');
      return;
    }

    try {
      this.ws.send(JSON.stringify(payload));
    } catch (error) {
      console.error('Failed to send voice gateway payload:', error);
    }
  }

  /**
   * Resume a voice connection
   */
  resume(): void {
    const payload = {
      op: VoiceGatewayOpcodes.RESUME,
      d: {
        server_id: this.options.serverId,
        session_id: this.options.sessionId,
        token: this.options.token,
      },
    };

    this.send(payload);
  }

  /**
   * Get connection info
   */
  getConnectionInfo() {
    return {
      ssrc: this.ssrc,
      ip: this.ip,
      port: this.port,
      modes: this.modes,
      encryptionMode: this.encryptionMode,
      secretKey: this.secretKey,
    };
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }

    if (this.connectionTimeout) {
      clearTimeout(this.connectionTimeout);
      this.connectionTimeout = undefined;
    }

    this.ready = false;
    this.lastHeartbeatAck = true;
    this.heartbeatMissed = 0;
  }

  /**
   * Close the WebSocket connection
   */
  close(code = 1000): void {
    this.cleanup();
    
    if (this.ws) {
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close(code);
      }
      this.ws = undefined;
    }
  }

  /**
   * Check if connected and ready
   */
  isReady(): boolean {
    return this.ready && this.ws?.readyState === WebSocket.OPEN;
  }
}