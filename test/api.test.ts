import { describe, it, expect, beforeEach, vi } from 'vitest';
import { REST, API } from '../src/index';
import { Routes } from 'discord-api-types/v10';

describe('API Modules', () => {
  let api: API;
  let mockRest: REST;
  const mockToken = 'test-bot-token';

  beforeEach(() => {
    mockRest = new REST();
    mockRest.setToken(mockToken);
    api = new API(mockRest);
    
    // Mock all REST methods
    vi.spyOn(mockRest, 'get').mockResolvedValue({});
    vi.spyOn(mockRest, 'post').mockResolvedValue({});
    vi.spyOn(mockRest, 'patch').mockResolvedValue({});
    vi.spyOn(mockRest, 'delete').mockResolvedValue({});
    vi.spyOn(mockRest, 'put').mockResolvedValue({});
  });

  describe('ChannelsAPI', () => {
    const channelId = '123456789';
    const messageId = '987654321';

    it('should create a message', async () => {
      const messageData = {
        content: 'Hello, World!',
        embeds: [{ title: 'Test Embed', description: 'Test' }],
      };

      await api.channels.createMessage(channelId, messageData);

      expect(mockRest.post).toHaveBeenCalledWith(
        Routes.channelMessages(channelId),
        expect.objectContaining({
          body: messageData,
        })
      );
    });

    it('should edit a message', async () => {
      const editData = { content: 'Edited message' };

      await api.channels.editMessage(channelId, messageId, editData);

      expect(mockRest.patch).toHaveBeenCalledWith(
        Routes.channelMessage(channelId, messageId),
        expect.objectContaining({
          body: editData,
        })
      );
    });

    it('should delete a message', async () => {
      await api.channels.deleteMessage(channelId, messageId);

      expect(mockRest.delete).toHaveBeenCalledWith(
        Routes.channelMessage(channelId, messageId),
        expect.any(Object)
      );
    });

    it('should get a message', async () => {
      await api.channels.getMessage(channelId, messageId);

      expect(mockRest.get).toHaveBeenCalledWith(
        Routes.channelMessage(channelId, messageId),
        expect.any(Object)
      );
    });

    it('should get messages with query parameters', async () => {
      await api.channels.getMessages(channelId, { limit: 50, after: '123' });

      expect(mockRest.get).toHaveBeenCalledWith(
        Routes.channelMessages(channelId),
        expect.objectContaining({
          query: expect.any(URLSearchParams),
        })
      );
    });
  });

  describe('InteractionsAPI', () => {
    const interactionId = '123456789';
    const interactionToken = 'test-token';
    const applicationId = '111111111';

    it('should reply to an interaction', async () => {
      const replyData = {
        type: 4,
        data: { content: 'Response' },
      };

      await api.interactions.reply(interactionId, interactionToken, replyData);

      expect(mockRest.post).toHaveBeenCalledWith(
        Routes.interactionCallback(interactionId, interactionToken),
        expect.objectContaining({
          body: replyData,
        })
      );
    });

    it('should get original response', async () => {
      await api.interactions.getOriginalResponse(applicationId, interactionToken);

      expect(mockRest.get).toHaveBeenCalled();
    });

    it('should edit reply', async () => {
      const editData = { content: 'Edited response' };

      await api.interactions.editReply(applicationId, interactionToken, editData);

      expect(mockRest.patch).toHaveBeenCalled();
    });

    it('should send follow-up message', async () => {
      const followupData = { content: 'Follow-up message' };

      await api.interactions.followUp(applicationId, interactionToken, followupData);

      expect(mockRest.post).toHaveBeenCalled();
    });
  });

  describe('UsersAPI', () => {
    const userId = '123456789';

    it('should get a user', async () => {
      await api.users.get(userId);

      expect(mockRest.get).toHaveBeenCalledWith(
        Routes.user(userId),
        expect.any(Object)
      );
    });

    it('should get current user', async () => {
      await api.users.getCurrent();

      expect(mockRest.get).toHaveBeenCalledWith(
        Routes.user('@me'),
        expect.any(Object)
      );
    });

    it('should edit current user', async () => {
      const userData = { username: 'NewName' };

      await api.users.edit(userData);

      expect(mockRest.patch).toHaveBeenCalledWith(
        Routes.user('@me'),
        expect.objectContaining({
          body: userData,
        })
      );
    });

    it('should get user guilds', async () => {
      await api.users.getGuilds({ limit: 10 });

      expect(mockRest.get).toHaveBeenCalledWith(
        Routes.userGuilds(),
        expect.objectContaining({
          query: expect.any(URLSearchParams),
        })
      );
    });
  });

  describe('GuildsAPI', () => {
    const guildId = '123456789';
    const roleId = '987654321';

    it('should get a guild', async () => {
      await api.guilds.get(guildId);

      expect(mockRest.get).toHaveBeenCalledWith(
        Routes.guild(guildId),
        expect.any(Object)
      );
    });

    it('should get guild channels', async () => {
      await api.guilds.getChannels(guildId);

      expect(mockRest.get).toHaveBeenCalledWith(
        Routes.guildChannels(guildId),
        expect.any(Object)
      );
    });

    it('should create a channel', async () => {
      const channelData = {
        name: 'new-channel',
        type: 0,
      };

      await api.guilds.createChannel(guildId, channelData);

      expect(mockRest.post).toHaveBeenCalledWith(
        Routes.guildChannels(guildId),
        expect.objectContaining({
          body: channelData,
        })
      );
    });

    it('should get guild roles', async () => {
      await api.guilds.getRoles(guildId);

      expect(mockRest.get).toHaveBeenCalledWith(
        Routes.guildRoles(guildId),
        expect.any(Object)
      );
    });

    it('should create a role', async () => {
      const roleData = {
        name: 'New Role',
        color: 0xff0000,
      };

      await api.guilds.createRole(guildId, roleData);

      expect(mockRest.post).toHaveBeenCalledWith(
        Routes.guildRoles(guildId),
        expect.objectContaining({
          body: roleData,
        })
      );
    });
  });

  describe('WebhooksAPI', () => {
    const webhookId = '123456789';
    const webhookToken = 'webhook-token';
    const messageId = '987654321';

    it('should execute webhook', async () => {
      const webhookData = {
        content: 'Webhook message',
        username: 'Test Bot',
      };

      await api.webhooks.execute(webhookId, webhookToken, webhookData);

      expect(mockRest.post).toHaveBeenCalledWith(
        Routes.webhook(webhookId, webhookToken),
        expect.objectContaining({
          body: webhookData,
          auth: false,
        })
      );
    });

    it('should execute webhook with wait parameter', async () => {
      const webhookData = {
        content: 'Webhook message',
        wait: true,
      };

      await api.webhooks.execute(webhookId, webhookToken, webhookData);

      expect(mockRest.post).toHaveBeenCalledWith(
        Routes.webhook(webhookId, webhookToken),
        expect.objectContaining({
          query: expect.any(URLSearchParams),
        })
      );
    });

    it('should get webhook message', async () => {
      await api.webhooks.getMessage(webhookId, webhookToken, messageId);

      expect(mockRest.get).toHaveBeenCalledWith(
        Routes.webhookMessage(webhookId, webhookToken, messageId),
        expect.objectContaining({
          auth: false,
        })
      );
    });

    it('should edit webhook message', async () => {
      const editData = { content: 'Edited webhook message' };

      await api.webhooks.editMessage(webhookId, webhookToken, messageId, editData);

      expect(mockRest.patch).toHaveBeenCalledWith(
        Routes.webhookMessage(webhookId, webhookToken, messageId),
        expect.objectContaining({
          body: editData,
          auth: false,
        })
      );
    });
  });
});