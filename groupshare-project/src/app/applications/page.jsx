'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import LoadingSpinner from '@/components/common/LoadingSpinner';

export default function ApplicationsPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [applications, setApplications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isLoaded || !user) return;

    const fetchApplications = async () => {
      try {
        setIsLoading(true);
        
        const response = await fetch('/api/applications');
        
        if (!response.ok) {
          throw new Error('Failed to fetch applications');
        }
        
        const data = await response.json();
        setApplications(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error fetching applications:', err);
        setError(err.message || 'Wystąpił błąd podczas pobierania aplikacji');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchApplications();
  }, [user, isLoaded]);

  if (!isLoaded || isLoading) {
    return <LoadingSpinner />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Twoje aplikacje</h1>
        <p className="text-gray-600 mt-1">
          Zarządzaj zgłoszeniami o dostęp do subskrypcji
        </p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700 mb-6">
          {error}
        </div>
      )}

      {applications.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-6 text-center">
          <p className="text-gray-500">Nie masz jeszcze żadnych aplikacji.</p>
          <Link href="/offers" className="mt-3 inline-block text-indigo-600 hover:text-indigo-800">
            Przeglądaj dostępne oferty
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => (
            <Link
              href={`/applications/${app.id}`}
              key={app.id}
              className="block bg-white rounded-lg border border-gray-200 shadow-sm p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">
                    {app.group_sub?.subscription_platforms?.name || 'Platforma'}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    Status: <span className={`font-medium ${
                      app.status === 'pending' ? 'text-yellow-600' : 
                      app.status === 'accepted' ? 'text-green-600' : 
                      app.status === 'rejected' ? 'text-red-600' : 
                      app.status === 'completed' ? 'text-blue-600' : 
                      'text-gray-600'
                    }`}>
                      {app.status === 'pending' ? 'Oczekująca' : 
                       app.status === 'accepted' ? 'Zaakceptowana' : 
                       app.status === 'rejected' ? 'Odrzucona' : 
                       app.status === 'completed' ? 'Zakończona' : 
                       app.status === 'problem' ? 'Problem' : 
                       app.status === 'cancelled' ? 'Anulowana' : app.status}
                    </span>
                  </p>
                </div>
                <div className="text-sm font-medium text-indigo-600">
                  {app.group_sub?.price_per_slot?.toFixed(2) || '-'} {app.group_sub?.currency || 'PLN'}/mies.
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}