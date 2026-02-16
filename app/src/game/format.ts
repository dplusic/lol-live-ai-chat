import type { LivePlayer } from "./live";

export type ChampInfo = {
  id: number | string;
  name: string;
};

export type ChampMap = Map<number | string, ChampInfo>;
export type ItemMap = Map<number, { name: string }>;

export const FILTERED_ITEM_NAMES = new Set(["포로간식", "포로 간식"]);

export function toChampionMap(list: ChampInfo[] | null): ChampMap {
  const map: ChampMap = new Map();
  if (!Array.isArray(list)) return map;
  for (const champ of list) {
    if (champ && (typeof champ.id === "number" || typeof champ.id === "string")) {
      map.set(champ.id, champ);
    }
  }
  return map;
}

export function champName(map: ChampMap, id?: number | string | null): string {
  if (!id) return "Unknown";
  return map.get(id)?.name ?? String(id);
}

export function normalizeSummonerName(name?: string | null): string | null {
  if (!name) return null;
  const base = name.split("#")[0]?.trim();
  return base ? base.toLowerCase() : null;
}

export function summarizeTeam(
  players: Array<{ championId?: number; summonerId?: number }>,
  map: ChampMap,
  meSummonerId?: number | null
): string {
  return players
    .map((p) => {
      const name = champName(map, p.championId);
      const isMe = meSummonerId != null && p.summonerId === meSummonerId;
      return isMe ? `${name}(나)` : name;
    })
    .join(", ");
}

export function summarizeItems(
  players: LivePlayer[],
  itemMap: ItemMap,
  championMap: ChampMap
): string {
  return players
    .map((p) => {
      const cName = champName(championMap, p.championName ?? p.rawChampionName);
      const items = Array.isArray(p.items)
        ? p.items
            .map((i) => i?.itemID ?? 0)
            .filter((id) => id > 0)
            .map((id) => itemMap.get(id)?.name)
            .filter((name): name is string => !!name && !FILTERED_ITEM_NAMES.has(name))
        : [];
      return `${cName}:[${items.join(",")}]`;
    })
    .join(", ");
}

export function summarizeKda(players: LivePlayer[], championMap: ChampMap): string {
  return players
    .map((p) => {
      const cName = champName(championMap, p.championName ?? p.rawChampionName);
      const level = p.level ?? 0;
      const k = p.scores?.kills ?? 0;
      const d = p.scores?.deaths ?? 0;
      const a = p.scores?.assists ?? 0;
      return `${cName}: L${level} ${k}/${d}/${a}`;
    })
    .join(", ");
}

export function normalizePhase(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed.replace(/^"+|"+$/g, "");
    }
  }
  return trimmed;
}

export type GameMode =
  | "aram"
  | "ranked_solo"
  | "ranked_flex"
  | "normal_blind"
  | "normal_draft"
  | "quickplay"
  | "cherry"
  | "practice"
  | "unknown";

export function classifyQueue(info: {
  queueId?: number;
  gameMode?: string;
  mapId?: number;
}): GameMode {
  const queueId = info.queueId ?? 0;
  const gameMode = info.gameMode ?? "";
  const mapId = info.mapId ?? 0;

  if (queueId === 450 || gameMode === "ARAM" || mapId === 12) return "aram";
  if (queueId === 420) return "ranked_solo";
  if (queueId === 440) return "ranked_flex";
  if (queueId === 430) return "normal_blind";
  if (queueId === 400) return "normal_draft";
  if (queueId === 490) return "quickplay";
  if (queueId === 2400) return "cherry";
  if (queueId === 3140) return "practice";
  return "unknown";
}

export function displayMode(mode: GameMode): string {
  switch (mode) {
    case "aram":         return "칼바람";
    case "ranked_solo":  return "솔랭";
    case "ranked_flex":  return "Ranked Flex";
    case "normal_blind": return "일겜(Blind)";
    case "normal_draft": return "일겜";
    case "quickplay":    return "Quickplay";
    case "cherry":       return "증강 칼바람";
    case "practice":     return "연습모드";
    case "unknown":      return "Unknown";
  }
}
