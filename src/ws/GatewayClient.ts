import type { DurableObjectNamespace } from '@cloudflare/workers-types';
import type { GatewaySendPayload, GatewayIntentBits } from 'discord-api-types/v10';

export interface GatewayClientOptions {
  token: string;
  intents: number | GatewayIntentBits[];
}

export class GatewayClient {
  private namespace: DurableObjectNamespace;
  private stubId: DurableObjectId;
  private stub?: DurableObjectStub;

  constructor(namespace: DurableObjectNamespace, clientId: string) {
    this.namespace = namespace;
    this.stubId = namespace.idFromName(clientId);
  }

  private async getStub(): Promise<DurableObjectStub> {
    if (!this.stub) {
      this.stub = this.namespace.get(this.stubId);
    }
    return this.stub;
  }

  async connect(options: GatewayClientOptions): Promise<void> {
    const stub = await this.getStub();
    const intents = Array.isArray(options.intents)
      ? options.intents.reduce((acc, bit) => acc | bit, 0)
      : options.intents;

    const response = await stub.fetch('http://internal/connect', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: options.token,
        intents,
      }),
    });

    if (!response.ok) {
      const error = await response.json() as { error: string };
      throw new Error(`Failed to connect: ${error.error}`);
    }
  }

  async disconnect(): Promise<void> {
    const stub = await this.getStub();
    const response = await stub.fetch('http://internal/disconnect', {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json() as { error: string };
      throw new Error(`Failed to disconnect: ${error.error}`);
    }
  }

  async send(payload: GatewaySendPayload): Promise<void> {
    const stub = await this.getStub();
    const response = await stub.fetch('http://internal/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.json() as { error: string };
      throw new Error(`Failed to send: ${error.error}`);
    }
  }

  async getStatus(): Promise<{
    connected: boolean;
    sessionId?: string;
    sequence: number | null;
  }> {
    const stub = await this.getStub();
    const response = await stub.fetch('http://internal/status');
    
    if (!response.ok) {
      throw new Error('Failed to get status');
    }

    return response.json();
  }
}