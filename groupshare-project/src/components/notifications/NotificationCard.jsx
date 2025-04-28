'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
    CheckIcon, 
    XMarkIcon as XIcon, 
    EnvelopeIcon as MailIcon, 
    TicketIcon, 
    ExclamationTriangleIcon as ExclamationIcon, 
    UserPlusIcon as UserAddIcon,
    TrashIcon
  } from '@heroicons/react/24/outline';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { toast } from '@/lib/utils/notification';

/**
 * Komponent karty pojedynczego powiadomienia
 */
const NotificationCard = ({ notification, onMarkAsRead, onDelete }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isMarkingRead, setIsMarkingRead] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  // Formatowanie daty
  const formattedDate = notification.created_at 
    ? formatDistanceToNow(parseISO(notification.created_at), { addSuffix: true, locale: pl }) 
    : '';

// Generowanie linku do odpowiedniego zasobu
const getNotificationLink = () => {
    if (!notification.related_entity_type || !notification.related_entity_id) {
      return null;
    }
  
    // Generowanie odpowiedniego URL na podstawie typu powiązanego zasobu
    switch (notification.related_entity_type) {
      case 'group':
        return `/groups/${notification.related_entity_id}?from_notification=true`;
      case 'group_invitation':
        return `/groups/${notification.related_entity_id}?from_notification=true`;
      case 'purchase':
        return `/purchases/${notification.related_entity_id}/details?from_notification=true`;
      case 'dispute':
        return `/disputes/${notification.related_entity_id}?from_notification=true`;
      case 'conversation':
        return `/messages/${notification.related_entity_id}?from_notification=true`;
      default:
        return null;
    }
  };

  // Pobieranie podstawowego URL na podstawie typu powiązanego zasobu
  const getBaseUrl = () => {
    switch (notification.related_entity_type) {
      case 'group':
        return `/groups/${notification.related_entity_id}`;
      case 'group_invitation':
        return `/groups/${notification.related_entity_id}`;
      case 'purchase':
        return `/purchases/${notification.related_entity_id}/details`;
      case 'dispute':
        return `/disputes/${notification.related_entity_id}`;
      case 'conversation':
        return `/messages/${notification.related_entity_id}`;
      default:
        return '/notifications'; // Przekierowanie domyślne, jeśli typ nie jest obsługiwany
    }
  };

  // Generowanie ikony w zależności od typu powiadomienia
  const getNotificationIcon = () => {
    switch (notification.type) {
      case 'invite':
        return <UserAddIcon className="h-6 w-6 text-indigo-500" />;
      case 'message':
        return <MailIcon className="h-6 w-6 text-blue-500" />;
      case 'purchase':
        return <TicketIcon className="h-6 w-6 text-green-500" />;
      case 'dispute':
        return <ExclamationIcon className="h-6 w-6 text-red-500" />;
      default:
        return <MailIcon className="h-6 w-6 text-gray-400" />;
    }
  };

  // Określenie koloru tła w zależności od stanu przeczytania i priorytetu
  const getBackgroundColor = () => {
    if (!notification.is_read) {
      return 'bg-indigo-50 hover:bg-indigo-100';
    }
    
    switch (notification.priority) {
      case 'high':
        return 'hover:bg-red-50';
      case 'low':
        return 'hover:bg-gray-50';
      default:
        return 'hover:bg-gray-50';
    }
  };

  // Obsługa kliknięcia w powiadomienie
const handleClick = async () => {
    // Pobierz link docelowy
    const link = getNotificationLink();
    console.log("Notification clicked, link:", link);
    
    try {
      // Najpierw oznaczamy jako przeczytane
      if (!notification.is_read) {
        await handleMarkAsRead();
      }
      
      // Przekierowanie, jeśli jest dokąd
      if (link) {
        console.log("Redirecting to:", link);
        router.push(link);
      } else {
        // Jeśli nie ma linku, pokażmy informację
        console.log("No link available for notification");
        toast.info('Nie można otworzyć szczegółów tego powiadomienia');
      }
    } catch (error) {
      console.error('Error handling notification click:', error);
      
      // Przekieruj nawet jeśli wystąpił błąd z oznaczaniem jako przeczytane
      if (link) {
        console.log("Redirecting despite error:", link);
        router.push(link);
      }
    }
  };

  // Obsługa oznaczania jako przeczytane
  const handleMarkAsRead = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    if (notification.is_read || isMarkingRead) {
      return;
    }
    
    setIsMarkingRead(true);
    try {
      await onMarkAsRead(notification.id);
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast.error('Nie udało się oznaczyć powiadomienia jako przeczytane');
    } finally {
      setIsMarkingRead(false);
    }
  };

  // Obsługa usuwania powiadomienia
  const handleDelete = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isDeleting) {
      return;
    }
    
    if (confirm('Czy na pewno chcesz usunąć to powiadomienie?')) {
      setIsDeleting(true);
      try {
        await onDelete(notification.id);
        toast.success('Powiadomienie zostało usunięte');
      } catch (error) {
        console.error('Error deleting notification:', error);
        toast.error('Nie udało się usunąć powiadomienia');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <div
      className={`${getBackgroundColor()} relative p-6 cursor-pointer`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
    >
      <div className="flex items-start">
        {/* Ikona typu */}
        <div className="flex-shrink-0 mr-4">
          {getNotificationIcon()}
        </div>
        
        {/* Treść */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className={`text-md font-medium ${notification.is_read ? 'text-gray-900' : 'text-indigo-700'}`}>
              {notification.title}
            </h4>
            <span className="text-sm text-gray-500 ml-2 whitespace-nowrap">{formattedDate}</span>
          </div>
          
          <p className="mt-1 text-sm text-gray-600">{notification.content}</p>
          
          {/* Dodatkowe informacje */}
          {notification.related_entity_type && (
            <div className="mt-2 flex items-center">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                notification.priority === 'high' ? 'bg-red-100 text-red-800' :
                notification.priority === 'low' ? 'bg-gray-100 text-gray-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {notification.related_entity_type === 'group_invitation' ? 'Zaproszenie' :
                 notification.related_entity_type === 'purchase' ? 'Zakup' :
                 notification.related_entity_type === 'dispute' ? 'Spór' :
                 notification.related_entity_type === 'conversation' ? 'Wiadomość' :
                 notification.related_entity_type}
              </span>
              
              {!notification.is_read && (
                <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                  Nowe
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      
      {/* Przyciski akcji - widoczne przy najechaniu */}
      {isHovered && (
        <div className="absolute top-4 right-4 flex space-x-2">
          {!notification.is_read && (
            <button
              onClick={handleMarkAsRead}
              disabled={isMarkingRead}
              className="p-1.5 rounded-full bg-white border border-gray-300 text-gray-500 hover:text-indigo-600 hover:border-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              title="Oznacz jako przeczytane"
            >
              {isMarkingRead ? (
                <div className="h-5 w-5 border-t-2 border-b-2 border-indigo-500 rounded-full animate-spin"></div>
              ) : (
                <CheckIcon className="h-5 w-5" />
              )}
            </button>
          )}
          
          <button
            onClick={handleDelete}
            disabled={isDeleting}
            className="p-1.5 rounded-full bg-white border border-gray-300 text-gray-500 hover:text-red-600 hover:border-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
            title="Usuń powiadomienie"
          >
            {isDeleting ? (
              <div className="h-5 w-5 border-t-2 border-b-2 border-red-500 rounded-full animate-spin"></div>
            ) : (
              <TrashIcon className="h-5 w-5" />
            )}
          </button>
        </div>
      )}
    </div>
  );
};

export default NotificationCard;