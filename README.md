# discord-cf

> ⚠️ **This project is currently under development and not yet ready for production use.**

A Discord.js-compatible library for Cloudflare Workers. Designed to use Discord API in the Cloudflare Workers environment.

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

### 1. Create a Discord Bot

1. Create an application at [Discord Developer Portal](https://discord.com/developers/applications)
2. Get the token from Bot settings
3. Set Bot permissions in OAuth2 > URL Generator and add to your server

### 2. Create a Cloudflare Worker Project

```bash
mkdir my-discord-bot
cd my-discord-bot
npm init -y
npm install discord-cf discord-interactions itty-router
npm install -D @cloudflare/workers-types wrangler typescript
```

### 3. Basic Bot Implementation

`src/index.ts`:

```typescript
import { Router } from 'itty-router';
import { verifyKey } from 'discord-interactions';
import { REST, API } from 'discord-cf';
import { 
  InteractionType, 
  InteractionResponseType,
  type APIInteraction,
  type APIChatInputApplicationCommandInteraction 
} from 'discord-api-types/v10';

interface Env {
  DISCORD_TOKEN: string;
  DISCORD_PUBLIC_KEY: string;
  DISCORD_APPLICATION_ID: string;
}

const router = Router();

router.post('/interactions', async (request, env: Env) => {
  // Verify Discord signature
  const signature = request.headers.get('X-Signature-Ed25519')!;
  const timestamp = request.headers.get('X-Signature-Timestamp')!;
  const body = await request.text();

  const isValidRequest = verifyKey(
    body,
    signature,
    timestamp,
    env.DISCORD_PUBLIC_KEY
  );

  if (!isValidRequest) {
    return new Response('Bad request signature', { status: 401 });
  }

  const interaction = JSON.parse(body) as APIInteraction;

  // Respond to Discord PING
  if (interaction.type === InteractionType.Ping) {
    return new Response(JSON.stringify({ type: InteractionResponseType.Pong }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Handle slash commands
  if (interaction.type === InteractionType.ApplicationCommand) {
    const commandInteraction = interaction as APIChatInputApplicationCommandInteraction;
    const rest = new REST().setToken(env.DISCORD_TOKEN);
    const api = new API(rest);

    switch (commandInteraction.data.name) {
      case 'hello':
        return new Response(JSON.stringify({
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content: 'Hello from Cloudflare Workers! 👋',
          },
        }), {
          headers: { 'Content-Type': 'application/json' },
        });

      case 'ping':
        return new Response(JSON.stringify({
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content: `Pong! 🏓`,
          },
        }), {
          headers: { 'Content-Type': 'application/json' },
        });

      default:
        return new Response(JSON.stringify({
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content: 'Unknown command',
          },
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
    }
  }

  return new Response('Unknown interaction type', { status: 400 });
});

router.all('*', () => new Response('Not Found', { status: 404 }));

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return router.handle(request, env);
  },
};
```

### 4. Configuration Files

`wrangler.toml`:

```toml
name = "my-discord-bot"
main = "src/index.ts"
compatibility_date = "2024-06-01"
compatibility_flags = [ "nodejs_compat" ]

[vars]
DISCORD_APPLICATION_ID = "YOUR_APPLICATION_ID"
```

`.dev.vars` (environment variables for development):

```bash
# Copy from .dev.vars.example
cp .dev.vars.example .dev.vars
# Edit and enter actual values
```

### 5. Register Commands

`scripts/register-commands.ts`:

```typescript
import { REST } from 'cloudflare-discord-js';
import { Routes } from 'discord-api-types/v10';

const commands = [
  {
    name: 'hello',
    description: 'Replies with a greeting',
  },
  {
    name: 'ping',
    description: 'Replies with Pong!',
  },
];

import { REST } from 'discord-cf';
import { Routes } from 'discord-api-types/v10';

const rest = new REST().setToken(process.env.DISCORD_TOKEN!);

async function registerCommands() {
  try {
    await rest.put(
      Routes.applicationCommands(process.env.DISCORD_APPLICATION_ID!),
      { body: commands }
    );
    console.log('Successfully registered commands!');
  } catch (error) {
    console.error(error);
  }
}

registerCommands();
```

Run:

```bash
DISCORD_TOKEN="Bot YOUR_BOT_TOKEN" DISCORD_APPLICATION_ID="YOUR_APP_ID" node --loader tsx scripts/register-commands.ts
```

### 6. Deploy

```bash
# Local development
npx wrangler dev

# Deploy to Cloudflare
npx wrangler deploy
```

## Advanced Usage

### Using REST API

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

### Deferred Interaction Response

```typescript
if (interaction.type === InteractionType.ApplicationCommand) {
  const commandInteraction = interaction as APIChatInputApplicationCommandInteraction;
  
  if (commandInteraction.data.name === 'complex-command') {
    // First send a deferred response
    const deferResponse = new Response(JSON.stringify({
      type: InteractionResponseType.DeferredChannelMessageWithSource,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

    // Execute processing in the background
    ctx.waitUntil(
      (async () => {
        // Simulate heavy processing
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const rest = new REST().setToken(env.DISCORD_TOKEN);
        const api = new API(rest);
        
        // Send follow-up message
        await api.interactions.editReply(
          env.DISCORD_APPLICATION_ID,
          commandInteraction.token,
          {
            content: 'Processing completed!',
            embeds: [{
              title: 'Results',
              description: 'Complex processing results displayed here',
              color: 0x00ff00,
            }],
          }
        );
      })()
    );

    return deferResponse;
  }
}
```

### Using Webhooks

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

## Sample Project

A complete sample project is available in the [examples/simple](./examples/simple) directory.

```bash
cd examples/simple
npm install
npm run dev
```

## Troubleshooting

### "Bad request signature" Error
- Verify that `DISCORD_PUBLIC_KEY` is correctly set
- Ensure the request body hasn't been modified

### "401 Unauthorized" Error
- Verify that `DISCORD_TOKEN` is correctly set
- Ensure the token includes the "Bot " prefix

### Durable Objects Error
- Verify you're using a paid Cloudflare plan
- Check that Durable Objects configuration exists in `wrangler.toml`

## Limitations

- Cloudflare Workers execution time limits (10ms-30 seconds)
- Memory usage limit (128MB)
- Some discord.js features are not yet implemented
- Voice-related features are not supported

## Contributing

Pull requests are welcome!

## License

MIT