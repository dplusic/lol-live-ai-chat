export type Service = {
  id: string;
  label: string;
  url: string;
  accent: string;
  hint: string;
  icon: string;
};

export type GameViewState = {
  phase: string;
  mode: string;
  lcuStatus: 'disconnected' | 'connected';
  myTeam: string;
  enemyTeam: string;
  pickable: string;
  items: string;
  kda: string;
  lastEvent: string;
  lastMessage: string;
};

declare global {
  interface HTMLWebViewElement extends HTMLElement {
    executeJavaScript: (code: string, userGesture?: boolean) => Promise<unknown>;
    loadURL: (url: string) => Promise<void>;
    reload: () => void;
    isLoading?: () => boolean;
  }

  interface Window {
    lolApi?: {
      onEvent: (handler: (event: { type: string; data?: Record<string, unknown>; text?: string; ts: string }) => void) => () => void;
      sendCommand: (message: { type: string; [key: string]: unknown }) => void;
      openAuthWindow: (url: string, partition: string) => void;
    };
  }
}

