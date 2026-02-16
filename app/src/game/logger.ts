function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ message: 'Failed to serialize value' });
  }
}

function formatError(err: unknown) {
  if (err instanceof Error) return { message: err.message, stack: err.stack };
  return { message: String(err) };
}

function logLine(level: string, message: string, extra?: unknown) {
  const base = `[${new Date().toISOString()}] ${level} ${message}`;
  const suffix = extra !== undefined ? ` ${safeStringify(extra)}` : '';
  process.stderr.write(`${base}${suffix}\n`);
}

export function logInfo(message: string, extra?: unknown) {
  logLine('INFO', message, extra);
}

export function logWarn(message: string, extra?: unknown) {
  logLine('WARN', message, extra);
}

export function logError(message: string, err?: unknown) {
  logLine('ERROR', message, err !== undefined ? formatError(err) : undefined);
}
