import { timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { logger } from './logger.js';

const expectedToken = process.env.MCP_BEARER_TOKEN;
if (!expectedToken) {
  throw new Error('MCP_BEARER_TOKEN is required');
}
const expectedBuf = Buffer.from(expectedToken, 'utf8');

export function bearerAuth(req: Request, res: Response, next: NextFunction) {
  const requestId = typeof res.locals.requestId === 'string' ? res.locals.requestId : undefined;
  const header = req.header('authorization') ?? req.header('Authorization');
  if (!header || !header.startsWith('Bearer ')) {
    logger.warn('authentication failed', {
      requestId,
      path: req.path,
      reason: 'missing bearer token',
    });
    res.status(401).json({ error: 'missing bearer token' });
    return;
  }
  const provided = Buffer.from(header.slice('Bearer '.length).trim(), 'utf8');
  if (provided.length !== expectedBuf.length || !timingSafeEqual(provided, expectedBuf)) {
    logger.warn('authentication failed', {
      requestId,
      path: req.path,
      reason: 'invalid bearer token',
    });
    res.status(401).json({ error: 'invalid bearer token' });
    return;
  }
  logger.debug('authentication succeeded', {
    requestId,
    path: req.path,
  });
  next();
}
