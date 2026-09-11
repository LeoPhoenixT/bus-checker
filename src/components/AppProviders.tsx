'use client';

import type { ReactNode } from 'react';
import { FavouriteProvider } from '@/contexts/FavouriteContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <FavouriteProvider>{children}</FavouriteProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
