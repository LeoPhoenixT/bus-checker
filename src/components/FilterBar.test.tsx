import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { FilterBar } from './FilterBar';
import { LanguageToggle } from './LanguageToggle';

afterEach(cleanup);

function renderFilterBar(active: boolean, toggle = vi.fn()) {
  render(
    <LanguageProvider>
      <LanguageToggle />
      <FilterBar
        filters={[]}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        onClear={vi.fn()}
        destinationActive={false}
        destinationLabel={null}
        destinationDistanceM={null}
        onOpenDestinationModal={vi.fn()}
        onClearDestination={vi.fn()}
        favouritesOnly={active}
        onToggleFavouritesOnly={toggle}
      />
    </LanguageProvider>,
  );
  return toggle;
}

describe('FilterBar favourite route filter', () => {
  it('renders the inactive accessible toggle in both languages and handles clicks', () => {
    const toggle = renderFilterBar(false);
    const button = screen.getByRole('button', { name: /☆\s*只顯示收藏路線/ });
    expect(button.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(button);
    expect(toggle).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', { name: 'Switch to English' }));
    expect(screen.getByRole('button', { name: /☆\s*Favourite routes only/ })).toBeDefined();
  });

  it('renders the active state', () => {
    renderFilterBar(true);
    expect(screen.getByRole('button', { name: /★\s*只顯示收藏路線/ }).getAttribute('aria-pressed')).toBe('true');
  });

  it('shows a named destination alongside its distance', () => {
    render(
      <LanguageProvider>
        <FilterBar
          filters={[]}
          onAdd={vi.fn()}
          onRemove={vi.fn()}
          onClear={vi.fn()}
          destinationActive
          destinationLabel="中環巴士總站"
          destinationDistanceM={885}
          onOpenDestinationModal={vi.fn()}
          onClearDestination={vi.fn()}
          favouritesOnly={false}
          onToggleFavouritesOnly={vi.fn()}
        />
      </LanguageProvider>,
    );

    expect(screen.getByText('中環巴士總站')).toBeDefined();
    expect(screen.getByText('885 m 外')).toBeDefined();
  });
});
