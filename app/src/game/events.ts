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

export function setEventSink(sink: EventSink | null) {
  eventSink = sink;
}

export function emitEvent(type: string, data?: unknown, text?: string) {
  eventSink?.({ type, data, text, ts: new Date().toISOString() });
}

export function startNativeMessageListener(onMessage: (msg: IncomingMessage) => void) {
  incomingSink = onMessage;
}

export function deliverIncomingMessage(msg: IncomingMessage) {
  incomingSink?.(msg);
}
