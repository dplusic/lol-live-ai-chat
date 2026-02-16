import {
  champName,
  classifyQueue,
  displayMode,
  FILTERED_ITEM_NAMES,
  normalizeSummonerName,
  summarizeItems,
  summarizeKda,
  summarizeTeam,
} from "./format";
import { lcuGetJson } from "./lcu";
import type { LcuCreds } from "./lcu";
import type { LiveAllGameData, LivePlayer } from "./live";
import { getLiveAllGameData } from "./live";
import { emitEvent } from "./events";
import type { State } from "./state";
import type { GameflowSession, GameflowTeamMember } from "./types";

type Summoner = { summonerId?: number };

export async function updateModeFromSession(
  creds: LcuCreds,
  state: State
): Promise<GameflowSession | null> {
  const session = await lcuGetJson<GameflowSession>(creds, "/lol-gameflow/v1/session", {
    allow404: true,
  });
  const mode = classifyQueue({ queueId: session?.gameData?.queue?.id });
  if (mode !== state.lastMode) {
    state.lastMode = mode;
    emitEvent("gameMode", { mode, label: displayMode(mode) });
  }
  return session;
}

async function ensureLocalSummoner(
  creds: LcuCreds,
  state: State,
  session: GameflowSession | null
) {
  if (state.localSummonerId) return;
  const local = session?.localPlayer ?? session?.gameData?.localPlayer;
  if (typeof local?.summonerId === "number") state.localSummonerId = local.summonerId;
  if (state.localSummonerId) return;
  const me = await lcuGetJson<Summoner>(creds, "/lol-summoner/v1/current-summoner", {
    allow404: true,
  });
  if (typeof me?.summonerId === "number") state.localSummonerId = me.summonerId;
}

export async function handleChampSelect(creds: LcuCreds, state: State) {
  const session = await updateModeFromSession(creds, state);
  const pickable = await lcuGetJson<unknown[]>(creds, "/lol-champ-select/v1/pickable-champions", {
    allow404: true,
  });

  if (state.lastMode === "aram" && Array.isArray(pickable)) {
    const ids = pickable
      .map((c) => (typeof c === "number" ? c : typeof (c as any)?.id === "number" ? (c as any).id : 0))
      .filter((id) => id > 0);
    const key = ids.join(",");
    if (ids.length && (key !== state.lastPickableKey || !state.aramPickablePrinted)) {
      state.lastPickableKey = key;
      state.aramPickablePrinted = true;
      emitEvent("aramPickable", {
        champions: ids.map((id) => ({ id, name: champName(state.championMap, id) })),
      });
    }
  }

  const myTeam = session?.myTeam ?? [];
  const theirTeam = session?.theirTeam ?? [];
  for (const p of myTeam) {
    if (typeof p?.summonerId === "number") state.myTeamSummonerIds.add(p.summonerId);
  }
  const champKey = JSON.stringify({
    my: myTeam.map((p) => p?.championId ?? 0),
    their: theirTeam.map((p) => p?.championId ?? 0),
  });
  if (champKey !== state.lastChampSelectKey) {
    state.lastChampSelectKey = champKey;
    emitEvent("champSelectTeams", {
      myTeam: summarizeTeam(myTeam, state.championMap),
      theirTeam: summarizeTeam(theirTeam, state.championMap),
    });
  }
}

type TeamsData = {
  myTeam: GameflowTeamMember[];
  enemyTeam: GameflowTeamMember[];
  gameId: number | null;
  myTeamNames: Set<string>;
};

async function buildTeamsData(creds: LcuCreds, state: State): Promise<TeamsData> {
  const session = await updateModeFromSession(creds, state);
  await ensureLocalSummoner(creds, state, session);

  const teamOne = session?.gameData?.teamOne ?? [];
  const teamTwo = session?.gameData?.teamTwo ?? [];
  const teamOneIds = new Set(teamOne.map((p) => p.summonerId).filter((id): id is number => typeof id === "number"));
  const teamTwoIds = new Set(teamTwo.map((p) => p.summonerId).filter((id): id is number => typeof id === "number"));
  const isTeamOneMine = teamOneIds.has(state.localSummonerId!);
  const isTeamTwoMine = teamTwoIds.has(state.localSummonerId!);
  const myTeam = isTeamOneMine ? teamOne : isTeamTwoMine ? teamTwo : [];
  const enemyTeam = isTeamOneMine ? teamTwo : isTeamTwoMine ? teamOne : [];
  const gameId = typeof session?.gameData?.gameId === "number" ? session.gameData.gameId : null;
  const myTeamNames = new Set(
    myTeam.map((p) => p.summonerName).filter((n): n is string => typeof n === "string" && n.length > 0)
  );

  return { myTeam, enemyTeam, gameId, myTeamNames };
}

export async function handleGameStart(creds: LcuCreds, state: State, suppressEmit = false) {
  const { myTeam, enemyTeam, gameId, myTeamNames } = await buildTeamsData(creds, state);

  const key = JSON.stringify({
    my: myTeam.map((p) => p.championId ?? 0),
    enemy: enemyTeam.map((p) => p.championId ?? 0),
  });
  if (suppressEmit) {
    state.lastLoadingKey = key;
    state.pendingTeams = null;
  } else if (key !== state.lastLoadingKey && (myTeam.length || enemyTeam.length)) {
    state.lastLoadingKey = key;
    const myTeamStr = summarizeTeam(myTeam, state.championMap, state.localSummonerId);
    const enemyTeamStr = summarizeTeam(enemyTeam, state.championMap);
    const modeLabel = displayMode(state.lastMode);

    const live = await getLiveAllGameData();
    if (live && Array.isArray(live.allPlayers) && live.allPlayers.length > 0) {
      const teamDetails = buildRuneSpellLines(live, myTeamNames, state);
      emitEvent("loadingTeams", { myTeam: myTeamStr, enemyTeam: enemyTeamStr, modeLabel, gameId, teamDetails });
    } else {
      state.pendingTeams = { myTeam: myTeamStr, enemyTeam: enemyTeamStr, modeLabel, gameId };
    }
  }
  state.myTeamSummonerNames = myTeamNames;
}

export async function handleManualGameStart(creds: LcuCreds, state: State) {
  const { myTeam, enemyTeam, gameId, myTeamNames } = await buildTeamsData(creds, state);
  state.myTeamSummonerNames = myTeamNames;

  const live = await getLiveAllGameData();
  const teamDetails = live && Array.isArray(live.allPlayers)
    ? buildRuneSpellLines(live, myTeamNames, state)
    : undefined;

  emitEvent("loadingTeams", {
    myTeam: summarizeTeam(myTeam, state.championMap, state.localSummonerId),
    enemyTeam: summarizeTeam(enemyTeam, state.championMap),
    modeLabel: displayMode(state.lastMode),
    gameId,
    manual: true,
    teamDetails,
  });
}

function splitTeams(
  allPlayers: LivePlayer[],
  myTeamTag: string | undefined,
  myNames: Set<string>
): { myPlayers: LivePlayer[]; enemyPlayers: LivePlayer[] } {
  if (myTeamTag) {
    return {
      myPlayers: allPlayers.filter((p) => p?.team === myTeamTag),
      enemyPlayers: allPlayers.filter((p) => p?.team && p.team !== myTeamTag),
    };
  }

  const isMatch = (name: string | undefined) => {
    if (!name) return false;
    if (myNames.has(name)) return true;
    const norm = normalizeSummonerName(name);
    return !!norm && [...myNames].some((n) => normalizeSummonerName(n) === norm);
  };

  return {
    myPlayers: allPlayers.filter((p) => isMatch(p?.summonerName)),
    enemyPlayers: allPlayers.filter((p) => !isMatch(p?.summonerName)),
  };
}

function buildRuneSpellLines(
  live: LiveAllGameData,
  myTeamNames: Set<string>,
  state: State
): string {
  const allPlayers = live.allPlayers ?? [];
  const normActiveName = normalizeSummonerName(live.activePlayer?.summonerName);
  const meEntry = normActiveName
    ? allPlayers.find((p) => normalizeSummonerName(p.summonerName) === normActiveName)
    : undefined;
  const myTeamTag = meEntry?.team ?? live.activePlayer?.team;
  const { myPlayers, enemyPlayers } = splitTeams(allPlayers, myTeamTag, myTeamNames);

  const fmt = (p: LivePlayer): string => {
    const isMe = normActiveName != null && normalizeSummonerName(p.summonerName) === normActiveName;
    const champ = champName(state.championMap, p.championName ?? p.rawChampionName);
    const keystone = p.runes?.keystone?.displayName ?? '?';
    const primary = p.runes?.primaryRuneTree?.displayName ?? '?';
    const secondary = p.runes?.secondaryRuneTree?.displayName ?? '?';
    const spell1 = p.summonerSpells?.summonerSpellOne?.displayName ?? '?';
    const spell2 = p.summonerSpells?.summonerSpellTwo?.displayName ?? '?';
    return `${isMe ? '(나) ' : ''}${champ}: ${keystone}(${primary}/${secondary}) ${spell1}+${spell2}`;
  };

  const lines: string[] = [];
  if (myPlayers.length > 0 || enemyPlayers.length > 0) {
    if (myPlayers.length > 0) {
      lines.push('우리팀:');
      myPlayers.forEach((p) => lines.push(fmt(p)));
    }
    if (enemyPlayers.length > 0) {
      lines.push('상대팀:');
      enemyPlayers.forEach((p) => lines.push(fmt(p)));
    }
  } else {
    allPlayers.forEach((p) => lines.push(fmt(p)));
  }
  return lines.join('\n');
}

export async function handleInProgress(state: State) {
  const live = await getLiveAllGameData();
  if (!state.liveReady) {
    if (!live || !Array.isArray(live.allPlayers)) return;
    state.liveReady = true;

    if (state.pendingTeams) {
      const teamDetails = buildRuneSpellLines(live, state.myTeamSummonerNames, state);
      emitEvent('loadingTeams', { ...state.pendingTeams, teamDetails });
      state.pendingTeams = null;
    }
  }
  if (!live || !Array.isArray(live.allPlayers)) return;

  const { myPlayers, enemyPlayers } = splitTeams(
    live.allPlayers,
    live.activePlayer?.team,
    state.myTeamSummonerNames
  );
  const now = Date.now();
  if (now - state.lastItemsPrintAt < 60_000) return;
  state.lastItemsPrintAt = now;

  if (myPlayers.length || enemyPlayers.length) {
    emitEvent("items", {
      myTeam: summarizeItems(myPlayers, state.itemMap, state.championMap),
      enemyTeam: summarizeItems(enemyPlayers, state.itemMap, state.championMap),
    });
  } else {
    emitEvent("items", {
      allPlayers: summarizeItems(live.allPlayers, state.itemMap, state.championMap),
    });
  }
  emitEvent("kda", {
    allPlayers: summarizeKda(live.allPlayers, state.championMap),
  });
}

export async function handleIngameUpdate(creds: LcuCreds, state: State) {
  const session = await updateModeFromSession(creds, state);
  await ensureLocalSummoner(creds, state, session);

  const live = await getLiveAllGameData();
  if (!live || !Array.isArray(live.allPlayers) || live.allPlayers.length === 0) {
    emitEvent("sendChatMessage", { message: "[인게임 업데이트] 현재 게임 진행 중이 아닙니다." });
    return;
  }

  const normActiveName = normalizeSummonerName(live.activePlayer?.summonerName);
  const meEntry = normActiveName
    ? live.allPlayers.find((p) => normalizeSummonerName(p.summonerName) === normActiveName)
    : undefined;
  const myTeamTag = meEntry?.team ?? live.activePlayer?.team;

  const { myPlayers, enemyPlayers } = splitTeams(
    live.allPlayers,
    myTeamTag,
    state.myTeamSummonerNames
  );

  const gameTimeSeconds = live.gameData?.gameTime ?? 0;
  const minutes = Math.floor(gameTimeSeconds / 60);
  const seconds = Math.floor(gameTimeSeconds % 60);
  const timeStr = `${minutes}:${seconds.toString().padStart(2, "0")}`;

  const formatPlayer = (p: LivePlayer) => {
    const isMe = normActiveName != null && normalizeSummonerName(p.summonerName) === normActiveName;
    const champ = champName(state.championMap, p.championName ?? p.rawChampionName);
    const level = p.level ?? 0;
    const k = p.scores?.kills ?? 0;
    const d = p.scores?.deaths ?? 0;
    const a = p.scores?.assists ?? 0;
    const cs = p.scores?.creepScore ?? 0;
    const items = Array.isArray(p.items)
      ? p.items
          .map((i) => i?.itemID ?? 0)
          .filter((id) => id > 0)
          .map((id) => state.itemMap.get(id)?.name)
          .filter((name): name is string => !!name && !FILTERED_ITEM_NAMES.has(name))
          .join(",")
      : "";
    return `${isMe ? "(나) " : ""}${champ} L${level} CS${cs} ${k}/${d}/${a} [${items}]`;
  };

  const message = [
    "[인게임 업데이트]",
    timeStr,
    "우리팀:",
    ...myPlayers.map(formatPlayer),
    "상대팀:",
    ...enemyPlayers.map(formatPlayer),
  ].join("\n");

  emitEvent("sendChatMessage", { message });
}

export async function handleRecommendChamp(creds: LcuCreds, state: State) {
  const session = await updateModeFromSession(creds, state);
  await ensureLocalSummoner(creds, state, session);

  const champSelectSession = await lcuGetJson<any>(creds, "/lol-champ-select/v1/session");
  if (!champSelectSession) return;

  const myTeam: Array<{ championId?: number; summonerId?: number }> =
    Array.isArray(champSelectSession.myTeam) ? champSelectSession.myTeam : [];
  const myTeamStr = myTeam
    .map((p) => {
      const name = champName(state.championMap, p.championId);
      return `${name}${p.summonerId === state.localSummonerId ? "(나)" : ""}`;
    })
    .join(", ");

  let message: string;
  if (state.lastMode === "aram") {
    const bench: Array<{ championId?: number }> =
      Array.isArray(champSelectSession.benchChampions) ? champSelectSession.benchChampions : [];
    const benchStr = bench.map((c) => champName(state.championMap, c.championId)).join(", ");
    message = [
      "[챔피언 선택]",
      `모드: ${displayMode("aram")}`,
      `현재 선택: ${myTeamStr}`,
      `선택 가능 챔피언: ${benchStr}`,
    ].join("\n");
  } else {
    message = [
      "[챔피언 선택]",
      `모드: ${displayMode(state.lastMode)}`,
      `현재 우리팀 선택: ${myTeamStr}`,
      "조합을 보고 챔피언을 추천해줘.",
    ].join("\n");
  }

  emitEvent("sendChatMessage", { message });
}
