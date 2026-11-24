import type { ReactNode } from 'react';
import { LanguageToggle } from './LanguageToggle';
import { PrimaryNavigation } from './PrimaryNavigation';
import { ThemeToggle } from './ThemeToggle';

export function PageHeader({ children }: { children: ReactNode }) {
  return (
    <header className="border-t-3 border-t-[var(--brand)] border-b border-b-[var(--card-border)] bg-[var(--card-bg)]">
      <div className="mx-auto flex max-w-6xl items-center gap-x-3 px-4 py-2 sm:gap-x-5 sm:px-6">
        {children}
        <PrimaryNavigation />
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
