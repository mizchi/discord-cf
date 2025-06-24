# discord-cf

> ⚠️ **This project is currently under development and not yet ready for production use.**

A Discord.js-compatible client library for Cloudflare Workers. This library provides a simple interface to interact with Discord API in the Cloudflare Workers environment.

## Features

- 🚀 Optimized for Cloudflare Workers environment
- 🔧 Fetch API-based REST API client
- 🔌 WebSocket Gateway connections via Cloudflare Durable Objects (experimental)
- 📝 Full TypeScript support
- 🎯 discord.js-style easy-to-use API
- ⚡ Lightweight and fast

## Installation

```bash
npm install discord-cf
```

## Quick Start

```typescript
import { REST, API } from 'discord-cf';

// Initialize the REST client
const rest = new REST().setToken('Bot YOUR_TOKEN');
const api = new API(rest);

// Send a message
await api.channels.createMessage('channel_id', {
  content: 'Hello from discord-cf!'
});

// Get user info
const user = await api.users.get('user_id');

// Create an embed message
await api.channels.createMessage('channel_id', {
  embeds: [{
    title: 'Example Embed',
    description: 'This is an example embed message',
    color: 0x00ff00
  }]
});
```

## Usage

### REST API Client

```typescript
import { REST, API } from 'discord-cf';

const rest = new REST().setToken(env.DISCORD_TOKEN);
const api = new API(rest);

// Send a message
await api.channels.createMessage(channelId, {
  content: 'Hello, World!',
  embeds: [{
    title: 'Welcome!',
    description: 'This is an embed message',
    color: 0x00ff00,
    fields: [
      {
        name: 'Field 1',
        value: 'Value 1',
        inline: true,
      },
      {
        name: 'Field 2', 
        value: 'Value 2',
        inline: true,
      },
    ],
    timestamp: new Date().toISOString(),
  }],
});

// Edit a message
await api.channels.editMessage(channelId, messageId, {
  content: 'Updated message',
});

// Delete a message
await api.channels.deleteMessage(channelId, messageId);

// Get user information
const user = await api.users.get(userId);

// Get guild information
const guild = await api.guilds.get(guildId);

// Get guild members list
const members = await api.guilds.getMembers(guildId, { limit: 100 });
```

### Interactions

```typescript
// Reply to an interaction
await api.interactions.reply(interactionId, interactionToken, {
  content: 'Thanks for using the command!'
});

// Edit an interaction reply
await api.interactions.editReply(applicationId, interactionToken, {
  content: 'Updated response'
});

// Send a follow-up message
await api.interactions.followUp(applicationId, interactionToken, {
  content: 'Here is additional information',
  embeds: [{
    title: 'Follow-up',
    description: 'Additional details'
  }]
});
```

### Webhooks

```typescript
const api = new API(new REST());

// Send message via webhook (no authentication required)
await api.webhooks.execute(webhookId, webhookToken, {
  content: 'Webhook message',
  username: 'Custom Bot Name',
  avatar_url: 'https://example.com/avatar.png',
  embeds: [{
    title: 'Webhook Embed',
    description: 'This message was sent via webhook',
  }],
});

// Edit webhook message
await api.webhooks.editMessage(webhookId, webhookToken, messageId, {
  content: 'Updated webhook message',
});
```

### WebSocket Gateway (Experimental)

**Note**: This feature requires a paid plan as it uses Cloudflare Durable Objects.

```typescript
import { GatewayClient, GatewayIntentBits, WebSocketHandler } from 'discord-cf';

// Add to wrangler.toml
// [[durable_objects.bindings]]
// name = "WEBSOCKET_HANDLER"
// class_name = "WebSocketHandler"

export { WebSocketHandler };

// Usage within Worker
const gateway = new GatewayClient(env.WEBSOCKET_HANDLER, 'bot-instance');

await gateway.connect({
  token: env.DISCORD_TOKEN,
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Check connection status
const status = await gateway.getStatus();
console.log('Gateway connected:', status.connected);
```

## API Reference

### REST Client

```typescript
const rest = new REST(options?);

// Methods
rest.setToken(token: string): REST
rest.get(route: string, options?: RequestData): Promise<unknown>
rest.post(route: string, options?: RequestData): Promise<unknown>
rest.patch(route: string, options?: RequestData): Promise<unknown>
rest.put(route: string, options?: RequestData): Promise<unknown>
rest.delete(route: string, options?: RequestData): Promise<unknown>
```

### API Modules

#### Channels API
```typescript
api.channels.createMessage(channelId, data)
api.channels.editMessage(channelId, messageId, data)
api.channels.deleteMessage(channelId, messageId)
api.channels.getMessage(channelId, messageId)
api.channels.getMessages(channelId, query?)
```

#### Interactions API
```typescript
api.interactions.reply(interactionId, token, data)
api.interactions.editReply(applicationId, token, data)
api.interactions.deleteReply(applicationId, token)
api.interactions.followUp(applicationId, token, data)
```

#### Webhooks API
```typescript
api.webhooks.execute(id, token, data)
api.webhooks.editMessage(id, token, messageId, data)
api.webhooks.deleteMessage(id, token, messageId)
```

#### Users API
```typescript
api.users.get(userId)
api.users.getCurrent()
api.users.edit(data)
api.users.getGuilds(query?)
```

#### Guilds API
```typescript
api.guilds.get(guildId)
api.guilds.edit(guildId, data)
api.guilds.getChannels(guildId)
api.guilds.createChannel(guildId, data)
api.guilds.getMember(guildId, userId)
api.guilds.getMembers(guildId, query?)
api.guilds.getRoles(guildId)
api.guilds.createRole(guildId, data)
```

## Examples

### Creating a Discord Bot with Cloudflare Workers

For a complete example of building a Discord bot using this library, see the [examples/simple](./examples/simple) directory.

### Basic Message Operations

```typescript
import { REST, API } from 'discord-cf';

const rest = new REST().setToken(process.env.DISCORD_TOKEN);
const api = new API(rest);

// Get channel messages
const messages = await api.channels.getMessages(channelId, { limit: 10 });

// React to a message
await api.channels.createReaction(channelId, messageId, '👍');

// Pin a message
await api.channels.pinMessage(channelId, messageId);
```

### Working with Guilds

```typescript
// Get guild information
const guild = await api.guilds.get(guildId);

// List guild channels
const channels = await api.guilds.getChannels(guildId);

// Create a new channel
const newChannel = await api.guilds.createChannel(guildId, {
  name: 'new-channel',
  type: 0, // GUILD_TEXT
});

// Get guild members
const members = await api.guilds.getMembers(guildId, {
  limit: 100,
  after: '0'
});
```

## Environment Configuration

### Required Environment Variables

```bash
# Discord Bot Token
DISCORD_TOKEN=Bot YOUR_BOT_TOKEN_HERE

# For webhook endpoints (optional)
DISCORD_PUBLIC_KEY=YOUR_PUBLIC_KEY_HERE
DISCORD_APPLICATION_ID=YOUR_APPLICATION_ID_HERE
```

### Using with Cloudflare Workers

```typescript
interface Env {
  DISCORD_TOKEN: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const rest = new REST().setToken(env.DISCORD_TOKEN);
    const api = new API(rest);
    
    // Your bot logic here
    return new Response('OK');
  },
};
```

## Limitations

- Cloudflare Workers execution time limits (10ms-30 seconds)
- Memory usage limit (128MB)
- Some discord.js features are not yet implemented
- Voice-related features are not supported

## Contributing

Pull requests are welcome!

## License

MIT