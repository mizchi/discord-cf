/**
 * Audio Player for Discord Voice
 * 
 * Based on @discordjs/voice AudioPlayer architecture
 * Manages audio playback states and resources
 */

import { EventEmitter } from 'events';
import type { VoiceConnection } from './VoiceConnection.js';
import { createSilenceFrame } from './udp.js';

/**
 * Audio player status
 */
export enum AudioPlayerStatus {
  /**
   * The player is idle (no audio to play)
   */
  Idle = 'idle',
  
  /**
   * The player is buffering audio
   */
  Buffering = 'buffering',
  
  /**
   * The player is actively playing audio
   */
  Playing = 'playing',
  
  /**
   * The player is paused
   */
  Paused = 'paused',
  
  /**
   * The player is auto-paused (no subscribers)
   */
  AutoPaused = 'autopaused',
}

/**
 * Audio player state
 */
export interface AudioPlayerState {
  status: AudioPlayerStatus;
  resource?: AudioResource;
  missedFrames: number;
  playbackDuration: number;
}

/**
 * Audio resource to play
 */
export interface AudioResource {
  /**
   * The audio stream or buffer
   */
  stream: NodeJS.ReadableStream | Buffer[];
  
  /**
   * Volume (0.0 - 1.0)
   */
  volume: number;
  
  /**
   * Whether the stream is already encoded in Opus
   */
  isOpus: boolean;
  
  /**
   * Sample rate (48000 for Discord)
   */
  sampleRate: number;
  
  /**
   * Number of channels (2 for stereo)
   */
  channels: number;
  
  /**
   * Metadata associated with this resource
   */
  metadata?: any;
  
  /**
   * Whether to inline volume
   */
  inlineVolume?: boolean;
}

/**
 * Audio player behaviors
 */
export interface AudioPlayerBehaviors {
  /**
   * What to do when no subscribers
   */
  noSubscriber?: 'pause' | 'play' | 'stop';
  
  /**
   * Maximum number of missed frames before pausing
   */
  maxMissedFrames?: number;
}

/**
 * Create audio resource options
 */
export interface CreateAudioResourceOptions {
  inputType?: 'opus' | 'pcm' | 'raw';
  metadata?: any;
  inlineVolume?: boolean;
}

/**
 * Audio Player implementation
 */
export class AudioPlayer extends EventEmitter {
  private state: AudioPlayerState = {
    status: AudioPlayerStatus.Idle,
    missedFrames: 0,
    playbackDuration: 0,
  };
  
  private behaviors: AudioPlayerBehaviors;
  private connections = new Set<VoiceConnection>();
  private intervalId?: ReturnType<typeof setInterval>;
  private lastFrameTime = 0;
  private debug: boolean;
  
  constructor(behaviors: AudioPlayerBehaviors = {}, debug = false) {
    super();
    this.behaviors = {
      noSubscriber: 'pause',
      maxMissedFrames: 5,
      ...behaviors,
    };
    this.debug = debug;
  }

  /**
   * Play an audio resource
   */
  play(resource: AudioResource): void {
    if (this.state.status !== AudioPlayerStatus.Idle) {
      this.stop();
    }

    this.state = {
      status: AudioPlayerStatus.Buffering,
      resource,
      missedFrames: 0,
      playbackDuration: 0,
    };

    this.emit('stateChange', this.state, AudioPlayerStatus.Idle);
    
    // Start playback after buffering
    setTimeout(() => {
      if (this.state.status === AudioPlayerStatus.Buffering) {
        this.startPlayback();
      }
    }, 100);
  }

  /**
   * Start playback
   */
  private startPlayback(): void {
    if (this.state.status !== AudioPlayerStatus.Buffering) return;
    
    const oldStatus = this.state.status;
    this.state.status = AudioPlayerStatus.Playing;
    this.emit('stateChange', this.state, oldStatus);
    
    this.lastFrameTime = Date.now();
    
    // Send audio frames every 20ms (48kHz, 960 samples per frame)
    this.intervalId = setInterval(() => {
      this.sendNextFrame();
    }, 20);
  }

  /**
   * Send next audio frame
   */
  private sendNextFrame(): void {
    if (this.state.status !== AudioPlayerStatus.Playing) return;
    
    const now = Date.now();
    const expectedTime = this.lastFrameTime + 20;
    
    // Check for missed frames
    if (now - expectedTime > 5) {
      this.state.missedFrames++;
      if (this.debug) {
        console.log(`Missed frame! Total: ${this.state.missedFrames}`);
      }
      
      if (this.state.missedFrames >= this.behaviors.maxMissedFrames!) {
        this.pause();
        return;
      }
    } else {
      this.state.missedFrames = 0;
    }
    
    // Get next audio frame
    const frame = this.getNextFrame();
    
    if (!frame) {
      // No more audio
      this.stop();
      return;
    }
    
    // Send to all subscribed connections
    for (const connection of this.connections) {
      connection.sendAudioPacket(frame);
    }
    
    this.state.playbackDuration += 20;
    this.lastFrameTime = now;
  }

  /**
   * Get next audio frame from resource
   */
  private getNextFrame(): Buffer | null {
    if (!this.state.resource) return null;
    
    // For now, return silence frames
    // In a real implementation, this would read from the audio stream
    // and encode it to Opus if necessary
    
    if (this.state.playbackDuration > 5000) {
      // Stop after 5 seconds for demo
      return null;
    }
    
    return createSilenceFrame();
  }

  /**
   * Pause playback
   */
  pause(): void {
    if (this.state.status !== AudioPlayerStatus.Playing) return;
    
    const oldStatus = this.state.status;
    this.state.status = AudioPlayerStatus.Paused;
    this.emit('stateChange', this.state, oldStatus);
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
  }

  /**
   * Resume playback
   */
  resume(): void {
    if (this.state.status !== AudioPlayerStatus.Paused) return;
    
    const oldStatus = this.state.status;
    this.state.status = AudioPlayerStatus.Playing;
    this.emit('stateChange', this.state, oldStatus);
    
    this.lastFrameTime = Date.now();
    this.intervalId = setInterval(() => {
      this.sendNextFrame();
    }, 20);
  }

  /**
   * Stop playback
   */
  stop(force = false): void {
    if (this.state.status === AudioPlayerStatus.Idle && !force) return;
    
    const oldStatus = this.state.status;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    
    // Send silence frames to signal end
    for (let i = 0; i < 5; i++) {
      const silence = createSilenceFrame();
      for (const connection of this.connections) {
        connection.sendAudioPacket(silence);
      }
    }
    
    this.state = {
      status: AudioPlayerStatus.Idle,
      missedFrames: 0,
      playbackDuration: 0,
    };
    
    this.emit('stateChange', this.state, oldStatus);
    this.emit('idle');
  }

  /**
   * Subscribe a voice connection to this player
   */
  subscribe(connection: VoiceConnection): void {
    this.connections.add(connection);
    
    if (this.connections.size === 1 && this.state.status === AudioPlayerStatus.AutoPaused) {
      // Resume from auto-pause
      const oldStatus = this.state.status;
      this.state.status = AudioPlayerStatus.Playing;
      this.emit('stateChange', this.state, oldStatus);
      this.startPlayback();
    }
    
    this.emit('subscribe', connection);
  }

  /**
   * Unsubscribe a voice connection
   */
  unsubscribe(connection: VoiceConnection): void {
    const deleted = this.connections.delete(connection);
    
    if (deleted) {
      if (this.connections.size === 0 && this.state.status === AudioPlayerStatus.Playing) {
        // Handle no subscriber behavior
        switch (this.behaviors.noSubscriber) {
          case 'pause':
            const oldStatus = this.state.status;
            this.state.status = AudioPlayerStatus.AutoPaused;
            this.emit('stateChange', this.state, oldStatus);
            if (this.intervalId) {
              clearInterval(this.intervalId);
              this.intervalId = undefined;
            }
            break;
          case 'stop':
            this.stop();
            break;
          // 'play' continues playing
        }
      }
      
      this.emit('unsubscribe', connection);
    }
  }

  /**
   * Get current state
   */
  getState(): AudioPlayerState {
    return { ...this.state };
  }

  /**
   * Check if player can play
   */
  checkPlayable(): boolean {
    return this.state.status === AudioPlayerStatus.Idle;
  }

  /**
   * Destroy the player
   */
  destroy(): void {
    this.stop(true);
    this.connections.clear();
    this.removeAllListeners();
  }
}

/**
 * Create an audio resource from various sources
 */
export function createAudioResource(
  input: NodeJS.ReadableStream | Buffer | string,
  options: CreateAudioResourceOptions = {}
): AudioResource {
  // Determine input type
  let stream: NodeJS.ReadableStream | Buffer[];
  let isOpus = false;
  
  if (Buffer.isBuffer(input)) {
    stream = [input];
  } else if (typeof input === 'string') {
    // Assume it's a file path - would need fs module in Node.js
    throw new Error('File path input not supported in this implementation');
  } else {
    stream = input;
  }
  
  // Check if already Opus encoded
  if (options.inputType === 'opus') {
    isOpus = true;
  }
  
  return {
    stream,
    volume: 1.0,
    isOpus,
    sampleRate: 48000,
    channels: 2,
    metadata: options.metadata,
    inlineVolume: options.inlineVolume || false,
  };
}

/**
 * No-op audio player for testing
 */
export class NoOpAudioPlayer extends AudioPlayer {
  play(resource: AudioResource): void {
    console.log('NoOp: Playing audio resource');
    super.play(resource);
  }
  
  pause(): void {
    console.log('NoOp: Pausing');
    super.pause();
  }
  
  resume(): void {
    console.log('NoOp: Resuming');
    super.resume();
  }
  
  stop(): void {
    console.log('NoOp: Stopping');
    super.stop();
  }
}