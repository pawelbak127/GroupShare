'use client';

import { useState } from 'react';
import Link from 'next/link';
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

/**
 * Komponent pojedynczego powiadomienia
 */
const NotificationItem = ({ notification, onMarkAsRead }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isMarkingRead, setIsMarkingRead] = useState(false);

  // Formatowanie daty do postaci "X minut temu"
  const formattedDate = notification.created_at
    ? formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: pl })
    : '';

  // Generowanie linku w zależności od typu powiadomienia
  const getNotificationLink = () => {
    if (!notification.related_entity_type || !notification.related_entity_id) {
      return '/notifications';
    }

    switch (notification.related_entity_type) {
      case 'group':
      case 'group_invitation':
        return `/groups/${notification.related_entity_id}`;
      case 'purchase':
        return `/purchases/${notification.related_entity_id}`;
      case 'dispute':
        return `/disputes/${notification.related_entity_id}`;
      case 'conversation':
        return `/messages/${notification.related_entity_id}`;
      default:
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
        return <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />;
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
    e.preventDefault();
    e.stopPropagation();
    
    if (notification.is_read || isMarkingRead) {
      return;
    }
    
    setIsMarkingRead(true);
    await onMarkAsRead(notification.id);
    setIsMarkingRead(false);
  };

  return (
    <li
      className={`${getNotificationColor()} relative`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Link
        href={getNotificationLink()}
        className="block p-4"
        onClick={notification.is_read ? undefined : handleMarkAsRead}
      >
        <div className="flex items-start">
          <div className="flex-shrink-0 mr-3">
            {getNotificationIcon()}
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">
              {notification.title}
            </div>
            <p className="text-sm text-gray-500 mt-1">{notification.content}</p>
            <p className="text-xs text-gray-400 mt-1">{formattedDate}</p>
          </div>
          
          {/* Wskaźnik nieprzeczytanego powiadomienia */}
          {!notification.is_read && (
            <span className="h-2 w-2 bg-indigo-600 rounded-full flex-shrink-0 ml-2 mt-2"></span>
          )}
        </div>
      </Link>
      
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