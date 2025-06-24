import { Routes } from 'discord-api-types/v10';
import type {
  RESTGetAPICurrentUserResult,
  RESTGetAPIUserResult,
  RESTPatchAPICurrentUserJSONBody,
  RESTPatchAPICurrentUserResult,
  RESTGetAPICurrentUserGuildsQuery,
  RESTGetAPICurrentUserGuildsResult,
  RESTPostAPICurrentUserCreateDMChannelJSONBody,
  RESTPostAPICurrentUserCreateDMChannelResult,
  Snowflake,
} from 'discord-api-types/v10';
import type { REST, RequestData } from '../rest/index.js';
import { makeURLSearchParams } from '../rest/REST.js';

export class UsersAPI {
  public constructor(private readonly rest: REST) {}

  public async get(
    userId: Snowflake,
    { signal }: Pick<RequestData, 'signal'> = {},
  ) {
    return this.rest.get(Routes.user(userId), {
      signal,
    }) as Promise<RESTGetAPIUserResult>;
  }

  public async getCurrent(
    { signal }: Pick<RequestData, 'signal'> = {},
  ) {
    return this.rest.get(Routes.user('@me'), {
      signal,
    }) as Promise<RESTGetAPICurrentUserResult>;
  }

  public async edit(
    body: RESTPatchAPICurrentUserJSONBody,
    { signal }: Pick<RequestData, 'signal'> = {},
  ) {
    return this.rest.patch(Routes.user('@me'), {
      body,
      signal,
    }) as Promise<RESTPatchAPICurrentUserResult>;
  }

  public async getGuilds(
    query: RESTGetAPICurrentUserGuildsQuery = {},
    { signal }: Pick<RequestData, 'signal'> = {},
  ) {
    return this.rest.get(Routes.userGuilds(), {
      query: makeURLSearchParams(query),
      signal,
    }) as Promise<RESTGetAPICurrentUserGuildsResult>;
  }

  public async createDM(
    body: RESTPostAPICurrentUserCreateDMChannelJSONBody,
    { signal }: Pick<RequestData, 'signal'> = {},
  ) {
    return this.rest.post(Routes.userChannels(), {
      body,
      signal,
    }) as Promise<RESTPostAPICurrentUserCreateDMChannelResult>;
  }
}