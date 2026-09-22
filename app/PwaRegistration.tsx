'use client';

import { useEffect } from 'react';

export default function PwaRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;

    const manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    const manifestUrl = new URL(manifest?.href ?? '/site.webmanifest', window.location.origin);
    const workerUrl = new URL('sw.js', manifestUrl);
    const scopeUrl = new URL('./', manifestUrl);

    navigator.serviceWorker.register(workerUrl, {
      scope: scopeUrl.pathname,
      updateViaCache: 'none',
    }).catch((error: unknown) => {
      console.warn('FantasyStacks service worker registration failed.', error);
    });
  }, []);

  return null;
}
