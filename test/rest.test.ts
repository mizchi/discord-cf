import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockAgent, setGlobalDispatcher, Interceptable } from 'undici';
import { REST } from '../src/rest/REST';
import { Routes } from 'discord-api-types/v10';
import { API_BASE } from '../src/constants';

function genPath(path: `/${string}`) {
  return `/api/v10${path}` as const;
}

describe('REST Client', () => {
  let mockAgent: MockAgent;
  let mockPool: Interceptable;
  let rest: REST;
  const mockToken = 'test-bot-token';
  
  beforeEach(() => {
    mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    setGlobalDispatcher(mockAgent);
    
    mockPool = mockAgent.get('https://discord.com');
    
    rest = new REST();
    rest.setToken(mockToken);
  });

  afterEach(async () => {
    await mockAgent.close();
  });

  describe('constructor', () => {
    it('should initialize with default options', () => {
      const client = new REST();
      expect(client).toBeInstanceOf(REST);
    });

    it('should accept custom options', () => {
      const customRest = new REST({
        api: 'https://custom-api.example.com',
        timeout: 30000,
      });
      expect(customRest).toBeInstanceOf(REST);
    });
  });

  describe('setToken', () => {
    it('should set the token and return this for chaining', () => {
      const client = new REST();
      const result = client.setToken('new-token');
      expect(result).toBe(client);
    });
  });

  describe('HTTP methods', () => {
    const mockResponse = { id: '123', name: 'test' };

    it('should make GET requests', async () => {
      mockPool
        .intercept({
          path: genPath('/test'),
          method: 'GET',
        })
        .reply(() => ({
          data: mockResponse,
          statusCode: 200,
          responseOptions: {
            headers: {
              'content-type': 'application/json',
            },
          },
        }));
      
      const result = await rest.get('/test');
      expect(result).toEqual(mockResponse);
    });

    it('should make POST requests with body', async () => {
      const body = { content: 'Hello' };
      
      mockPool
        .intercept({
          path: genPath('/test'),
          method: 'POST',
          body: JSON.stringify(body),
        })
        .reply(() => ({
          data: mockResponse,
          statusCode: 200,
          responseOptions: {
            headers: {
              'content-type': 'application/json',
            },
          },
        }));
      
      const result = await rest.post('/test', { body });
      expect(result).toEqual(mockResponse);
    });

    it('should make PATCH requests', async () => {
      const body = { content: 'Updated' };
      const result = await rest.patch('/test', { body });
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/test'),
        expect.objectContaining({
          method: 'PATCH',
          body: JSON.stringify(body),
        })
      );
      expect(result).toEqual(mockResponse);
    });

    it('should make DELETE requests', async () => {
      const result = await rest.delete('/test');
      
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/test'),
        expect.objectContaining({
          method: 'DELETE',
        })
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('request handling', () => {
    it('should add authorization header when token is set', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({}),
      });

      await rest.get('/test');
      
      const [url, options] = (fetch as any).mock.calls[0];
      const headers = options.headers as Headers;
      expect(headers.get('Authorization')).toBe(`Bot ${mockToken}`);
    });

    it('should handle query parameters', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({}),
      });

      const query = new URLSearchParams({ limit: '10', after: '123' });
      await rest.get('/test', { query });
      
      const [url] = (fetch as any).mock.calls[0];
      expect(url).toContain('?limit=10&after=123');
    });

    it('should handle file uploads', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: new Headers({ 'content-type': 'application/json' }),
        json: () => Promise.resolve({}),
      });

      const files = [{
        name: 'test.txt',
        data: new TextEncoder().encode('Hello World'),
        contentType: 'text/plain',
      }];
      
      await rest.post('/test', { files, body: { content: 'Test' } });
      
      const [, options] = (fetch as any).mock.calls[0];
      expect(options.body).toBeInstanceOf(FormData);
    });
  });

  describe('error handling', () => {
    it('should throw on non-ok responses', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve(JSON.stringify({ message: 'Not Found' })),
      });

      await expect(rest.get('/test')).rejects.toThrow('Discord API Error: 404 - Not Found');
    });

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(rest.get('/test')).rejects.toThrow('Network error');
    });

    it('should handle timeout', async () => {
      let abortController: AbortController | null = null;
      
      global.fetch = vi.fn().mockImplementation((url, options) => {
        abortController = options.signal?.controller || null;
        return new Promise((resolve, reject) => {
          options.signal?.addEventListener('abort', () => {
            reject(new Error('The operation was aborted'));
          });
        });
      });

      const fastRest = new REST({ timeout: 100 });
      fastRest.setToken(mockToken);
      
      await expect(fastRest.get('/test')).rejects.toThrow('The operation was aborted');
    });
  });
});