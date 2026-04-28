import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import express, { type Request, type Response } from 'express';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { buildMcpServer } from './server.js';
import { bearerAuth } from './auth.js';
import { logger } from './logger.js';

const port = Number(process.env.PORT ?? 8081);
const app = express();

function requestIdFromResponse(res: Response): string | undefined {
  const requestId = res.locals.requestId;
  return typeof requestId === 'string' ? requestId : undefined;
}

app.use((req, res, next) => {
  const headerRequestId = req.header('x-request-id')?.trim();
  const requestId = headerRequestId && headerRequestId.length > 0 ? headerRequestId : randomUUID();
  res.locals.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  const startedAt = Date.now();
  logger.info('request started', {
    requestId,
    method: req.method,
    path: req.path,
  });

  res.on('finish', () => {
    logger.info('request completed', {
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
    });
  });

  next();
});

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

const transports = new Map<string, SSEServerTransport>();

app.get('/sse', bearerAuth, async (req: Request, res: Response) => {
  const requestId = requestIdFromResponse(res);
  const transport = new SSEServerTransport('/messages', res);
  transports.set(transport.sessionId, transport);
  logger.info('sse session opened', {
    requestId,
    sessionId: transport.sessionId,
    activeSessions: transports.size,
  });

  res.on('close', () => {
    transports.delete(transport.sessionId);
    logger.info('sse session closed', {
      requestId,
      sessionId: transport.sessionId,
      activeSessions: transports.size,
    });
  });

  const server = buildMcpServer();
  try {
    await server.connect(transport);
    logger.info('mcp transport connected', {
      requestId,
      sessionId: transport.sessionId,
    });
  } catch (err) {
    transports.delete(transport.sessionId);
    logger.error('failed to connect MCP transport', {
      requestId,
      sessionId: transport.sessionId,
      error: err,
    });
    if (!res.headersSent) {
      res.status(500).end();
    }
  }
});

app.post('/messages', bearerAuth, async (req: Request, res: Response) => {
  const requestId = requestIdFromResponse(res);
  const sessionId = req.query.sessionId;
  if (typeof sessionId !== 'string') {
    logger.warn('missing sessionId on /messages', {
      requestId,
      query: req.query,
    });
    res.status(400).json({ error: 'missing sessionId' });
    return;
  }
  const transport = transports.get(sessionId);
  if (!transport) {
    logger.warn('unknown sessionId on /messages', {
      requestId,
      sessionId,
      activeSessions: transports.size,
    });
    res.status(404).json({ error: 'unknown sessionId' });
    return;
  }
  logger.info('handling MCP message', {
    requestId,
    sessionId,
  });
  try {
    await transport.handlePostMessage(req, res);
    logger.info('handled MCP message', {
      requestId,
      sessionId,
    });
  } catch (err) {
    logger.error('failed to handle MCP message', {
      requestId,
      sessionId,
      error: err,
    });
    if (!res.headersSent) {
      res.status(500).json({ error: 'failed to handle message' });
    }
  }
});

app.listen(port, () => {
  logger.info('mcp server listening', {
    url: `http://localhost:${port}`,
    port,
  });
});
