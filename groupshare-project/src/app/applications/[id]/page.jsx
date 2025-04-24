'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { toast } from '@/lib/utils/notification';

export default function ApplicationDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, isLoaded } = useUser();
  
  const [application, setApplication] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    if (!isLoaded || !user || !id) return;
    
    const fetchApplicationDetails = async () => {
      try {
        setIsLoading(true);
        
        // Próba pobrania danych aplikacji jako purchaseRecord
        const response = await fetch(`/api/purchases/${id}`);
        
        if (!response.ok) {
          throw new Error('Nie udało się pobrać szczegółów aplikacji');
        }
        
        const data = await response.json();
        setApplication(data);
      } catch (err) {
        console.error('Error fetching application details:', err);
        setError(err.message || 'Wystąpił błąd podczas pobierania danych');
        toast.error('Problem z pobraniem szczegółów aplikacji');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchApplicationDetails();
  }, [id, user, isLoaded]);
  
  // Formaty daty
  const formatDate = (dateString) => {
    if (!dateString) return 'Brak daty';
    return new Date(dateString).toLocaleDateString('pl-PL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
  
  if (!isLoaded || isLoading) {
    return <LoadingSpinner />;
  }
  
  if (error || !application) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700">
          {error || 'Nie znaleziono szczegółów aplikacji'}
        </div>
        <Link href="/applications" className="mt-4 inline-block text-indigo-600 hover:text-indigo-800">
          &larr; Wróć do listy aplikacji
        </Link>
      </div>
    );
  }
  
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Szczegóły aplikacji</h1>
        <Link href="/applications" className="text-indigo-600 hover:text-indigo-800">
          &larr; Wróć do listy aplikacji
        </Link>
      </div>
      
      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
        <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
          <div>
            <h2 className="text-lg leading-6 font-medium text-gray-900">
              {application.group_sub?.subscription_platforms?.name || 'Platforma subskrypcyjna'}
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Status: <span className={`font-medium ${
                application.status === 'pending_payment' ? 'text-yellow-600' :
                application.status === 'payment_processing' ? 'text-blue-600' :
                application.status === 'completed' ? 'text-green-600' :
                application.status === 'failed' ? 'text-red-600' :
                'text-gray-600'
              }`}>
                {application.status === 'pending_payment' ? 'Oczekuje na płatność' :
                 application.status === 'payment_processing' ? 'Przetwarzanie płatności' :
                 application.status === 'completed' ? 'Zakończono' :
                 application.status === 'failed' ? 'Nieudana' :
                 application.status}
              </span>
            </p>
          </div>
          
          {application.status === 'completed' && (
            <Link 
              href={`/purchase/${id}/details`}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Szczegóły dostępu
            </Link>
          )}
          
          {application.status === 'pending_payment' && (
            <Link 
              href={`/checkout/${id}`}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Dokończ płatność
            </Link>
          )}
        </div>
        
        <div className="border-t border-gray-200">
          <dl>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Data złożenia</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {formatDate(application.created_at)}
              </dd>
            </div>
            
            <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Cena</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {application.group_sub?.price_per_slot?.toFixed(2) || '0.00'} {application.group_sub?.currency || 'PLN'} / miesiąc
              </dd>
            </div>
            
            {application.status === 'completed' && (
              <>
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Data zakończenia</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {formatDate(application.updated_at)}
                  </dd>
                </div>
                
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Dostęp</dt>
                  <dd className="mt-1 text-sm sm:mt-0 sm:col-span-2">
                    {application.access_provided ? (
                      <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800 font-medium">
                        Dostęp aktywny
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800 font-medium">
                        Oczekuje na dostęp
                      </span>
                    )}
                  </dd>
                </div>
              </>
            )}
          </dl>
        </div>
      </div>
      
      {application.status === 'completed' && (
        <div className="bg-white shadow sm:rounded-lg">
          <div className="px-4 py-5 sm:p-6">
            <h3 className="text-lg leading-6 font-medium text-gray-900">
              Instrukcje dostępu
            </h3>
            <div className="mt-2 text-sm text-gray-500">
              <p>
                Aby uzyskać dostęp do instrukcji, przejdź do szczegółów dostępu. Instrukcje są dostępne tylko przez ograniczony czas ze względów bezpieczeństwa.
              </p>
            </div>
            <div className="mt-5">
              <Link
                href={`/purchase/${id}/details`}
                className="inline-flex items-center px-4 py-2 border border-gray-300 shadow-sm text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Pokaż szczegóły dostępu
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}