/**
 * Discord Voice API exports
 * 
 * Note: Full voice functionality requires Node.js runtime.
 * WebSocket components can work in Cloudflare Workers.
 */

// Core voice components
export { VoiceConnection, VoiceConnectionState } from './VoiceConnection.js';
export { VoiceWebSocket, VoiceGatewayOpcodes, VoiceCloseEventCodes } from './VoiceWebSocket.js';
export { 
  VoiceUDPSocket,
  EncryptionMode,
  SpeakingFlags,
  VoiceOpcodes,
  createSpeakingPacket,
  createSilenceFrame,
  VOICE_PROTOCOL_VERSION,
  RTP_HEADER_SIZE,
  RTP_VERSION,
  RTP_PAYLOAD_TYPE
} from './udp.js';
export {
  VoiceAdapter,
  createDiscordJSAdapter,
  MockAdapter
} from './VoiceAdapter.js';
export {
  AudioPlayer,
  AudioPlayerStatus,
  createAudioResource,
  NoOpAudioPlayer
} from './AudioPlayer.js';

// Re-export types
export type {
  VoiceConnectionOptions,
  VoiceServerUpdate,
  VoiceStateUpdate
} from './VoiceConnection.js';

export type {
  VoiceIdentify,
  VoiceReady,
  VoiceSessionDescription,
  SelectProtocol,
  VoiceWebSocketOptions
} from './VoiceWebSocket.js';

export type {
  VoiceUDPSocketConfig,
  IPDiscoveryResult,
  RTPPacket
} from './udp.js';

export type {
  DiscordGatewayAdapterCreator,
  DiscordGatewayAdapterLibraryMethods,
  DiscordGatewayAdapterImplementationMethods,
  AdapterEvents
} from './VoiceAdapter.js';

export type {
  AudioPlayerState,
  AudioResource,
  AudioPlayerBehaviors,
  CreateAudioResourceOptions
} from './AudioPlayer.js';

/**
 * Check if current environment supports full voice features
 */
export function isVoiceSupported(): boolean {
  return typeof process !== 'undefined' && 
         process.versions && 
         process.versions.node !== undefined;
}

/**
 * Voice feature detection
 */
export const VoiceFeatures = {
  /**
   * WebSocket voice gateway (Works in Workers)
   */
  webSocket: true,
  
  /**
   * UDP audio transmission (Node.js only)
   */
  udp: isVoiceSupported(),
  
  /**
   * Audio encoding/decoding (Node.js only)
   */
  opus: isVoiceSupported(),
  
  /**
   * Voice receiving (Node.js only)
   */
  receive: isVoiceSupported(),
} as const;