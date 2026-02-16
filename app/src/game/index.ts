import {
  handleChampSelect,
  handleGameStart,
  handleInProgress,
  handleIngameUpdate,
  handleRecommendChamp,
  handleManualGameStart,
} from './handlers';
import { loadDDragonData } from './ddragon';
import { updatePhase } from './lifecycle';
import { initState } from './state';
import type { State } from './state';
import { waitForLcu } from './lcu';
import type { LcuCreds } from './lcu';
import {
  deliverIncomingMessage,
  emitEvent,
  startNativeMessageListener,
} from './events';
import { logInfo, logWarn } from './logger';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

let shouldStop = false;
let runPromise: Promise<void> | null = null;

export function startGameLoop() {
  if (runPromise) return runPromise;
  shouldStop = false;
  runPromise = run().finally(() => { runPromise = null; });
  return runPromise;
}

export function stopGameLoop() {
  if (!runPromise) return;
  deliverIncomingMessage({ type: 'shutdown' });
}

export function sendGameCommand(message: { type: string; [key: string]: unknown }) {
  deliverIncomingMessage(message);
}

async function run() {
  let state: State | null = null;
  let creds: LcuCreds | null = null;

  startNativeMessageListener((msg) => {
    if (msg?.type === 'ping') { emitEvent('pong'); return; }
    if (msg?.type === 'shutdown') { shouldStop = true; emitEvent('shutdownAck'); return; }
    if (msg?.type === 'toggleAutoSend') {
      emitEvent('autoSend', { enabled: Boolean((msg as any)?.enabled) });
      return;
    }
    if (msg?.type === 'resetChat') { emitEvent('chatReset'); return; }
    if (msg?.type === 'sendIngameUpdate') { if (state && creds) void handleIngameUpdate(creds, state); return; }
    if (msg?.type === 'recommendChamp') { if (state && creds) void handleRecommendChamp(creds, state); return; }
    if (msg?.type === 'manualGameStart') { if (state && creds) void handleManualGameStart(creds, state); return; }
    logWarn('Unhandled native message', msg);
  });

  while (true) {
    if (shouldStop) break;
    creds = await waitForLcu(() => shouldStop);
    if (!creds) break;
    emitEvent('lcuConnected', { port: creds.port });
    logInfo(`LCU connected on port ${creds.port}`);
    state = initState();

    try {
      await loadDDragonData(state);
      let firstPhaseCheck = true;
      while (true) {
        if (shouldStop) break;
        const phase = await updatePhase(creds, state);
        const midGameStartup = firstPhaseCheck && (phase === 'GameStart' || phase === 'InProgress');
        firstPhaseCheck = false;
        if (phase === 'ChampSelect') await handleChampSelect(creds, state);
        if (phase === 'GameStart' || phase === 'InProgress') await handleGameStart(creds, state, midGameStartup);
        if (phase === 'InProgress') await handleInProgress(state);
        await delay(1000);
      }
    } catch (err) {
      emitEvent('lcuDisconnected', { message: err instanceof Error ? err.message : String(err) });
      logWarn('LCU disconnected, retrying...', err);
      state = null;
      creds = null;
      await delay(1000);
    }
  }
}
