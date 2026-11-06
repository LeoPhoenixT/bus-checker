import { connection } from 'next/server';
import { RouteSearchPage } from '@/components/RouteSearchPage';

export default async function RoutesPage() {
  // Keep request-time rendering so the initial HTML includes the current URL search.
  await connection();
  return <RouteSearchPage />;
}
