/**
 * Discord Voice REST API endpoints
 */

import { Routes } from 'discord-api-types/v10';
import type { REST, RequestData } from '../rest/index.js';
import type { VoiceRegion, VoiceState } from '../voice/types.js';
import type { Snowflake } from 'discord-api-types/v10';

/**
 * Voice-related REST API endpoints
 */
export class VoiceAPI {
  public constructor(private readonly rest: REST) {}

  /**
   * Get available voice regions
   */
  public async listVoiceRegions(
    { signal }: Pick<RequestData, 'signal'> = {}
  ): Promise<VoiceRegion[]> {
    return this.rest.get(Routes.voiceRegions(), {
      signal,
    }) as Promise<VoiceRegion[]>;
  }

  /**
   * Get voice state for a user in a guild
   */
  public async getVoiceState(
    guildId: Snowflake,
    userId: Snowflake,
    { signal }: Pick<RequestData, 'signal'> = {}
  ): Promise<VoiceState> {
    return this.rest.get(Routes.guildVoiceState(guildId, userId), {
      signal,
    }) as Promise<VoiceState>;
  }

  /**
   * Modify current user's voice state in a guild
   * Requires MUTE_MEMBERS permission to suppress others
   */
  public async modifyCurrentUserVoiceState(
    guildId: Snowflake,
    channelId: Snowflake,
    options: {
      suppress?: boolean;
      requestToSpeakTimestamp?: string | null;
    } = {},
    { signal }: Pick<RequestData, 'signal'> = {}
  ): Promise<void> {
    return this.rest.patch(Routes.guildVoiceState(guildId, '@me'), {
      body: {
        channel_id: channelId,
        ...options,
      },
      signal,
    }) as Promise<void>;
  }

  /**
   * Modify another user's voice state in a guild
   * Requires MUTE_MEMBERS permission
   */
  public async modifyUserVoiceState(
    guildId: Snowflake,
    userId: Snowflake,
    channelId: Snowflake,
    options: {
      suppress?: boolean;
    } = {},
    { signal }: Pick<RequestData, 'signal'> = {}
  ): Promise<void> {
    return this.rest.patch(Routes.guildVoiceState(guildId, userId), {
      body: {
        channel_id: channelId,
        ...options,
      },
      signal,
    }) as Promise<void>;
  }

  /**
   * Get guild voice regions
   * Returns VIP servers when guild has VIP_REGIONS feature
   */
  public async getGuildVoiceRegions(
    guildId: Snowflake,
    { signal }: Pick<RequestData, 'signal'> = {}
  ): Promise<VoiceRegion[]> {
    return this.rest.get(`/guilds/${guildId}/regions`, {
      signal,
    }) as Promise<VoiceRegion[]>;
  }
}