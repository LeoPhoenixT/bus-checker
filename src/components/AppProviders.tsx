'use client';

import type { ReactNode } from 'react';
import { BookmarkProvider } from '@/contexts/BookmarkContext';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <BookmarkProvider>{children}</BookmarkProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}
