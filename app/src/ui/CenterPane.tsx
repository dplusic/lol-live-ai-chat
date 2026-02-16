import React from 'react';
import type { Service } from './types';

type CenterPaneProps = {
  service?: Service;
  webviewRef: React.RefObject<HTMLWebViewElement | null>;
  initialUrl?: string;
};

export function CenterPane({ service, webviewRef, initialUrl }: CenterPaneProps) {
  const lastServiceIdRef = React.useRef(service?.id);
  const initialSrcRef = React.useRef(initialUrl ?? service?.url);

  if (service?.id !== lastServiceIdRef.current) {
    lastServiceIdRef.current = service?.id;
    initialSrcRef.current = initialUrl ?? service?.url;
  }

  return (
    <main className="center-pane">
      <webview
        key={service?.id}
        className="webview"
        src={initialSrcRef.current}
        partition="persist:shared"
        allowpopups={true}
        ref={webviewRef}
        useragent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36"
      />
    </main>
  );
}
