// src/app/notifications/preferences/page.js
import NotificationPreferencesForm from '@/components/notifications/NotificationPreferencesForm';

export const metadata = {
  title: 'Preferencje powiadomień | GroupShare',
  description: 'Dostosuj ustawienia powiadomień na platformie GroupShare',
};

/**
 * Strona preferencji powiadomień użytkownika
 */
export default function NotificationPreferencesPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Preferencje powiadomień</h1>
        <p className="text-gray-600 mb-6">Dostosuj sposób otrzymywania powiadomień z platformy GroupShare.</p>
        
        <NotificationPreferencesForm />
      </div>
    </div>
  );
}