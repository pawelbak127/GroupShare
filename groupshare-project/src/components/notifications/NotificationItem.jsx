'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  CheckIcon, 
  XMarkIcon
} from '@heroicons/react/24/outline';
import { formatDistanceToNow } from 'date-fns';
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
 * Component for a single notification item in dropdown
 */
const NotificationItem = ({ notification, onMarkAsRead, closeDropdown }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isMarkingRead, setIsMarkingRead] = useState(false);
  const router = useRouter();
  
  // Format date as "X minutes ago"
  const formattedDate = notification.created_at
    ? formatDistanceToNow(new Date(notification.created_at), { addSuffix: true, locale: pl })
    : '';

  // Get notification icon config
  const iconConfig = getNotificationIconConfig(notification.type);

  // Get notification background color
  const backgroundColor = getNotificationBackgroundColor(notification);

  // Handle notification click
  const handleNotificationClick = async (e) => {
    e.preventDefault();
    console.log("Clicking on notification from dropdown:", notification);
    
    // Get target link
    const link = getNotificationLink(notification);
    console.log("Target link:", link);
    
    try {
      // First mark as read if needed
      if (!notification.is_read) {
        await handleMarkAsRead(e);
      }
      
      // Close dropdown
      if (typeof closeDropdown === 'function') {
        closeDropdown();
      }
      
      // Redirect to appropriate page
      console.log("Redirecting to:", link);
      router.push(link);
    } catch (error) {
      console.error('Error handling notification click:', error);
      
      // Close dropdown even on error
      if (typeof closeDropdown === 'function') {
        closeDropdown();
      }
      
      // Redirect anyway
      router.push(link);
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
    } finally {
      setIsMarkingRead(false);
    }
  };

  // Get entity badge (if needed)
  const entityBadge = notification.related_entity_type 
    ? getEntityBadgeConfig(notification.related_entity_type)
    : null;

  return (
    <li
      className={`${backgroundColor} relative`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div 
        className="block p-4 cursor-pointer" 
        onClick={handleNotificationClick}
      >
        <div className="flex items-start">
          <div className="flex-shrink-0 mr-3">
            <DynamicIcon name={iconConfig.name} className={`h-5 w-5 text-${iconConfig.color}`} />
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-gray-900 truncate">
              {notification.title}
            </div>
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{notification.content}</p>
            <p className="text-xs text-gray-400 mt-1">{formattedDate}</p>
            
            {/* Display entity badge if applicable */}
            {entityBadge && (
              <div className="mt-1">
                <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-${entityBadge.color}-100 text-${entityBadge.color}-800`}>
                  {entityBadge.text}
                </span>
              </div>
            )}
          </div>
          
          {/* Unread indicator */}
          {!notification.is_read && (
            <span className="h-2 w-2 bg-indigo-600 rounded-full flex-shrink-0 ml-2 mt-2"></span>
          )}
        </div>
      </div>
      
      {/* Mark as read button */}
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