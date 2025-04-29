'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from '@/lib/utils/notification';

/**
 * Component that automatically marks notifications as read when navigating to a page
 * Use on pages that are notification targets
 * 
 * @param {Object} props - Component props
 * @param {string} props.entityType - Type of entity related to notification (e.g., 'purchase', 'group_invitation')
 * @param {string} props.entityId - ID of entity related to notification
 * @param {React.ReactNode} props.children - Child components
 * @param {boolean} props.showToast - Whether to show a toast notification when marking as read
 * @param {boolean} props.trackView - Whether to track view in analytics
 */
const NotificationAutoMark = ({ 
  entityType, 
  entityId, 
  children, 
  showToast = true,
  trackView = true
}) => {
  const searchParams = useSearchParams();
  const fromNotification = searchParams.get('from_notification') === 'true';
  
  useEffect(() => {
    // Only mark as read if:
    // 1. User came from a notification, or
    // 2. Entity type and ID are explicitly provided
    if ((fromNotification || (entityType && entityId)) && entityType && entityId) {
      const markNotificationsAsRead = async () => {
        try {
          // Use the new PATCH endpoint for marking entity-related notifications as read
          const response = await fetch('/api/notifications', {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
              entityType, 
              entityId 
            }),
          });
          
          if (!response.ok) {
            console.warn(`Failed to mark notifications as read for ${entityType}:${entityId}`);
            return;
          }
          
          const data = await response.json();
          
          if (data.success && showToast && fromNotification) {
            // Show user feedback
            toast.info('Oznaczono powiadomienia jako przeczytane', { 
              duration: 3000,
              position: 'bottom-right'
            });
          }
          
          // Track view if needed
          if (trackView) {
            try {
              await fetch('/api/notifications/track', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  entityType,
                  entityId,
                  markAsRead: false // Already marked as read above
                }),
              });
            } catch (trackError) {
              console.warn('Failed to track notification view:', trackError);
            }
          }
          
        } catch (error) {
          console.error('Error marking notifications as read:', error);
        }
      };
      
      markNotificationsAsRead();
    }
  }, [entityType, entityId, fromNotification, showToast, trackView]);
  
  // This component doesn't render anything, just passes through children
  return children;
};

export default NotificationAutoMark;