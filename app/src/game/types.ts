export type GameflowSession = {
  gameClient?: {
    observerServerIp?: string;
    observerServerPort?: number;
    running?: boolean;
    serverIp?: string;
    serverPort?: number;
    visible?: boolean;
  };
  gameData?: {
    gameId?: number;
    gameName?: string;
    isCustomGame?: boolean;
    password?: string;
    playerChampionSelections?: Array<Record<string, unknown>>;
    queue?: GameflowQueue;
    spectatorsAllowed?: boolean;
    teamOne?: GameflowTeamMember[];
    teamTwo?: GameflowTeamMember[];
    localPlayer?: GameflowLocalPlayer;
  };
  gameDodge?: {
    dodgeIds?: number[];
    phase?: string;
    state?: string;
  };
  map?: {
    assets?: Record<string, unknown>;
    categorizedContentBundles?: Record<string, unknown>;
    description?: string;
    gameMode?: string;
    gameModeName?: string;
    gameModeShortName?: string;
    gameMutator?: string;
    id?: number;
    isRGM?: boolean;
    mapStringId?: string;
    name?: string;
    perPositionDisallowedSummonerSpells?: Record<string, { spells?: number[] }>;
    perPositionRequiredSummonerSpells?: Record<string, { spells?: number[] }>;
    platformId?: string;
    platformName?: string;
    properties?: Record<string, unknown>;
  };
  phase?: string;
  localPlayer?: GameflowLocalPlayer;
  myTeam?: GameflowTeamMember[];
  theirTeam?: GameflowTeamMember[];
};

export type GameflowLocalPlayer = {
  summonerId?: number;
  summonerName?: string;
  [key: string]: unknown;
};

export type GameflowTeamMember = {
  championId?: number;
  summonerId?: number;
  summonerName?: string;
  [key: string]: unknown;
};

export type GameflowQueue = {
  allowablePremadeSizes?: number[];
  areFreeChampionsAllowed?: boolean;
  assetMutator?: string;
  category?: string;
  championsRequiredToPlay?: number;
  description?: string;
  detailedDescription?: string;
  gameMode?: string;
  gameTypeConfig?: GameflowQueueGameTypeConfig;
  id?: number;
  isRanked?: boolean;
  isTeamBuilderManaged?: boolean;
  isTeamOnly?: boolean;
  lastToggledOffTime?: number;
  lastToggledOnTime?: number;
  mapId?: number;
  maxLevel?: number;
  maxSummonerLevelForFirstWinOfTheDay?: number;
  maximumParticipantListSize?: number;
  minLevel?: number;
  minimumParticipantListSize?: number;
  name?: string;
  numPlayersPerTeam?: number;
  queueAvailability?: string;
  queueRewards?: GameflowQueueRewards;
  removalFromGameAllowed?: boolean;
  removalFromGameDelayMinutes?: number;
  shortName?: string;
  showPositionSelector?: boolean;
  spectatorEnabled?: boolean;
  type?: string;
};

export type GameflowQueueGameTypeConfig = {
  advancedLearningQuests?: boolean;
  allowTrades?: boolean;
  banMode?: string;
  banTimerDuration?: number;
  battleBoost?: boolean;
  crossTeamChampionPool?: boolean;
  deathMatch?: boolean;
  doNotRemove?: boolean;
  duplicatePick?: boolean;
  exclusivePick?: boolean;
  id?: number;
  learningQuests?: boolean;
  mainPickTimerDuration?: number;
  maxAllowableBans?: number;
  name?: string;
  onboardCoopBeginner?: boolean;
  pickMode?: string;
  postPickTimerDuration?: number;
  reroll?: boolean;
  teamChampionPool?: boolean;
};

export type GameflowQueueRewards = {
  isChampionPointsEnabled?: boolean;
  isIpEnabled?: boolean;
  isXpEnabled?: boolean;
  partySizeIpRewards?: number[];
};
