'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
    CheckIcon, 
    TrashIcon 
  } from '@heroicons/react/24/outline';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { pl } from 'date-fns/locale';
import { toast } from '@/lib/utils/notification';
import { 
  getNotificationLink,
  getNotificationIconConfig,
  getNotificationBackgroundColor,
  getEntityBadgeConfig
} from '@/lib/utils/notification-utils';
import dynamic from 'next/dynamic';

// Dynamically import icons to reduce bundle size
const DynamicIcon = ({ name, className }) => {
  const Icon = dynamic(() => 
    import('@heroicons/react/24/outline').then((mod) => mod[name + 'Icon'])
  );
  return <Icon className={className} />;
};

/**
 * Component for a single notification card
 */
const NotificationCard = ({ notification, onMarkAsRead, onDelete }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isMarkingRead, setIsMarkingRead] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  // Date formatting
  const formattedDate = notification.created_at 
    ? formatDistanceToNow(parseISO(notification.created_at), { addSuffix: true, locale: pl }) 
    : '';

  // Get icon config
  const iconConfig = getNotificationIconConfig(notification.type);

  // Handle click on notification
  const handleClick = async () => {
    // Get target link
    const link = getNotificationLink(notification);
    console.log("Clicking on notification:", notification);
    
    try {
      // First mark as read if needed
      if (!notification.is_read) {
        await handleMarkAsRead();
      }
      
      // Redirect if there's a link
      if (link) {
        console.log("Redirecting to:", link);
        router.push(link);
      } else {
        // Show info if no link
        console.log("No available link for notification");
        toast.info('Nie można otworzyć szczegółów tego powiadomienia');
      }
    } catch (error) {
      console.error('Error handling notification click:', error);
      
      // Redirect anyway if there's a link, even if marking as read failed
      if (link) {
        console.log("Redirecting despite error:", link);
        router.push(link);
      }
    }
  };

  // Handle marking as read
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

  // Handle deleting notification
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

  // Get entity badge config if there's a related entity
  const entityBadge = notification.related_entity_type 
    ? getEntityBadgeConfig(notification.related_entity_type)
    : null;

  return (
    <div
      className={`${getNotificationBackgroundColor(notification)} relative p-6 cursor-pointer`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={handleClick}
    >
      <div className="flex items-start">
        {/* Type icon */}
        <div className="flex-shrink-0 mr-4">
          <DynamicIcon name={iconConfig.name} className={`h-6 w-6 text-${iconConfig.color}`} />
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className={`text-md font-medium ${notification.is_read ? 'text-gray-900' : 'text-indigo-700'}`}>
              {notification.title}
            </h4>
            <span className="text-sm text-gray-500 ml-2 whitespace-nowrap">{formattedDate}</span>
          </div>
          
          <p className="mt-1 text-sm text-gray-600">{notification.content}</p>
          
          {/* Additional info */}
          {entityBadge && (
            <div className="mt-2 flex items-center">
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${entityBadge.color}-100 text-${entityBadge.color}-800`}>
                {entityBadge.text}
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
      
      {/* Action buttons - visible on hover */}
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