'use client';
import { useLang } from '@/contexts/LanguageContext';

export function LanguageToggle() {
  const { lang, toggleLang } = useLang();
  return (
    <button
      onClick={toggleLang}
      aria-label={`Switch to ${lang === 'en' ? 'Traditional Chinese' : 'English'}`}
      className="flex items-center gap-1 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-sm font-semibold backdrop-blur-sm transition hover:bg-white/20 active:scale-95"
    >
      <span className={lang === 'en' ? 'text-white' : 'text-white/40'}>EN</span>
      <span className="mx-0.5 text-white/30">|</span>
      <span className={lang === 'tc' ? 'text-white' : 'text-white/40'}>中</span>
    </button>
  );
}
