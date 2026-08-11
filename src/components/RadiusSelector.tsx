'use client';

import { Locate } from 'lucide-react';
import { RADIUS_PRESETS } from '@/config';
import clsx from 'clsx';

interface RadiusSelectorProps {
  radius: number;
  onChangeRadius: (radius: number) => void;
}

export function RadiusSelector({ radius, onChangeRadius }: RadiusSelectorProps) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative">
        <Locate className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/70" />
        <select
          value={radius}
          onChange={(e) => onChangeRadius(parseInt(e.target.value, 10))}
          className={clsx(
            'pl-9 pr-3 py-2 rounded-xl border text-sm font-medium',
            'bg-white/10 border-white/20 text-white',
            'hover:bg-white/15 hover:border-white/30',
            'focus:outline-none focus:ring-2 focus:ring-white/40 focus:border-white/30',
            'transition duration-150',
            'appearance-none cursor-pointer',
          )}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='white' d='M6 9L1 4h10z'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 0.5rem center',
            paddingRight: '1.75rem',
          }}
        >
          {RADIUS_PRESETS.map((preset) => (
            <option key={preset} value={preset} className="bg-gray-900 text-white">
              {preset >= 1000 ? `${preset / 1000}km` : `${preset}m`}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
