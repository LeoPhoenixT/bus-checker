'use client';
import { X } from 'lucide-react';
import clsx from 'clsx';
import { useLang } from '@/contexts/LanguageContext';
import { useBookmarks } from '@/contexts/BookmarkContext';

interface FavoriteSidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function FavoriteSidebar({ isOpen, onClose }: FavoriteSidebarProps) {
  const { lang } = useLang();
  const { favoriteRoutes, toggleBookmark } = useBookmarks();

  const routes = Array.from(favoriteRoutes).sort();

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Panel */}
      <div
        className={clsx(
          'fixed inset-y-0 right-0 z-50 w-72 flex flex-col bg-[var(--background)] border-l border-[var(--card-border)] shadow-2xl transition-transform duration-300',
          isOpen ? 'translate-x-0' : 'translate-x-full',
        )}
        role="dialog"
        aria-modal="true"
        aria-label={lang === 'en' ? 'My Favourites' : '我的最愛'}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-[var(--divider)]">
          <h2 className="text-base font-semibold text-[var(--foreground)]">
            {lang === 'en' ? `My Favourites (${routes.length})` : `我的最愛 (${routes.length})`}
          </h2>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--divider)] hover:text-[var(--foreground)] transition-colors"
            aria-label={lang === 'en' ? 'Close' : '關閉'}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Route list */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {routes.length === 0 ? (
            <p className="mt-8 text-center text-sm text-[var(--muted)]">
              {lang === 'en' ? 'No saved routes yet.' : '暫無存檔路線'}
            </p>
          ) : (
            <ul className="space-y-2">
              {routes.map((route) => (
                <li
                  key={route}
                  className="flex items-center justify-between rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] px-3 py-2.5"
                >
                  <span className="text-sm font-semibold text-[var(--foreground)]">{route}</span>
                  <button
                    onClick={() => toggleBookmark(route)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-red-500/15 hover:text-red-500 transition-colors"
                    aria-label={lang === 'en' ? `Remove route ${route}` : `移除路線 ${route}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}
