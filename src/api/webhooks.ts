import { Routes } from 'discord-api-types/v10';
import type {
  RESTPostAPIWebhookWithTokenJSONBody,
  RESTPostAPIWebhookWithTokenResult,
  RESTGetAPIWebhookWithTokenMessageResult,
  RESTPatchAPIWebhookWithTokenMessageJSONBody,
  RESTPatchAPIWebhookWithTokenMessageResult,
  RESTDeleteAPIWebhookWithTokenMessageResult,
  RESTPostAPIWebhookWithTokenWaitResult,
  Snowflake,
} from 'discord-api-types/v10';
import type { REST, RequestData, RawFile } from '../rest/index.js';
import { makeURLSearchParams } from '../rest/REST.js';

export interface ExecuteWebhookOptions extends RESTPostAPIWebhookWithTokenJSONBody {
  files?: RawFile[];
  wait?: boolean;
  thread_id?: Snowflake;
}

export interface EditWebhookMessageOptions extends RESTPatchAPIWebhookWithTokenMessageJSONBody {
  files?: RawFile[];
}

export class WebhooksAPI {
  public constructor(private readonly rest: REST) {}

  public async execute(
    id: Snowflake,
    token: string,
    { wait, thread_id, files, ...body }: ExecuteWebhookOptions,
    { auth, signal }: Pick<RequestData, 'auth' | 'signal'> = {},
  ) {
    const query = makeURLSearchParams({ wait, thread_id });
    
    return this.rest.post(Routes.webhook(id, token), {
      auth: false as any,
      query: query.toString() ? query : undefined,
      files,
      body,
      signal,
    }) as Promise<RESTPostAPIWebhookWithTokenResult | RESTPostAPIWebhookWithTokenWaitResult>;
  }

  public async getMessage(
    id: Snowflake,
    token: string,
    messageId: Snowflake,
    query?: { thread_id?: Snowflake },
    { signal }: Pick<RequestData, 'signal'> = {},
  ) {
    return this.rest.get(Routes.webhookMessage(id, token, messageId), {
      auth: false as any,
      query: query ? makeURLSearchParams(query) : undefined,
      signal,
    }) as Promise<RESTGetAPIWebhookWithTokenMessageResult>;
  }

  public async editMessage(
    id: Snowflake,
    token: string,
    messageId: Snowflake,
    { files, ...body }: EditWebhookMessageOptions,
    { signal }: Pick<RequestData, 'signal'> = {},
  ) {
    return this.rest.patch(Routes.webhookMessage(id, token, messageId), {
      auth: false as any,
      files,
      body,
      signal,
    }) as Promise<RESTPatchAPIWebhookWithTokenMessageResult>;
  }

  public async deleteMessage(
    id: Snowflake,
    token: string,
    messageId: Snowflake,
    query?: { thread_id?: Snowflake },
    { signal }: Pick<RequestData, 'signal'> = {},
  ) {
    return this.rest.delete(Routes.webhookMessage(id, token, messageId), {
      auth: false as any,
      query: query ? makeURLSearchParams(query) : undefined,
      signal,
    }) as Promise<RESTDeleteAPIWebhookWithTokenMessageResult>;
  }
}