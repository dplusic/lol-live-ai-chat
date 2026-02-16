import React, { useEffect, useMemo, useRef, useState } from 'react';
import { CenterPane } from './CenterPane';
import { RightPane } from './RightPane';
import { buildGameStartMessage, buildInitMessage, DEFAULT_INIT_TEMPLATE } from './chatMessages';
import { sendMessageToService } from './chatSenders';
import { SERVICES } from './services';
import type { Service } from './types';

const ACTIVE_PHASES = new Set(['ChampSelect', 'GameStart', 'InProgress']);

function useWebviewNavigation(
  webviewRef: React.RefObject<HTMLWebViewElement | null>,
  activeServiceId: string
): Record<string, string> {
  const [lastUrls, setLastUrls] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('lastUrls') ?? '{}');
    } catch {
      return {};
    }
  });

  useEffect(() => {
    const webview = webviewRef.current;
    if (!webview) return;

    const handleNavigate = (e: Event & { url?: string }) => {
      const url = e.url;
      if (url && url.startsWith('http')) {
        setLastUrls((prev) => {
          const next = { ...prev, [activeServiceId]: url };
          localStorage.setItem('lastUrls', JSON.stringify(next));
          return next;
        });
      }
    };

    // Intercept Google auth navigation: open in a real BrowserWindow instead of webview
    // so Google doesn't block sign-in. The BrowserWindow shares the same partition,
    // so cookies are available to the webview after login.
    const handleWillNavigate = (e: Event & { url?: string }) => {
      const url = e.url;
      if (url && url.startsWith('https://accounts.google.com')) {
        e.preventDefault();
        window.lolApi?.openAuthWindow(url, 'persist:shared');
      }
    };

    webview.addEventListener('did-navigate', handleNavigate);
    webview.addEventListener('did-navigate-in-page', handleNavigate);
    webview.addEventListener('will-navigate', handleWillNavigate);
    return () => {
      webview.removeEventListener('did-navigate', handleNavigate);
      webview.removeEventListener('did-navigate-in-page', handleNavigate);
      webview.removeEventListener('will-navigate', handleWillNavigate);
    };
  }, [activeServiceId]);

  return lastUrls;
}

function useGameEvents(opts: {
  webviewRef: React.RefObject<HTMLWebViewElement | null>;
  activeServiceRef: React.RefObject<Service | null>;
  autoSendEnabled: boolean;
  setAutoSendEnabled: (v: boolean) => void;
  setDdragonVersion: (v: string) => void;
}) {
  const { webviewRef, activeServiceRef, autoSendEnabled, setAutoSendEnabled, setDdragonVersion } = opts;
  const autoSendEnabledRef = useRef(autoSendEnabled);
  const lastGameStartKeyRef = useRef('');

  useEffect(() => {
    autoSendEnabledRef.current = autoSendEnabled;
  }, [autoSendEnabled]);

  useEffect(() => {
    if (!window.lolApi?.onEvent) return;
    const unsubscribe = window.lolApi.onEvent((event) => {
      if (event.type === 'autoSend') {
        setAutoSendEnabled(Boolean(event.data?.enabled));
      }

      if (event.type === 'ddragonVersion') {
        const version = String(event.data?.version ?? '');
        if (version) {
          localStorage.setItem('ddragonVersion', version);
          setDdragonVersion(version);
        }
      }

      if (event.type === 'phaseChanged') {
        const phase = String(event.data?.phase ?? '');
        if (phase && !ACTIVE_PHASES.has(phase)) {
          lastGameStartKeyRef.current = '';
        }
      }

      if (event.type === 'loadingTeams') {
        const isManual = event.data?.manual === true;
        if (!autoSendEnabledRef.current && !isManual) return;

        const myTeam = String(event.data?.myTeam ?? '-');
        const enemyTeam = String(event.data?.enemyTeam ?? event.data?.theirTeam ?? '-');
        const mode = String(event.data?.modeLabel ?? 'Unknown');
        const hasTeams = myTeam.trim().length > 0 || enemyTeam.trim().length > 0;
        const gameId = typeof event.data?.gameId === 'number' ? String(event.data?.gameId) : '';
        const key = gameId || [mode, myTeam, enemyTeam].join('|');

        if (hasTeams && key !== lastGameStartKeyRef.current) {
          lastGameStartKeyRef.current = key;
          const service = activeServiceRef.current ?? SERVICES[0];
          const teamDetails = typeof event.data?.teamDetails === 'string' ? event.data.teamDetails : undefined;
          const message = buildGameStartMessage({ mode, myTeam, enemyTeam, teamDetails });
          void sendMessageToService({ serviceId: service.id, webview: webviewRef.current, message });
        }
      }

      if (event.type === 'sendChatMessage') {
        const message = event.data?.message;
        if (typeof message === 'string' && message.length > 0) {
          const service = activeServiceRef.current ?? SERVICES[0];
          void sendMessageToService({ serviceId: service.id, webview: webviewRef.current, message });
        }
      }
    });
    return () => unsubscribe?.();
  }, []);
}

export function App() {
  const [activeServiceId, setActiveServiceId] = useState(
    () => localStorage.getItem('activeServiceId') ?? SERVICES[0]?.id ?? 'gemini'
  );
  const [autoSendEnabled, setAutoSendEnabled] = useState(
    () => localStorage.getItem('autoSendEnabled') === 'true'
  );
  const [ddragonVersion, setDdragonVersion] = useState(
    () => localStorage.getItem('ddragonVersion') ?? ''
  );
  const [initTemplate, setInitTemplate] = useState(
    () => localStorage.getItem('initTemplate') ?? DEFAULT_INIT_TEMPLATE
  );
  const [showGuideModal, setShowGuideModal] = useState(false);

  const webviewRef = useRef<HTMLWebViewElement | null>(null);
  const activeServiceRef = useRef<Service | null>(null);

  const activeService = useMemo(
    () => SERVICES.find((s) => s.id === activeServiceId) ?? SERVICES[0],
    [activeServiceId]
  );

  useEffect(() => { localStorage.setItem('activeServiceId', activeServiceId); }, [activeServiceId]);
  useEffect(() => { activeServiceRef.current = activeService ?? null; }, [activeService]);
  useEffect(() => {
    window.lolApi?.sendCommand?.({ type: 'toggleAutoSend', enabled: autoSendEnabled });
  }, []);

  const lastUrls = useWebviewNavigation(webviewRef, activeServiceId);
  useGameEvents({ webviewRef, activeServiceRef, autoSendEnabled, setAutoSendEnabled, setDdragonVersion });

  const handleDoubleClickService = (id: string) => {
    const service = SERVICES.find((s) => s.id === id);
    if (service) void webviewRef.current?.loadURL(service.url);
  };

  const handleToggleAutoSend = () => {
    const next = !autoSendEnabled;
    setAutoSendEnabled(next);
    localStorage.setItem('autoSendEnabled', String(next));
    window.lolApi?.sendCommand?.({ type: 'toggleAutoSend', enabled: next });
  };

  const handleInitTemplateChange = (template: string) => {
    setInitTemplate(template);
    localStorage.setItem('initTemplate', template);
  };

  const handleResetChat = () => {
    const service = activeService ?? SERVICES[0];
    const message = buildInitMessage(initTemplate, ddragonVersion);
    void sendMessageToService({ serviceId: service.id, webview: webviewRef.current, message });
    window.lolApi?.sendCommand?.({ type: 'resetChat' });
  };

  useEffect(() => {
    if (!window.lolApi?.onEvent) return;
    const unsubscribe = window.lolApi.onEvent((event) => {
      if (event.type === 'menu:editGuide') {
        setShowGuideModal(true);
      }

      if (event.type === 'authComplete') {
        const url = activeServiceRef.current?.url;
        if (url) setTimeout(() => { const wv = webviewRef.current; if (wv) wv.loadURL(url).catch(() => {}); }, 500);
      }

      if (event.type === 'menu:clearCache') {
        const partitions = ['persist:shared'];
        // Also include default partition if needed, but services use persist:id
        window.lolApi?.sendCommand?.({ type: 'clearStorage', partitions });
        if (webviewRef.current) {
          webviewRef.current.reload();
        }
      }
    });
    return () => unsubscribe?.();
  }, []);

  return (
    <div className="app-shell">
      <CenterPane
        service={activeService}
        webviewRef={webviewRef}
        initialUrl={lastUrls[activeServiceId]}
      />
      <RightPane
        autoSendEnabled={autoSendEnabled}
        onToggleAutoSend={handleToggleAutoSend}
        onInputGuide={handleResetChat}
        onSendIngameUpdate={() => window.lolApi?.sendCommand?.({ type: 'sendIngameUpdate' })}
        onRecommendChamp={() => window.lolApi?.sendCommand?.({ type: 'recommendChamp' })}
        onManualGameStart={() => window.lolApi?.sendCommand?.({ type: 'manualGameStart' })}
        services={SERVICES}
        activeServiceId={activeService?.id ?? ''}
        onSelectService={setActiveServiceId}
        onDoubleClickService={handleDoubleClickService}
      />
      {showGuideModal && (
        <div className="modal-overlay" onClick={() => setShowGuideModal(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <span className="modal-title">가이드 메시지 수정</span>
              <button className="modal-close" onClick={() => setShowGuideModal(false)}>✕</button>
            </div>
            <textarea
              className="modal-textarea"
              value={initTemplate}
              onChange={(e) => handleInitTemplateChange(e.target.value)}
              autoFocus
            />
            <div className="modal-footer">
              <span className="modal-hint">변수: <code>{'{version}'}</code>{ddragonVersion ? ` → ${ddragonVersion}` : ''}</span>
              <button className="modal-reset" onClick={() => handleInitTemplateChange(DEFAULT_INIT_TEMPLATE)}>기본값 복원</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
