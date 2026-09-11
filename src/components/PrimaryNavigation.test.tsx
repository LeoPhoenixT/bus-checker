import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { PrimaryNavigation } from './PrimaryNavigation';

let pathname = '/';

vi.mock('next/navigation', () => ({ usePathname: () => pathname }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentProps<'a'>) => <a href={href} {...props}>{children}</a>,
}));

afterEach(() => cleanup());

describe('PrimaryNavigation', () => {
  it('marks Nearby active on the home page and Routes active throughout route detail', () => {
    const { rerender } = render(<LanguageProvider><PrimaryNavigation /></LanguageProvider>);
    const nearbyLinks = screen.getAllByRole('link', { name: '附近' });
    expect(nearbyLinks).toHaveLength(2);
    expect(nearbyLinks.every((link) => link.getAttribute('aria-current') === 'page')).toBe(true);
    expect(screen.getAllByRole('navigation').some((nav) => nav.className.includes('sm:hidden'))).toBe(true);
    expect(screen.getAllByRole('navigation').some((nav) => nav.className.includes('hidden sm:flex'))).toBe(true);

    pathname = '/routes/87D';
    rerender(<LanguageProvider><PrimaryNavigation /></LanguageProvider>);
    const routeLinks = screen.getAllByRole('link', { name: '路線' });
    expect(routeLinks).toHaveLength(2);
    expect(routeLinks.every((link) => link.getAttribute('aria-current') === 'page')).toBe(true);
    expect(screen.getAllByRole('link', { name: '附近' }).every((link) => link.getAttribute('aria-current') === null)).toBe(true);
  });
});
