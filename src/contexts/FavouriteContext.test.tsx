import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FAVOURITES_STORAGE_KEY, LEGACY_FAVOURITES_STORAGE_KEY, serializeFavourites } from '@/lib/favourites';
import { FavouriteProvider, useFavourites } from './FavouriteContext';

const favourite = { route: '87D', bound: 'O' as const, serviceType: '1', stopId: 'STOP1' };
const otherFavourite = { route: '87D', bound: 'O' as const, serviceType: '3', stopId: 'STOP2' };

function Probe() {
  const { favourites, hydrated, removeFavourite, toggleFavourite } = useFavourites();
  return <>
    <span>{hydrated ? 'hydrated' : 'loading'}</span><span>{favourites.length}</span>
    <button onClick={() => toggleFavourite(favourite)}>toggle</button>
    <button onClick={() => { toggleFavourite(favourite); toggleFavourite(otherFavourite); }}>add two</button>
    <button onClick={() => { removeFavourite(favourite); toggleFavourite(otherFavourite); }}>remove and toggle</button>
  </>;
}

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); localStorage.clear(); });

describe('FavouriteProvider', () => {
  it('clears legacy route-only data and hydrates a deduplicated v2 store', async () => {
    localStorage.setItem(LEGACY_FAVOURITES_STORAGE_KEY, JSON.stringify(['87D']));
    localStorage.setItem(FAVOURITES_STORAGE_KEY, serializeFavourites([favourite, favourite]));
    render(<FavouriteProvider><Probe /></FavouriteProvider>);
    await waitFor(() => expect(screen.getByText('hydrated')).toBeDefined());
    expect(screen.getByText('1')).toBeDefined();
    expect(localStorage.getItem(LEGACY_FAVOURITES_STORAGE_KEY)).toBeNull();
  });

  it('toggles an exact identity and removes persistence when empty', async () => {
    render(<FavouriteProvider><Probe /></FavouriteProvider>);
    await waitFor(() => expect(screen.getByText('hydrated')).toBeDefined());
    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
    expect(JSON.parse(localStorage.getItem(FAVOURITES_STORAGE_KEY)!).items).toEqual([favourite]);
    fireEvent.click(screen.getByRole('button', { name: 'toggle' }));
    expect(localStorage.getItem(FAVOURITES_STORAGE_KEY)).toBeNull();
  });

  it('keeps every next state when multiple toggle/remove actions are batched in one event', async () => {
    render(<FavouriteProvider><Probe /></FavouriteProvider>);
    await waitFor(() => expect(screen.getByText('hydrated')).toBeDefined());

    // Both callbacks capture the same render, so this regresses the previous
    // closure-based update bug.
    fireEvent.click(screen.getByRole('button', { name: 'add two' }));
    await waitFor(() => expect(JSON.parse(localStorage.getItem(FAVOURITES_STORAGE_KEY)!).items).toEqual([favourite, otherFavourite]));

    fireEvent.click(screen.getByRole('button', { name: 'remove and toggle' }));
    await waitFor(() => expect(localStorage.getItem(FAVOURITES_STORAGE_KEY)).toBeNull());
  });
});
