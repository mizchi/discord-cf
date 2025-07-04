import { Routes } from 'discord-api-types/v10';
import type {
  RESTPostAPIChannelMessageJSONBody,
  RESTPostAPIChannelMessageResult,
  RESTPatchAPIChannelMessageJSONBody,
  RESTPatchAPIChannelMessageResult,
  RESTDeleteAPIChannelMessageResult,
  RESTGetAPIChannelMessageResult,
  RESTGetAPIChannelMessagesQuery,
  RESTGetAPIChannelMessagesResult,
  Snowflake,
} from 'discord-api-types/v10';
import type { REST, RequestData, RawFile } from '../rest/index.js';
import { makeURLSearchParams } from '../rest/REST.js';

export interface CreateMessageOptions extends RESTPostAPIChannelMessageJSONBody {
  files?: RawFile[];
}

export interface EditMessageOptions extends RESTPatchAPIChannelMessageJSONBody {
  files?: RawFile[];
}

export class ChannelsAPI {
  public constructor(private readonly rest: REST) {}

  public async createMessage(
    channelId: Snowflake,
    { files, ...body }: CreateMessageOptions,
    { auth, signal }: Pick<RequestData, 'auth' | 'signal'> = {},
  ) {
    return this.rest.post(Routes.channelMessages(channelId), {
      auth,
      files,
      body,
      signal,
    }) as Promise<RESTPostAPIChannelMessageResult>;
  }

  public async editMessage(
    channelId: Snowflake,
    messageId: Snowflake,
    { files, ...body }: EditMessageOptions,
    { auth, signal }: Pick<RequestData, 'auth' | 'signal'> = {},
  ) {
    return this.rest.patch(Routes.channelMessage(channelId, messageId), {
      auth,
      files,
      body,
      signal,
    }) as Promise<RESTPatchAPIChannelMessageResult>;
  }

  public async deleteMessage(
    channelId: Snowflake,
    messageId: Snowflake,
    { signal }: Pick<RequestData, 'signal'> = {},
  ) {
    return this.rest.delete(Routes.channelMessage(channelId, messageId), {
      signal,
    }) as Promise<RESTDeleteAPIChannelMessageResult>;
  }

  public async getMessage(
    channelId: Snowflake,
    messageId: Snowflake,
    { signal }: Pick<RequestData, 'signal'> = {},
  ) {
    return this.rest.get(Routes.channelMessage(channelId, messageId), {
      signal,
    }) as Promise<RESTGetAPIChannelMessageResult>;
  }

  public async getMessages(
    channelId: Snowflake,
    query: RESTGetAPIChannelMessagesQuery = {},
    { signal }: Pick<RequestData, 'signal'> = {},
  ) {
    return this.rest.get(Routes.channelMessages(channelId), {
      query: makeURLSearchParams(query),
      signal,
    }) as Promise<RESTGetAPIChannelMessagesResult>;
  }
}