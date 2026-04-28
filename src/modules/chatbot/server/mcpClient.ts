import 'server-only';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

let cachedClient: Client | null = null;
let connecting: Promise<Client> | null = null;

async function connect(): Promise<Client> {
  const url = process.env.MCP_SERVER_URL;
  const token = process.env.MCP_BEARER_TOKEN;
  if (!url) throw new Error('MCP_SERVER_URL is not set');
  if (!token) throw new Error('MCP_BEARER_TOKEN is not set');

  const sseUrl = new URL('/sse', url);
  const authHeader = `Bearer ${token}`;

  const transport = new SSEClientTransport(sseUrl, {
    requestInit: { headers: { Authorization: authHeader } },
    eventSourceInit: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        headers.set('Authorization', authHeader);
        return fetch(input, { ...init, headers });
      },
    },
  });

  const client = new Client(
    { name: 'aub-clubs-app', version: '0.1.0' },
    { capabilities: {} },
  );
  await client.connect(transport);
  return client;
}

export async function getMcpClient(): Promise<Client> {
  if (cachedClient) return cachedClient;
  if (!connecting) {
    connecting = connect()
      .then((c) => {
        cachedClient = c;
        return c;
      })
      .catch((err) => {
        connecting = null;
        throw err;
      });
  }
  return connecting;
}

export async function resetMcpClient() {
  if (cachedClient) {
    try {
      await cachedClient.close();
    } catch {
      // ignore
    }
  }
  cachedClient = null;
  connecting = null;
}
