'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { toast } from '@/lib/utils/notification';

export default function GroupInvitePage() {
  const { id: groupId } = useParams();
  const router = useRouter();
  const { user, isLoaded } = useUser();
  
  const [group, setGroup] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('member');
  const [isSending, setIsSending] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  
  // Pobierz dane grupy po załadowaniu
  useEffect(() => {
    if (!isLoaded || !user || !groupId) return;

    const fetchGroupData = async () => {
      try {
        setIsLoading(true);
        
        // Pobierz szczegóły grupy
        const groupResponse = await fetch(`/api/groups/${groupId}`);
        
        if (!groupResponse.ok) {
          throw new Error('Failed to fetch group details');
        }
        
        const groupData = await groupResponse.json();
        setGroup(groupData);
        
        // Generuj link zapraszający
        const baseUrl = window.location.origin;
        setInviteLink(`${baseUrl}/groups/join?code=${groupId}-${Date.now()}`);
        
      } catch (err) {
        console.error('Error fetching group data:', err);
        setError(err.message || 'Wystąpił błąd podczas pobierania danych grupy');
        toast.error('Nie udało się pobrać danych grupy. Spróbuj ponownie później.');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchGroupData();
  }, [groupId, user, isLoaded]);

  // Obsługa zaproszenia przez email
  const handleInvite = async (e) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast.error('Wprowadź adres email');
      return;
    }
    
    setIsSending(true);
    
    try {
      // W rzeczywistej implementacji ten endpoint musiałby zostać utworzony
      const response = await fetch(`/api/groups/${groupId}/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email,
          role
        })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Nie udało się wysłać zaproszenia');
      }
      
      toast.success('Zaproszenie zostało wysłane');
      setEmail('');
    } catch (err) {
      console.error('Error sending invitation:', err);
      toast.error(err.message || 'Wystąpił błąd podczas wysyłania zaproszenia');
    } finally {
      setIsSending(false);
    }
  };

  // Kopiuj link zapraszający do schowka
  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink)
      .then(() => {
        toast.success('Link został skopiowany do schowka');
      })
      .catch(err => {
        console.error('Failed to copy:', err);
        toast.error('Nie udało się skopiować linku');
      });
  };

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (error || !group) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-red-50 border border-red-200 rounded-md p-4 text-red-700">
          {error || 'Nie znaleziono grupy'}
        </div>
        <Link href="/groups" className="mt-4 inline-block text-indigo-600 hover:text-indigo-800">
          &larr; Wróć do listy grup
        </Link>
      </div>
    );
  }

  // Sprawdź, czy użytkownik ma uprawnienia (właściciel lub admin)
  const hasPermissions = group.isOwner || group.role === 'admin';
  
  if (!hasPermissions) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 text-yellow-700">
          Nie masz uprawnień do zapraszania członków do tej grupy.
        </div>
        <Link href={`/groups/${groupId}`} className="mt-4 inline-block text-indigo-600 hover:text-indigo-800">
          &larr; Wróć do grupy
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Zaproś do grupy: {group.name}</h1>
        <Link href={`/groups/${groupId}`} className="text-indigo-600 hover:text-indigo-800">
          &larr; Wróć do grupy
        </Link>
      </div>
      
      <div className="bg-white shadow overflow-hidden sm:rounded-lg mb-6">
        <div className="px-4 py-5 sm:p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Zaproś przez email</h2>
          <form onSubmit={handleInvite} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Adres email
              </label>
              <input
                type="email"
                id="email"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="np. jan.kowalski@example.com"
                required
              />
            </div>
            
            <div>
              <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
                Rola
              </label>
              <select
                id="role"
                className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="member">Członek</option>
                <option value="admin">Administrator</option>
              </select>
            </div>
            
            <div className="pt-2">
              <button
                type="submit"
                className={`px-4 py-2 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                  isSending ? 'opacity-75 cursor-wait' : ''
                }`}
                disabled={isSending}
              >
                {isSending ? 'Wysyłanie...' : 'Wyślij zaproszenie'}
              </button>
            </div>
          </form>
        </div>
      </div>
      
      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <div className="px-4 py-5 sm:p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Link zapraszający</h2>
          <p className="text-sm text-gray-500 mb-4">
            Możesz również udostępnić ten link, aby zaprosić innych użytkowników do grupy. 
            Link jest ważny przez 7 dni.
          </p>
          
          <div className="flex items-center">
            <input
              type="text"
              className="flex-grow rounded-l-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500"
              value={inviteLink}
              readOnly
            />
            <button
              onClick={copyInviteLink}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-r-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              Kopiuj
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}