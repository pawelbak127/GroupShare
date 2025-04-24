'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import EmptyState from '@/components/common/EmptyState';
import { toast } from '@/lib/utils/notification';

export default function ApplicationsPage() {
  const router = useRouter();
  const { user, isLoaded } = useUser();
  const [applications, setApplications] = useState([]);
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

  // Pobieranie aplikacji po załadowaniu i synchronizacji profilu
  useEffect(() => {
    if (!isLoaded || !user || !profileSynced) return;

    const fetchApplications = async () => {
      try {
        setIsLoading(true);
        
        // Użyj nowego endpointu API w liczbie mnogiej
        const response = await fetch('/api/applications?active=true');
        
        if (!response.ok) {
          throw new Error('Failed to fetch applications');
        }
        
        const data = await response.json();
        setApplications(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Error fetching applications:', err);
        setError('Nie udało się pobrać aplikacji. Spróbuj ponownie później.');
        toast.error('Problem z pobraniem Twoich aplikacji');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchApplications();
  }, [user, isLoaded, profileSynced]);

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

  if (applications.length === 0) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Moje aplikacje</h1>
        <EmptyState
          title="Nie masz jeszcze żadnych aplikacji"
          description="Przeglądaj oferty i aplikuj o dostęp do subskrypcji grupowych"
          actionText="Przeglądaj oferty"
          onAction={() => router.push('/offers')}
        />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Moje aplikacje</h1>
      
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <ul className="divide-y divide-gray-200">
          {applications.map((app) => (
            <li key={app.id} className="p-4 hover:bg-gray-50">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-medium text-gray-900">
                    {app.group_sub?.subscription_platforms?.name || 'Platforma'}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    Status: <span className={`font-medium ${
                      app.status === 'pending' ? 'text-yellow-600' : 
                      app.status === 'accepted' ? 'text-green-600' : 
                      app.status === 'rejected' ? 'text-red-600' : 'text-gray-600'
                    }`}>
                      {app.status === 'pending' ? 'Oczekująca' : 
                       app.status === 'accepted' ? 'Zaakceptowana' : 
                       app.status === 'rejected' ? 'Odrzucona' : 
                       app.status === 'completed' ? 'Zakończona' : app.status}
                    </span>
                  </p>
                </div>
                <div className="text-sm font-medium">
                  {app.group_sub?.price_per_slot?.toFixed(2) || '-'} {app.group_sub?.currency || 'PLN'}/mies.
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}