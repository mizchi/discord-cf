import type { REST } from '../rest/index.js';
import { ChannelsAPI } from './channels.js';
import { InteractionsAPI } from './interactions.js';
import { WebhooksAPI } from './webhooks.js';
import { UsersAPI } from './users.js';
import { GuildsAPI } from './guilds.js';
import { VoiceAPI } from './voice.js';

export * from './channels.js';
export * from './interactions.js';
export * from './webhooks.js';
export * from './users.js';
export * from './guilds.js';
export * from './voice.js';

export class API {
  public readonly channels: ChannelsAPI;
  public readonly interactions: InteractionsAPI;
  public readonly webhooks: WebhooksAPI;
  public readonly users: UsersAPI;
  public readonly guilds: GuildsAPI;
  public readonly voice: VoiceAPI;

  public constructor(public readonly rest: REST) {
    this.channels = new ChannelsAPI(rest);
    this.webhooks = new WebhooksAPI(rest);
    this.users = new UsersAPI(rest);
    this.guilds = new GuildsAPI(rest);
    this.voice = new VoiceAPI(rest);
    this.interactions = new InteractionsAPI(rest, this.webhooks);
  }
}