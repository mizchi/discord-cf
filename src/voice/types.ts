/**
 * Discord Voice API type definitions
 */

import type { Snowflake } from 'discord-api-types/v10';

/**
 * Voice region information
 */
export interface VoiceRegion {
  id: string;
  name: string;
  optimal: boolean;
  deprecated: boolean;
  custom: boolean;
}

/**
 * Voice state object
 */
export interface VoiceState {
  guild_id?: Snowflake;
  channel_id: Snowflake | null;
  user_id: Snowflake;
  member?: any;
  session_id: string;
  deaf: boolean;
  mute: boolean;
  self_deaf: boolean;
  self_mute: boolean;
  self_stream?: boolean;
  self_video: boolean;
  suppress: boolean;
  request_to_speak_timestamp: string | null;
}

/**
 * Audio receive stream options
 */
export interface AudioReceiveStreamOptions {
  mode: 'pcm' | 'opus';
  /**
   * Whether to automatically end the stream when silence is detected
   */
  silenceOnEnd?: boolean;
}

/**
 * Voice metrics
 */
export interface VoiceMetrics {
  /**
   * Current ping to voice server in ms
   */
  ping: number;
  
  /**
   * Packets sent
   */
  packetsSent: number;
  
  /**
   * Packets lost
   */
  packetsLost: number;
  
  /**
   * Average packet loss rate
   */
  lossRate: number;
  
  /**
   * Current jitter buffer size
   */
  jitterBuffer: number;
}

/**
 * Audio player state
 */
export enum AudioPlayerStatus {
  IDLE = 'idle',
  BUFFERING = 'buffering',
  PLAYING = 'playing',
  PAUSED = 'paused',
  AUTO_PAUSED = 'autopaused',
}

/**
 * Audio resource for playing
 */
export interface AudioResource {
  /**
   * The audio stream or buffer
   */
  stream: any;
  
  /**
   * Volume (0.0 - 1.0)
   */
  volume?: number;
  
  /**
   * Whether the stream is already encoded in Opus
   */
  isOpus?: boolean;
  
  /**
   * Metadata associated with this resource
   */
  metadata?: any;
}

/**
 * Voice adapter for different platforms
 */
export interface VoiceAdapter {
  /**
   * Send payload to Discord gateway
   */
  sendPayload(payload: any): void;
  
  /**
   * Cleanup adapter resources
   */
  destroy(): void;
}

/**
 * Voice data packet
 */
export interface VoicePacket {
  /**
   * User ID of the speaker
   */
  userId: Snowflake;
  
  /**
   * SSRC of the audio stream
   */
  ssrc: number;
  
  /**
   * Opus audio data
   */
  audioBuffer: Buffer;
  
  /**
   * RTP sequence number
   */
  sequence: number;
  
  /**
   * RTP timestamp
   */
  timestamp: number;
}

/**
 * Options for creating audio player
 */
export interface CreateAudioPlayerOptions {
  /**
   * Behaviors to apply to the audio player
   */
  behaviors?: {
    /**
     * Whether to automatically pause when no subscribers
     */
    noSubscriber?: 'pause' | 'play' | 'stop';
    
    /**
     * Maximum number of missed frames before pausing
     */
    maxMissedFrames?: number;
  };
  
  /**
   * Debug mode
   */
  debug?: boolean;
}

/**
 * Voice connection configuration
 */
export interface VoiceConfig {
  /**
   * Whether to automatically reconnect on disconnect
   */
  autoReconnect?: boolean;
  
  /**
   * Maximum reconnection attempts
   */
  maxReconnectAttempts?: number;
  
  /**
   * Reconnection delay in ms
   */
  reconnectDelay?: number;
  
  /**
   * Whether to enable voice activity detection
   */
  voiceActivityDetection?: boolean;
  
  /**
   * Audio bitrate (8000 - 128000)
   */
  bitrate?: number;
  
  /**
   * Whether to prioritize audio quality over latency
   */
  highQuality?: boolean;
  
  /**
   * Custom voice adapter
   */
  adapter?: VoiceAdapter;
}

/**
 * Voice recorder options
 */
export interface VoiceRecorderOptions {
  /**
   * Users to record (empty = all users)
   */
  users?: Snowflake[];
  
  /**
   * Output format
   */
  format?: 'pcm' | 'opus' | 'ogg' | 'webm';
  
  /**
   * Sample rate for PCM
   */
  sampleRate?: number;
  
  /**
   * Number of channels
   */
  channels?: 1 | 2;
  
  /**
   * Separate files per user
   */
  separateUsers?: boolean;
}

/**
 * Voice permission overrides
 */
export interface VoicePermissions {
  /**
   * Can connect to voice channels
   */
  connect?: boolean;
  
  /**
   * Can speak in voice channels
   */
  speak?: boolean;
  
  /**
   * Can stream video
   */
  stream?: boolean;
  
  /**
   * Can use voice activity detection
   */
  useVAD?: boolean;
  
  /**
   * Can use priority speaker
   */
  prioritySpeaker?: boolean;
  
  /**
   * Can mute members
   */
  muteMembers?: boolean;
  
  /**
   * Can deafen members
   */
  deafenMembers?: boolean;
  
  /**
   * Can move members between channels
   */
  moveMembers?: boolean;
}

/**
 * Events emitted by voice connections
 */
export interface VoiceConnectionEvents {
  /**
   * Connection state changed
   */
  stateChange: (oldState: string, newState: string) => void;
  
  /**
   * Connection is ready
   */
  ready: () => void;
  
  /**
   * Connection error occurred
   */
  error: (error: Error) => void;
  
  /**
   * Connection was disconnected
   */
  disconnected: (reason?: string) => void;
  
  /**
   * Started reconnecting
   */
  reconnecting: (attempt: number) => void;
  
  /**
   * Debug information
   */
  debug: (message: string) => void;
  
  /**
   * User started speaking
   */
  speaking: (userId: Snowflake, ssrc: number) => void;
  
  /**
   * Received audio packet
   */
  packet: (packet: VoicePacket) => void;
}