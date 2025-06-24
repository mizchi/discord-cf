import { Router } from 'itty-router';
import { verifyKey } from 'discord-interactions';
import { REST, API } from 'cloudflare-discord-js';
import { 
  InteractionType, 
  InteractionResponseType, 
  type APIInteraction,
  type APIApplicationCommandInteraction,
  type APIChatInputApplicationCommandInteraction 
} from 'discord-api-types/v10';

export interface Env {
  DISCORD_TOKEN: string;
  DISCORD_PUBLIC_KEY: string;
  DISCORD_APPLICATION_ID: string;
  WEBSOCKET_HANDLER: DurableObjectNamespace;
}

const router = Router();

router.post('/interactions', async (request: Request, env: Env) => {
  const signature = request.headers.get('X-Signature-Ed25519')!;
  const timestamp = request.headers.get('X-Signature-Timestamp')!;
  const body = await request.text();

  const isValidRequest = verifyKey(
    body,
    signature,
    timestamp,
    env.DISCORD_PUBLIC_KEY,
  );

  if (!isValidRequest) {
    return new Response('Bad request signature', { status: 401 });
  }

  const interaction = JSON.parse(body) as APIInteraction;

  if (interaction.type === InteractionType.Ping) {
    return new Response(JSON.stringify({ type: InteractionResponseType.Pong }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (interaction.type === InteractionType.ApplicationCommand) {
    const commandInteraction = interaction as APIChatInputApplicationCommandInteraction;
    const rest = new REST().setToken(env.DISCORD_TOKEN);
    const api = new API(rest);

    // Example: Echo command
    if (commandInteraction.data.name === 'echo') {
      const messageOption = commandInteraction.data.options?.find(
        (opt) => opt.name === 'message' && 'value' in opt
      );
      const message = messageOption && 'value' in messageOption ? messageOption.value : 'Hello from Cloudflare Workers!';

      return new Response(JSON.stringify({
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          content: message,
        },
      }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Example: Send a follow-up message
    if (commandInteraction.data.name === 'followup') {
      // Acknowledge first
      const response = new Response(JSON.stringify({
        type: InteractionResponseType.DeferredChannelMessageWithSource,
      }), {
        headers: { 'Content-Type': 'application/json' },
      });

      // Send follow-up after response
      request.headers.set('cf-worker', 'true');
      const ctx = {
        waitUntil: (promise: Promise<any>) => promise,
      } as any;

      ctx.waitUntil(
        api.interactions.followUp(
          env.DISCORD_APPLICATION_ID,
          commandInteraction.token,
          {
            content: 'This is a follow-up message!',
          },
        ),
      );

      return response;
    }
  }

  return new Response(JSON.stringify({
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content: 'Unknown command',
    },
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

router.all('*', () => new Response('Not Found', { status: 404 }));

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return router.handle(request, env, ctx);
  },
};

export { WebSocketHandler } from 'cloudflare-discord-js';