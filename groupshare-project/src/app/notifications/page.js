// src/app/notifications/page.js
import NotificationsPage from '@/components/notifications/NotificationsPage';

export const metadata = {
  title: 'Powiadomienia | GroupShare',
  description: 'Zarządzaj swoimi powiadomieniami na platformie GroupShare',
};

/**
 * Strona wyświetlająca wszystkie powiadomienia użytkownika
 */
export default function Notifications() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Powiadomienia</h1>
        <NotificationsPage />
      </div>
    </div>
  );
}