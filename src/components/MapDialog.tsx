'use client';

import { useLayoutEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';

const FOCUSABLE = 'a[href], button, input, select, textarea, summary, [tabindex]';

export function MapDialog({ label, onClose, children }: {
  label: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const opener = document.activeElement;
    const initialFocus = panel.querySelector<HTMLElement>('[data-dialog-initial-focus]') ?? panel;
    initialFocus.focus({ preventScroll: true });

    const keepFocusInside = (event: FocusEvent) => {
      if (event.target instanceof Node && !panel.contains(event.target)) {
        initialFocus.focus({ preventScroll: true });
      }
    };
    document.addEventListener('focusin', keepFocusInside);

    return () => {
      document.removeEventListener('focusin', keepFocusInside);
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus({ preventScroll: true });
    };
  }, []);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;

    const panel = event.currentTarget;
    const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((element) => (
      element.tabIndex >= 0 && !element.matches(':disabled') && !element.closest('[hidden], [inert]')
        && (element.checkVisibility?.({ visibilityProperty: true }) ?? true)
    ));
    const first = focusable.at(0);
    const last = focusable.at(-1);
    const active = document.activeElement;
    const atBoundary = event.shiftKey ? active === first : active === last;
    if (atBoundary || active === panel) {
      event.preventDefault();
      (event.shiftKey ? last ?? panel : first ?? panel).focus();
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center">
      <div aria-hidden="true" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onKeyDownCapture={handleKeyDown}
        className="relative z-10 w-full max-w-lg max-h-full overflow-y-auto rounded-2xl border border-[var(--card-border)] bg-[var(--card-bg)] shadow-2xl"
      >
        {children}
      </div>
    </div>
  );
}
