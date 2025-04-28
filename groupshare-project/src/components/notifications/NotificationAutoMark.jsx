'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Komponent automatycznie oznaczający powiadomienia jako przeczytane po przejściu do strony.
 * Należy go używać na stronach, które są celem powiadomień.
 * 
 * @param {Object} props - Właściwości komponentu
 * @param {string} props.entityType - Typ encji powiązanej z powiadomieniem (np. 'purchase', 'group_invitation')
 * @param {string} props.entityId - ID encji powiązanej z powiadomieniem
 * @param {React.ReactNode} props.children - Dzieci komponentu
 */
const NotificationAutoMark = ({ entityType, entityId, children }) => {
  const searchParams = useSearchParams();
  const fromNotification = searchParams.get('from_notification') === 'true';
  
  useEffect(() => {
    // Oznacz powiadomienia jako przeczytane tylko jeśli użytkownik przyszedł z powiadomienia
    // lub jeśli dostarczono jawnie typ i ID encji
    if ((fromNotification || (entityType && entityId)) && entityType && entityId) {
      const markNotificationsAsRead = async () => {
        try {
          // Pobierz wszystkie powiadomienia związane z tą encją
          const response = await fetch(
            `/api/notifications?relatedEntityType=${encodeURIComponent(entityType)}&relatedEntityId=${encodeURIComponent(entityId)}`
          );
          
          if (!response.ok) return;
          
          const data = await response.json();
          
          if (!data.notifications || data.notifications.length === 0) return;
          
          // Filtruj tylko nieprzeczytane powiadomienia
          const unreadNotifications = data.notifications
            .filter(notification => !notification.is_read)
            .map(notification => notification.id);
          
          if (unreadNotifications.length === 0) return;
          
          // Oznacz wszystkie znalezione powiadomienia jako przeczytane
          await fetch('/api/notifications', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ ids: unreadNotifications }),
          });
          
          console.log(`Marked ${unreadNotifications.length} notifications as read for ${entityType}:${entityId}`);
        } catch (error) {
          console.error('Error marking notifications as read:', error);
        }
      };
      
      markNotificationsAsRead();
    }
  }, [entityType, entityId, fromNotification]);
  
  // Ten komponent nie renderuje żadnego elementu, tylko przepuszcza dzieci
  return children;
};

export default NotificationAutoMark;