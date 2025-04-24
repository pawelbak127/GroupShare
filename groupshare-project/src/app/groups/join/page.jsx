'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import Link from 'next/link';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { toast } from '@/lib/utils/notification';

export default function JoinGroupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoaded, isSignedIn } = useUser();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [invitation, setInvitation] = useState(null);
  
  // Get the invitation code from the URL
  const code = searchParams.get('code');
  
  // Fetch invitation details when component loads
  useEffect(() => {
    if (!code) {
      setError('Kod zaproszenia jest wymagany');
      setIsLoading(false);
      return;
    }
    
    const fetchInvitationDetails = async () => {
      try {
        setIsLoading(true);
        
        const response = await fetch(`/api/groups/invitations/verify?code=${code}`);
        
        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || 'Nie udało się zweryfikować zaproszenia');
        }
        
        const data = await response.json();
        setInvitation(data);
      } catch (err) {
        console.error('Error verifying invitation:', err);
        setError(err.message || 'Wystąpił błąd podczas weryfikacji zaproszenia');
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchInvitationDetails();
  }, [code]);
  
  // Function to handle joining the group
  const handleJoinGroup = async () => {
    if (!isSignedIn) {
      // If user is not signed in, redirect to sign in page
      router.push(`/sign-in?redirect=${encodeURIComponent(`/groups/join?code=${code}`)}`);
      return;
    }
    
    if (!invitation || !invitation.groupId) {
      toast.error('Błędne dane zaproszenia');
      return;
    }
    
    try {
      setIsProcessing(true);
      
      const response = await fetch(`/api/groups/${invitation.groupId}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          inviteCode: code,
          role: invitation.role || 'member'
        })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Nie udało się dołączyć do grupy');
      }
      
      const data = await response.json();
      
      toast.success('Pomyślnie dołączono do grupy!');
      
      // Redirect to the group page
      router.push(`/groups/${invitation.groupId}`);
    } catch (err) {
      console.error('Error joining group:', err);
      toast.error(err.message || 'Wystąpił błąd podczas dołączania do grupy');
      setIsProcessing(false);
    }
  };
  
  if (isLoading) {
    return <LoadingSpinner />;
  }
  
  if (error || !invitation) {
    return (
      <div className="max-w-md mx-auto my-12 px-4">
        <div className="bg-white p-6 rounded-lg shadow-md">
          <h1 className="text-xl font-bold text-red-600 mb-4">Błąd zaproszenia</h1>
          <p className="text-gray-700 mb-4">{error || 'Nieprawidłowy kod zaproszenia'}</p>
          <Link href="/" className="text-indigo-600 hover:text-indigo-800">
            &larr; Wróć do strony głównej
          </Link>
        </div>
      </div>
    );
  }
  
  return (
    <div className="max-w-md mx-auto my-12 px-4">
      <div className="bg-white p-6 rounded-lg shadow-md">
        <h1 className="text-xl font-bold text-gray-900 mb-4">Zaproszenie do grupy</h1>
        
        <div className="mb-6">
          <p className="text-gray-700 mb-2">
            Zostałeś zaproszony do dołączenia do grupy:
          </p>
          <p className="text-lg font-medium text-gray-900 mb-1">{invitation.groupName}</p>
          <p className="text-sm text-gray-500 mb-4">
            Rola: <span className="font-medium">{invitation.role === 'admin' ? 'Administrator' : 'Członek'}</span>
          </p>
          
          {invitation.expireDate && (
            <p className="text-xs text-gray-500">
              Zaproszenie ważne do: {new Date(invitation.expireDate).toLocaleDateString()}
            </p>
          )}
        </div>
        
        {!isSignedIn ? (
          <div>
            <p className="text-gray-700 mb-4">
              Aby dołączyć do grupy, musisz się najpierw zalogować.
            </p>
            <button
              onClick={handleJoinGroup}
              className="w-full px-4 py-2 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700"
            >
              Zaloguj się i dołącz
            </button>
          </div>
        ) : (
          <button
            onClick={handleJoinGroup}
            disabled={isProcessing}
            className={`w-full px-4 py-2 bg-indigo-600 text-white font-medium rounded-md hover:bg-indigo-700 
              ${isProcessing ? 'opacity-75 cursor-wait' : ''}`}
          >
            {isProcessing ? 'Przetwarzanie...' : 'Dołącz do grupy'}
          </button>
        )}
        
        <div className="mt-4 text-center">
          <Link href="/" className="text-sm text-indigo-600 hover:text-indigo-800">
            Anuluj i wróć do strony głównej
          </Link>
        </div>
      </div>
    </div>
  );
}