import type { DurableObject, DurableObjectState, DurableObjectStorage } from '@cloudflare/workers-types';
import {
  GatewayOpcodes,
  GatewayDispatchEvents,
  type GatewayDispatchPayload,
  type GatewayHeartbeatData,
  type GatewayIdentifyData,
  type GatewayReceivePayload,
  type GatewaySendPayload,
} from 'discord-api-types/v10';

export interface Env {
  DISCORD_TOKEN: string;
  DISCORD_APPLICATION_ID: string;
}

export class WebSocketHandler implements DurableObject {
  private state: DurableObjectState;
  private storage: DurableObjectStorage;
  private ws?: WebSocket;
  private heartbeatInterval?: number;
  private lastHeartbeatAck = true;
  private sequence: number | null = null;
  private sessionId?: string;
  private resumeUrl?: string;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.storage = state.storage;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    
    switch (url.pathname) {
      case '/connect':
        return this.handleConnect(request);
      case '/disconnect':
        return this.handleDisconnect();
      case '/send':
        return this.handleSend(request);
      case '/status':
        return this.handleStatus();
      default:
        return new Response('Not Found', { status: 404 });
    }
  }

  private async handleConnect(request: Request): Promise<Response> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return new Response(JSON.stringify({ error: 'Already connected' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { token, intents } = await request.json() as { token: string; intents: number };
    
    try {
      await this.connect(token, intents);
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: String(error) }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  private async connect(token: string, intents: number): Promise<void> {
    const gatewayUrl = 'wss://gateway.discord.gg/?v=10&encoding=json';
    this.ws = new WebSocket(gatewayUrl);

    this.ws.addEventListener('open', () => {
      console.log('WebSocket connected to Discord Gateway');
    });

    this.ws.addEventListener('message', async (event) => {
      const payload = JSON.parse(event.data as string) as GatewayReceivePayload;
      await this.handleGatewayMessage(payload, token, intents);
    });

    this.ws.addEventListener('close', (event) => {
      console.log(`WebSocket closed: ${event.code} - ${event.reason}`);
      this.cleanup();
    });

    this.ws.addEventListener('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }

  private async handleGatewayMessage(
    payload: GatewayReceivePayload,
    token: string,
    intents: number,
  ): Promise<void> {
    if (payload.s !== null) {
      this.sequence = payload.s;
    }

    switch (payload.op) {
      case GatewayOpcodes.Hello:
        this.startHeartbeat(payload.d.heartbeat_interval);
        await this.identify(token, intents);
        break;

      case GatewayOpcodes.HeartbeatAck:
        this.lastHeartbeatAck = true;
        break;

      case GatewayOpcodes.Dispatch:
        await this.handleDispatch(payload as GatewayDispatchPayload);
        break;

      case GatewayOpcodes.Reconnect:
        await this.reconnect(token, intents);
        break;

      case GatewayOpcodes.InvalidSession:
        if (payload.d) {
          await this.resume(token);
        } else {
          await this.identify(token, intents);
        }
        break;
    }
  }

  private async handleDispatch(payload: GatewayDispatchPayload): Promise<void> {
    switch (payload.t) {
      case GatewayDispatchEvents.Ready:
        this.sessionId = payload.d.session_id;
        this.resumeUrl = payload.d.resume_gateway_url;
        await this.storage.put('session', {
          sessionId: this.sessionId,
          resumeUrl: this.resumeUrl,
          sequence: this.sequence,
        });
        break;

      default:
        // Store events for processing
        await this.storage.put(`event:${Date.now()}`, payload);
    }
  }

  private startHeartbeat(interval: number): void {
    this.heartbeatInterval = interval;
    this.sendHeartbeat();
  }

  private sendHeartbeat(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    if (!this.lastHeartbeatAck) {
      console.error('Heartbeat ACK not received, reconnecting...');
      this.ws.close(1000, 'Heartbeat ACK not received');
      return;
    }

    this.lastHeartbeatAck = false;
    this.send({
      op: GatewayOpcodes.Heartbeat,
      d: this.sequence,
    } as GatewaySendPayload);

    this.state.waitUntil(
      new Promise((resolve) => {
        setTimeout(() => {
          this.sendHeartbeat();
          resolve(undefined);
        }, this.heartbeatInterval!);
      }),
    );
  }

  private async identify(token: string, intents: number): Promise<void> {
    const payload: GatewaySendPayload = {
      op: GatewayOpcodes.Identify,
      d: {
        token,
        intents,
        properties: {
          os: 'cloudflare',
          browser: 'cloudflare-discord-js',
          device: 'cloudflare-discord-js',
        },
      } as GatewayIdentifyData,
    };

    this.send(payload);
  }

  private async resume(token: string): Promise<void> {
    const session = await this.storage.get('session') as any;
    if (!session?.sessionId) {
      throw new Error('No session to resume');
    }

    this.send({
      op: GatewayOpcodes.Resume,
      d: {
        token,
        session_id: session.sessionId,
        seq: this.sequence,
      },
    } as GatewaySendPayload);
  }

  private send(payload: GatewaySendPayload): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    this.ws.send(JSON.stringify(payload));
  }

  private async reconnect(token: string, intents: number): Promise<void> {
    this.cleanup();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    await this.connect(token, intents);
  }

  private cleanup(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
    this.lastHeartbeatAck = true;
  }

  private async handleDisconnect(): Promise<Response> {
    this.cleanup();
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async handleSend(request: Request): Promise<Response> {
    const payload = await request.json() as GatewaySendPayload;
    
    try {
      this.send(payload);
      return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: String(error) }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  private async handleStatus(): Promise<Response> {
    return new Response(JSON.stringify({
      connected: this.ws?.readyState === WebSocket.OPEN,
      sessionId: this.sessionId,
      sequence: this.sequence,
    }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}