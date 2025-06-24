# Discord Bot Example

Cloudflare Workers で動作する Discord Bot のサンプルです。

## セットアップ

1. 環境変数を設定

`.dev.vars` ファイルを作成:

```
DISCORD_TOKEN=your_bot_token
DISCORD_PUBLIC_KEY=your_public_key  
DISCORD_APPLICATION_ID=your_application_id
```

2. 依存関係をインストール

```bash
npm install
```

3. 開発サーバーを起動

```bash
npm run dev
```

## コマンドの登録

Discord Developer Portal でスラッシュコマンドを登録してください。

### Echo コマンド

```json
{
  "name": "echo",
  "description": "Echo a message",
  "options": [
    {
      "name": "message",
      "description": "The message to echo",
      "type": 3,
      "required": true
    }
  ]
}
```

### Followup コマンド

```json
{
  "name": "followup",
  "description": "Send a followup message"
}
```

## デプロイ

```bash
npm run deploy
```