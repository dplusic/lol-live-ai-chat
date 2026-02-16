import { app, BrowserWindow, ipcMain, screen, session, Menu, Session } from 'electron';
import { startGameLoop, stopGameLoop, sendGameCommand } from './game';
import { setEventSink } from './game/events';
import type { NativeMessage } from './game/events';
import * as fs from 'fs';
import * as path from 'path';

declare const MAIN_WINDOW_WEBPACK_ENTRY: string;
declare const MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY: string;

if (require('electron-squirrel-startup')) app.quit();

// Patch Sec-Ch-Ua headers so Google doesn't detect Electron and block OAuth login.
// Electron appends "Electron";v="..." to Sec-Ch-Ua, which Google's identity service
// treats as an unsafe embedded browser. We replace it with a plain Chrome value.
const CHROME_UA_HINT = '"Chromium";v="136", "Google Chrome";v="136", "Not-A.Brand";v="99"';

function patchSessionHeaders(sess: Session) {
  sess.webRequest.onBeforeSendHeaders((details, callback) => {
    const headers = { ...details.requestHeaders };
    if (headers['Sec-Ch-Ua']) headers['Sec-Ch-Ua'] = CHROME_UA_HINT;
    if (headers['Sec-Ch-Ua-Full-Version-List']) {
      headers['Sec-Ch-Ua-Full-Version-List'] =
        '"Chromium";v="136.0.0.0", "Google Chrome";v="136.0.0.0", "Not-A.Brand";v="99.0.0.0"';
    }
    callback({ requestHeaders: headers });
  });
}

app.on('session-created', patchSessionHeaders);

// Window state persistence

const statePath = path.join(app.getPath('userData'), 'window-state.json');
type WindowBounds = { x?: number; y?: number; width: number; height: number };

function sanitizeBounds(bounds: WindowBounds): WindowBounds {
  if (bounds.x == null || bounds.y == null) return bounds;
  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const onScreen = screen.getAllDisplays().some(({ bounds: b }) =>
    cx >= b.x && cx < b.x + b.width && cy >= b.y && cy < b.y + b.height
  );
  if (!onScreen) {
    const { x: _x, y: _y, ...rest } = bounds;
    return rest;
  }
  return bounds;
}

function loadWindowState(): { bounds: WindowBounds } {
  try {
    const raw = JSON.parse(fs.readFileSync(statePath, 'utf8'));
    return { bounds: sanitizeBounds(raw.bounds ?? raw) };
  } catch {
    return { bounds: { width: 1400, height: 900 } };
  }
}

function saveWindowState() {
  if (!mainWindow || mainWindow.isDestroyed() || mainWindow.isMinimized()) return;
  try {
    fs.writeFileSync(statePath, JSON.stringify({ bounds: mainWindow.getBounds() }));
  } catch (e) {
    console.error('Failed to save window state', e);
  }
}

// Window management

let mainWindow: BrowserWindow | null = null;
const pendingEvents: NativeMessage[] = [];

function flushPendingEvents() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  while (pendingEvents.length) {
    const event = pendingEvents.shift();
    if (event) mainWindow.webContents.send('game:event', event);
  }
}

function createWindow() {
  const { bounds } = loadWindowState();
  mainWindow = new BrowserWindow({
    ...bounds,
    minHeight: 720,
    minWidth: 980,
    backgroundColor: '#f4f1ec',
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      contextIsolation: true,
      nodeIntegration: false,
      webviewTag: true,
    },
  });

  const menuTemplate = [
    {
      label: '메뉴',
      submenu: [
        {
          label: '가이드 메시지 수정',
          click: () => {
            mainWindow?.webContents.send('game:event', { type: 'menu:editGuide' });
          },
        },
        {
          label: '웹 데이터 초기화',
          click: () => {
            mainWindow?.webContents.send('game:event', { type: 'menu:clearCache' });
          },
        },
      ],
    },
    ...(!app.isPackaged ? [
      {
        label: 'DEV',
        submenu: [
          {
            label: '개발자 도구',
            accelerator: 'F12',
            click: () => { mainWindow?.webContents.toggleDevTools(); },
          },
        ],
      },
    ] : []),
  ];
  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);

  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  mainWindow.webContents.on('did-finish-load', flushPendingEvents);

  let saveTimeout: NodeJS.Timeout | null = null;
  const debouncedSave = () => {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(saveWindowState, 500);
  };

  mainWindow.on('resize', debouncedSave);
  mainWindow.on('move', debouncedSave);
  mainWindow.on('close', saveWindowState);
  mainWindow.on('closed', () => { mainWindow = null; });
}

// IPC / event routing

setEventSink((event) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('game:event', event);
  } else {
    pendingEvents.push(event);
  }
});

// Open a real BrowserWindow (not webview) for Google OAuth so Google doesn't block it.
// The BrowserWindow uses the same session partition as the webview so cookies are shared.
ipcMain.on('open-auth-window', (_event, { url, partition }: { url: string; partition: string }) => {
  const authWindow = new BrowserWindow({
    width: 520,
    height: 660,
    title: 'Google 로그인',
    webPreferences: {
      partition,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  authWindow.loadURL(url);

  let closed = false;
  authWindow.webContents.on('did-navigate', (_e, navUrl) => {
    if (closed) return;
    if (!navUrl.startsWith('https://accounts.google.com')) {
      closed = true;
      mainWindow?.webContents.send('game:event', { type: 'authComplete' });
      authWindow.close();
    }
  });
});

ipcMain.on('game:command', async (_event, message) => {
  if (message && typeof message.type === 'string') {
    if (message.type === 'clearStorage' && Array.isArray(message.partitions)) {
      try {
        await Promise.all(message.partitions.map(async (partition: string) => {
          if (typeof partition === 'string') {
             await session.fromPartition(partition).clearStorageData();
             console.log(`Cleared storage for partition: ${partition}`);
          }
        }));
      } catch (err) {
        console.error('Failed to clear storage:', err);
      }
    } else {
      sendGameCommand(message);
    }
  }
});

// App lifecycle

app.on('ready', () => {
  patchSessionHeaders(session.defaultSession);
  createWindow();
  startGameLoop().catch((err) => {
    const message = err instanceof Error ? err.message : String(err);
    mainWindow?.webContents.send('game:event', {
      type: 'fatalError',
      data: { message },
      ts: new Date().toISOString(),
    });
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    stopGameLoop();
    app.quit();
  }
});

app.on('before-quit', () => stopGameLoop());

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
