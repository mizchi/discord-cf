export const API_VERSION = '10';
export const API_BASE = `https://discord.com/api/v${API_VERSION}`;
export const CDN_BASE = 'https://cdn.discordapp.com';

export const DEFAULT_USER_AGENT = 'CloudflareDiscordJS/0.1.0';

export enum RESTEvents {
  Debug = 'debug',
  RateLimited = 'rateLimited',
  Request = 'request',
  Response = 'response',
  RestDebug = 'restDebug',
}

export const DefaultRestOptions = {
  api: API_BASE,
  cdn: CDN_BASE,
  headers: {
    'User-Agent': DEFAULT_USER_AGENT,
  },
  retries: 3,
  timeout: 15_000,
} as const;