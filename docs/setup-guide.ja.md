# Discord Bot セットアップガイド

このガイドでは、discord-cf と Cloudflare Workers を使用して Discord Bot をセットアップする手順を説明します。

## 前提条件

- Node.js 18+ がインストールされていること
- Cloudflare アカウントを持っていること
- TypeScript/JavaScript の基本的な知識があること

## ステップ 1: Discord アプリケーションの作成

1. [Discord Developer Portal](https://discord.com/developers/applications) にアクセス
2. 「New Application」をクリックして、アプリケーション名を入力
3. 左側のサイドバーから「Bot」セクションに移動
4. 「Add Bot」をクリックしてボットユーザーを作成
5. 「Token」の下にある「Copy」をクリックしてボットトークンをコピー
   - **重要**: このトークンは秘密にし、絶対にバージョン管理にコミットしないでください
6. 「Privileged Gateway Intents」で、ボットに必要なインテントを有効化：
   - Presence Intent（必要な場合）
   - Server Members Intent（必要な場合）
   - Message Content Intent（必要な場合）

## ステップ 2: ボットをサーバーに追加

1. Discord Developer Portal で「OAuth2」>「URL Generator」に移動
2. 「Scopes」で以下を選択：
   - `bot`
   - `applications.commands`（スラッシュコマンド用）
3. 「Bot Permissions」で、ボットに必要な権限を選択：
   - Send Messages（メッセージ送信）
   - Read Messages/View Channels（メッセージ読み取り/チャンネル表示）
   - Embed Links（埋め込みリンク）
   - Attach Files（ファイル添付）
   - Use Slash Commands（スラッシュコマンド使用）
   - その他、ボットに必要な権限
4. 生成されたURLをコピーしてブラウザで開く
5. ボットを追加したいサーバーを選択
6. 「認証」をクリック

## ステップ 3: Cloudflare Worker プロジェクトのセットアップ

### 新規プロジェクトの作成

```bash
mkdir my-discord-bot
cd my-discord-bot
npm init -y
```

### 依存関係のインストール

```bash
npm install discord-cf discord-interactions itty-router
npm install -D @cloudflare/workers-types wrangler typescript
```

### TypeScript 設定の作成

`tsconfig.json` を作成：

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

## ステップ 4: Wrangler の設定

`wrangler.toml` を作成：

```toml
name = "my-discord-bot"
main = "src/index.ts"
compatibility_date = "2024-06-01"
compatibility_flags = [ "nodejs_compat" ]

[vars]
# 公開環境変数
DISCORD_APPLICATION_ID = "YOUR_APPLICATION_ID"

# オプション: WebSocket 用の Durable Objects を使用する場合
# [[durable_objects.bindings]]
# name = "WEBSOCKET_HANDLER"
# class_name = "WebSocketHandler"
```

### 環境変数の設定

ローカル開発用に `.dev.vars` を作成：

```bash
# Discord Bot トークン（秘密にしてください！）
DISCORD_TOKEN=Bot YOUR_BOT_TOKEN_HERE

# Discord Public Key（インタラクション検証用）
DISCORD_PUBLIC_KEY=YOUR_PUBLIC_KEY_HERE

# Discord Application ID
DISCORD_APPLICATION_ID=YOUR_APPLICATION_ID_HERE
```

**重要**: `.dev.vars` を `.gitignore` ファイルに追加：

```bash
echo ".dev.vars" >> .gitignore
```

## ステップ 5: ボットの作成

### 基本的なボット構造

`src/index.ts` を作成：

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

// Discord インタラクションの処理
router.post('/interactions', async (request, env: Env) => {
  // リクエストが Discord からのものか検証
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

  // Discord の ping に応答
  if (interaction.type === InteractionType.Ping) {
    return new Response(JSON.stringify({ type: InteractionResponseType.Pong }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // スラッシュコマンドの処理
  if (interaction.type === InteractionType.ApplicationCommand) {
    const commandInteraction = interaction as APIChatInputApplicationCommandInteraction;
    
    // Discord API クライアントの初期化
    const rest = new REST().setToken(env.DISCORD_TOKEN);
    const api = new API(rest);

    // 各コマンドの処理
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
            content: `こんにちは、${user?.username}さん！ 👋`,
          },
        }), {
          headers: { 'Content-Type': 'application/json' },
        });

      default:
        return new Response(JSON.stringify({
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content: '不明なコマンドです',
          },
        }), {
          headers: { 'Content-Type': 'application/json' },
        });
    }
  }

  return new Response('Unknown interaction type', { status: 400 });
});

// デフォルトルート
router.all('*', () => new Response('Not Found', { status: 404 }));

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return router.handle(request, env);
  },
};
```

## ステップ 6: スラッシュコマンドの登録

`scripts/register-commands.ts` を作成：

```typescript
import { REST } from 'discord-cf';
import { Routes } from 'discord-api-types/v10';

const commands = [
  {
    name: 'ping',
    description: 'Pong! と返信します',
  },
  {
    name: 'hello',
    description: 'あなたに挨拶します',
  },
];

async function registerCommands() {
  const token = process.env.DISCORD_TOKEN;
  const applicationId = process.env.DISCORD_APPLICATION_ID;

  if (!token || !applicationId) {
    throw new Error('DISCORD_TOKEN または DISCORD_APPLICATION_ID が設定されていません');
  }

  const rest = new REST().setToken(token);

  try {
    console.log('スラッシュコマンドを登録中...');
    
    await rest.put(
      Routes.applicationCommands(applicationId),
      { body: commands }
    );
    
    console.log('スラッシュコマンドの登録に成功しました！');
  } catch (error) {
    console.error('コマンド登録エラー:', error);
  }
}

registerCommands();
```

コマンド登録スクリプトを実行：

```bash
DISCORD_TOKEN="Bot YOUR_BOT_TOKEN" DISCORD_APPLICATION_ID="YOUR_APP_ID" npx tsx scripts/register-commands.ts
```

## ステップ 7: ボットのデプロイ

### ローカルでテスト

```bash
npx wrangler dev
```

[ngrok](https://ngrok.com/) などのツールを使用してローカルサーバーを公開：

```bash
ngrok http 8787
```

Discord Developer Portal で Interactions Endpoint URL を ngrok の URL + `/interactions` に設定します。

### Cloudflare Workers へのデプロイ

```bash
npx wrangler deploy
```

デプロイ後、Discord アプリケーションの Interactions Endpoint URL を以下に更新：
```
https://your-worker-name.your-subdomain.workers.dev/interactions
```

## ステップ 8: 本番環境のシークレット設定

Cloudflare Workers でシークレットを設定：

```bash
npx wrangler secret put DISCORD_TOKEN
# プロンプトが表示されたらボットトークンを入力

npx wrangler secret put DISCORD_PUBLIC_KEY
# プロンプトが表示されたらパブリックキーを入力
```

## 高度な設定

### WebSocket 用の Durable Objects の使用

リアルタイムイベントが必要な場合、Durable Objects を使用できます（Cloudflare の有料プランが必要）：

1. `wrangler.toml` を更新：

```toml
[[durable_objects.bindings]]
name = "WEBSOCKET_HANDLER"
class_name = "WebSocketHandler"

[[migrations]]
tag = "v1"
new_classes = ["WebSocketHandler"]
```

2. Worker で WebSocketHandler をエクスポート：

```typescript
import { WebSocketHandler } from 'discord-cf';

export { WebSocketHandler };

// ... 残りの Worker コード
```

### 環境別の設定

異なる環境（開発、ステージング、本番）に対して、異なる wrangler 設定を使用できます：

```toml
# wrangler.production.toml
name = "my-discord-bot-prod"
vars = { ENVIRONMENT = "production" }

# wrangler.staging.toml  
name = "my-discord-bot-staging"
vars = { ENVIRONMENT = "staging" }
```

デプロイ方法：
```bash
npx wrangler deploy --env production
```

## トラブルシューティング

### よくある問題

1. **「Bad request signature」エラー**
   - `DISCORD_PUBLIC_KEY` が正しいことを確認
   - 検証前にリクエストボディを変更していないことを確認

2. **「401 Unauthorized」エラー**
   - ボットトークンに「Bot 」プレフィックスが含まれていることを確認
   - トークンが再生成されていないことを確認

3. **コマンドが表示されない**
   - コマンド登録後、数分待つ
   - Discord を更新してみる（Ctrl+R）
   - ボットを `applications.commands` スコープで招待したことを確認

4. **ボットが応答しない**
   - Cloudflare Workers のログを確認：`npx wrangler tail`
   - インタラクションエンドポイント URL が正しいことを確認
   - Worker がデプロイされて実行されていることを確認

## 次のステップ

- [API リファレンス](../README.md#api-reference)で利用可能なメソッドを学ぶ
- より複雑なボット実装について [examples](../examples) ディレクトリを確認
- 高度な機能について [Discord の API](https://discord.com/developers/docs/intro) を学ぶ