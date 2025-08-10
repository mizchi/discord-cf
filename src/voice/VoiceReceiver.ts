/**
 * Discord Voice Receiver
 * 
 * Receives and processes audio from other users
 * Note: Requires Node.js with UDP support
 */

import { EventEmitter } from 'events';
import type { VoiceUDPSocket, RTPPacket } from './udp.js';
import type { Snowflake } from 'discord-api-types/v10';

/**
 * Audio receive mode
 */
export enum AudioReceiveMode {
  /**
   * Receive PCM audio (decoded)
   */
  PCM = 'pcm',
  
  /**
   * Receive Opus audio (encoded)
   */
  Opus = 'opus',
}

/**
 * User audio stream
 */
export interface UserAudioStream {
  userId: Snowflake;
  ssrc: number;
  mode: AudioReceiveMode;
  stream: NodeJS.ReadableStream;
}

/**
 * Voice packet data
 */
export interface VoicePacketData {
  userId: Snowflake;
  ssrc: number;
  opus: Buffer;
  pcm?: Buffer;
  sequence: number;
  timestamp: number;
}

/**
 * Speaking state
 */
export interface SpeakingState {
  userId: Snowflake;
  ssrc: number;
  speaking: boolean;
  soundshare: boolean;
  priority: boolean;
}

/**
 * Voice Receiver implementation
 */
export class VoiceReceiver extends EventEmitter {
  private ssrcMap = new Map<number, Snowflake>();
  private userStreams = new Map<Snowflake, UserAudioStream>();
  private speakingMap = new Map<Snowflake, SpeakingState>();
  private udpSocket?: VoiceUDPSocket;
  private secretKey?: Uint8Array;
  private mode: AudioReceiveMode = AudioReceiveMode.Opus;

  constructor(udpSocket?: VoiceUDPSocket) {
    super();
    this.udpSocket = udpSocket;
    
    if (udpSocket) {
      this.setupUDPListeners();
    }
  }

  /**
   * Set up UDP socket listeners
   */
  private setupUDPListeners(): void {
    if (!this.udpSocket) return;

    // In a real implementation, the UDP socket would emit audio packets
    // For now, this is a placeholder
    console.log('Voice receiver initialized (receive not fully implemented)');
  }

  /**
   * Set the secret key for decryption
   */
  setSecretKey(key: Uint8Array): void {
    this.secretKey = key;
  }

  /**
   * Handle incoming RTP packet
   */
  handlePacket(buffer: Buffer): void {
    if (!this.secretKey) {
      console.error('No secret key set for decryption');
      return;
    }

    // Parse RTP header
    const rtpHeader = buffer.slice(0, 12);
    const ssrc = rtpHeader.readUInt32BE(8);
    
    // Get user ID from SSRC
    const userId = this.ssrcMap.get(ssrc);
    if (!userId) {
      console.log(`Unknown SSRC: ${ssrc}`);
      return;
    }

    // Decrypt audio data
    const encryptedAudio = buffer.slice(12);
    const decryptedOpus = this.decryptAudio(encryptedAudio, rtpHeader);
    
    if (!decryptedOpus) {
      console.error('Failed to decrypt audio');
      return;
    }

    // Create packet data
    const packetData: VoicePacketData = {
      userId,
      ssrc,
      opus: decryptedOpus,
      sequence: rtpHeader.readUInt16BE(2),
      timestamp: rtpHeader.readUInt32BE(4),
    };

    // Decode to PCM if needed
    if (this.mode === AudioReceiveMode.PCM) {
      packetData.pcm = this.decodeOpus(decryptedOpus);
    }

    // Emit packet event
    this.emit('packet', packetData);

    // Send to user stream if exists
    const stream = this.userStreams.get(userId);
    if (stream) {
      this.sendToStream(stream, packetData);
    }
  }

  /**
   * Decrypt audio data
   */
  private decryptAudio(encrypted: Buffer, nonce: Buffer): Buffer | null {
    if (!this.secretKey) return null;

    // This would use libsodium in a real implementation
    // crypto_secretbox_open_easy(decrypted, encrypted, nonce, this.secretKey)
    
    console.log('Audio decryption not implemented (requires libsodium)');
    return encrypted; // Return as-is for now
  }

  /**
   * Decode Opus to PCM
   */
  private decodeOpus(opus: Buffer): Buffer {
    // This would use an Opus decoder in a real implementation
    // For example: @discordjs/opus or opusscript
    
    console.log('Opus decoding not implemented (requires opus library)');
    return opus; // Return as-is for now
  }

  /**
   * Send packet data to stream
   */
  private sendToStream(stream: UserAudioStream, packet: VoicePacketData): void {
    const data = stream.mode === AudioReceiveMode.PCM ? packet.pcm : packet.opus;
    if (data) {
      // Write to stream
      (stream.stream as any).push(data);
    }
  }

  /**
   * Map SSRC to user ID
   */
  mapSSRC(ssrc: number, userId: Snowflake): void {
    this.ssrcMap.set(ssrc, userId);
    console.log(`Mapped SSRC ${ssrc} to user ${userId}`);
  }

  /**
   * Unmap SSRC
   */
  unmapSSRC(ssrc: number): void {
    const userId = this.ssrcMap.get(ssrc);
    if (userId) {
      this.ssrcMap.delete(ssrc);
      console.log(`Unmapped SSRC ${ssrc} from user ${userId}`);
    }
  }

  /**
   * Update speaking state
   */
  setSpeaking(userId: Snowflake, ssrc: number, speaking: boolean, soundshare = false, priority = false): void {
    const state: SpeakingState = {
      userId,
      ssrc,
      speaking,
      soundshare,
      priority,
    };

    this.speakingMap.set(userId, state);
    this.emit('speaking', state);
  }

  /**
   * Subscribe to a user's audio
   */
  subscribeToUser(userId: Snowflake, mode: AudioReceiveMode = AudioReceiveMode.Opus): UserAudioStream {
    // Check if already subscribed
    let stream = this.userStreams.get(userId);
    if (stream) {
      return stream;
    }

    // Create a new stream
    const { Readable } = require('stream');
    const audioStream = new Readable({
      read() {
        // No-op
      }
    });

    stream = {
      userId,
      ssrc: 0, // Will be set when we get SSRC mapping
      mode,
      stream: audioStream,
    };

    this.userStreams.set(userId, stream);
    this.emit('subscribe', userId);

    return stream;
  }

  /**
   * Unsubscribe from a user's audio
   */
  unsubscribeFromUser(userId: Snowflake): void {
    const stream = this.userStreams.get(userId);
    if (stream) {
      (stream.stream as any).destroy();
      this.userStreams.delete(userId);
      this.emit('unsubscribe', userId);
    }
  }

  /**
   * Get all subscribed users
   */
  getSubscriptions(): Snowflake[] {
    return Array.from(this.userStreams.keys());
  }

  /**
   * Set receive mode
   */
  setReceiveMode(mode: AudioReceiveMode): void {
    this.mode = mode;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    // Clean up all streams
    for (const stream of this.userStreams.values()) {
      (stream.stream as any).destroy();
    }
    
    this.userStreams.clear();
    this.ssrcMap.clear();
    this.speakingMap.clear();
    this.removeAllListeners();
  }
}

/**
 * Create a voice receiver
 */
export function createVoiceReceiver(udpSocket?: VoiceUDPSocket): VoiceReceiver {
  return new VoiceReceiver(udpSocket);
}