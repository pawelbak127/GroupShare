'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUser } from '@clerk/nextjs';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { toast } from '@/lib/utils/notification';
import NotificationAutoMark from '@/components/notifications/NotificationAutoMark';

export default function GroupDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const { user, isLoaded } = useUser();
  
  const [group, setGroup] = useState(null);
  const [groupMembers, setGroupMembers] = useState([]);
  const [groupSubscriptions, setGroupSubscriptions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('offers');

  // Pobierz dane grupy po załadowaniu
  useEffect(() => {
    if (!isLoaded || !user || !id) return;

    const fetchGroupData = async () => {
      try {
        setIsLoading(true);
        
        // Pobierz szczegóły grupy
        const groupResponse = await fetch(`/api/groups/${id}`);
        
        if (!groupResponse.ok) {
          throw new Error('Failed to fetch group details');
        }
        
        const groupData = await groupResponse.json();
        setGroup(groupData);
        
        // Pobierz członków grupy
        const membersResponse = await fetch(`/api/groups/${id}/members`);
        
        if (membersResponse.ok) {
          const membersData = await membersResponse.json();
          setGroupMembers(Array.isArray(membersData) ? membersData : []);
        }
        
        // Pobierz subskrypcje grupy
        const subscriptionsResponse = await fetch(`/api/groups/${id}/subscriptions`);
        
        if (subscriptionsResponse.ok) {
          const subscriptionsData = await subscriptionsResponse.json();
          setGroupSubscriptions(Array.isArray(subscriptionsData) ? subscriptionsData : []);
        }
      } catch (err) {
        console.error('Error fetching group data:', err);
        setError(err.message || 'Wystąpił błąd podczas pobierania danych grupy');
        toast.error('Nie udało się pobrać danych grupy. Spróbuj ponownie później.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchGroupData();
  }, [id, user, isLoaded]);

  if (!isLoaded || isLoading) {
    return <LoadingSpinner />;
  }

  if (error || !group) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="rounded-md bg-red-50 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Błąd podczas pobierania danych grupy</h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error || 'Nie znaleziono grupy'}</p>
              </div>
            </div>
          </div>
        </div>
        <div className="mt-4">
          <button
            type="button"
            onClick={() => router.push('/groups')}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Wróć do listy grup
          </button>
        </div>
      </div>
    );
  }

  const isOwnerOrAdmin = group.isOwner || group.role === 'admin';

  return (
    <NotificationAutoMark entityType="group" entityId={id}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Nagłówek strony */}
        <div className="mb-8 sm:flex sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-gray-900">{group.name}</h1>
              <span className="ml-3 px-2.5 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-800">
                {group.isOwner ? 'Właściciel' : group.role === 'admin' ? 'Administrator' : 'Członek'}
              </span>
            </div>
            <p className="mt-1 text-sm text-gray-500">
              {group.description || 'Brak opisu grupy'}
            </p>
          </div>
          
          {isOwnerOrAdmin && (
            <div className="mt-5 flex lg:mt-0 lg:ml-4">
              <span className="hidden sm:block">
                <Link
                  href={`/groups/${id}/edit`}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <svg className="-ml-1 mr-2 h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                  </svg>
                  Edytuj grupę
                </Link>
              </span>
              
              <span className="hidden sm:block ml-3">
                <Link
                  href={`/groups/${id}/invite`}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <svg className="-ml-1 mr-2 h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
                  </svg>
                  Zaproś członków
                </Link>
              </span>
              
              <span className="sm:ml-3">
                <Link
                  href={`/groups/${id}/offers/new`}
                  className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                >
                  <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                  </svg>
                  Dodaj ofertę
                </Link>
              </span>
            </div>
          )}
        </div>
        
        {/* Tabs */}
        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            <button
              className={`${
                activeTab === 'offers'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              onClick={() => setActiveTab('offers')}
            >
              Oferty subskrypcji
            </button>
            <button
              className={`${
                activeTab === 'members'
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
              onClick={() => setActiveTab('members')}
            >
              Członkowie grupy
            </button>
          </nav>
        </div>
        
        {/* Zawartość zakładki */}
        {activeTab === 'offers' && (
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-4">Oferty subskrypcji</h2>
            
            {groupSubscriptions.length === 0 ? (
              <div className="bg-white shadow overflow-hidden sm:rounded-md p-6 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">Brak ofert subskrypcji</h3>
                <p className="mt-1 text-sm text-gray-500">
                  Ta grupa nie ma jeszcze żadnych ofert subskrypcji.
                </p>
                {isOwnerOrAdmin && (
                  <div className="mt-6">
                    <Link
                      href={`/groups/${id}/offers/new`}
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                        <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
                      </svg>
                      Dodaj pierwszą ofertę
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-gray-200">
                  {groupSubscriptions.map((subscription) => (
                    <li key={subscription.id}>
                      <div className="px-4 py-4 sm:px-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 bg-gray-100 rounded-full flex items-center justify-center">
                              {subscription.subscription_platforms?.icon ? (
                                <img 
                                  src={subscription.subscription_platforms.icon} 
                                  alt={subscription.subscription_platforms.name} 
                                  className="h-6 w-6 object-contain"
                                />
                              ) : (
                                <span className="text-gray-600 font-medium text-sm">
                                  {subscription.subscription_platforms?.name?.substring(0, 2).toUpperCase() || 'SUB'}
                                </span>
                              )}
                            </div>
                            <div className="ml-4">
                              <h3 className="text-sm font-medium text-indigo-600">
                                {subscription.subscription_platforms?.name || 'Platforma'}
                              </h3>
                              <p className="text-sm text-gray-500">
                                {subscription.price_per_slot.toFixed(2)} {subscription.currency} / miejsce
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                            <div className="flex items-center mb-1">
                              <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                subscription.status === 'active' ? 'bg-green-100 text-green-800' :
                                subscription.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {subscription.status === 'active' ? 'Aktywna' :
                                 subscription.status === 'pending' ? 'Oczekująca' :
                                 subscription.status === 'paused' ? 'Wstrzymana' :
                                 subscription.status}
                              </span>
                            </div>
                            <p className="text-sm text-gray-500">
                              {subscription.slots_available} / {subscription.slots_total} dostępnych miejsc
                            </p>
                          </div>
                        </div>
                        
                        {isOwnerOrAdmin && (
                          <div className="mt-4 flex justify-end space-x-3">
                            <Link
                              href={`/groups/${id}/offers/${subscription.id}/edit`}
                              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                            >
                              Edytuj
                            </Link>
                            <Link
                              href={`/groups/${id}/offers/${subscription.id}/access`}
                              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                            >
                              Zarządzaj dostępem
                            </Link>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
        
        {activeTab === 'members' && (
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-4">Członkowie grupy</h2>
            
            {groupMembers.length === 0 ? (
              <div className="bg-white shadow overflow-hidden sm:rounded-md p-6 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">Brak członków</h3>
                <p className="mt-1 text-sm text-gray-500">
                  W tej grupie nie ma jeszcze żadnych członków oprócz Ciebie.
                </p>
                {isOwnerOrAdmin && (
                  <div className="mt-6">
                    <Link
                      href={`/groups/${id}/invite`}
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                    >
                      <svg className="-ml-1 mr-2 h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M8 9a3 3 0 100-6 3 3 0 000 6zM8 11a6 6 0 00-6 6v1h12v-1a6 6 0 00-6-6zM16 7a1 1 0 10-2 0v1h-1a1 1 0 100 2h1v1a1 1 0 102 0v-1h1a1 1 0 100-2h-1V7z" />
                      </svg>
                      Zaproś członków
                    </Link>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white shadow overflow-hidden sm:rounded-md">
                <ul className="divide-y divide-gray-200">
                  {groupMembers.map((member) => (
                    <li key={member.id}>
                      <div className="px-4 py-4 sm:px-6">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-10 w-10 rounded-full bg-gray-200 overflow-hidden">
                              {member.user?.avatar_url ? (
                                <img 
                                  src={member.user.avatar_url} 
                                  alt={member.user.display_name} 
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="h-full w-full flex items-center justify-center">
                                  <span className="text-gray-600 font-medium text-sm">
                                    {member.user?.display_name?.substring(0, 2).toUpperCase() || 'U'}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="ml-4">
                              <h3 className="text-sm font-medium text-gray-900">
                                {member.user?.display_name || 'Użytkownik'}
                                {member.user_id === group.owner_id && (
                                  <span className="ml-2 text-xs text-gray-500">(Właściciel)</span>
                                )}
                              </h3>
                              <p className="text-sm text-gray-500">
                                {member.user?.email || 'Brak adresu email'}
                              </p>
                            </div>
                          </div>
                          <div>
                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                              member.role === 'admin' ? 'bg-purple-100 text-purple-800' :
                              member.role === 'member' ? 'bg-blue-100 text-blue-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {member.role === 'admin' ? 'Administrator' :
                               member.role === 'member' ? 'Członek' :
                               member.role}
                            </span>
                          </div>
                        </div>
                        
                        {isOwnerOrAdmin && member.user_id !== group.owner_id && member.user_id !== user.id && (
                          <div className="mt-4 flex justify-end space-x-3">
                            <button
                              className="text-sm font-medium text-indigo-600 hover:text-indigo-500"
                            >
                              {member.role === 'admin' ? 'Zmień na Członka' : 'Awansuj do Administratora'}
                            </button>
                            <button
                              className="text-sm font-medium text-red-600 hover:text-red-500"
                            >
                              Usuń z grupy
                            </button>
                          </div>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </NotificationAutoMark>
  );
}