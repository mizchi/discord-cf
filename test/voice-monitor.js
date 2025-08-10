import WebSocket from 'ws';
import { 
  GatewayOpcodes, 
  GatewayDispatchEvents,
  GatewayIntentBits 
} from 'discord-api-types/v10';
import dotenv from 'dotenv';

dotenv.config();

const token = process.env.DISCORD_TOKEN;
const voiceChannelId = process.env.VOICE_CHANNEL_ID;
const textChannelId = process.env.DISCORD_CHANNEL_ID;

if (!token || !voiceChannelId || !textChannelId) {
  console.error('DISCORD_TOKEN, VOICE_CHANNEL_ID, DISCORD_CHANNEL_ID を .env ファイルに設定してください');
  process.exit(1);
}

let ws;
let sequence = null;
let sessionId = null;
let heartbeatInterval = null;
let lastHeartbeatAck = true;

// 音声チャンネルの参加者を追跡
const voiceStates = new Map();

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
        // Identify - 音声状態のIntentを追加
        ws.send(JSON.stringify({
          op: GatewayOpcodes.Identify,
          d: {
            token,
            intents: 
              GatewayIntentBits.GuildMessages | 
              GatewayIntentBits.MessageContent | 
              GatewayIntentBits.Guilds |
              GatewayIntentBits.GuildVoiceStates, // 音声状態を監視
            properties: {
              os: 'linux',
              browser: 'discord-cf-voice-monitor',
              device: 'discord-cf-voice-monitor'
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
          setTimeout(() => connect(), 1000);
        } else {
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
      console.log(`音声チャンネル監視ボットが準備完了しました！`);
      console.log(`セッションID: ${sessionId}`);
      console.log(`監視対象音声チャンネルID: ${voiceChannelId}`);
      console.log(`通知先テキストチャンネルID: ${textChannelId}`);
      
      // 既存の音声状態を初期化
      if (payload.d.guilds) {
        payload.d.guilds.forEach(guild => {
          if (guild.voice_states) {
            guild.voice_states.forEach(state => {
              if (state.channel_id === voiceChannelId) {
                voiceStates.set(state.user_id, state);
                console.log(`初期状態: ユーザー ${state.user_id} が音声チャンネルにいます`);
              }
            });
          }
        });
      }
      break;

    case GatewayDispatchEvents.VoiceStateUpdate:
      handleVoiceStateUpdate(payload.d);
      break;

    case GatewayDispatchEvents.MessageCreate:
      const message = payload.d;
      // ボット自身のメッセージは無視
      if (message.author.bot) return;
      
      if (message.channel_id === textChannelId) {
        // コマンド処理
        if (message.content === '!voice') {
          showVoiceChannelStatus();
        } else if (message.content === '!voicetest') {
          testVoiceConnection();
        }
      }
      break;
  }
}

function handleVoiceStateUpdate(voiceState) {
  const userId = voiceState.user_id;
  const userName = voiceState.member?.user?.username || voiceState.member?.nick || userId;
  const previousState = voiceStates.get(userId);

  // 監視対象の音声チャンネルへの参加
  if (voiceState.channel_id === voiceChannelId && previousState?.channel_id !== voiceChannelId) {
    console.log(`\n[${new Date().toISOString()}] 音声チャンネル参加`);
    console.log(`- ユーザー: ${userName} (ID: ${userId})`);
    console.log(`- チャンネルID: ${voiceChannelId}`);
    console.log(`- ミュート: ${voiceState.self_mute ? 'はい' : 'いいえ'}`);
    console.log(`- 聴取制限: ${voiceState.self_deaf ? 'はい' : 'いいえ'}`);
    console.log(`- サーバーミュート: ${voiceState.mute ? 'はい' : 'いいえ'}`);
    console.log(`- サーバー聴取制限: ${voiceState.deaf ? 'はい' : 'いいえ'}`);
    console.log(`- ストリーミング: ${voiceState.self_stream ? 'はい' : 'いいえ'}`);
    console.log(`- ビデオ: ${voiceState.self_video ? 'はい' : 'いいえ'}`);
    
    voiceStates.set(userId, voiceState);
    sendNotification(`🎙️ **${userName}** が音声チャンネルに参加しました`);
  }
  
  // 監視対象の音声チャンネルからの退出
  else if (previousState?.channel_id === voiceChannelId && voiceState.channel_id !== voiceChannelId) {
    console.log(`\n[${new Date().toISOString()}] 音声チャンネル退出`);
    console.log(`- ユーザー: ${userName} (ID: ${userId})`);
    
    if (voiceState.channel_id) {
      console.log(`- 移動先チャンネルID: ${voiceState.channel_id}`);
      sendNotification(`🚪 **${userName}** が音声チャンネルから別のチャンネルに移動しました`);
    } else {
      sendNotification(`👋 **${userName}** が音声チャンネルから退出しました`);
    }
    
    voiceStates.delete(userId);
  }
  
  // 音声チャンネル内での状態変更
  else if (voiceState.channel_id === voiceChannelId && previousState?.channel_id === voiceChannelId) {
    const changes = [];
    
    if (voiceState.self_mute !== previousState.self_mute) {
      changes.push(`ミュート: ${voiceState.self_mute ? 'ON' : 'OFF'}`);
    }
    if (voiceState.self_deaf !== previousState.self_deaf) {
      changes.push(`聴取制限: ${voiceState.self_deaf ? 'ON' : 'OFF'}`);
    }
    if (voiceState.self_stream !== previousState.self_stream) {
      changes.push(`画面共有: ${voiceState.self_stream ? '開始' : '終了'}`);
    }
    if (voiceState.self_video !== previousState.self_video) {
      changes.push(`ビデオ: ${voiceState.self_video ? 'ON' : 'OFF'}`);
    }
    
    if (changes.length > 0) {
      console.log(`\n[${new Date().toISOString()}] 音声状態変更`);
      console.log(`- ユーザー: ${userName} (ID: ${userId})`);
      console.log(`- 変更内容: ${changes.join(', ')}`);
      
      sendNotification(`🔄 **${userName}** の状態が変更されました: ${changes.join(', ')}`);
    }
    
    voiceStates.set(userId, voiceState);
  }
}

async function sendNotification(content) {
  try {
    // REST API を使用してメッセージを送信
    const response = await fetch(`https://discord.com/api/v10/channels/${textChannelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ content })
    });
    
    if (!response.ok) {
      console.error('通知送信に失敗しました:', response.statusText);
    }
  } catch (error) {
    console.error('通知送信エラー:', error);
  }
}

function showVoiceChannelStatus() {
  const memberCount = voiceStates.size;
  const members = Array.from(voiceStates.values())
    .map(state => {
      const name = state.member?.user?.username || state.user_id;
      const status = [];
      if (state.self_mute) status.push('🔇');
      if (state.self_deaf) status.push('🔕');
      if (state.self_stream) status.push('📺');
      if (state.self_video) status.push('📹');
      return `• ${name} ${status.join(' ')}`;
    })
    .join('\n');
  
  const message = memberCount > 0
    ? `📊 **音声チャンネルの状態**\n参加者数: ${memberCount}\n\n${members}`
    : '📊 **音声チャンネルの状態**\n現在誰も参加していません';
  
  sendNotification(message);
}

async function testVoiceConnection() {
  console.log('\n音声接続テストを開始...');
  
  // Voice State Update を送信して音声チャンネルに接続を試みる
  ws.send(JSON.stringify({
    op: GatewayOpcodes.VoiceStateUpdate,
    d: {
      guild_id: null, // DM の場合は null、サーバーの場合は guild_id を設定
      channel_id: voiceChannelId,
      self_mute: false,
      self_deaf: false
    }
  }));
  
  sendNotification('⚠️ 音声接続テストを実行しました。注意: Cloudflare Workers では実際の音声ストリーミングはサポートされません。');
  
  // Voice Server Update イベントを待機
  const voiceServerPromise = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Voice Server Update タイムアウト'));
    }, 10000);
    
    const handler = (data) => {
      const payload = JSON.parse(data);
      if (payload.op === GatewayOpcodes.Dispatch && 
          payload.t === GatewayDispatchEvents.VoiceServerUpdate) {
        clearTimeout(timeout);
        ws.off('message', handler);
        resolve(payload.d);
      }
    };
    ws.on('message', handler);
  });
  
  try {
    const voiceServer = await voiceServerPromise;
    console.log('\nVoice Server Update を受信:');
    console.log(`- Token: ${voiceServer.token}`);
    console.log(`- Endpoint: ${voiceServer.endpoint}`);
    console.log(`- Guild ID: ${voiceServer.guild_id}`);
    
    sendNotification(`✅ Voice Server Update を受信しました。エンドポイント: ${voiceServer.endpoint}`);
    
    // 音声WebSocketへの接続を試みる（これ以降は実際には動作しない）
    console.log('\n⚠️ 注意: これ以降の音声ストリーミングは Cloudflare Workers では実装できません');
    sendNotification('ℹ️ UDP 接続と音声ストリーミングは Cloudflare Workers の制限により実装できません');
    
  } catch (error) {
    console.error('Voice Server Update の受信に失敗:', error.message);
    sendNotification(`❌ Voice Server Update の受信に失敗しました: ${error.message}`);
  }
  
  // 音声チャンネルから切断
  setTimeout(() => {
    ws.send(JSON.stringify({
      op: GatewayOpcodes.VoiceStateUpdate,
      d: {
        guild_id: null,
        channel_id: null,
        self_mute: false,
        self_deaf: false
      }
    }));
    console.log('音声チャンネルから切断しました');
  }, 5000);
}

console.log('Discord 音声チャンネル監視ボットを起動しています...');
console.log('利用可能なコマンド:');
console.log('  !voice - 音声チャンネルの現在の状態を表示');
console.log('  !voicetest - 音声接続のテスト（制限あり）');
connect();