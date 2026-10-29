import type { ReactNode } from 'react';
import { LanguageToggle } from './LanguageToggle';
import { PrimaryNavigation } from './PrimaryNavigation';
import { ThemeToggle } from './ThemeToggle';

export function PageHeader({ children, controls }: { children: ReactNode; controls?: ReactNode }) {
  return (
    <header className="border-b border-white/10 bg-gradient-to-r from-blue-700 via-blue-600 to-blue-700 shadow-xl">
      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-4">
        <div className="flex items-center justify-between gap-4">
          {children}
          <div className="flex shrink-0 items-center gap-2"><LanguageToggle /><ThemeToggle /></div>
        </div>
        {controls}
        <PrimaryNavigation />
      </div>
    </header>
  );
}
