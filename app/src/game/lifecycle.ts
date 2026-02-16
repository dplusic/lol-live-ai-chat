import { normalizePhase } from './format';
import { lcuGetText } from './lcu';
import type { LcuCreds } from './lcu';
import { emitEvent } from './events';
import { resetMatchState } from './state';
import type { State } from './state';

const ACTIVE_PHASES = new Set(['ChampSelect', 'GameStart', 'InProgress']);

export async function updatePhase(creds: LcuCreds, state: State): Promise<string> {
  const phase = normalizePhase(await lcuGetText(creds, '/lol-gameflow/v1/gameflow-phase'));
  if (phase === state.lastPhase) return phase;

  const prevPhase = state.lastPhase;
  emitEvent('phaseChanged', { phase });
  state.lastPhase = phase;

  if (phase !== 'ChampSelect') {
    state.lastPickableKey = '';
    state.aramPickablePrinted = false;
  }
  if (!ACTIVE_PHASES.has(phase) || (phase === 'ChampSelect' && prevPhase !== 'ChampSelect')) {
    resetMatchState(state);
  }

  return phase;
}
