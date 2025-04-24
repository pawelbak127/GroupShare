import { Suspense } from 'react';
import JoinGroupPageClient from './JoinGroupPageClient';

export const dynamic = 'force-dynamic';

export default function JoinGroupPage() {
  return (
    <Suspense fallback={<div className="p-6 text-gray-500">Ładowanie zaproszenia...</div>}>
      <JoinGroupPageClient />
    </Suspense>
  );
}
