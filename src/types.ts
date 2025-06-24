export interface RESTOptions {
  api?: string;
  cdn?: string;
  headers?: Record<string, string>;
  retries?: number;
  timeout?: number;
}

export interface RequestData {
  auth?: string;
  body?: unknown;
  files?: RawFile[];
  headers?: Record<string, string>;
  query?: URLSearchParams;
  signal?: AbortSignal;
}

export interface RawFile {
  data: ArrayBuffer | Uint8Array | string;
  name: string;
  contentType?: string;
}

export interface APIRequest {
  method: string;
  url: string;
  route: string;
  options: RequestData;
  retries: number;
}

export type RequestMethod = 'DELETE' | 'GET' | 'PATCH' | 'POST' | 'PUT';

export interface RouteData {
  majorParameter: string;
  bucketRoute: string;
  original: string;
}

export interface RateLimitData {
  timeout: number;
  limit: number;
  method: string;
  path: string;
  route: string;
  global: boolean;
}