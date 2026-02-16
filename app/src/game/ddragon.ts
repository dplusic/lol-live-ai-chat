import * as https from 'https';
import { toChampionMap } from './format';
import { emitEvent } from './events';
import { logInfo } from './logger';
import type { State } from './state';

const TIMEOUT_MS = 10_000;

function fetchJson<T>(url: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = https
      .get(url, (res) => {
        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          return reject(new Error(`HTTP ${res.statusCode}: ${url}`));
        }
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => {
          try {
            resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8')));
          } catch (e) {
            reject(e);
          }
        });
      })
      .on('error', reject);
    req.setTimeout(TIMEOUT_MS, () => req.destroy(new Error(`DDragon timed out: ${url}`)));
  });
}

export async function loadDDragonData(state: State) {
  try {
    const versions = await fetchJson<string[]>(
      'https://ddragon.leagueoflegends.com/api/versions.json'
    );
    const latest = versions[0];
    logInfo('DDragon latest version', latest);

    const [champData, itemData] = await Promise.all([
      fetchJson<{ data: Record<string, { id: string; name: string; key: string }> }>(
        `https://ddragon.leagueoflegends.com/cdn/${latest}/data/ko_KR/champion.json`
      ),
      fetchJson<{ data: Record<string, { name: string }> }>(
        `https://ddragon.leagueoflegends.com/cdn/${latest}/data/ko_KR/item.json`
      ),
    ]);

    const champList = Object.values(champData.data).flatMap((c) => [
      { id: parseInt(c.key, 10), name: c.name },
      { id: c.id, name: c.name },
    ]);
    state.championMap = toChampionMap(champList);
    logInfo(`Loaded ${state.championMap.size} champions from DDragon`);

    const itemMap = new Map<number, { name: string }>();
    for (const [id, item] of Object.entries(itemData.data)) {
      itemMap.set(parseInt(id, 10), { name: item.name });
    }
    state.itemMap = itemMap;
    logInfo(`Loaded ${state.itemMap.size} items from DDragon`);

    emitEvent('ddragonVersion', { version: latest });
  } catch (e) {
    logInfo('Failed to load DDragon data', e);
  }
}
