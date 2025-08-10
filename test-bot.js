import { REST, API } from './dist/index.js';
import WebSocket from 'ws';
import { 
  GatewayOpcodes, 
  GatewayDispatchEvents,
  GatewayIntentBits 
} from 'discord-api-types/v10';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.DISCORD_TOKEN;
const channelId = process.env.DISCORD_CHANNEL_ID;

if (!token || !channelId) {
  console.error('DISCORD_TOKEN と DISCORD_CHANNEL_ID を .env ファイルに設定してください');
  process.exit(1);
}

let ws;
let sequence = null;
let sessionId = null;
let heartbeatInterval = null;
let lastHeartbeatAck = true;

function startHeartbeat(interval) {
  heartbeatInterval = setInterval(() => {
    if (!lastHeartbeatAck) {
      console.error('ハートビートACKが受信されませんでした。再接続します...');
      ws.close();
      return;
    }

    lastHeartbeatAck = false;
    ws.send(JSON.stringify({
      op: GatewayOpcodes.Heartbeat,
      d: sequence
    }));
  }, interval);
}

function connect() {
  ws = new WebSocket('wss://gateway.discord.gg/?v=10&encoding=json');

  ws.on('open', () => {
    console.log('Discord Gateway に接続しました');
  });

  ws.on('message', (data) => {
    const payload = JSON.parse(data);
    
    if (payload.s) {
      sequence = payload.s;
    }

    switch (payload.op) {
      case GatewayOpcodes.Hello:
        startHeartbeat(payload.d.heartbeat_interval);
        // Identify
        ws.send(JSON.stringify({
          op: GatewayOpcodes.Identify,
          d: {
            token,
            intents: GatewayIntentBits.GuildMessages | GatewayIntentBits.MessageContent | GatewayIntentBits.Guilds,
            properties: {
              os: 'linux',
              browser: 'discord-cf-test',
              device: 'discord-cf-test'
            }
          }
        }));
        break;

      case GatewayOpcodes.HeartbeatAck:
        lastHeartbeatAck = true;
        break;

      case GatewayOpcodes.Dispatch:
        handleDispatch(payload);
        break;

      case GatewayOpcodes.Reconnect:
        console.log('再接続が要求されました');
        ws.close();
        break;

      case GatewayOpcodes.InvalidSession:
        console.log('無効なセッション');
        if (payload.d) {
          // Resume可能
          setTimeout(() => connect(), 1000);
        } else {
          // 新しいセッション
          sessionId = null;
          setTimeout(() => connect(), 5000);
        }
        break;
    }
  });

  ws.on('close', (code, reason) => {
    console.log(`WebSocket が閉じられました: ${code} - ${reason}`);
    if (heartbeatInterval) {
      clearInterval(heartbeatInterval);
    }
    // 再接続
    setTimeout(() => connect(), 5000);
  });

  ws.on('error', (error) => {
    console.error('WebSocket エラー:', error);
  });
}

function handleDispatch(payload) {
  switch (payload.t) {
    case GatewayDispatchEvents.Ready:
      sessionId = payload.d.session_id;
      console.log(`ボットが準備完了しました！セッションID: ${sessionId}`);
      console.log(`監視対象チャンネルID: ${channelId}`);
      break;

    case GatewayDispatchEvents.MessageCreate:
      const message = payload.d;
      if (message.channel_id === channelId) {
        console.log(`\n[${new Date().toISOString()}] メッセージを受信しました:`);
        console.log(`- チャンネル: ${message.channel_id}`);
        console.log(`- 送信者: ${message.author.username}#${message.author.discriminator} (ID: ${message.author.id})`);
        console.log(`- 内容: ${message.content}`);
        if (message.attachments && message.attachments.length > 0) {
          console.log(`- 添付ファイル: ${message.attachments.length}個`);
        }
      }
      break;

    case GatewayDispatchEvents.MessageUpdate:
      const updatedMessage = payload.d;
      if (updatedMessage.channel_id === channelId) {
        console.log(`\n[${new Date().toISOString()}] メッセージが編集されました:`);
        console.log(`- チャンネル: ${updatedMessage.channel_id}`);
        console.log(`- メッセージID: ${updatedMessage.id}`);
        if (updatedMessage.content) {
          console.log(`- 新しい内容: ${updatedMessage.content}`);
        }
      }
      break;

    case GatewayDispatchEvents.MessageDelete:
      const deletedMessage = payload.d;
      if (deletedMessage.channel_id === channelId) {
        console.log(`\n[${new Date().toISOString()}] メッセージが削除されました:`);
        console.log(`- チャンネル: ${deletedMessage.channel_id}`);
        console.log(`- メッセージID: ${deletedMessage.id}`);
      }
      break;
  }
}

console.log('Discord ボットを起動しています...');
connect();