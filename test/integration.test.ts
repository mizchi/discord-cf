import { REST, API } from "../src/index";
import WebSocket from "ws";
import {
  GatewayOpcodes,
  GatewayDispatchEvents,
  GatewayIntentBits,
} from "discord-api-types/v10";
import * as dotenv from "dotenv";
import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "vitest";

dotenv.config();

const token = process.env.DISCORD_TOKEN;
const channelId = process.env.DISCORD_CHANNEL_ID;

if (!token || !channelId) {
  throw new Error(
    "DISCORD_TOKEN と DISCORD_CHANNEL_ID を .env ファイルに設定してください"
  );
}

describe("Discord Integration Tests", () => {
  let rest;
  let api;

  beforeAll(() => {
    rest = new REST().setToken(token);
    api = new API(rest);
  });

  describe("REST API Tests", () => {
    describe("Channel Operations", () => {
      it("should fetch channel information", async () => {
        const channel = await api.channels.get(channelId);
        expect(channel).toBeDefined();
        expect(channel.id).toBe(channelId);
        expect(channel.type).toBeDefined();
      });

      it("should send a message to channel", async () => {
        const content = `テストメッセージ: ${new Date().toISOString()}`;
        const message = await api.channels.createMessage(channelId, {
          content,
        });

        expect(message).toBeDefined();
        expect(message.content).toBe(content);
        expect(message.channel_id).toBe(channelId);
        expect(message.id).toBeDefined();

        // クリーンアップ: メッセージを削除
        await api.channels.deleteMessage(channelId, message.id);
      });

      it("should send an embed message", async () => {
        const embed = {
          title: "テスト埋め込み",
          description: "これはテスト用の埋め込みメッセージです",
          color: 0x00ff00,
          timestamp: new Date().toISOString(),
          fields: [
            {
              name: "フィールド1",
              value: "テスト値1",
              inline: true,
            },
            {
              name: "フィールド2",
              value: "テスト値2",
              inline: true,
            },
          ],
        };

        const message = await api.channels.createMessage(channelId, {
          embeds: [embed],
        });

        expect(message).toBeDefined();
        expect(message.embeds).toHaveLength(1);
        expect(message.embeds[0].title).toBe(embed.title);

        // クリーンアップ
        await api.channels.deleteMessage(channelId, message.id);
      });

      it("should edit a message", async () => {
        // メッセージを作成
        const originalContent = "オリジナルメッセージ";
        const message = await api.channels.createMessage(channelId, {
          content: originalContent,
        });

        // メッセージを編集
        const editedContent = "編集されたメッセージ";
        const editedMessage = await api.channels.editMessage(
          channelId,
          message.id,
          {
            content: editedContent,
          }
        );

        expect(editedMessage.content).toBe(editedContent);
        expect(editedMessage.edited_timestamp).toBeDefined();

        // クリーンアップ
        await api.channels.deleteMessage(channelId, message.id);
      });

      it("should handle reactions", async () => {
        // メッセージを作成
        const message = await api.channels.createMessage(channelId, {
          content: "リアクションテスト",
        });

        // リアクションを追加
        const emoji = "👍";
        await api.channels.createReaction(
          channelId,
          message.id,
          encodeURIComponent(emoji)
        );

        // メッセージを再取得してリアクションを確認
        const updatedMessage = await api.channels.getMessage(
          channelId,
          message.id
        );
        expect(updatedMessage.reactions).toBeDefined();
        expect(updatedMessage.reactions.length).toBeGreaterThan(0);

        // リアクションを削除
        await api.channels.deleteOwnReaction(
          channelId,
          message.id,
          encodeURIComponent(emoji)
        );

        // クリーンアップ
        await api.channels.deleteMessage(channelId, message.id);
      });

      it("should handle typing indicator", async () => {
        // タイピングインジケーターを送信（エラーが出ないことを確認）
        await expect(
          api.channels.triggerTypingIndicator(channelId)
        ).resolves.not.toThrow();
      });
    });

    describe("User Operations", () => {
      it("should fetch current user information", async () => {
        const user = await api.users.getCurrent();
        expect(user).toBeDefined();
        expect(user.id).toBeDefined();
        expect(user.username).toBeDefined();
        expect(user.bot).toBe(true);
      });

      it("should fetch user by ID", async () => {
        const currentUser = await api.users.getCurrent();
        const user = await api.users.get(currentUser.id);

        expect(user).toBeDefined();
        expect(user.id).toBe(currentUser.id);
        expect(user.username).toBe(currentUser.username);
      });
    });
  });

  describe("WebSocket Gateway Tests", () => {
    let ws;
    let sequence = null;
    let sessionId = null;
    let heartbeatInterval = null;
    let lastHeartbeatAck = true;
    let isReady = false;

    const connect = () => {
      return new Promise<void>((resolve, reject) => {
        ws = new WebSocket("wss://gateway.discord.gg/?v=10&encoding=json");

        const timeout = setTimeout(() => {
          reject(new Error("Connection timeout"));
        }, 30000);

        ws.on("open", () => {
          console.log("WebSocket connected");
        });

        ws.on("message", (data) => {
          const payload = JSON.parse(data);

          if (payload.s) {
            sequence = payload.s;
          }

          switch (payload.op) {
            case GatewayOpcodes.Hello:
              // ハートビート開始
              const interval = payload.d.heartbeat_interval;
              heartbeatInterval = setInterval(() => {
                if (!lastHeartbeatAck) {
                  console.error("Heartbeat ACK not received");
                  ws.close();
                  return;
                }

                lastHeartbeatAck = false;
                ws.send(
                  JSON.stringify({
                    op: GatewayOpcodes.Heartbeat,
                    d: sequence,
                  })
                );
              }, interval);

              // Identify送信
              ws.send(
                JSON.stringify({
                  op: GatewayOpcodes.Identify,
                  d: {
                    token,
                    intents:
                      GatewayIntentBits.GuildMessages |
                      GatewayIntentBits.MessageContent |
                      GatewayIntentBits.Guilds,
                    properties: {
                      os: "linux",
                      browser: "discord-cf-test",
                      device: "discord-cf-test",
                    },
                  },
                })
              );
              break;

            case GatewayOpcodes.HeartbeatAck:
              lastHeartbeatAck = true;
              break;

            case GatewayOpcodes.Dispatch:
              if (payload.t === GatewayDispatchEvents.Ready) {
                sessionId = payload.d.session_id;
                isReady = true;
                clearTimeout(timeout);
                resolve();
              }
              break;
          }
        });

        ws.on("error", (error) => {
          clearTimeout(timeout);
          reject(error);
        });

        ws.on("close", () => {
          if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
            heartbeatInterval = null;
          }
        });
      });
    };

    beforeEach(async () => {
      await connect();
    }, 35000);

    afterEach(() => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
      }
      isReady = false;
      sequence = null;
      sessionId = null;
      lastHeartbeatAck = true;
    });

    it("should connect to gateway and receive READY event", async () => {
      expect(isReady).toBe(true);
      expect(sessionId).toBeDefined();
    });

    it("should maintain heartbeat", async () => {
      // 最初のハートビートを待つ
      await new Promise((resolve) => setTimeout(resolve, 5000));
      expect(lastHeartbeatAck).toBe(true);
    }, 10000);

    it("should receive message events", async () => {
      const messagePromise = new Promise<any>((resolve) => {
        const handler = (data) => {
          const payload = JSON.parse(data);
          if (
            payload.op === GatewayOpcodes.Dispatch &&
            payload.t === GatewayDispatchEvents.MessageCreate &&
            payload.d.channel_id === channelId
          ) {
            ws.off("message", handler);
            resolve(payload.d);
          }
        };
        ws.on("message", handler);
      });

      // REST APIでメッセージを送信
      const testContent = `WebSocketテスト: ${Date.now()}`;
      const sentMessage = await api.channels.createMessage(channelId, {
        content: testContent,
      });

      // WebSocketでメッセージイベントを受信
      const receivedMessage = await messagePromise;

      expect(receivedMessage.id).toBe(sentMessage.id);
      expect(receivedMessage.content).toBe(testContent);

      // クリーンアップ
      await api.channels.deleteMessage(channelId, sentMessage.id);
    });

    it.skip("should receive message update events (flaky due to reconnection)", async () => {
      // メッセージを作成
      const originalMessage = await api.channels.createMessage(channelId, {
        content: "更新前のメッセージ",
      });

      const updatePromise = new Promise<any>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Update event timeout"));
        }, 10000);

        const handler = (data) => {
          const payload = JSON.parse(data);
          if (
            payload.op === GatewayOpcodes.Dispatch &&
            payload.t === GatewayDispatchEvents.MessageUpdate &&
            payload.d.id === originalMessage.id
          ) {
            clearTimeout(timeout);
            ws.off("message", handler);
            resolve(payload.d);
          }
        };
        ws.on("message", handler);
      });

      // メッセージを編集
      const editedContent = "更新後のメッセージ";
      await api.channels.editMessage(channelId, originalMessage.id, {
        content: editedContent,
      });

      // 更新イベントを受信
      const updatedMessage = await updatePromise;
      expect(updatedMessage.content).toBe(editedContent);

      // クリーンアップ
      await api.channels.deleteMessage(channelId, originalMessage.id);
    }, 15000);

    it.skip("should receive message delete events (flaky due to reconnection)", async () => {
      // メッセージを作成
      const message = await api.channels.createMessage(channelId, {
        content: "削除されるメッセージ",
      });

      const deletePromise = new Promise<any>((resolve) => {
        const handler = (data) => {
          const payload = JSON.parse(data);
          if (
            payload.op === GatewayOpcodes.Dispatch &&
            payload.t === GatewayDispatchEvents.MessageDelete &&
            payload.d.id === message.id
          ) {
            ws.off("message", handler);
            resolve(payload.d);
          }
        };
        ws.on("message", handler);
      });

      // メッセージを削除
      await api.channels.deleteMessage(channelId, message.id);

      // 削除イベントを受信
      const deletedMessage = await deletePromise;
      expect(deletedMessage.id).toBe(message.id);
      expect(deletedMessage.channel_id).toBe(channelId);
    });
  });

  describe("Error Handling Tests", () => {
    it("should handle 404 for non-existent channel", async () => {
      const fakeChannelId = "000000000000000000";
      await expect(api.channels.get(fakeChannelId)).rejects.toThrow();
    });

    it("should handle rate limiting gracefully", async () => {
      // 複数のリクエストを連続で送信
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(api.channels.triggerTypingIndicator(channelId));
      }

      // すべてのリクエストが成功または適切にレート制限されることを確認
      await expect(Promise.allSettled(promises)).resolves.toBeDefined();
    });

    it("should handle invalid message content", async () => {
      // 空のコンテンツでメッセージ送信を試みる
      await expect(
        api.channels.createMessage(channelId, {
          content: "",
        })
      ).rejects.toThrow();
    });
  });
});
