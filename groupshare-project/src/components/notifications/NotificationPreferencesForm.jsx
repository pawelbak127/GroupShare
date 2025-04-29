'use client';

import { useState, useEffect } from 'react';
import { toast } from '@/lib/utils/notification';
import LoadingSpinner from '../common/LoadingSpinner';

/**
 * Komponent formularza preferencji powiadomień
 */
const NotificationPreferencesForm = () => {
  const [preferences, setPreferences] = useState({
    email_enabled: true,
    push_enabled: false,
    type_preferences: true,
    type_preferences: true,
    notify_on_purchase: true,
    notify_on_dispute: true,
    email_digest: 'daily'
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(null);

  // Pobierz preferencje użytkownika przy montowaniu komponentu
  useEffect(() => {
    const fetchPreferences = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch('/api/notifications/preferences');
        
        if (!response.ok) {
          throw new Error('Failed to fetch notification preferences');
        }
        
        const data = await response.json();
        setPreferences(data);
      } catch (err) {
        console.error('Error fetching preferences:', err);
        setError('Nie udało się pobrać preferencji powiadomień. Spróbuj ponownie później.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchPreferences();
  }, []);

  // Obsługa zmiany pól formularza
  const handleChange = (e) => {
    const { name, value, checked, type } = e.target;
    setPreferences(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Zapisz preferencje
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      setIsSaving(true);
      setError(null);
      
      const response = await fetch('/api/notifications/preferences', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(preferences)
      });
      
      if (!response.ok) {
        throw new Error('Failed to update notification preferences');
      }
      
      const updatedPreferences = await response.json();
      setPreferences(updatedPreferences);
      
      toast.success('Preferencje powiadomień zostały zaktualizowane');
    } catch (err) {
      console.error('Error updating preferences:', err);
      setError('Nie udało się zaktualizować preferencji powiadomień. Spróbuj ponownie później.');
      toast.error('Nie udało się zapisać preferencji');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-8">
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
      <form onSubmit={handleSubmit}>
        <div className="p-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Ogólne ustawienia powiadomień</h2>
          
          {/* Kanały powiadomień */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label htmlFor="email_enabled" className="font-medium text-gray-700">
                  Powiadomienia e-mail
                </label>
                <p className="text-sm text-gray-500">
                  Otrzymuj powiadomienia na swój adres e-mail
                </p>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="email_enabled"
                  name="email_enabled"
                  checked={preferences.email_enabled}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </div>
            </div>
            
            <div className="flex items-center justify-between border-t border-gray-200 pt-4">
              <div>
                <label htmlFor="push_enabled" className="font-medium text-gray-700">
                  Powiadomienia push
                </label>
                <p className="text-sm text-gray-500">
                  Otrzymuj powiadomienia push w przeglądarce
                </p>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="push_enabled"
                  name="push_enabled"
                  checked={preferences.push_enabled}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </div>
            </div>
            
            {/* Zestawienie e-mail - tylko jeśli email_enabled jest zaznaczone */}
            {preferences.email_enabled && (
              <div className="border-t border-gray-200 pt-4">
                <label htmlFor="email_digest" className="block font-medium text-gray-700 mb-1">
                  Zestawienie e-mail
                </label>
                <p className="text-sm text-gray-500 mb-2">
                  Jak często chcesz otrzymywać zestawienie nowych powiadomień
                </p>
                <select
                  id="email_digest"
                  name="email_digest"
                  value={preferences.email_digest}
                  onChange={handleChange}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="daily">Codziennie</option>
                  <option value="weekly">Tygodniowo</option>
                  <option value="never">Nigdy (tylko pojedyncze powiadomienia)</option>
                </select>
              </div>
            )}
          </div>
          
          {/* Typy powiadomień */}
          <h2 className="text-lg font-medium text-gray-900 mt-8 mb-4">Typy powiadomień</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label htmlFor="type_preferences" className="font-medium text-gray-700">
                  Zaproszenia
                </label>
                <p className="text-sm text-gray-500">
                  Powiadomienia o zaproszeniach do grup
                </p>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="type_preferences"
                  name="type_preferences"
                  checked={preferences.type_preferences}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </div>
            </div>
            
            <div className="flex items-center justify-between border-t border-gray-200 pt-4">
              <div>
                <label htmlFor="type_preferences" className="font-medium text-gray-700">
                  Wiadomości
                </label>
                <p className="text-sm text-gray-500">
                  Powiadomienia o nowych wiadomościach
                </p>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="type_preferences"
                  name="type_preferences"
                  checked={preferences.type_preferences}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </div>
            </div>
            
            <div className="flex items-center justify-between border-t border-gray-200 pt-4">
              <div>
                <label htmlFor="notify_on_purchase" className="font-medium text-gray-700">
                  Zakupy
                </label>
                <p className="text-sm text-gray-500">
                  Powiadomienia o zakupach i płatnościach
                </p>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="notify_on_purchase"
                  name="notify_on_purchase"
                  checked={preferences.notify_on_purchase}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </div>
            </div>
            
            <div className="flex items-center justify-between border-t border-gray-200 pt-4">
              <div>
                <label htmlFor="notify_on_dispute" className="font-medium text-gray-700">
                  Spory
                </label>
                <p className="text-sm text-gray-500">
                  Powiadomienia o sporach i problemach
                </p>
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="notify_on_dispute"
                  name="notify_on_dispute"
                  checked={preferences.notify_on_dispute}
                  onChange={handleChange}
                  className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
          
          {/* Błąd */}
          {error && (
            <div className="mt-6 bg-red-50 border border-red-200 rounded-md p-4 text-sm text-red-600">
              {error}
            </div>
          )}
        </div>
        
        {/* Przyciski formularza */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className={`px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
              isSaving ? 'opacity-75 cursor-not-allowed' : ''
            }`}
          >
            {isSaving ? 'Zapisywanie...' : 'Zapisz preferencje'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default NotificationPreferencesForm;