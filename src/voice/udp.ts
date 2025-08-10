/**
 * Discord Voice UDP Socket Implementation
 * 
 * Note: This implementation requires Node.js runtime for UDP support.
 * It cannot run in Cloudflare Workers environment.
 */

import type { EventEmitter } from 'events';

// Discord Voice Protocol Constants
export const VOICE_PROTOCOL_VERSION = 4;
export const MAX_PACKET_SIZE = 1460;
export const KEEP_ALIVE_INTERVAL = 5000;
export const KEEP_ALIVE_RETRIES = 5;

// RTP Header Constants
export const RTP_HEADER_SIZE = 12;
export const RTP_VERSION = 2;
export const RTP_PAYLOAD_TYPE = 120; // Opus

// Opcodes for IP Discovery
export enum VoiceOpcodes {
  IP_DISCOVERY = 0x1,
  SELECT_PROTOCOL = 0x2,
  READY = 0x3,
  HEARTBEAT = 0x4,
  SESSION_DESCRIPTION = 0x5,
  SPEAKING = 0x6,
  HEARTBEAT_ACK = 0x7,
  RESUME = 0x8,
  HELLO = 0x9,
  RESUMED = 0xa,
  CLIENT_DISCONNECT = 0xd,
}

// Encryption modes supported by Discord
export enum EncryptionMode {
  XSALSA20_POLY1305_LITE = 'xsalsa20_poly1305_lite',
  XSALSA20_POLY1305_SUFFIX = 'xsalsa20_poly1305_suffix',
  XSALSA20_POLY1305 = 'xsalsa20_poly1305',
}

// Speaking flags
export enum SpeakingFlags {
  NONE = 0,
  MICROPHONE = 1 << 0,
  SOUNDSHARE = 1 << 1,
  PRIORITY = 1 << 2,
}

export interface VoiceUDPSocketConfig {
  ip: string;
  port: number;
  ssrc: number;
  encryptionMode: EncryptionMode;
  secretKey?: Uint8Array;
}

export interface IPDiscoveryResult {
  ip: string;
  port: number;
}

export interface RTPPacket {
  version: number;
  padding: boolean;
  extension: boolean;
  csrcCount: number;
  marker: boolean;
  payloadType: number;
  sequence: number;
  timestamp: number;
  ssrc: number;
  payload: Buffer;
}

/**
 * Voice UDP Socket for Discord Voice connections
 * Handles UDP communication, IP discovery, and RTP packet processing
 */
export class VoiceUDPSocket {
  private socket: any; // Will be dgram.Socket in Node.js
  private config: VoiceUDPSocketConfig;
  private sequence = 0;
  private timestamp = 0;
  private nonce = 0;
  private keepAliveTimer?: ReturnType<typeof setInterval>;
  private keepAliveCounter = 0;
  private closed = false;
  private ping = -1;
  private pingSendTime = 0;

  constructor(config: VoiceUDPSocketConfig) {
    this.config = config;
    // In Node.js environment, this would be:
    // this.socket = dgram.createSocket('udp4');
  }

  /**
   * Initialize the UDP socket
   */
  async connect(): Promise<void> {
    if (typeof (globalThis as any).window !== 'undefined') {
      throw new Error('UDP sockets are not supported in browser/Workers environment');
    }

    // Node.js implementation would be:
    /*
    const dgram = require('dgram');
    this.socket = dgram.createSocket('udp4');
    
    this.socket.on('message', this.handleMessage.bind(this));
    this.socket.on('error', this.handleError.bind(this));
    
    return new Promise((resolve) => {
      this.socket.once('listening', () => {
        this.startKeepAlive();
        resolve();
      });
      this.socket.bind();
    });
    */
    
    throw new Error('UDP socket implementation requires Node.js runtime');
  }

  /**
   * Perform IP discovery to determine external IP and port
   */
  async performIPDiscovery(): Promise<IPDiscoveryResult> {
    // Create IP discovery packet
    const packet = Buffer.alloc(74);
    
    // Type (2 bytes) - IP Discovery
    packet.writeUInt16BE(0x1, 0);
    
    // Length (2 bytes) - 70
    packet.writeUInt16BE(70, 2);
    
    // SSRC (4 bytes)
    packet.writeUInt32BE(this.config.ssrc, 4);
    
    // Address (64 bytes) - null terminated string
    // Port (2 bytes)
    
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('IP discovery timeout'));
      }, 5000);

      // In Node.js:
      /*
      const handler = (msg: Buffer) => {
        if (msg.readUInt16BE(0) !== 0x2) return;
        
        clearTimeout(timeout);
        
        // Parse response
        const ip = msg.slice(8, 72).toString('utf8').replace(/\0/g, '');
        const port = msg.readUInt16BE(72);
        
        this.socket.off('message', handler);
        resolve({ ip, port });
      };
      
      this.socket.on('message', handler);
      this.socket.send(packet, this.config.port, this.config.ip);
      */

      reject(new Error('IP discovery requires Node.js runtime'));
    });
  }

  /**
   * Create an RTP header for voice packets
   */
  private createRTPHeader(): Buffer {
    const header = Buffer.alloc(RTP_HEADER_SIZE);
    
    // Byte 0: Version (2 bits), Padding (1 bit), Extension (1 bit), CSRC count (4 bits)
    header[0] = (RTP_VERSION << 6) | 0;
    
    // Byte 1: Marker (1 bit), Payload type (7 bits)
    header[1] = RTP_PAYLOAD_TYPE;
    
    // Bytes 2-3: Sequence number
    header.writeUInt16BE(this.sequence, 2);
    this.sequence = (this.sequence + 1) & 0xFFFF;
    
    // Bytes 4-7: Timestamp
    header.writeUInt32BE(this.timestamp, 4);
    
    // Bytes 8-11: SSRC
    header.writeUInt32BE(this.config.ssrc, 8);
    
    return header;
  }

  /**
   * Parse an RTP packet
   */
  parseRTPPacket(buffer: Buffer): RTPPacket | null {
    if (buffer.length < RTP_HEADER_SIZE) {
      return null;
    }

    const byte0 = buffer[0];
    const byte1 = buffer[1];

    return {
      version: (byte0 >> 6) & 0x3,
      padding: !!(byte0 & 0x20),
      extension: !!(byte0 & 0x10),
      csrcCount: byte0 & 0x0F,
      marker: !!(byte1 & 0x80),
      payloadType: byte1 & 0x7F,
      sequence: buffer.readUInt16BE(2),
      timestamp: buffer.readUInt32BE(4),
      ssrc: buffer.readUInt32BE(8),
      payload: buffer.slice(RTP_HEADER_SIZE),
    };
  }

  /**
   * Encrypt audio data for transmission
   */
  private encryptPacket(opusPacket: Buffer): Buffer {
    if (!this.config.secretKey) {
      throw new Error('Secret key not set');
    }

    const header = this.createRTPHeader();
    
    switch (this.config.encryptionMode) {
      case EncryptionMode.XSALSA20_POLY1305_LITE: {
        // Nonce: 4 bytes appended to packet
        const nonceBuffer = Buffer.alloc(4);
        nonceBuffer.writeUInt32BE(this.nonce++, 0);
        
        // In Node.js with sodium:
        /*
        const sodium = require('sodium-native');
        const nonce = Buffer.alloc(24);
        nonceBuffer.copy(nonce);
        
        const encrypted = Buffer.alloc(opusPacket.length + sodium.crypto_secretbox_MACBYTES);
        sodium.crypto_secretbox_easy(encrypted, opusPacket, nonce, this.config.secretKey);
        
        return Buffer.concat([header, encrypted, nonceBuffer]);
        */
        break;
      }
      
      case EncryptionMode.XSALSA20_POLY1305: {
        // Nonce: RTP header
        // In Node.js with sodium:
        /*
        const sodium = require('sodium-native');
        const nonce = Buffer.alloc(24);
        header.copy(nonce);
        
        const encrypted = Buffer.alloc(opusPacket.length + sodium.crypto_secretbox_MACBYTES);
        sodium.crypto_secretbox_easy(encrypted, opusPacket, nonce, this.config.secretKey);
        
        return Buffer.concat([header, encrypted]);
        */
        break;
      }
      
      default:
        throw new Error(`Unsupported encryption mode: ${this.config.encryptionMode}`);
    }

    // Placeholder - actual implementation needs sodium
    return Buffer.concat([header, opusPacket]);
  }

  /**
   * Decrypt received audio data
   */
  private decryptPacket(packet: Buffer): Buffer | null {
    if (!this.config.secretKey) {
      return null;
    }

    const rtpHeader = packet.slice(0, RTP_HEADER_SIZE);
    
    switch (this.config.encryptionMode) {
      case EncryptionMode.XSALSA20_POLY1305_LITE: {
        // Nonce is last 4 bytes
        const encryptedAudio = packet.slice(RTP_HEADER_SIZE, -4);
        const nonceBuffer = packet.slice(-4);
        
        // In Node.js with sodium:
        /*
        const sodium = require('sodium-native');
        const nonce = Buffer.alloc(24);
        nonceBuffer.copy(nonce);
        
        const decrypted = Buffer.alloc(encryptedAudio.length - sodium.crypto_secretbox_MACBYTES);
        if (!sodium.crypto_secretbox_open_easy(decrypted, encryptedAudio, nonce, this.config.secretKey)) {
          return null;
        }
        return decrypted;
        */
        break;
      }
      
      case EncryptionMode.XSALSA20_POLY1305: {
        // Nonce is RTP header
        const encryptedAudio = packet.slice(RTP_HEADER_SIZE);
        
        // In Node.js with sodium:
        /*
        const sodium = require('sodium-native');
        const nonce = Buffer.alloc(24);
        rtpHeader.copy(nonce);
        
        const decrypted = Buffer.alloc(encryptedAudio.length - sodium.crypto_secretbox_MACBYTES);
        if (!sodium.crypto_secretbox_open_easy(decrypted, encryptedAudio, nonce, this.config.secretKey)) {
          return null;
        }
        return decrypted;
        */
        break;
      }
    }

    // Placeholder - actual implementation needs sodium
    return packet.slice(RTP_HEADER_SIZE);
  }

  /**
   * Send an audio packet
   */
  sendAudioPacket(opusPacket: Buffer): void {
    if (this.closed) return;

    const packet = this.encryptPacket(opusPacket);
    
    // In Node.js:
    /*
    this.socket.send(packet, this.config.port, this.config.ip, (err) => {
      if (err) {
        console.error('Failed to send audio packet:', err);
      }
    });
    */
    
    // Update timestamp (48kHz, 20ms frames = 960 samples per frame)
    this.timestamp = (this.timestamp + 960) & 0xFFFFFFFF;
  }

  /**
   * Send a keep-alive packet
   */
  private sendKeepAlive(): void {
    const packet = Buffer.alloc(8);
    packet.writeUInt32LE(this.keepAliveCounter++, 0);
    
    this.pingSendTime = Date.now();
    
    // In Node.js:
    /*
    this.socket.send(packet, this.config.port, this.config.ip);
    */
  }

  /**
   * Start keep-alive timer
   */
  private startKeepAlive(): void {
    this.keepAliveTimer = setInterval(() => {
      if (this.closed) {
        this.stopKeepAlive();
        return;
      }
      this.sendKeepAlive();
    }, KEEP_ALIVE_INTERVAL);
  }

  /**
   * Stop keep-alive timer
   */
  private stopKeepAlive(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = undefined;
    }
  }

  /**
   * Handle incoming UDP message
   */
  private handleMessage(msg: Buffer, rinfo: any): void {
    // Check if it's a keep-alive response
    if (msg.length === 8) {
      const counter = msg.readUInt32LE(0);
      if (counter === this.keepAliveCounter - 1) {
        this.ping = Date.now() - this.pingSendTime;
        return;
      }
    }

    // Otherwise, it's an RTP packet with audio data
    const rtpPacket = this.parseRTPPacket(msg);
    if (rtpPacket) {
      // Emit raw packet for receiver to process
      // this.emit('packet', msg, rtpPacket);
      
      // Also decrypt here if you want
      const decrypted = this.decryptPacket(msg);
      if (decrypted) {
        // this.emit('audio', rtpPacket.ssrc, decrypted);
      }
    }
  }

  /**
   * Handle socket errors
   */
  private handleError(error: Error): void {
    console.error('UDP socket error:', error);
    // this.emit('error', error);
  }

  /**
   * Get current ping
   */
  getPing(): number {
    return this.ping;
  }

  /**
   * Set the secret key for encryption
   */
  setSecretKey(key: Uint8Array): void {
    this.config.secretKey = key;
  }

  /**
   * Close the UDP socket
   */
  close(): void {
    this.closed = true;
    this.stopKeepAlive();
    
    // In Node.js:
    /*
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }
    */
  }
}

/**
 * Helper function to create speaking packet
 */
export function createSpeakingPacket(ssrc: number, flags: SpeakingFlags): Buffer {
  const packet = Buffer.alloc(12);
  packet.writeUInt32BE(ssrc, 0);
  packet.writeUInt32BE(flags, 4);
  packet.writeUInt32BE(0, 8); // Reserved
  return packet;
}

/**
 * Helper function to create silence frame (Opus)
 */
export function createSilenceFrame(): Buffer {
  // Opus silence frame
  return Buffer.from([0xF8, 0xFF, 0xFE]);
}