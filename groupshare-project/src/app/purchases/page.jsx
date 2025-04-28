'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import EmptyState from '@/components/common/EmptyState';
import { toast } from '@/lib/utils/notification';

export default function PurchasesPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [purchases, setPurchases] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [profileSynced, setProfileSynced] = useState(false);

  // Synchronizacja profilu użytkownika
  useEffect(() => {
    if (!isLoaded || !user) return;

    const syncUserProfile = async () => {
      try {
        const profileRes = await fetch('/api/auth/profile');
        if (!profileRes.ok) {
          throw new Error('Failed to sync user profile');
        }
        setProfileSynced(true);
      } catch (err) {
        console.error('Error syncing user profile:', err);
        setError('Nie udało się zsynchronizować profilu. Odśwież stronę, aby spróbować ponownie.');
      }
    };

    syncUserProfile();
  }, [user, isLoaded]);

  // Pobieranie zakupów po załadowaniu i synchronizacji profilu
  useEffect(() => {
    if (!isLoaded || !user || !profileSynced) return;

    const fetchPurchases = async () => {
      try {
        setIsLoading(true);
        
        const response = await fetch('/api/purchases');
        
        if (!response.ok) {
          throw new Error('Failed to fetch purchases');
        }
        
        const data = await response.json();
        setPurchases(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error fetching purchases:', err);
        setError('Nie udało się pobrać zakupów. Spróbuj ponownie później.');
        toast.error('Problem z pobraniem Twoich zakupów');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchPurchases();
  }, [user, isLoaded, profileSynced]);

  // Funkcja formatująca datę
  const formatDate = (dateString) => {
    if (!dateString) return 'Brak daty';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pl-PL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }).format(date);
  };

  // Funkcja do wyświetlania statusu w czytelnej formie
  const formatStatus = (status) => {
    switch (status) {
      case 'pending_payment': return 'Oczekuje na płatność';
      case 'payment_processing': return 'Przetwarzanie płatności';
      case 'completed': return 'Zakończony';
      case 'failed': return 'Nieudany';
      case 'refunded': return 'Zwrócony';
      default: return status;
    }
  };

  // Funkcja zwracająca kolor statusu
  const getStatusColor = (status) => {
    switch (status) {
      case 'pending_payment': return 'text-yellow-600';
      case 'payment_processing': return 'text-blue-600';
      case 'completed': return 'text-green-600';
      case 'failed': return 'text-red-600';
      case 'refunded': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  if (!isLoaded || isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (purchases.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Moje zakupy</h1>
        <EmptyState
          title="Nie masz jeszcze żadnych zakupów"
          description="Przeglądaj oferty i dołącz do subskrypcji grupowych"
          actionText="Przeglądaj oferty"
          onAction={() => router.push('/offers')}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Moje zakupy</h1>
      
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <ul className="divide-y divide-gray-200">
          {purchases.map((purchase) => (
            <li key={purchase.id} className="p-4 hover:bg-gray-50">
              <div className="sm:flex sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-lg font-medium text-gray-900">
                    {purchase.group_sub?.subscription_platforms?.name || 'Platforma'}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Data zakupu: {formatDate(purchase.created_at)}
                  </p>
                  <p className="text-sm text-gray-500">
                    Status: <span className={`font-medium ${getStatusColor(purchase.status)}`}>
                      {formatStatus(purchase.status)}
                    </span>
                  </p>
                </div>
                <div className="mt-2 sm:mt-0 text-right">
                  <div className="text-sm font-medium">
                    {purchase.group_sub?.price_per_slot?.toFixed(2) || '-'} {purchase.group_sub?.currency || 'PLN'}/mies.
                  </div>
                  {purchase.status === 'completed' && (
                    <Link
                      href={`/purchases/${purchase.id}/details`}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-800 mt-1 inline-block"
                    >
                      Pokaż szczegóły dostępu
                    </Link>
                  )}
                  {purchase.status === 'pending_payment' && (
                    <Link
                      href={`/checkout/${purchase.id}`}
                      className="text-sm font-medium text-indigo-600 hover:text-indigo-800 mt-1 inline-block"
                    >
                      Dokończ płatność
                    </Link>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}