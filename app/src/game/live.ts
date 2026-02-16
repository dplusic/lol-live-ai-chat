import * as https from 'node:https';

const httpsAgent = new https.Agent({ rejectUnauthorized: false });

export type LivePlayer = {
  summonerName?: string;
  items?: Array<{ itemID?: number }>;
  team?: string;
  level?: number;
  scores?: { kills?: number; deaths?: number; assists?: number; creepScore?: number };
  championName?: string;
  rawChampionName?: string;
  runes?: {
    keystone?: { displayName?: string };
    primaryRuneTree?: { displayName?: string };
    secondaryRuneTree?: { displayName?: string };
  };
  summonerSpells?: {
    summonerSpellOne?: { displayName?: string };
    summonerSpellTwo?: { displayName?: string };
  };
};

export type LiveAllGameData = {
  allPlayers?: LivePlayer[];
  activePlayer?: { summonerName?: string; team?: string };
  gameData?: { gameTime?: number };
};

export function getLiveAllGameData(): Promise<LiveAllGameData | null> {
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: '127.0.0.1',
        port: 2999,
        path: '/liveclientdata/allgamedata',
        method: 'GET',
        agent: httpsAgent,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(Buffer.from(c)));
        res.on('end', () => {
          if (res.statusCode && res.statusCode >= 400) return resolve(null);
          const data = Buffer.concat(chunks).toString('utf-8');
          if (!data.trim()) return resolve(null);
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve(null);
          }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.end();
  });
}
