'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import { toast } from '@/lib/utils/notification';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { tokenService } from '@/lib/security/token-service';

export default function PurchaseDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, isLoaded } = useUser();
  
  const [purchase, setPurchase] = useState(null);
  const [accessToken, setAccessToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGeneratingToken, setIsGeneratingToken] = useState(false);
  const [error, setError] = useState(null);
  const [isRegenerating, setIsRegenerating] = useState(false);



// Dodaj funkcję do regeneracji tokenu

const regenerateAccessToken = async () => {
    try {
      setIsGeneratingToken(true);
      
      const response = await fetch(`/api/purchases/${id}/regenerate-token`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Failed to regenerate access token');
      }
      
      const data = await response.json();
      setAccessToken(data);
      toast.success('Token został ponownie wygenerowany');
    } catch (err) {
      console.error('Error regenerating access token:', err);
      toast.error('Nie udało się ponownie wygenerować tokenu dostępu');
    } finally {
      setIsGeneratingToken(false);
    }
  };

  // Pobieranie danych zakupu
  useEffect(() => {
    if (!isLoaded || !user) return;

    const fetchPurchaseDetails = async () => {
      try {
        setIsLoading(true);
        
        const response = await fetch(`/api/purchases/${id}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch purchase details');
        }
        
        const data = await response.json();
        setPurchase(data);
      } catch (err) {
        console.error('Error fetching purchase details:', err);
        setError('Nie udało się pobrać szczegółów zakupu');
        toast.error('Problem z pobraniem szczegółów zakupu');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchPurchaseDetails();
  }, [id, user, isLoaded]);

  // Generowanie tokenu dostępu
  const generateAccessToken = async () => {
    try {
      setIsGeneratingToken(true);
      
      const response = await fetch(`/api/purchases/${id}/access-token`, {
        method: 'POST'
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate access token');
      }
      
      const data = await response.json();
      setAccessToken(data);
      toast.success('Token wygenerowany pomyślnie');
    } catch (err) {
      console.error('Error generating access token:', err);
      toast.error('Nie udało się wygenerować tokenu dostępu');
    } finally {
      setIsGeneratingToken(false);
    }
  };

  // Formatowanie daty
  const formatDate = (dateString) => {
    if (!dateString) return 'Brak daty';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pl-PL', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  if (!isLoaded || isLoading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700">
          {error}
        </div>
        <Link href="/purchases" className="mt-4 inline-block text-indigo-600 hover:text-indigo-800">
          &larr; Wróć do listy zakupów
        </Link>
      </div>
    );
  }

  if (!purchase) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 text-yellow-700">
          Nie znaleziono szczegółów zakupu
        </div>
        <Link href="/purchases" className="mt-4 inline-block text-indigo-600 hover:text-indigo-800">
          &larr; Wróć do listy zakupów
        </Link>
      </div>
    );
  }

  // Sprawdź czy zakup jest zakończony
  const isCompleted = purchase.status === 'completed';

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Szczegóły zakupu</h1>
        <Link href="/purchases" className="text-indigo-600 hover:text-indigo-800">
          &larr; Wróć do listy zakupów
        </Link>
      </div>
      
      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
        <div className="px-4 py-5 sm:px-6">
          <h2 className="text-lg leading-6 font-medium text-gray-900">
            {purchase.group_sub?.subscription_platforms?.name || 'Platforma subskrypcyjna'}
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">
            Szczegóły zakupu i dostępu do subskrypcji
          </p>
        </div>
        
        <div className="border-t border-gray-200">
          <dl>
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Status</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {purchase.status === 'pending_payment' && <span className="text-yellow-600 font-medium">Oczekuje na płatność</span>}
                {purchase.status === 'payment_processing' && <span className="text-blue-600 font-medium">Przetwarzanie płatności</span>}
                {purchase.status === 'completed' && <span className="text-green-600 font-medium">Zakończony</span>}
                {purchase.status === 'failed' && <span className="text-red-600 font-medium">Nieudany</span>}
                {purchase.status === 'refunded' && <span className="text-gray-600 font-medium">Zwrócony</span>}
              </dd>
            </div>
            
            <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Data zakupu</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {formatDate(purchase.created_at)}
              </dd>
            </div>
            
            <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
              <dt className="text-sm font-medium text-gray-500">Cena</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                {purchase.group_sub?.price_per_slot?.toFixed(2) || '0.00'} {purchase.group_sub?.currency || 'PLN'} / miesiąc
              </dd>
            </div>
            
            {isCompleted && (
              <>
                <div className="bg-white px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Dostęp przyznany</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {purchase.access_provided 
                      ? <span className="text-green-600 font-medium">Tak</span> 
                      : <span className="text-red-600 font-medium">Nie</span>}
                    {purchase.access_provided_at && ` (${formatDate(purchase.access_provided_at)})`}
                  </dd>
                </div>
                
                <div className="bg-gray-50 px-4 py-5 sm:grid sm:grid-cols-3 sm:gap-4 sm:px-6">
                  <dt className="text-sm font-medium text-gray-500">Dostęp potwierdzony</dt>
                  <dd className="mt-1 text-sm text-gray-900 sm:mt-0 sm:col-span-2">
                    {purchase.access_confirmed 
                      ? <span className="text-green-600 font-medium">Tak</span> 
                      : <span className="text-yellow-600 font-medium">Nie</span>}
                    {purchase.access_confirmed_at && ` (${formatDate(purchase.access_confirmed_at)})`}
                  </dd>
                </div>
              </>
            )}
          </dl>
        </div>
      </div>
      
      {/* Akcje dostępowe */}
      {isCompleted && (
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h2 className="text-lg leading-6 font-medium text-gray-900">
              Dostęp do subskrypcji
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              Poniżej znajdziesz opcje dostępu do zakupionej subskrypcji
            </p>
          </div>
          
          <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
            {purchase.access_provided ? (
              <>
                <p className="text-sm text-gray-600 mb-4">
                  Możesz wygenerować jednorazowy token dostępu, który umożliwi Ci pobranie instrukcji dostępowych.
                </p>
                
                {accessToken ? (
  <div className="bg-green-50 border border-green-200 rounded-md p-4 mb-4">
    <h3 className="text-sm font-medium text-green-800 mb-1">Token został wygenerowany</h3>
    <p className="text-xs text-green-700 mb-2">
      Ten link jest ważny przez 60 minut i może być użyty tylko raz.
    </p>
    <div className="flex items-center">
      <input
        type="text"
        className="flex-grow rounded-l-md border border-gray-300 px-3 py-2 shadow-sm text-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
        value={accessToken.accessUrl}
        readOnly
      />
      <button
        onClick={() => {
          navigator.clipboard.writeText(accessToken.accessUrl);
          toast.success('Link skopiowany do schowka');
        }}
        className="inline-flex items-center px-4 py-2 border border-transparent rounded-r-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        Kopiuj
      </button>
    </div>
    <div className="mt-3 flex space-x-3">
                      <a
                        href={accessToken.accessUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                      >
                        Przejdź do instrukcji dostępu
                      </a>
                      <button
                        onClick={regenerateAccessToken}
                        disabled={isGeneratingToken}
                        className={`inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                          isGeneratingToken ? 'opacity-70 cursor-wait' : ''
                        }`}
                      >
                        {isGeneratingToken ? 'Regeneracja...' : 'Regeneruj token'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={generateAccessToken}
                    disabled={isGeneratingToken}
                    className={`inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                      isGeneratingToken ? 'opacity-70 cursor-wait' : ''
                    }`}
                  >
                    {isGeneratingToken ? 'Generowanie...' : 'Wygeneruj token dostępu'}
                  </button>
                )}
                
                {!purchase.access_confirmed && (
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <h3 className="text-sm font-medium text-gray-900 mb-1">Potwierdzenie dostępu</h3>
                    <p className="text-sm text-gray-600 mb-3">
                      Po sprawdzeniu instrukcji dostępowych, potwierdź czy dostęp działa poprawnie.
                    </p>
                    <div className="flex space-x-3">
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/purchases/${id}/confirm-access`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ isWorking: true })
                            });
                            
                            if (!res.ok) throw new Error('Failed to confirm access');
                            
                            toast.success('Dostęp potwierdzony jako działający');
                            // Odśwież dane
                            router.refresh();
                          } catch (err) {
                            toast.error('Nie udało się potwierdzić dostępu');
                          }
                        }}
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                      >
                        Dostęp działa
                      </button>
                      
                      <button
                        onClick={async () => {
                          try {
                            const res = await fetch(`/api/purchases/${id}/confirm-access`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ isWorking: false })
                            });
                            
                            if (!res.ok) throw new Error('Failed to report problem');
                            
                            toast.success('Zgłoszenie problemu zostało wysłane');
                            // Odśwież dane
                            router.refresh();
                          } catch (err) {
                            toast.error('Nie udało się zgłosić problemu');
                          }
                        }}
                        className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                      >
                        Zgłoś problem
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <h3 className="text-sm font-medium text-yellow-800">Dostęp nie został jeszcze przyznany</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  Instrukcje dostępowe będą dostępne po przyznaniu dostępu przez sprzedającego.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}