import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguageProvider } from '@/contexts/LanguageContext';
import { FilterBar } from './FilterBar';

afterEach(cleanup);

describe('FilterBar', () => {
  it('does not include a legacy favourite-only filter', () => {
    render(
      <LanguageProvider>
        <FilterBar filters={[]} onAdd={vi.fn()} onRemove={vi.fn()} onClear={vi.fn()} destinationActive={false} destinationLabel={null} destinationDistanceM={null} onOpenDestinationModal={vi.fn()} onClearDestination={vi.fn()} />
      </LanguageProvider>,
    );
    expect(screen.queryByText('只顯示收藏路線')).toBeNull();
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
        />
      </LanguageProvider>,
    );

    expect(screen.getByText('中環巴士總站')).toBeDefined();
    expect(screen.getByText('885 m 外')).toBeDefined();
  });
});
