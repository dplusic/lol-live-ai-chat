// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('lolApi', {
  onEvent: (handler: (event: any) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, payload: any) => handler(payload);
    ipcRenderer.on('game:event', listener);
    return () => ipcRenderer.removeListener('game:event', listener);
  },
  sendCommand: (message: { type: string; [key: string]: unknown }) => {
    ipcRenderer.send('game:command', message);
  },
  openAuthWindow: (url: string, partition: string) => {
    ipcRenderer.send('open-auth-window', { url, partition });
  },
});
