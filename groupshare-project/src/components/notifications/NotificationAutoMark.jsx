'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from '@/lib/utils/notification';

/**
 * Component that automatically marks notifications as read when navigating to a page
 * Use on pages that are notification targets
 * Includes improved error handling and retry logic
 * 
 * @param {Object} props - Component props
 * @param {string} props.entityType - Type of entity related to notification (e.g., 'purchase', 'group_invitation')
 * @param {string} props.entityId - ID of entity related to notification
 * @param {React.ReactNode} props.children - Child components
 * @param {boolean} props.showToast - Whether to show a toast notification when marking as read
 * @param {boolean} props.trackView - Whether to track view in analytics
 * @param {number} props.maxRetries - Maximum number of retries on failure
 */
const NotificationAutoMark = ({ 
  entityType, 
  entityId, 
  children, 
  showToast = true,
  trackView = true,
  maxRetries = 3
}) => {
  const searchParams = useSearchParams();
  const fromNotification = searchParams.get('from_notification') === 'true';
  const [isProcessing, setIsProcessing] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  
  // Memoize the marking function to avoid unnecessary re-renders
  const markNotificationsAsRead = useCallback(async () => {
    // Don't try multiple times simultaneously
    if (isProcessing) return;
    
    // Only mark as read if:
    // 1. User came from a notification, or
    // 2. Entity type and ID are explicitly provided
    if ((fromNotification || (entityType && entityId)) && entityType && entityId) {
      try {
        setIsProcessing(true);
        
        // Use the PATCH endpoint for marking entity-related notifications as read
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
          // For server errors (5xx), we can retry
          if (response.status >= 500 && retryCount < maxRetries) {
            // Exponential backoff for retries
            const retryDelay = Math.min(2000 * Math.pow(2, retryCount), 10000);
            console.warn(`Failed to mark notifications as read, retrying in ${retryDelay}ms...`);
            
            setTimeout(() => {
              setRetryCount(prev => prev + 1);
              setIsProcessing(false);
            }, retryDelay);
            return;
          }
          
          throw new Error(`Failed to mark notifications as read: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success && showToast && fromNotification) {
          // Show user feedback
          toast.info('Oznaczono powiadomienia jako przeczytane', { 
            duration: 3000,
            position: 'bottom-right'
          });
        }
        
        // Track view if needed - with fallback
        if (trackView) {
          try {
            const trackResponse = await fetch('/api/notifications/track', {
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
            
            if (!trackResponse.ok) {
              console.warn('Failed to track notification view:', await trackResponse.text());
            }
          } catch (trackError) {
            console.warn('Failed to track notification view:', trackError);
            
            // Simple direct fallback for tracking views
            try {
              // Direct insert to analytics table if available
              fetch('/api/analytics/log-event', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  event_type: 'notification_view',
                  resource_type: entityType,
                  resource_id: entityId
                })
              }).catch(e => console.warn('Fallback analytics also failed:', e));
            } catch (fallbackError) {
              // Just log the failure but continue
              console.warn('Fallback tracking also failed:', fallbackError);
            }
          }
        }
      } catch (error) {
        console.error('Error marking notifications as read:', error);
        
        // If we're under max retries, try again
        if (retryCount < maxRetries) {
          const retryDelay = Math.min(2000 * Math.pow(2, retryCount), 10000);
          console.warn(`Failed to mark notifications as read, retrying in ${retryDelay}ms...`);
          
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
            setIsProcessing(false);
          }, retryDelay);
          return;
        }
      } finally {
        if (retryCount >= maxRetries) {
          // If we've tried max times, give up but don't show an error to the user
          // as this is a non-critical functionality
          console.warn(`Failed to mark notifications as read after ${maxRetries} attempts`);
        }
        setIsProcessing(false);
      }
    }
  }, [entityType, entityId, fromNotification, showToast, trackView, retryCount, isProcessing, maxRetries]);
  
  // Try to mark notifications as read when component mounts or search params change
  useEffect(() => {
    markNotificationsAsRead();
  }, [markNotificationsAsRead]);
  
  // Also retry if the retry count changes
  useEffect(() => {
    if (retryCount > 0 && !isProcessing) {
      markNotificationsAsRead();
    }
  }, [retryCount, isProcessing, markNotificationsAsRead]);
  
  // This component doesn't render anything, just passes through children
  return children;
};

export default NotificationAutoMark;