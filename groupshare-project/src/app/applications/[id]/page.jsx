'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import LoadingSpinner from '@/components/common/LoadingSpinner';

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
        
        // Pobierz szczegóły aplikacji/zakupu
        const response = await fetch(`/api/applications?id=${id}`);
        
        if (!response.ok) {
          throw new Error('Nie udało się pobrać szczegółów aplikacji');
        }
        
        const data = await response.json();
        
        // Znajdź konkretną aplikację po ID
        const app = Array.isArray(data) ? data.find(a => a.id === id) : null;
        
        if (!app) {
          throw new Error('Nie znaleziono aplikacji o podanym ID');
        }
        
        setApplication(app);
      } catch (err) {
        console.error('Error fetching application details:', err);
        setError(err.message || 'Wystąpił błąd podczas pobierania szczegółów aplikacji');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchApplicationDetails();
  }, [id, user, isLoaded]);

  if (!isLoaded || isLoading) {
    return <LoadingSpinner />;
  }

  if (error || !application) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="bg-red-50 rounded-lg border border-red-200 shadow-sm p-6">
          <h2 className="text-lg font-bold text-red-700 mb-2">Wystąpił błąd</h2>
          <p className="text-red-600">{error || 'Nie znaleziono aplikacji'}</p>
          <Link href="/applications" className="mt-4 inline-block text-indigo-600 hover:text-indigo-800">
            &larr; Wróć do listy aplikacji
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-6">
        <Link href="/applications" className="text-indigo-600 hover:text-indigo-800">
          &larr; Wróć do listy aplikacji
        </Link>
      </div>
      
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-200">
          <h1 className="text-xl font-bold text-gray-900">
            {application.group_sub?.subscription_platforms?.name || 'Platforma'}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            ID aplikacji: {application.id}
          </p>
        </div>
        
        <div className="px-6 py-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-medium text-gray-500">Status</h3>
              <p className={`mt-1 text-sm font-medium ${
                application.status === 'completed' ? 'text-green-600' : 
                application.status === 'pending' ? 'text-yellow-600' : 
                application.status === 'rejected' ? 'text-red-600' : 
                'text-gray-700'
              }`}>
                {application.status === 'pending' ? 'Oczekująca' : 
                 application.status === 'accepted' ? 'Zaakceptowana' : 
                 application.status === 'rejected' ? 'Odrzucona' : 
                 application.status === 'completed' ? 'Zakończona' : 
                 application.status === 'problem' ? 'Problem' : 
                 application.status === 'cancelled' ? 'Anulowana' : application.status}
              </p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-500">Cena</h3>
              <p className="mt-1 text-sm text-gray-900">
                {application.group_sub?.price_per_slot?.toFixed(2) || '-'} {application.group_sub?.currency || 'PLN'}/miesiąc
              </p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-500">Data utworzenia</h3>
              <p className="mt-1 text-sm text-gray-900">
                {new Date(application.created_at).toLocaleDateString()}
              </p>
            </div>
            
            <div>
              <h3 className="text-sm font-medium text-gray-500">Ostatnia aktualizacja</h3>
              <p className="mt-1 text-sm text-gray-900">
                {new Date(application.updated_at).toLocaleDateString()}
              </p>
            </div>
          </div>
          
          {application.status === 'completed' && application.access_provided && (
            <div className="mt-6 border-t border-gray-200 pt-4">
              <Link 
                href={`/access?id=${application.id}`}
                className="block w-full text-center px-4 py-2 border border-transparent font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Pokaż instrukcje dostępu
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}