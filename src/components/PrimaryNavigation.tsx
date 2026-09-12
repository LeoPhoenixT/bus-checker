'use client';

import Link from 'next/link';
import { Heart, MapPin, Search } from 'lucide-react';
import clsx from 'clsx';
import { usePathname } from 'next/navigation';
import { useLang } from '@/contexts/LanguageContext';

const links = [
  { href: '/', icon: MapPin, key: 'nearby' as const },
  { href: '/routes', icon: Search, key: 'routes' as const },
  { href: '/favourites', icon: Heart, key: 'favourites' as const },
];

export function PrimaryNavigation() {
  const pathname = usePathname();
  const { lang } = useLang();

  return (
    <>
      <nav className="hidden sm:flex items-center gap-1" aria-label={lang === 'en' ? 'Primary navigation' : '主要導覽'}>
        {links.map(({ href, icon: Icon, key }) => {
          const active = key === 'nearby' ? pathname === '/' : key === 'routes' ? pathname.startsWith('/routes') : pathname.startsWith('/favourites');
          const label = key === 'nearby' ? (lang === 'en' ? 'Nearby' : '附近') : key === 'routes' ? (lang === 'en' ? 'Routes' : '路線') : (lang === 'en' ? 'Favourites' : '收藏');
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors',
                active ? 'bg-white text-blue-700 shadow-sm' : 'text-blue-100 hover:bg-white/15 hover:text-white',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex h-16 border-t border-[var(--card-border)] bg-[var(--popover-bg)]/95 px-3 pb-[env(safe-area-inset-bottom)] shadow-[0_-10px_30px_rgba(0,0,0,0.12)] backdrop-blur sm:hidden"
        aria-label={lang === 'en' ? 'Primary navigation' : '主要導覽'}
      >
        {links.map(({ href, icon: Icon, key }) => {
          const active = key === 'nearby' ? pathname === '/' : key === 'routes' ? pathname.startsWith('/routes') : pathname.startsWith('/favourites');
          const label = key === 'nearby' ? (lang === 'en' ? 'Nearby' : '附近') : key === 'routes' ? (lang === 'en' ? 'Routes' : '路線') : (lang === 'en' ? 'Favourites' : '收藏');
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-colors',
                active ? 'text-blue-600 dark:text-blue-400' : 'text-[var(--muted)]',
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
