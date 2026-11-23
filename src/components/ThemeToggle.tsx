'use client';

import { Sun, Moon } from 'lucide-react';
import { useLang } from '@/contexts/LanguageContext';
import { useTheme } from '@/contexts/ThemeContext';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { lang } = useLang();
  const toLight = theme === 'dark';
  const Icon = toLight ? Sun : Moon;
  const label = lang === 'en'
    ? (toLight ? 'Switch to light mode' : 'Switch to dark mode')
    : (toLight ? '切換至亮色模式' : '切換至深色模式');

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={label}
      className="flex size-11 shrink-0 items-center justify-center rounded-lg text-[var(--brand)] transition-colors hover:bg-[var(--brand-surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
    >
      <Icon className="size-5" aria-hidden="true" />
    </button>
  );
}
