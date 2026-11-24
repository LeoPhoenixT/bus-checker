'use client';

import Link from 'next/link';
import { Heart, MapPin, Search } from 'lucide-react';
import clsx from 'clsx';
import { usePathname } from 'next/navigation';
import { useLang } from '@/contexts/LanguageContext';
import { useSearchState } from '@/contexts/SearchStateContext';
import { routeSearchHref } from '@/lib/routeSearch';

const links = [
  { href: '/', icon: MapPin, key: 'nearby' as const },
  { href: '/routes', icon: Search, key: 'routes' as const },
  { href: '/favourites', icon: Heart, key: 'favourites' as const },
];

export function PrimaryNavigation() {
  const pathname = usePathname();
  const { lang } = useLang();
  const { routeSearch } = useSearchState();
  const routesHref = routeSearchHref(routeSearch.query, routeSearch.filter);

  return (
    <>
      <nav className="hidden sm:flex items-center gap-1" aria-label={lang === 'en' ? 'Primary navigation' : '主要導覽'}>
        {links.map(({ href, icon: Icon, key }) => {
          const active = key === 'nearby' ? pathname === '/' : key === 'routes' ? pathname.startsWith('/routes') : pathname.startsWith('/favourites');
          const label = key === 'nearby' ? (lang === 'en' ? 'Nearby' : '附近') : key === 'routes' ? (lang === 'en' ? 'Routes' : '路線') : (lang === 'en' ? 'Favourites' : '收藏');
          return (
            <Link
              key={href}
              href={key === 'routes' ? routesHref : href}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]',
                active ? 'bg-[var(--brand-surface)] text-[var(--brand)]' : 'text-[var(--muted)] hover:bg-[var(--brand-surface)] hover:text-[var(--brand)]',
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
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
              href={key === 'routes' ? routesHref : href}
              aria-current={active ? 'page' : undefined}
              className={clsx(
                'flex flex-1 flex-col items-center justify-center gap-0.5 text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--brand)]',
                active ? 'text-[var(--brand)]' : 'text-[var(--muted)]',
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
