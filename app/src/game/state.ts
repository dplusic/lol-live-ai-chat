import type { ChampMap, GameMode, ItemMap } from "./format";

export type PendingTeams = {
  myTeam: string;
  enemyTeam: string;
  modeLabel: string;
  gameId: number | null;
};

export type State = {
  championMap: ChampMap;
  itemMap: ItemMap;
  myTeamSummonerIds: Set<number>;
  myTeamSummonerNames: Set<string>;
  lastPhase: string;
  lastChampSelectKey: string;
  lastPickableKey: string;
  lastLoadingKey: string;
  lastItemsPrintAt: number;
  lastMode: GameMode;
  aramPickablePrinted: boolean;
  liveReady: boolean;
  pendingTeams: PendingTeams | null;
  localSummonerId: number | null;
};

export const initState = (): State => ({
  championMap: new Map(),
  itemMap: new Map(),
  myTeamSummonerIds: new Set(),
  myTeamSummonerNames: new Set(),
  lastPhase: "",
  lastChampSelectKey: "",
  lastPickableKey: "",
  lastLoadingKey: "",
  lastItemsPrintAt: 0,
  lastMode: "unknown",
  aramPickablePrinted: false,
  liveReady: false,
  pendingTeams: null,
  localSummonerId: null,
});

export const resetMatchState = (state: State) => {
  state.myTeamSummonerIds.clear();
  state.myTeamSummonerNames.clear();
  state.lastChampSelectKey = "";
  state.lastLoadingKey = "";
  state.lastItemsPrintAt = 0;
  state.liveReady = false;
  state.pendingTeams = null;
  state.lastPickableKey = "";
  state.aramPickablePrinted = false;
};
