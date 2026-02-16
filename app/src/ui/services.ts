import type { Service } from './types';

type ScriptBuilder = (message: string) => string;

export type ServiceConfig = Service & { buildScript: ScriptBuilder };

// ─── Script builders ──────────────────────────────────────────────────────────

const COMMON_INPUT_SELECTORS = [
  'textarea',
  'div[contenteditable="true"]',
  'input[type="text"]',
  'input[role="textbox"]',
];

const COMMON_SEND_SELECTORS = [
  'button[aria-label="Send message"]',
  'button[aria-label="Send"]',
  'button[type="submit"]',
];

function buildGenericScript(
  message: string,
  inputSelectors: string[],
  sendSelectors: string[]
): string {
  return `
(() => {
  const message = ${JSON.stringify(message)};
  const findFirst = (selectors) => {
    for (const s of selectors) { const el = document.querySelector(s); if (el) return el; }
    return null;
  };

  const input = findFirst(${JSON.stringify(inputSelectors)});
  if (!input) return { ok: false, reason: 'no-input' };

  if (input instanceof HTMLTextAreaElement || input instanceof HTMLInputElement) {
    input.value = message;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  } else if (input instanceof HTMLElement) {
    input.focus();
    input.textContent = message;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  const sendBtn = findFirst(${JSON.stringify(sendSelectors)});
  if (sendBtn instanceof HTMLElement) {
    sendBtn.click();
    return { ok: true, reason: 'clicked' };
  }

  const enterEvent = { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 };
  input.dispatchEvent(new KeyboardEvent('keydown', enterEvent));
  input.dispatchEvent(new KeyboardEvent('keyup', enterEvent));
  return { ok: true, reason: 'enter' };
})();
`;
}

// For ProseMirror-based editors (ChatGPT, Claude, etc.) — requires execCommand
// because React-controlled contenteditable ignores direct DOM mutation.
function buildProseMirrorScript(
  message: string,
  inputSelectors: string[],
  sendSelectors: string[]
): string {
  return `
(() => {
  const message = ${JSON.stringify(message)};
  const findFirst = (selectors) => {
    for (const s of selectors) { const el = document.querySelector(s); if (el) return el; }
    return null;
  };

  const input = findFirst(${JSON.stringify(inputSelectors)});
  if (!input) return Promise.resolve({ ok: false, reason: 'no-input' });

  input.focus();
  window.getSelection()?.selectAllChildren(input);
  document.execCommand('insertText', false, message);

  return new Promise((resolve) => {
    setTimeout(() => {
      const sendBtn = findFirst(${JSON.stringify(sendSelectors)});
      if (sendBtn instanceof HTMLElement && !sendBtn.hasAttribute('disabled')) {
        sendBtn.click();
        resolve({ ok: true, reason: 'clicked' });
      } else {
        input.dispatchEvent(new KeyboardEvent('keydown', {
          bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13,
        }));
        resolve({ ok: true, reason: 'enter' });
      }
    }, 200);
  });
})()
`;
}

// ─── Service definitions ───────────────────────────────────────────────────────
// To add a new service: add an entry here with metadata + buildScript.

export const SERVICES: ServiceConfig[] = [
  {
    id: 'gemini',
    label: 'Gemini',
    url: 'https://gemini.google.com',
    accent: '#4285F4',
    hint: 'Google Gemini',
    icon: '✦',
    buildScript: (message) => buildGenericScript(message, COMMON_INPUT_SELECTORS, COMMON_SEND_SELECTORS),
  },
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    url: 'https://chatgpt.com',
    accent: '#10A37F',
    hint: 'ChatGPT',
    icon: 'C',
    buildScript: (message) => buildProseMirrorScript(
      message,
      ['#prompt-textarea', 'div[contenteditable="true"]'],
      ['button[data-testid="send-button"]', 'button[aria-label="Send message"]']
    ),
  },
  {
    id: 'claude',
    label: 'Claude',
    url: 'https://claude.ai',
    accent: '#D97757',
    hint: 'Anthropic Claude',
    icon: 'A',
    buildScript: (message) => buildProseMirrorScript(
      message,
      ['div[contenteditable="true"].ProseMirror', 'div[contenteditable="true"]'],
      ['button[aria-label="Send message"]', 'button[type="submit"]']
    ),
  },
  {
    id: 'grok',
    label: 'Grok',
    url: 'https://grok.com',
    accent: '#8B5CF6',
    hint: 'xAI Grok',
    icon: 'G',
    buildScript: (message) => `
(() => {
  const message = ${JSON.stringify(message)};
  const input = document.querySelector('textarea');
  if (!input) return { ok: false, reason: 'no-input' };

  const nativeSet = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  nativeSet?.call(input, message);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));

  // 알려진 셀렉터 시도
  const knownSelectors = [
    'button[aria-label="Send message"]',
    'button[aria-label="Send"]',
    'button[data-testid="send-button"]',
    'button[type="submit"]',
  ];
  for (const sel of knownSelectors) {
    const btn = document.querySelector(sel);
    if (btn instanceof HTMLElement && !btn.hasAttribute('disabled')) {
      btn.click();
      return { ok: true, reason: 'clicked' };
    }
  }

  // 휴리스틱: textarea 주변 활성화된 버튼 중 마지막 것
  const container = input.closest('form') ?? input.parentElement?.parentElement ?? input.parentElement;
  const btns = Array.from(container?.querySelectorAll('button') ?? [])
    .filter(b => !b.hasAttribute('disabled') && b.offsetParent !== null);
  const sendBtn = btns[btns.length - 1];
  if (sendBtn instanceof HTMLElement) {
    sendBtn.click();
    return { ok: true, reason: 'heuristic' };
  }

  // 마지막 수단: Enter 키
  const enterEvent = { bubbles: true, cancelable: true, key: 'Enter', code: 'Enter', keyCode: 13, which: 13 };
  input.dispatchEvent(new KeyboardEvent('keydown', enterEvent));
  input.dispatchEvent(new KeyboardEvent('keypress', enterEvent));
  input.dispatchEvent(new KeyboardEvent('keyup', enterEvent));
  return { ok: true, reason: 'enter' };
})();
`,
  },
  {
    id: 'perplexity',
    label: 'Perplexity',
    url: 'https://www.perplexity.ai',
    accent: '#20A5A5',
    hint: 'Perplexity AI',
    icon: 'P',
    buildScript: (message) => buildGenericScript(
      message,
      ['textarea[placeholder]', 'textarea', 'div[contenteditable="true"]'],
      ['button[aria-label="Submit"]', 'button[type="submit"]']
    ),
  },
  {
    id: 'copilot',
    label: 'Copilot',
    url: 'https://copilot.microsoft.com',
    accent: '#0078D4',
    hint: 'Microsoft Copilot',
    icon: 'M',
    buildScript: (message) => buildGenericScript(
      message,
      ['div[contenteditable="true"]', 'textarea', 'input[type="text"]'],
      ['button[aria-label="Submit"]', 'button[type="submit"]']
    ),
  },
];
