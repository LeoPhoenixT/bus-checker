'use client';
import { useLang } from '@/contexts/LanguageContext';

export function LanguageToggle() {
  const { lang, toggleLang } = useLang();
  return (
    <button
      type="button"
      onClick={toggleLang}
      aria-label={`Switch to ${lang === 'en' ? 'Traditional Chinese' : 'English'}`}
      className="flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold transition-colors hover:bg-[var(--brand-surface)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand)]"
    >
      <span className={lang === 'en' ? 'text-[var(--brand)]' : 'text-[var(--muted)]'}>EN</span>
      <span className="mx-0.5 text-[var(--muted)]">|</span>
      <span className={lang === 'tc' ? 'text-[var(--brand)]' : 'text-[var(--muted)]'}>中</span>
    </button>
  );
}
