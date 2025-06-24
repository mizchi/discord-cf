import { Routes } from 'discord-api-types/v10';
import type {
  RESTPostAPIInteractionCallbackResult,
  RESTGetAPIInteractionOriginalResponseResult,
  RESTPatchAPIInteractionOriginalResponseJSONBody,
  RESTPatchAPIInteractionOriginalResponseResult,
  RESTDeleteAPIInteractionOriginalResponseResult,
  RESTPostAPIInteractionFollowupJSONBody,
  RESTPostAPIInteractionFollowupResult,
  RESTGetAPIInteractionFollowupResult,
  RESTPatchAPIInteractionFollowupJSONBody,
  RESTPatchAPIInteractionFollowupResult,
  RESTDeleteAPIInteractionFollowupResult,
  Snowflake,
  APIInteractionResponse,
} from 'discord-api-types/v10';
import type { REST, RequestData, RawFile } from '../rest/index.js';
import type { WebhooksAPI } from './webhooks.js';

export type CreateInteractionResponseOptions = APIInteractionResponse & {
  files?: RawFile[];
}

export interface EditInteractionResponseOptions {
  content?: RESTPatchAPIInteractionOriginalResponseJSONBody['content'];
  embeds?: RESTPatchAPIInteractionOriginalResponseJSONBody['embeds'];
  allowed_mentions?: RESTPatchAPIInteractionOriginalResponseJSONBody['allowed_mentions'];
  components?: RESTPatchAPIInteractionOriginalResponseJSONBody['components'];
  files?: RawFile[];
  attachments?: RESTPatchAPIInteractionOriginalResponseJSONBody['attachments'];
}

export interface CreateFollowupOptions {
  content?: RESTPostAPIInteractionFollowupJSONBody['content'];
  tts?: RESTPostAPIInteractionFollowupJSONBody['tts'];
  embeds?: RESTPostAPIInteractionFollowupJSONBody['embeds'];
  allowed_mentions?: RESTPostAPIInteractionFollowupJSONBody['allowed_mentions'];
  components?: RESTPostAPIInteractionFollowupJSONBody['components'];
  flags?: RESTPostAPIInteractionFollowupJSONBody['flags'];
  files?: RawFile[];
  attachments?: RESTPostAPIInteractionFollowupJSONBody['attachments'];
}

export interface EditFollowupOptions {
  content?: RESTPatchAPIInteractionFollowupJSONBody['content'];
  embeds?: RESTPatchAPIInteractionFollowupJSONBody['embeds'];
  allowed_mentions?: RESTPatchAPIInteractionFollowupJSONBody['allowed_mentions'];
  components?: RESTPatchAPIInteractionFollowupJSONBody['components'];
  files?: RawFile[];
  attachments?: RESTPatchAPIInteractionFollowupJSONBody['attachments'];
}

export class InteractionsAPI {
  public constructor(
    private readonly rest: REST,
    private readonly webhooks: WebhooksAPI,
  ) {}

  public async reply(
    interactionId: Snowflake,
    interactionToken: string,
    { files, ...body }: CreateInteractionResponseOptions,
    { auth, signal }: Pick<RequestData, 'auth' | 'signal'> = {},
  ) {
    return this.rest.post(Routes.interactionCallback(interactionId, interactionToken), {
      auth,
      files,
      body,
      signal,
    }) as Promise<RESTPostAPIInteractionCallbackResult>;
  }

  public async getOriginalResponse(
    applicationId: Snowflake,
    interactionToken: string,
    { signal }: Pick<RequestData, 'signal'> = {},
  ) {
    return this.webhooks.getMessage(
      applicationId,
      interactionToken,
      '@original',
      undefined,
      { signal },
    ) as Promise<RESTGetAPIInteractionOriginalResponseResult>;
  }

  public async editReply(
    applicationId: Snowflake,
    interactionToken: string,
    { files, ...body }: EditInteractionResponseOptions,
    { signal }: Pick<RequestData, 'signal'> = {},
  ) {
    return this.webhooks.editMessage(
      applicationId,
      interactionToken,
      '@original',
      { files, ...body },
      { signal },
    ) as Promise<RESTPatchAPIInteractionOriginalResponseResult>;
  }

  public async deleteReply(
    applicationId: Snowflake,
    interactionToken: string,
    { signal }: Pick<RequestData, 'signal'> = {},
  ) {
    return this.webhooks.deleteMessage(
      applicationId,
      interactionToken,
      '@original',
      undefined,
      { signal },
    ) as Promise<RESTDeleteAPIInteractionOriginalResponseResult>;
  }

  public async followUp(
    applicationId: Snowflake,
    interactionToken: string,
    { files, ...body }: CreateFollowupOptions,
    { signal }: Pick<RequestData, 'signal'> = {},
  ) {
    return this.webhooks.execute(
      applicationId,
      interactionToken,
      { wait: true, files, ...body },
      { signal },
    ) as Promise<RESTPostAPIInteractionFollowupResult>;
  }

  public async getFollowupMessage(
    applicationId: Snowflake,
    interactionToken: string,
    messageId: Snowflake,
    { signal }: Pick<RequestData, 'signal'> = {},
  ) {
    return this.webhooks.getMessage(
      applicationId,
      interactionToken,
      messageId,
      undefined,
      { signal },
    ) as Promise<RESTGetAPIInteractionFollowupResult>;
  }

  public async editFollowupMessage(
    applicationId: Snowflake,
    interactionToken: string,
    messageId: Snowflake,
    { files, ...body }: EditFollowupOptions,
    { signal }: Pick<RequestData, 'signal'> = {},
  ) {
    return this.webhooks.editMessage(
      applicationId,
      interactionToken,
      messageId,
      { files, ...body },
      { signal },
    ) as Promise<RESTPatchAPIInteractionFollowupResult>;
  }

  public async deleteFollowupMessage(
    applicationId: Snowflake,
    interactionToken: string,
    messageId: Snowflake,
    { signal }: Pick<RequestData, 'signal'> = {},
  ) {
    return this.webhooks.deleteMessage(
      applicationId,
      interactionToken,
      messageId,
      undefined,
      { signal },
    ) as Promise<RESTDeleteAPIInteractionFollowupResult>;
  }
}