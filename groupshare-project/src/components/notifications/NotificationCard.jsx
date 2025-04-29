'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
    CheckIcon, 
    TrashIcon,
    EyeIcon
  } from '@heroicons/react/24/outline';
import { formatDistanceToNow, parseISO, format } from 'date-fns';
import { pl } from 'date-fns/locale';
import { toast } from '@/lib/utils/notification';
import { 
  getNotificationLink,
  getNotificationIconConfig,
  getNotificationBackgroundColor,
  getEntityBadgeConfig
} from '@/lib/utils/notification';
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
  const [isExpanded, setIsExpanded] = useState(false);
  const router = useRouter();

  // Date formatting
  const formattedDate = notification.created_at 
    ? formatDistanceToNow(parseISO(notification.created_at), { addSuffix: true, locale: pl }) 
    : '';
  
  // Full date for expanded view
  const fullDate = notification.created_at
    ? format(parseISO(notification.created_at), 'PPP HH:mm', { locale: pl })
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
        // If no link, just toggle expanded state
        setIsExpanded(!isExpanded);
      }
    } catch (error) {
      console.error('Error handling notification click:', error);
      
      // Toggle expanded state on error
      setIsExpanded(!isExpanded);
      
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

  // Get action button based on notification type
  const getActionButton = () => {
    // Only show action button if there's a link
    const link = getNotificationLink(notification);
    if (!link) return null;
    
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          router.push(link);
        }}
        className="mt-3 inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm leading-4 font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
      >
        <EyeIcon className="h-4 w-4 mr-1" />
        {getActionLabel()}
      </button>
    );
  };

  // Get action label based on notification type
  const getActionLabel = () => {
    switch (notification.type) {
      case 'purchase_completed':
      case 'purchase':
        return 'Zobacz szczegóły';
      case 'dispute':
      case 'dispute_filed':
      case 'dispute_created':
        return 'Przejdź do sporu';
      case 'invite':
        return 'Zobacz zaproszenie';
      case 'message':
        return 'Przejdź do wiadomości';
      case 'sale_completed':
        return 'Zobacz sprzedaż';
      default:
        return 'Szczegóły';
    }
  };

  return (
    <div
      className={`${getNotificationBackgroundColor(notification)} relative p-6 cursor-pointer transition-all duration-200 ${isExpanded ? 'border-l-4 border-indigo-500' : ''}`}
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
          
          <p className="mt-1 text-sm text-gray-600">
            {isExpanded 
              ? notification.content 
              : notification.content.length > 120
                ? `${notification.content.substring(0, 120)}...`
                : notification.content
            }
          </p>
          
          {/* Additional info */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {entityBadge && (
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-${entityBadge.color}-100 text-${entityBadge.color}-800`}>
                {entityBadge.text}
              </span>
            )}
            
            {!notification.is_read && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
                Nowe
              </span>
            )}
            
            {notification.priority === 'high' && (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                Ważne
              </span>
            )}
          </div>
          
          {/* Action button and expanded info */}
          {(isExpanded || isHovered) && (
            <div className="mt-3">
              {isExpanded && (
                <div className="mt-2 mb-3 text-xs text-gray-500">
                  <p>Data utworzenia: {fullDate}</p>
                  {notification.related_entity_type && notification.related_entity_id && (
                    <p className="mt-1">
                      Powiązana encja: {notification.related_entity_type} (ID: {notification.related_entity_id})
                    </p>
                  )}
                </div>
              )}
              
              {getActionButton()}
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