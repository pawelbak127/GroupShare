'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import NotificationRealtime from './NotificationRealtime';
import { toast } from '@/lib/utils/notification';

// Tworzenie kontekstu powiadomień
const NotificationContext = createContext(null);

/**
 * Provider kontekstu dla systemu powiadomień
 */
export const NotificationProvider = ({ children }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { isSignedIn, isLoaded } = useUser();

  // Pobierz licznik nieprzeczytanych powiadomień
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
    }
  }, [isSignedIn, isLoaded]);

  // Pobierz ostatnie powiadomienia
  const fetchRecentNotifications = async () => {
    if (!isSignedIn) return;
    
    try {
      const response = await fetch('/api/notifications?pageSize=10');
      
      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }
      
      const data = await response.json();
      setNotifications(data.notifications || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  // Obsługa nowego powiadomienia
  const handleNewNotification = (notification) => {
    // Zwiększ licznik nieprzeczytanych
    setUnreadCount(prev => prev + 1);
    
    // Dodaj do listy powiadomień
    setNotifications(prev => [notification, ...prev.slice(0, 9)]);
    
    // Odśwież dane, jeśli jesteśmy na stronie powiadomień
    if (router.pathname === '/notifications') {
      router.refresh();
    }
  };

  // Obsługa aktualizacji powiadomienia
  const handleNotificationUpdate = (updatedNotification) => {
    // Aktualizuj lokalną listę
    setNotifications(prev => 
      prev.map(notification => 
        notification.id === updatedNotification.id ? updatedNotification : notification
      )
    );
    
    // Aktualizuj licznik nieprzeczytanych
    if (updatedNotification.is_read) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    
    // Odśwież dane, jeśli jesteśmy na stronie powiadomień
    if (router.pathname === '/notifications') {
      router.refresh();
    }
  };

  // Oznacz wszystkie jako przeczytane
  const markAllAsRead = async () => {
    if (!isSignedIn) return;
    
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
      
      // Aktualizuj stan
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      
      // Odśwież stronę, jeśli jesteśmy na /notifications
      if (router.pathname === '/notifications') {
        router.refresh();
      }
      
      return true;
    } catch (error) {
      console.error('Error marking all as read:', error);
      toast.error('Nie udało się oznaczyć powiadomień jako przeczytane');
      return false;
    }
  };

  // Wartość kontekstu
  const value = {
    unreadCount,
    setUnreadCount,
    notifications,
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
 * Hook do używania kontekstu powiadomień
 */
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};