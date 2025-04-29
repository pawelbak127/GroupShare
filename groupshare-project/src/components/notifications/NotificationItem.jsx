'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  CheckIcon, 
  XMarkIcon, 
  EnvelopeIcon, 
  TicketIcon, 
  ExclamationTriangleIcon, 
  UserPlusIcon 
} from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
import { pl } from 'date-fns/locale';
import { toast } from '@/lib/utils/notification';

/**
 * Komponent pojedynczego powiadomienia w rozwijanym menu
 */
const NotificationItem = ({ notification, onMarkAsRead, closeDropdown }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isMarkingRead, setIsMarkingRead] = useState(false);
  const router = useRouter();
  
  // Formatowanie daty do postaci "X minut temu"
  const formattedDate = notification.created_at
    ? formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: pl })
    : '';

  // Generowanie linku w zależności od typu powiadomienia
  const getNotificationLink = () => {
    if (!notification.related_entity_type || !notification.related_entity_id) {
      console.warn("Brak related_entity_type lub related_entity_id w powiadomieniu:", notification);
      return '/notifications';
    }

    // Dodaj parametr from_notification=true do URL
    switch (notification.related_entity_type) {
      case 'group':
        return `/groups/${notification.related_entity_id}?from_notification=true`;
      case 'group_invitation':
        // W przypadku zaproszenia, używamy kodu zaproszenia w URL
        return `/groups/join?code=${notification.related_entity_id}&from_notification=true`;
      case 'purchase':
      case 'purchase_record': // Obsługa purchase_record z bazy danych
        return `/purchases/${notification.related_entity_id}/details?from_notification=true`;
      case 'dispute':
        return `/disputes/${notification.related_entity_id}?from_notification=true`;
      case 'transaction':
        // Dla transakcji, przekierowujemy do szczegółów zakupu, ale z parametrem transactionId=true
        return `/purchases/${notification.related_entity_id}/details?transactionId=true&from_notification=true`;
      case 'conversation':
        return `/messages/${notification.related_entity_id}?from_notification=true`;
      default:
        console.warn(`Nieobsługiwany typ encji w powiadomieniu: ${notification.related_entity_type}`, notification);
        return '/notifications';
    }
  };

  // Generowanie ikony w zależności od typu powiadomienia
  const getNotificationIcon = () => {
    switch (notification.type) {
      case 'invite':
        return <UserPlusIcon className="h-5 w-5 text-indigo-500" />;
      case 'message':
        return <EnvelopeIcon className="h-5 w-5 text-blue-500" />;
      case 'purchase':
        return <TicketIcon className="h-5 w-5 text-green-500" />;
      case 'dispute':
      case 'dispute_filed':
      case 'dispute_created':
        return <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />;
      case 'payment':
        return <TicketIcon className="h-5 w-5 text-green-500" />;
      case 'access':
        return <EnvelopeIcon className="h-5 w-5 text-blue-500" />;
      default:
        return <EnvelopeIcon className="h-5 w-5 text-gray-400" />;
    }
  };

  // Generowanie koloru dla powiadomienia w zależności od priorytetu
  const getNotificationColor = () => {
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
    } finally {
      setIsMarkingRead(false);
    }
  };
  
  // Obsługa kliknięcia na powiadomienie
  const handleNotificationClick = async (e) => {
    e.preventDefault();
    console.log("Kliknięcie w powiadomienie z dropdown:", notification);
    
    // Pobierz link docelowy
    const link = getNotificationLink();
    console.log("Link docelowy:", link);
    
    try {
      // Najpierw oznaczamy jako przeczytane jeśli trzeba
      if (!notification.is_read) {
        await handleMarkAsRead(e);
      }
      
      // Zamknij dropdown
      if (typeof closeDropdown === 'function') {
        closeDropdown();
      }
      
      // Przekieruj na odpowiednią stronę
      console.log("Przekierowuję do:", link);
      router.push(link);
    } catch (error) {
      console.error('Błąd podczas obsługi kliknięcia w powiadomienie:', error);
      
      // Zamknij dropdown nawet w przypadku błędu
      if (typeof closeDropdown === 'function') {
        closeDropdown();
      }
      
      // Przekieruj mimo błędu
      router.push(link);
    }
  };

  return (
    <li
      className={`${getNotificationColor()} relative`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div 
        className="block p-4 cursor-pointer" 
        onClick={handleNotificationClick}
      >
        <div className="flex items-start">
          <div className="flex-shrink-0 mr-3">
            {getNotificationIcon()}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">
              {notification.title}
            </div>
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{notification.content}</p>
            <p className="text-xs text-gray-400 mt-1">{formattedDate}</p>
          </div>
          
          {/* Wskaźnik nieprzeczytanego powiadomienia */}
          {!notification.is_read && (
            <span className="h-2 w-2 bg-indigo-600 rounded-full flex-shrink-0 ml-2 mt-2"></span>
          )}
        </div>
      </div>
      
      {/* Przycisk oznaczenia jako przeczytane */}
      {isHovered && !notification.is_read && (
        <button
          className="absolute top-2 right-2 p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-200"
          onClick={handleMarkAsRead}
          disabled={isMarkingRead}
          title="Oznacz jako przeczytane"
        >
          {isMarkingRead ? (
            <div className="h-4 w-4 border-t-2 border-b-2 border-gray-500 rounded-full animate-spin"></div>
          ) : (
            <CheckIcon className="h-4 w-4" />
          )}
        </button>
      )}
    </li>
  );
};

export default NotificationItem;