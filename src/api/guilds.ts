import { Routes } from 'discord-api-types/v10';
import type {
  RESTGetAPIGuildResult,
  RESTPatchAPIGuildJSONBody,
  RESTPatchAPIGuildResult,
  RESTDeleteAPIGuildResult,
  RESTGetAPIGuildChannelsResult,
  RESTPostAPIGuildChannelJSONBody,
  RESTPostAPIGuildChannelResult,
  RESTGetAPIGuildMemberResult,
  RESTGetAPIGuildMembersQuery,
  RESTGetAPIGuildMembersResult,
  RESTGetAPIGuildRolesResult,
  RESTPostAPIGuildRoleJSONBody,
  RESTPostAPIGuildRoleResult,
  RESTPatchAPIGuildRoleJSONBody,
  RESTPatchAPIGuildRoleResult,
  RESTDeleteAPIGuildRoleResult,
  Snowflake,
} from 'discord-api-types/v10';
import type { REST, RequestData } from '../rest/index.js';
import { makeURLSearchParams } from '../rest/REST.js';

export class GuildsAPI {
  public constructor(private readonly rest: REST) {}

  public async get(
    guildId: Snowflake,
    { signal }: Pick<RequestData, 'signal'> = {},
  ) {
    return this.rest.get(Routes.guild(guildId), {
      signal,
    }) as Promise<RESTGetAPIGuildResult>;
  }

  public async edit(
    guildId: Snowflake,
    body: RESTPatchAPIGuildJSONBody,
    { signal }: Pick<RequestData, 'signal'> = {},
  ) {
    return this.rest.patch(Routes.guild(guildId), {
      body,
      signal,
    }) as Promise<RESTPatchAPIGuildResult>;
  }

  public async delete(
    guildId: Snowflake,
    { signal }: Pick<RequestData, 'signal'> = {},
  ) {
    return this.rest.delete(Routes.guild(guildId), {
      signal,
    }) as Promise<RESTDeleteAPIGuildResult>;
  }

  public async getChannels(
    guildId: Snowflake,
    { signal }: Pick<RequestData, 'signal'> = {},
  ) {
    return this.rest.get(Routes.guildChannels(guildId), {
      signal,
    }) as Promise<RESTGetAPIGuildChannelsResult>;
  }

  public async createChannel(
    guildId: Snowflake,
    body: RESTPostAPIGuildChannelJSONBody,
    { signal }: Pick<RequestData, 'signal'> = {},
  ) {
    return this.rest.post(Routes.guildChannels(guildId), {
      body,
      signal,
    }) as Promise<RESTPostAPIGuildChannelResult>;
  }

  public async getMember(
    guildId: Snowflake,
    userId: Snowflake,
    { signal }: Pick<RequestData, 'signal'> = {},
  ) {
    return this.rest.get(Routes.guildMember(guildId, userId), {
      signal,
    }) as Promise<RESTGetAPIGuildMemberResult>;
  }

  public async getMembers(
    guildId: Snowflake,
    query: RESTGetAPIGuildMembersQuery = {},
    { signal }: Pick<RequestData, 'signal'> = {},
  ) {
    return this.rest.get(Routes.guildMembers(guildId), {
      query: makeURLSearchParams(query),
      signal,
    }) as Promise<RESTGetAPIGuildMembersResult>;
  }

  public async getRoles(
    guildId: Snowflake,
    { signal }: Pick<RequestData, 'signal'> = {},
  ) {
    return this.rest.get(Routes.guildRoles(guildId), {
      signal,
    }) as Promise<RESTGetAPIGuildRolesResult>;
  }

  public async createRole(
    guildId: Snowflake,
    body: RESTPostAPIGuildRoleJSONBody,
    { signal }: Pick<RequestData, 'signal'> = {},
  ) {
    return this.rest.post(Routes.guildRoles(guildId), {
      body,
      signal,
    }) as Promise<RESTPostAPIGuildRoleResult>;
  }

  public async editRole(
    guildId: Snowflake,
    roleId: Snowflake,
    body: RESTPatchAPIGuildRoleJSONBody,
    { signal }: Pick<RequestData, 'signal'> = {},
  ) {
    return this.rest.patch(Routes.guildRole(guildId, roleId), {
      body,
      signal,
    }) as Promise<RESTPatchAPIGuildRoleResult>;
  }

  public async deleteRole(
    guildId: Snowflake,
    roleId: Snowflake,
    { signal }: Pick<RequestData, 'signal'> = {},
  ) {
    return this.rest.delete(Routes.guildRole(guildId, roleId), {
      signal,
    }) as Promise<RESTDeleteAPIGuildRoleResult>;
  }
}