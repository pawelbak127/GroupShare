'use client'

import { useSearchParams } from 'next/navigation';
import { useEffect, useState, Suspense } from 'react';
import { useAuth } from '@clerk/nextjs';
import SecureAccessDisplay from '@/components/secure-access/SecureAccessDisplay';
import LoginRedirect from '@/components/auth/LoginRedirect';

function AccessContent() {
  const searchParams = useSearchParams();
  const { isSignedIn, isLoaded } = useAuth();
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);

  const applicationId = searchParams.get('id');
  const token = searchParams.get('token');

  useEffect(() => {
    if (isLoaded) {
      setIsLoadingAuth(false);
    }
  }, [isLoaded]);

  if (isLoadingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-500"></div>
        <span className="ml-3 text-gray-600">Weryfikacja...</span>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <LoginRedirect
        message="Zaloguj się, aby uzyskać dostęp do instrukcji"
        returnTo={`/access?id=${applicationId}&token=${token}`}
      />
    );
  }

  if (!applicationId || !token) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-yellow-50 rounded-lg border border-yellow-200 shadow-sm p-6">
          <h2 className="text-lg font-medium text-yellow-800">Nieprawidłowy link dostępowy</h2>
          <p className="mt-2 text-sm text-yellow-700">
            Link dostępowy jest nieprawidłowy lub niekompletny. Poproś sprzedającego o wygenerowanie nowego linku.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Instrukcje dostępowe</h1>
        <p className="text-gray-600 mt-1">
          Poniżej znajdują się jednorazowe instrukcje dostępowe do subskrypcji.
        </p>
      </div>

      <SecureAccessDisplay applicationId={applicationId} token={token} />
    </div>
  );
}

export default function AccessPage() {
  return (
    <Suspense fallback={<div className="text-center p-6">Wczytywanie...</div>}>
      <AccessContent />
    </Suspense>
  );
}
