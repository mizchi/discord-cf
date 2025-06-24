import { DefaultRestOptions, RESTEvents } from '../constants.js';
import type { RESTOptions, RequestData, RawFile, RequestMethod } from '../types.js';
import { Routes } from 'discord-api-types/v10';

export class REST extends EventTarget {
  private token?: string;
  private readonly options: Required<Omit<RESTOptions, 'auth'>>;

  constructor(options: RESTOptions = {}) {
    super();
    this.options = {
      ...DefaultRestOptions,
      ...options,
    };
  }

  public setToken(token: string): this {
    this.token = token;
    return this;
  }

  public async get(route: string, options: RequestData = {}) {
    return this.request('GET', route, options);
  }

  public async post(route: string, options: RequestData = {}) {
    return this.request('POST', route, options);
  }

  public async put(route: string, options: RequestData = {}) {
    return this.request('PUT', route, options);
  }

  public async patch(route: string, options: RequestData = {}) {
    return this.request('PATCH', route, options);
  }

  public async delete(route: string, options: RequestData = {}) {
    return this.request('DELETE', route, options);
  }

  private async request(method: RequestMethod, route: string, options: RequestData = {}) {
    const url = new URL(`${this.options.api}${route}`);
    
    if (options.query) {
      for (const [key, value] of options.query) {
        url.searchParams.append(key, value);
      }
    }

    const headers = new Headers({
      ...this.options.headers,
      ...options.headers,
    });

    const auth = options.auth ?? this.token;
    if (auth) {
      headers.set('Authorization', `Bot ${auth}`);
    }

    let body: FormData | string | undefined;
    
    if (options.files?.length) {
      const formData = new FormData();
      
      for (let i = 0; i < options.files.length; i++) {
        const file = options.files[i];
        const blob = new Blob([file.data], { type: file.contentType ?? 'application/octet-stream' });
        formData.append(`files[${i}]`, blob, file.name);
      }
      
      if (options.body) {
        formData.append('payload_json', JSON.stringify(options.body));
      }
      
      body = formData;
    } else if (options.body) {
      headers.set('Content-Type', 'application/json');
      body = JSON.stringify(options.body);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeout);

    try {
      const response = await fetch(url.toString(), {
        method,
        headers,
        body,
        signal: options.signal ?? controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorBody = await response.text();
        let parsedError;
        try {
          parsedError = JSON.parse(errorBody);
        } catch {
          parsedError = { message: errorBody };
        }
        
        throw new Error(`Discord API Error: ${response.status} - ${parsedError.message ?? 'Unknown error'}`);
      }

      if (response.headers.get('content-type')?.includes('application/json')) {
        return response.json();
      }
      
      return response.text();
    } catch (error) {
      clearTimeout(timeout);
      throw error;
    }
  }
}

export function makeURLSearchParams(options: Record<string, any>): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(options)) {
    if (value !== undefined && value !== null) {
      params.append(key, String(value));
    }
  }
  return params;
}