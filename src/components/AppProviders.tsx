'use client';

import type { ReactNode } from 'react';
import { FavouriteProvider } from '@/contexts/FavouriteContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { SearchStateProvider } from '@/contexts/SearchStateContext';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <SearchStateProvider><FavouriteProvider>{children}</FavouriteProvider></SearchStateProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
