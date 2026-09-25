'use client';

import { useEffect, useState } from 'react';
import { getKmbServiceDay } from '@/lib/kmbServiceDay';

export function useKmbServiceDay(): string {
  const [serviceDay, setServiceDay] = useState(() => getKmbServiceDay(new Date()));
  useEffect(() => {
    const check = () => setServiceDay(getKmbServiceDay(new Date()));
    const timer = window.setInterval(check, 30_000);
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
  }, []);
  return serviceDay;
}
