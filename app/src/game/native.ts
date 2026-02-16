export type NativeMessage = {
  type: string;
  data?: unknown;
  text?: string;
  ts: string;
};

export type IncomingMessage = {
  type?: string;
  [key: string]: unknown;
};

type EventSink = (event: NativeMessage) => void;
type IncomingSink = (msg: IncomingMessage) => void;

let eventSink: EventSink | null = null;
let incomingSink: IncomingSink | null = null;

function safeStringify(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ message: "Failed to serialize value" });
  }
}

export function setEventSink(sink: EventSink | null) {
  eventSink = sink;
}

export function emitEvent(type: string, data?: unknown, text?: string) {
  const payload: NativeMessage = {
    type,
    data,
    text,
    ts: new Date().toISOString(),
  };
  eventSink?.(payload);
}

function formatError(err: unknown) {
  if (err instanceof Error) {
    return { message: err.message, stack: err.stack };
  }
  return { message: String(err) };
}

function logLine(level: string, message: string, extra?: unknown) {
  const base = `[${new Date().toISOString()}] ${level} ${message}`;
  if (extra === undefined) {
    process.stderr.write(`${base}\n`);
    return;
  }
  process.stderr.write(`${base} ${safeStringify(extra)}\n`);
}

export function logInfo(message: string, extra?: unknown) {
  logLine("INFO", message, extra);
}

export function logWarn(message: string, extra?: unknown) {
  logLine("WARN", message, extra);
}

export function logError(message: string, err?: unknown) {
  const extra = err === undefined ? undefined : formatError(err);
  logLine("ERROR", message, extra);
}

export function startNativeMessageListener(onMessage: (msg: IncomingMessage) => void) {
  incomingSink = onMessage;
}

export function deliverIncomingMessage(msg: IncomingMessage) {
  incomingSink?.(msg);
}
