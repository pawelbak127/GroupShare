'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import NotificationRealtime from './NotificationRealtime';
import { toast } from '@/lib/utils/notification';

// Create notifications context
const NotificationContext = createContext(null);

/**
 * Provider for the notification system
 */
export const NotificationProvider = ({ children }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  const { isSignedIn, isLoaded } = useUser();

  // Fetch unread count
  useEffect(() => {
    const fetchUnreadCount = async () => {
      if (!isSignedIn || !isLoaded) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const response = await fetch('/api/notifications/count');
        
        if (!response.ok) {
          throw new Error('Failed to fetch notification count');
        }
        
        const data = await response.json();
        setUnreadCount(data.count || 0);
      } catch (error) {
        console.error('Error fetching unread count:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (isLoaded) {
      fetchUnreadCount();
      
      // Set up periodic refresh
      const refreshInterval = setInterval(() => {
        if (isSignedIn) {
          fetchUnreadCount();
        }
      }, 60000); // Refresh every minute
      
      return () => clearInterval(refreshInterval);
    }
  }, [isSignedIn, isLoaded]);

  // Fetch recent notifications (memoized)
  const fetchRecentNotifications = useCallback(async () => {
    if (!isSignedIn) return;
    
    // Throttle refreshes to avoid excessive API calls
    const now = Date.now();
    if (now - lastRefresh < 10000) { // 10 second cooldown
      console.log('Throttling notification refresh');
      return;
    }
    
    try {
      setIsLoading(true);
      const response = await fetch('/api/notifications?pageSize=10');
      
      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }
      
      const data = await response.json();
      setNotifications(data.notifications || []);
      setLastRefresh(now);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    } finally {
      setIsLoading(false);
    }
  }, [isSignedIn, lastRefresh]);

  // Handle new notification
  const handleNewNotification = useCallback((notification) => {
    // Increase unread count
    setUnreadCount(prev => prev + 1);
    
    // Add to notifications list
    setNotifications(prev => [notification, ...prev.slice(0, 9)]);
    
    // Refresh page if we're on the notifications page
    if (pathname === '/notifications') {
      router.refresh();
    }
  }, [pathname, router]);

  // Handle notification update
  const handleNotificationUpdate = useCallback((updatedNotification) => {
    // Update local list
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === updatedNotification.id ? updatedNotification : notification
      )
    );
    
    // Update unread count if notification was marked as read
    if (updatedNotification.is_read) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    
    // Refresh page if we're on the notifications page
    if (pathname === '/notifications') {
      router.refresh();
    }
  }, [pathname, router]);

  // Mark all as read (memoized)
  const markAllAsRead = useCallback(async () => {
    if (!isSignedIn) return false;
    
    try {
      const response = await fetch('/api/notifications', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ all: true }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to mark notifications as read');
      }
      
      // Update state
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      
      // Refresh page if we're on the notifications page
      if (pathname === '/notifications') {
        router.refresh();
      }
      
      return true;
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('Nie udało się oznaczyć powiadomień jako przeczytane');
      return false;
    }
  }, [isSignedIn, pathname, router]);

  // Context value
  const value = {
    unreadCount,
    setUnreadCount,
    notifications,
    setNotifications,
    isLoading,
    fetchRecentNotifications,
    markAllAsRead
  };

  return (
    <NotificationContext.Provider value={value}>
      <NotificationRealtime
        onNewNotification={handleNewNotification}
        onNotificationUpdate={handleNotificationUpdate}
      >
        {children}
      </NotificationRealtime>
    </NotificationContext.Provider>
  );
};

/**
 * Hook to use the notifications context
 */
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};