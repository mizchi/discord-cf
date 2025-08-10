/**
 * Voice Adapter for Discord Voice Connections
 * 
 * Based on @discordjs/voice architecture
 * Provides abstraction layer between voice library and Discord gateway
 */

import { EventEmitter } from 'events';
import type { VoiceServerUpdate, VoiceStateUpdate } from './VoiceConnection.js';
import type { Snowflake } from 'discord-api-types/v10';

/**
 * Adapter methods for sending payloads
 */
export interface DiscordGatewayAdapterLibraryMethods {
  /**
   * Send payload to Discord gateway
   */
  sendPayload(payload: any): boolean;
  
  /**
   * Destroy the adapter
   */
  destroy(): void;
}

/**
 * Adapter implementation methods
 */
export interface DiscordGatewayAdapterImplementationMethods {
  /**
   * Called when adapter is ready
   */
  onReady(data: DiscordGatewayAdapterLibraryMethods): void;
  
  /**
   * Clean up adapter resources
   */
  destroy(): void;
}

/**
 * Create adapter signature
 */
export type DiscordGatewayAdapterCreator = (
  methods: DiscordGatewayAdapterImplementationMethods
) => DiscordGatewayAdapterLibraryMethods;

/**
 * Events emitted by adapters
 */
export interface AdapterEvents {
  voiceServerUpdate: (data: VoiceServerUpdate) => void;
  voiceStateUpdate: (data: VoiceStateUpdate) => void;
  ready: () => void;
  destroy: () => void;
}

/**
 * Base Voice Adapter
 */
export class VoiceAdapter extends EventEmitter implements DiscordGatewayAdapterImplementationMethods {
  private methods?: DiscordGatewayAdapterLibraryMethods;
  private destroyed = false;

  constructor() {
    super();
  }

  /**
   * Called when the adapter is ready
   */
  onReady(methods: DiscordGatewayAdapterLibraryMethods): void {
    if (this.destroyed) {
      throw new Error('Cannot ready destroyed adapter');
    }
    
    this.methods = methods;
    this.emit('ready');
  }

  /**
   * Send Voice State Update
   */
  sendVoiceStateUpdate(
    guildId: Snowflake,
    channelId: Snowflake | null,
    selfMute = false,
    selfDeaf = false
  ): boolean {
    if (!this.methods) {
      throw new Error('Adapter not ready');
    }

    return this.methods.sendPayload({
      op: 4, // VOICE_STATE_UPDATE
      d: {
        guild_id: guildId,
        channel_id: channelId,
        self_mute: selfMute,
        self_deaf: selfDeaf,
      },
    });
  }

  /**
   * Handle Voice Server Update from gateway
   */
  handleVoiceServerUpdate(data: VoiceServerUpdate): void {
    this.emit('voiceServerUpdate', data);
  }

  /**
   * Handle Voice State Update from gateway
   */
  handleVoiceStateUpdate(data: VoiceStateUpdate): void {
    this.emit('voiceStateUpdate', data);
  }

  /**
   * Destroy the adapter
   */
  destroy(): void {
    if (this.destroyed) return;
    
    this.destroyed = true;
    this.methods?.destroy();
    this.emit('destroy');
    this.removeAllListeners();
  }

  /**
   * Check if adapter is destroyed
   */
  isDestroyed(): boolean {
    return this.destroyed;
  }
}

/**
 * Create a standard Discord gateway adapter
 */
export function createDiscordJSAdapter(gateway: any): DiscordGatewayAdapterCreator {
  return (methods) => {
    // Listen for voice events from the main gateway
    const voiceServerUpdateHandler = (data: VoiceServerUpdate) => {
      methods.onReady({
        sendPayload: (payload) => {
          if (gateway.ws?.readyState === WebSocket.OPEN) {
            gateway.ws.send(JSON.stringify(payload));
            return true;
          }
          return false;
        },
        destroy: () => {
          gateway.off('VOICE_SERVER_UPDATE', voiceServerUpdateHandler);
          gateway.off('VOICE_STATE_UPDATE', voiceStateUpdateHandler);
        },
      });
      
      // Pass the event to the adapter
      if ('handleVoiceServerUpdate' in methods) {
        (methods as any).handleVoiceServerUpdate(data);
      }
    };

    const voiceStateUpdateHandler = (data: VoiceStateUpdate) => {
      if ('handleVoiceStateUpdate' in methods) {
        (methods as any).handleVoiceStateUpdate(data);
      }
    };

    gateway.on('VOICE_SERVER_UPDATE', voiceServerUpdateHandler);
    gateway.on('VOICE_STATE_UPDATE', voiceStateUpdateHandler);

    return {
      sendPayload: (payload) => {
        if (gateway.ws?.readyState === WebSocket.OPEN) {
          gateway.ws.send(JSON.stringify(payload));
          return true;
        }
        return false;
      },
      destroy: () => {
        gateway.off('VOICE_SERVER_UPDATE', voiceServerUpdateHandler);
        gateway.off('VOICE_STATE_UPDATE', voiceStateUpdateHandler);
      },
    };
  };
}

/**
 * Mock adapter for testing
 */
export class MockAdapter extends VoiceAdapter {
  private mockGateway: any;

  constructor(gateway?: any) {
    super();
    this.mockGateway = gateway || {
      send: () => true,
      on: () => {},
      off: () => {},
    };
    
    // Auto-ready the adapter
    setTimeout(() => {
      this.onReady({
        sendPayload: (payload) => {
          console.log('Mock sending payload:', payload);
          return true;
        },
        destroy: () => {
          console.log('Mock adapter destroyed');
        },
      });
    }, 0);
  }

  /**
   * Simulate Voice Server Update
   */
  simulateVoiceServerUpdate(token: string, endpoint: string, guildId: string): void {
    this.handleVoiceServerUpdate({
      token,
      endpoint,
      guild_id: guildId,
    });
  }

  /**
   * Simulate Voice State Update
   */
  simulateVoiceStateUpdate(sessionId: string, userId: string, guildId: string, channelId: string | null): void {
    this.handleVoiceStateUpdate({
      session_id: sessionId,
      user_id: userId,
      guild_id: guildId,
      channel_id: channelId,
      deaf: false,
      mute: false,
      self_deaf: false,
      self_mute: false,
    });
  }
}