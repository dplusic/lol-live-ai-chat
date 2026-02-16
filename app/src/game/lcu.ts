import { execFile } from 'node:child_process';
import * as https from 'node:https';
import { promisify } from 'node:util';
import { logInfo } from './logger';

const execFileAsync = promisify(execFile);
const httpsAgent = new https.Agent({ rejectUnauthorized: false });

export type LcuCreds = { port: number; token: string };

type UxProcess = { ProcessId: number; CommandLine?: string };

async function findLeagueClientUx(): Promise<UxProcess | null> {
  const ps = [
    "Get-CimInstance Win32_Process -Filter \"Name='LeagueClientUx.exe'\"",
    '| Select-Object ProcessId, CommandLine',
    '| ConvertTo-Json -Compress',
  ].join(' ');
  const { stdout } = await execFileAsync('powershell.exe', ['-NoProfile', '-Command', ps]);
  const trimmed = stdout.trim();
  if (!trimmed) return null;
  const data = JSON.parse(trimmed);
  return Array.isArray(data) ? data[0] ?? null : data ?? null;
}

function extractLcuCreds(cmdline?: string): LcuCreds | null {
  if (!cmdline) return null;
  const port = cmdline.match(/--app-port=(\d+)/)?.[1];
  const token = cmdline.match(/--remoting-auth-token=([^\s"]+)/)?.[1];
  if (!port || !token) return null;
  return { port: Number(port), token };
}

export async function getLcuCreds(): Promise<LcuCreds | null> {
  const proc = await findLeagueClientUx();
  return extractLcuCreds(proc?.CommandLine);
}

async function httpsGet(
  host: string,
  port: number,
  path: string,
  headers?: Record<string, string>
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      { hostname: host, port, path, method: 'GET', headers, agent: httpsAgent },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body: data }));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

export async function lcuGetJson<T>(
  creds: LcuCreds,
  path: string,
  opts?: { allow404?: boolean }
): Promise<T | null> {
  const auth = Buffer.from(`riot:${creds.token}`).toString('base64');
  const { status, body } = await httpsGet('127.0.0.1', creds.port, path, {
    Authorization: `Basic ${auth}`,
  });
  if (opts?.allow404 && status === 404) return null;
  if (status >= 400) throw new Error(`HTTP ${status}: ${body}`);
  if (!body.trim()) return null;
  return JSON.parse(body);
}

export async function lcuGetText(creds: LcuCreds, path: string): Promise<string> {
  const auth = Buffer.from(`riot:${creds.token}`).toString('base64');
  const { status, body } = await httpsGet('127.0.0.1', creds.port, path, {
    Authorization: `Basic ${auth}`,
  });
  if (status >= 400) throw new Error(`HTTP ${status}: ${body}`);
  return body.trim();
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function waitForLcu(shouldStop?: () => boolean): Promise<LcuCreds | null> {
  logInfo('Waiting for LeagueClientUx.exe...');
  while (true) {
    if (shouldStop?.()) return null;
    const creds = await getLcuCreds();
    if (creds) {
      logInfo('Found LeagueClientUx.exe credentials');
      return creds;
    }
    await delay(1000);
  }
}
