# discord-cf

> ⚠️ **This project is currently under development and not yet ready for production use.**

Discord.js互換のCloudflare Workers向けライブラリ。Discord APIをCloudflare Workers環境で使用できるように設計されています。

## 特徴

- 🚀 Cloudflare Workers環境に最適化
- 🔧 Fetch APIベースのREST APIクライアント
- 🔌 Cloudflare Durable ObjectsによるWebSocket Gateway接続（実験的）
- 📝 TypeScript完全対応
- 🎯 discord.js風の使いやすいAPI
- ⚡ 軽量で高速

## インストール

```bash
npm install discord-cf
```

## クイックスタート

### 1. Discord Botの作成

1. [Discord Developer Portal](https://discord.com/developers/applications)でアプリケーションを作成
2. Bot設定からトークンを取得
3. OAuth2 > URL GeneratorでBot権限を設定してサーバーに追加

### 2. Cloudflare Workerプロジェクトの作成

```bash
mkdir my-discord-bot
cd my-discord-bot
npm init -y
npm install discord-cf discord-interactions itty-router
npm install -D @cloudflare/workers-types wrangler typescript
```

### 3. 基本的なBotの実装

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
  // Discord署名の検証
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

  // Discord PINGへの応答
  if (interaction.type === InteractionType.Ping) {
    return new Response(JSON.stringify({ type: InteractionResponseType.Pong }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // スラッシュコマンドの処理
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

### 4. 設定ファイル

`wrangler.toml`:

```toml
name = "my-discord-bot"
main = "src/index.ts"
compatibility_date = "2024-06-01"
compatibility_flags = [ "nodejs_compat" ]

[vars]
DISCORD_APPLICATION_ID = "YOUR_APPLICATION_ID"
```

`.dev.vars` (開発用の環境変数):

```bash
# .dev.vars.example をコピーして作成
cp .dev.vars.example .dev.vars
# 編集して実際の値を入力
```

### 5. コマンドの登録

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

実行:

```bash
DISCORD_TOKEN="Bot YOUR_BOT_TOKEN" DISCORD_APPLICATION_ID="YOUR_APP_ID" node --loader tsx scripts/register-commands.ts
```

### 6. デプロイ

```bash
# ローカル開発
npx wrangler dev

# Cloudflareにデプロイ
npx wrangler deploy
```

## 高度な使用例

### REST APIの使用

```typescript
import { REST, API } from 'discord-cf';

const rest = new REST().setToken(env.DISCORD_TOKEN);
const api = new API(rest);

// メッセージを送信
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

// メッセージを編集
await api.channels.editMessage(channelId, messageId, {
  content: 'Updated message',
});

// メッセージを削除
await api.channels.deleteMessage(channelId, messageId);

// ユーザー情報を取得
const user = await api.users.get(userId);

// サーバー情報を取得
const guild = await api.guilds.get(guildId);

// サーバーメンバー一覧を取得
const members = await api.guilds.getMembers(guildId, { limit: 100 });
```

### インタラクションの遅延応答

```typescript
if (interaction.type === InteractionType.ApplicationCommand) {
  const commandInteraction = interaction as APIChatInputApplicationCommandInteraction;
  
  if (commandInteraction.data.name === 'complex-command') {
    // まず遅延応答を送信
    const deferResponse = new Response(JSON.stringify({
      type: InteractionResponseType.DeferredChannelMessageWithSource,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });

    // バックグラウンドで処理を実行
    ctx.waitUntil(
      (async () => {
        // 重い処理をシミュレート
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const rest = new REST().setToken(env.DISCORD_TOKEN);
        const api = new API(rest);
        
        // フォローアップメッセージを送信
        await api.interactions.editReply(
          env.DISCORD_APPLICATION_ID,
          commandInteraction.token,
          {
            content: '処理が完了しました！',
            embeds: [{
              title: '結果',
              description: '複雑な処理の結果をここに表示',
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

### Webhookの使用

```typescript
const api = new API(new REST());

// Webhookでメッセージを送信（認証不要）
await api.webhooks.execute(webhookId, webhookToken, {
  content: 'Webhook message',
  username: 'Custom Bot Name',
  avatar_url: 'https://example.com/avatar.png',
  embeds: [{
    title: 'Webhook Embed',
    description: 'This message was sent via webhook',
  }],
});

// Webhookメッセージを編集
await api.webhooks.editMessage(webhookId, webhookToken, messageId, {
  content: 'Updated webhook message',
});
```

### WebSocket Gateway (実験的)

**注意**: この機能はCloudflare Durable Objectsを使用するため、有料プランが必要です。

```typescript
import { GatewayClient, GatewayIntentBits, WebSocketHandler } from 'discord-cf';

// wrangler.tomlに追加
// [[durable_objects.bindings]]
// name = "WEBSOCKET_HANDLER"
// class_name = "WebSocketHandler"

export { WebSocketHandler };

// Worker内での使用
const gateway = new GatewayClient(env.WEBSOCKET_HANDLER, 'bot-instance');

await gateway.connect({
  token: env.DISCORD_TOKEN,
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// 接続状態の確認
const status = await gateway.getStatus();
console.log('Gateway connected:', status.connected);
```

## API リファレンス

### REST Client

```typescript
const rest = new REST(options?);

// メソッド
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

## サンプルプロジェクト

完全なサンプルプロジェクトは[examples/simple](./examples/simple)ディレクトリにあります。

```bash
cd examples/simple
npm install
npm run dev
```

## トラブルシューティング

### "Bad request signature" エラー
- `DISCORD_PUBLIC_KEY`が正しく設定されているか確認
- リクエストボディが変更されていないか確認

### "401 Unauthorized" エラー
- `DISCORD_TOKEN`が正しく設定されているか確認
- トークンに"Bot "プレフィックスが含まれているか確認

### Durable Objectsエラー
- Cloudflareの有料プランを使用しているか確認
- `wrangler.toml`にDurable Objectsの設定があるか確認

## 制限事項

- Cloudflare Workersの実行時間制限（10ms〜30秒）
- メモリ使用量の制限（128MB）
- 一部のdiscord.js機能は未実装
- Voice関連の機能は非対応

## コントリビュート

プルリクエストを歓迎します！

## ライセンス

MIT