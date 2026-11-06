import { useSyncExternalStore } from 'react';
import { vi } from 'vitest';

const navigationEvent = 'test:navigation';

function subscribe(listener: () => void) {
  window.addEventListener(navigationEvent, listener);
  window.addEventListener('popstate', listener);
  return () => {
    window.removeEventListener(navigationEvent, listener);
    window.removeEventListener('popstate', listener);
  };
}

// Model Next's native History API integration: push/replace notify URL hooks,
// but do not emit popstate or refresh cached Server Component props.
export function installNavigationHistory() {
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = window.history[method].bind(window.history);
    vi.spyOn(window.history, method).mockImplementation((...args) => {
      original(...args);
      window.dispatchEvent(new Event(navigationEvent));
    });
  }
}

export function useTestSearchParams() {
  const search = useSyncExternalStore(subscribe, () => window.location.search);
  return new URLSearchParams(search);
}
