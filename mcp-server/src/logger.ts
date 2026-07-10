type LogLevel = 'debug' | 'info' | 'warn' | 'error';
type LogMetadata = Record<string, unknown>;

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const rawLogLevel = process.env.LOG_LEVEL?.toLowerCase();
const activeLogLevel: LogLevel = rawLogLevel === 'debug'
  || rawLogLevel === 'info'
  || rawLogLevel === 'warn'
  || rawLogLevel === 'error'
  ? rawLogLevel
  : 'info';

function serializeError(error: Error) {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
}

function safeStringify(value: unknown): string {
  const seen = new WeakSet<object>();
  return JSON.stringify(value, (_key, current: unknown) => {
    if (current instanceof Error) {
      return serializeError(current);
    }
    if (typeof current === 'bigint') {
      return current.toString();
    }
    if (typeof current === 'object' && current !== null) {
      if (seen.has(current)) {
        return '[Circular]';
      }
      seen.add(current);
    }
    return current;
  });
}

function write(level: LogLevel, message: string, metadata?: LogMetadata) {
  if (LEVEL_ORDER[level] < LEVEL_ORDER[activeLogLevel]) {
    return;
  }

  const payload: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    level,
    service: 'aub-clubs-mcp-server',
    message,
  };

  if (metadata && Object.keys(metadata).length > 0) {
    payload.metadata = metadata;
  }

  const line = safeStringify(payload);
  if (level === 'error') {
    console.error(line);
    return;
  }
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  console.log(line);
}

export const logger = {
  debug: (message: string, metadata?: LogMetadata) => write('debug', message, metadata),
  info: (message: string, metadata?: LogMetadata) => write('info', message, metadata),
  warn: (message: string, metadata?: LogMetadata) => write('warn', message, metadata),
  error: (message: string, metadata?: LogMetadata) => write('error', message, metadata),
};
