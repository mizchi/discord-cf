import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MockAgent, setGlobalDispatcher, Interceptable } from 'undici';
import { REST } from '../src/rest/REST';
import { DefaultRestOptions } from '../src/constants';

function genPath(path: `/${string}`) {
  return `/api/v10${path}` as const;
}

function jsonHeaders(headers: Record<string, string> = {}) {
  return {
    headers: {
      'content-type': 'application/json',
      ...headers,
    },
  };
}

describe('REST Client (Undici MockAgent)', () => {
  let mockAgent: MockAgent;
  let mockPool: Interceptable;
  let rest: REST;
  const mockToken = 'Bot MOCK_TOKEN_FOR_TESTING.XXXXXX.XXXXXXXXXXXXXXXXXXXXXXXXXX';

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

  describe('Basic Requests', () => {
    it('should make simple GET request', async () => {
      const mockData = { test: true };
      
      mockPool
        .intercept({
          path: genPath('/simpleGet'),
          method: 'GET',
          headers: {
            authorization: mockToken,
          },
        })
        .reply(() => ({
          data: mockData,
          statusCode: 200,
          responseOptions: jsonHeaders(),
        }));

      const result = await rest.get('/simpleGet');
      expect(result).toEqual(mockData);
    });

    it('should make POST request with JSON body', async () => {
      const postData = { name: 'Test', value: 123 };
      const responseData = { id: '12345', ...postData };
      
      mockPool
        .intercept({
          path: genPath('/postEndpoint'),
          method: 'POST',
          body: JSON.stringify(postData),
          headers: {
            authorization: mockToken,
            'content-type': 'application/json',
          },
        })
        .reply(() => ({
          data: responseData,
          statusCode: 201,
          responseOptions: jsonHeaders(),
        }));

      const result = await rest.post('/postEndpoint', { body: postData });
      expect(result).toEqual(responseData);
    });
  });

  describe('Error Handling', () => {
    it('should handle 401 Unauthorized', async () => {
      const errorResponse = {
        message: 'Invalid authentication',
        code: 0,
      };
      
      mockPool
        .intercept({
          path: genPath('/unauthorized'),
          method: 'GET',
        })
        .reply(() => ({
          data: errorResponse,
          statusCode: 401,
          responseOptions: jsonHeaders(),
        }));

      await expect(rest.get('/unauthorized')).rejects.toThrow('401');
    });

    it('should handle 404 Not Found', async () => {
      const errorResponse = {
        message: 'Unknown Channel',
        code: 10003,
      };
      
      mockPool
        .intercept({
          path: genPath('/channels/000000000000000000'),
          method: 'GET',
        })
        .reply(() => ({
          data: errorResponse,
          statusCode: 404,
          responseOptions: jsonHeaders(),
        }));

      await expect(rest.get('/channels/000000000000000000')).rejects.toThrow('404');
    });

    it('should handle 429 Rate Limit', async () => {
      const rateLimitResponse = {
        message: 'You are being rate limited.',
        retry_after: 1.5,
        global: false,
      };
      
      mockPool
        .intercept({
          path: genPath('/rateLimited'),
          method: 'GET',
        })
        .reply(() => ({
          data: rateLimitResponse,
          statusCode: 429,
          responseOptions: {
            headers: {
              'x-ratelimit-limit': '10',
              'x-ratelimit-remaining': '0',
              'x-ratelimit-reset': String(Date.now() / 1000 + 1.5),
              'x-ratelimit-reset-after': '1.5',
              'x-ratelimit-bucket': 'test-bucket',
              'x-ratelimit-scope': 'user',
              'retry-after': '1.5',
              ...jsonHeaders().headers,
            },
          },
        }));

      await expect(rest.get('/rateLimited')).rejects.toThrow('429');
    });
  });

  describe('File Uploads', () => {
    it('should handle file upload with FormData', async () => {
      const fileContent = 'Hello, World!';
      const fileName = 'test.txt';
      const messageData = { content: 'File upload test' };
      const responseData = { id: '123456', ...messageData };
      
      // Note: In actual implementation, we'd need to handle multipart/form-data
      // For now, we'll simulate the response
      mockPool
        .intercept({
          path: genPath('/channels/123/messages'),
          method: 'POST',
          headers: {
            authorization: mockToken,
          },
        })
        .reply(() => ({
          data: responseData,
          statusCode: 200,
          responseOptions: jsonHeaders(),
        }));

      const files = [{
        name: fileName,
        data: new TextEncoder().encode(fileContent),
        contentType: 'text/plain',
      }];
      
      const result = await rest.post('/channels/123/messages', { 
        body: messageData,
        files,
      });
      
      expect(result).toEqual(responseData);
    });
  });

  describe('Query Parameters', () => {
    it('should handle query parameters correctly', async () => {
      const mockData = [{ id: '1' }, { id: '2' }];
      
      mockPool
        .intercept({
          path: genPath('/channels/123/messages?limit=50&after=456'),
          method: 'GET',
          headers: {
            authorization: mockToken,
          },
        })
        .reply(() => ({
          data: mockData,
          statusCode: 200,
          responseOptions: jsonHeaders(),
        }));

      const query = new URLSearchParams({ limit: '50', after: '456' });
      const result = await rest.get('/channels/123/messages', { query });
      expect(result).toEqual(mockData);
    });
  });

  describe('Request Options', () => {
    it('should use custom auth token when provided', async () => {
      const customToken = 'Bot custom.token.here';
      const mockData = { authorized: true };
      
      mockPool
        .intercept({
          path: genPath('/users/@me'),
          method: 'GET',
          headers: {
            authorization: customToken,
          },
        })
        .reply(() => ({
          data: mockData,
          statusCode: 200,
          responseOptions: jsonHeaders(),
        }));

      const result = await rest.get('/users/@me', { auth: customToken });
      expect(result).toEqual(mockData);
    });

    it('should handle requests without authentication', async () => {
      const webhookRest = new REST();
      const mockData = { sent: true };
      
      mockPool
        .intercept({
          path: genPath('/webhooks/123/token'),
          method: 'POST',
          body: JSON.stringify({ content: 'Test' }),
          headers: {
            'content-type': 'application/json',
          },
        })
        .reply(() => ({
          data: mockData,
          statusCode: 204,
          responseOptions: jsonHeaders(),
        }));

      const result = await rest.post('/webhooks/123/token', { 
        body: { content: 'Test' },
        auth: false as any,
      });
      
      expect(result).toBeTruthy();
    });
  });
});