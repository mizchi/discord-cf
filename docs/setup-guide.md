# Discord Bot Setup Guide

This guide will walk you through setting up a Discord bot using discord-cf with Cloudflare Workers.

## Prerequisites

- Node.js 18+ installed
- A Cloudflare account
- Basic knowledge of TypeScript/JavaScript

## Step 1: Create a Discord Application

1. Go to the [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Navigate to the "Bot" section in the left sidebar
4. Click "Add Bot" to create a bot user
5. Under "Token", click "Copy" to copy your bot token
   - **Important**: Keep this token secret and never commit it to version control
6. Under "Privileged Gateway Intents", enable the intents your bot needs:
   - Presence Intent (if needed)
   - Server Members Intent (if needed)
   - Message Content Intent (if needed)

## Step 2: Add Bot to Your Server

1. In the Discord Developer Portal, go to "OAuth2" > "URL Generator"
2. Under "Scopes", select:
   - `bot`
   - `applications.commands` (for slash commands)
3. Under "Bot Permissions", select the permissions your bot needs:
   - Send Messages
   - Read Messages/View Channels
   - Embed Links
   - Attach Files
   - Use Slash Commands
   - Any other permissions required for your bot
4. Copy the generated URL and open it in your browser
5. Select the server you want to add the bot to
6. Click "Authorize"

## Step 3: Set Up Your Cloudflare Worker Project

### Create a new project

```bash
mkdir my-discord-bot
cd my-discord-bot
npm init -y
```

### Install dependencies

```bash
npm install discord-cf discord-interactions itty-router
npm install -D @cloudflare/workers-types wrangler typescript
```

### Create TypeScript configuration

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2021",
    "module": "ES2022",
    "lib": ["ES2021"],
    "types": ["@cloudflare/workers-types"],
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules"]
}
```

## Step 4: Configure Wrangler

Create `wrangler.toml`:

```toml
name = "my-discord-bot"
main = "src/index.ts"
compatibility_date = "2024-06-01"
compatibility_flags = [ "nodejs_compat" ]

[vars]
# Public environment variables
DISCORD_APPLICATION_ID = "YOUR_APPLICATION_ID"

# Optional: If using Durable Objects for WebSocket
# [[durable_objects.bindings]]
# name = "WEBSOCKET_HANDLER"
# class_name = "WebSocketHandler"
```

### Set up environment variables

Create `.dev.vars` for local development:

```bash
# Discord Bot Token (keep this secret!)
DISCORD_TOKEN=Bot YOUR_BOT_TOKEN_HERE

# Discord Public Key (for verifying interactions)
DISCORD_PUBLIC_KEY=YOUR_PUBLIC_KEY_HERE

# Discord Application ID
DISCORD_APPLICATION_ID=YOUR_APPLICATION_ID_HERE
```

**Important**: Add `.dev.vars` to your `.gitignore` file:

```bash
echo ".dev.vars" >> .gitignore
```

## Step 5: Create Your Bot

### Basic bot structure

Create `src/index.ts`:

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

// Handle Discord interactions
router.post('/interactions', async (request, env: Env) => {
  // Verify the request is from Discord
  const signature = request.headers.get('X-Signature-Ed25519');
  const timestamp = request.headers.get('X-Signature-Timestamp');
  const body = await request.text();

  if (!signature || !timestamp) {
    return new Response('Missing headers', { status: 401 });
  }

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

  // Handle Discord ping
  if (interaction.type === InteractionType.Ping) {
    return new Response(JSON.stringify({ type: InteractionResponseType.Pong }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Handle slash commands
  if (interaction.type === InteractionType.ApplicationCommand) {
    const commandInteraction = interaction as APIChatInputApplicationCommandInteraction;
    
    // Initialize Discord API client
    const rest = new REST().setToken(env.DISCORD_TOKEN);
    const api = new API(rest);

    // Handle different commands
    switch (commandInteraction.data.name) {
      case 'ping':
        return new Response(JSON.stringify({
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content: 'Pong! 🏓',
          },
        }), {
          headers: { 'Content-Type': 'application/json' },
        });

      case 'hello':
        const user = commandInteraction.member?.user || commandInteraction.user;
        return new Response(JSON.stringify({
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content: `Hello ${user?.username}! 👋`,
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

// Default route
router.all('*', () => new Response('Not Found', { status: 404 }));

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return router.handle(request, env);
  },
};
```

## Step 6: Register Slash Commands

Create `scripts/register-commands.ts`:

```typescript
import { REST } from 'discord-cf';
import { Routes } from 'discord-api-types/v10';

const commands = [
  {
    name: 'ping',
    description: 'Replies with Pong!',
  },
  {
    name: 'hello',
    description: 'Says hello to you',
  },
];

async function registerCommands() {
  const token = process.env.DISCORD_TOKEN;
  const applicationId = process.env.DISCORD_APPLICATION_ID;

  if (!token || !applicationId) {
    throw new Error('Missing DISCORD_TOKEN or DISCORD_APPLICATION_ID');
  }

  const rest = new REST().setToken(token);

  try {
    console.log('Registering slash commands...');
    
    await rest.put(
      Routes.applicationCommands(applicationId),
      { body: commands }
    );
    
    console.log('Successfully registered slash commands!');
  } catch (error) {
    console.error('Error registering commands:', error);
  }
}

registerCommands();
```

Run the command registration script:

```bash
DISCORD_TOKEN="Bot YOUR_BOT_TOKEN" DISCORD_APPLICATION_ID="YOUR_APP_ID" npx tsx scripts/register-commands.ts
```

## Step 7: Deploy Your Bot

### Test locally

```bash
npx wrangler dev
```

Use a tool like [ngrok](https://ngrok.com/) to expose your local server:

```bash
ngrok http 8787
```

Then set the Interactions Endpoint URL in Discord Developer Portal to your ngrok URL + `/interactions`.

### Deploy to Cloudflare Workers

```bash
npx wrangler deploy
```

After deployment, update your Discord application's Interactions Endpoint URL to:
```
https://your-worker-name.your-subdomain.workers.dev/interactions
```

## Step 8: Set Production Secrets

Set your secrets in Cloudflare Workers:

```bash
npx wrangler secret put DISCORD_TOKEN
# Enter your bot token when prompted

npx wrangler secret put DISCORD_PUBLIC_KEY
# Enter your public key when prompted
```

## Advanced Configuration

### Using Durable Objects for WebSocket

If you need real-time events, you can use Durable Objects (requires paid Cloudflare plan):

1. Update `wrangler.toml`:

```toml
[[durable_objects.bindings]]
name = "WEBSOCKET_HANDLER"
class_name = "WebSocketHandler"

[[migrations]]
tag = "v1"
new_classes = ["WebSocketHandler"]
```

2. Export the WebSocketHandler in your worker:

```typescript
import { WebSocketHandler } from 'discord-cf';

export { WebSocketHandler };

// ... rest of your worker code
```

### Environment-specific Configuration

For different environments (development, staging, production), you can use different wrangler configurations:

```toml
# wrangler.production.toml
name = "my-discord-bot-prod"
vars = { ENVIRONMENT = "production" }

# wrangler.staging.toml  
name = "my-discord-bot-staging"
vars = { ENVIRONMENT = "staging" }
```

Deploy with:
```bash
npx wrangler deploy --env production
```

## Troubleshooting

### Common Issues

1. **"Bad request signature" error**
   - Make sure your `DISCORD_PUBLIC_KEY` is correct
   - Ensure you're not modifying the request body before verification

2. **"401 Unauthorized" error**
   - Check that your bot token includes the "Bot " prefix
   - Verify the token hasn't been regenerated

3. **Commands not showing up**
   - Wait a few minutes after registering commands
   - Try refreshing Discord (Ctrl+R)
   - Make sure you invited the bot with the `applications.commands` scope

4. **Bot not responding**
   - Check Cloudflare Workers logs: `npx wrangler tail`
   - Verify your interactions endpoint URL is correct
   - Ensure your worker is deployed and running

## Next Steps

- Explore the [API Reference](../README.md#api-reference) to learn about available methods
- Check out the [examples](../examples) directory for more complex bot implementations
- Learn about [Discord's API](https://discord.com/developers/docs/intro) for advanced features