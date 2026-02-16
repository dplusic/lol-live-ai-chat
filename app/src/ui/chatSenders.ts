import { SERVICES } from './services';

type SendResult = { ok: boolean; reason?: string };

async function waitForReady(webview: HTMLWebViewElement, timeoutMs = 8000) {
  try {
    if (typeof (webview as any).isLoading === 'function' && !(webview as any).isLoading()) return;
  } catch {
    // ignore
  }
  await new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      webview.removeEventListener('dom-ready', finish as EventListener);
      webview.removeEventListener('did-finish-load', finish as EventListener);
      resolve();
    };
    webview.addEventListener('dom-ready', finish as EventListener);
    webview.addEventListener('did-finish-load', finish as EventListener);
    setTimeout(finish, timeoutMs);
  });
}

async function executeScript(webview: HTMLWebViewElement, script: string): Promise<SendResult> {
  const raw = await webview.executeJavaScript(script, true);
  return typeof raw === 'object' && raw !== null ? (raw as SendResult) : { ok: true };
}

export async function sendMessageToService(options: {
  serviceId: string;
  webview: HTMLWebViewElement | null;
  message: string;
}): Promise<SendResult> {
  const { serviceId, webview, message } = options;
  if (!webview) return { ok: false, reason: 'no-webview' };

  const service = SERVICES.find((s) => s.id === serviceId);
  if (!service) return { ok: false, reason: 'unsupported-service' };

  const script = service.buildScript(message);

  try {
    const result = await executeScript(webview, script);
    if (result.ok || result.reason !== 'no-input') return result;
  } catch {
    // first attempt failed, retry after page is ready
  }

  await waitForReady(webview);

  try {
    return await executeScript(webview, script);
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : 'execute-failed' };
  }
}
