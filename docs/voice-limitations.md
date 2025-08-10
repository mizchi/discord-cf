# Discord 音声機能の制限事項

## Cloudflare Workers での音声機能について

Discord の音声機能は、Cloudflare Workers 環境では**実装できません**。以下がその理由です：

### 技術的制限

#### 1. UDP プロトコルの必要性
- Discord 音声は WebRTC ベースで UDP 通信を使用
- Cloudflare Workers は HTTP/WebSocket のみサポート
- 音声データの送受信には UDP が必須

#### 2. ステートフル接続の要求
- 音声接続は長時間のステートフル接続が必要
- Workers は本質的にステートレス
- Durable Objects を使用しても UDP はサポートされない

#### 3. リアルタイム処理要件
- 20ms ごとの音声フレーム処理が必要
- Workers の CPU 時間制限（50ms）では不十分
- 低遅延のリアルタイム処理には不適

### 音声処理に必要な要素

```javascript
// 音声接続フロー（Workers では実装不可）
// 1. Voice State Update（これは可能）
await gateway.send({
  op: 4,
  d: {
    guild_id: "...",
    channel_id: "...",
    self_mute: false,
    self_deaf: false
  }
});

// 2. Voice Server Update 受信（これも可能）
// endpoint, token, session_id を取得

// 3. 音声 WebSocket 接続（部分的に可能）
// wss://[endpoint]

// 4. UDP 接続とRTP送信（不可能）
// UDP ポートの開放と RTP パケット送信が必要
```

### 音声データフォーマット

音声処理には以下の仕様が必要：
- **コーデック**: Opus
- **サンプルレート**: 48kHz
- **チャンネル**: 2（ステレオ）
- **フレームサイズ**: 20ms
- **暗号化**: libsodium (xsalsa20_poly1305)

### 代替ソリューション

#### 1. 音声イベントの監視のみ
```javascript
// 音声チャンネルへの参加/退出イベントは監視可能
gateway.on('VOICE_STATE_UPDATE', (data) => {
  console.log(`${data.user_id} が音声チャンネルに参加`);
});
```

#### 2. 外部サービスとの連携
- Node.js サーバーで音声処理を実装
- Workers から外部 API 経由で音声機能を制御

#### 3. テキストベースの代替機能
- 音声チャンネル参加者のリスト表示
- 音声アクティビティの通知
- テキストチャンネルとの連携

## 実装可能な音声関連機能

### Voice State の取得

```typescript
// src/api/voice.ts
import { Routes } from 'discord-api-types/v10';
import type { REST, RequestData } from '../rest/index.js';

export class VoiceAPI {
  constructor(private readonly rest: REST) {}

  // 音声状態の取得
  public async getVoiceState(guildId: string, userId: string) {
    return this.rest.get(
      Routes.guildVoiceState(guildId, userId)
    );
  }

  // 音声リージョンのリスト取得
  public async listVoiceRegions() {
    return this.rest.get(Routes.voiceRegions());
  }
}
```

### イベント監視

```typescript
// 音声チャンネルのアクティビティ監視
gateway.on('VOICE_STATE_UPDATE', async (state) => {
  if (state.channel_id) {
    // ユーザーが音声チャンネルに参加
    await sendNotification({
      content: `${state.member.user.username} joined voice channel`
    });
  } else {
    // ユーザーが音声チャンネルから退出
    await sendNotification({
      content: `${state.member.user.username} left voice channel`
    });
  }
});
```

## まとめ

Cloudflare Workers では Discord の音声ストリーミング機能は実装できませんが、音声チャンネルの状態監視や管理機能は実装可能です。完全な音声機能が必要な場合は、Node.js などの従来型サーバー環境を使用する必要があります。