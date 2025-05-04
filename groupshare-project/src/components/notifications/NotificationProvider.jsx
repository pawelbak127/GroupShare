'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import NotificationRealtime from './NotificationRealtime';
import { toast } from '@/lib/utils/notification';

// Utwórz kontekst powiadomień
const NotificationContext = createContext(null);

/**
 * Uproszczony provider dla systemu powiadomień (MVP)
 */
export const NotificationProvider = ({ children }) => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(0);
  const router = useRouter();
  const pathname = usePathname();
  const { isSignedIn, isLoaded } = useUser();

  // Pobierz liczbę nieprzeczytanych powiadomień
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
      
      // Ustaw okresowe odświeżanie
      const refreshInterval = setInterval(() => {
        if (isSignedIn) {
          fetchUnreadCount();
        }
      }, 60000); // Odświeżaj co minutę
      
      return () => clearInterval(refreshInterval);
    }
  }, [isSignedIn, isLoaded]);

  // Pobierz ostatnie powiadomienia (zmemoryzowana funkcja)
  const fetchRecentNotifications = useCallback(async () => {
    if (!isSignedIn) return;
    
    // Ogranicz odświeżanie, aby uniknąć zbyt wielu wywołań API
    const now = Date.now();
    if (now - lastRefresh < 10000) { // 10 sekund cooldown
      console.log('Ograniczam odświeżanie powiadomień');
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

  // Obsłuż nowe powiadomienie
  const handleNewNotification = useCallback((notification) => {
    // Zwiększ licznik nieprzeczytanych
    setUnreadCount(prev => prev + 1);
    
    // Dodaj do listy powiadomień
    setNotifications(prev => {
      // Sprawdź, czy już jest na liście (unikaj duplikatów)
      const exists = prev.some(n => n.id === notification.id);
      if (exists) return prev;
      
      // Dodaj na początek listy
      return [notification, ...prev.slice(0, 9)];
    });
    
    // Pokaż toast z powiadomieniem
    const toastMessage = notification.title;
    toast.info(toastMessage, {
      duration: 5000,
      position: 'top-right',
      icon: '🔔',
      onClick: () => {
        // Obsłuż kliknięcie w toast
        try {
          // Oznacz jako przeczytane
          fetch(`/api/notifications/${notification.id}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ is_read: true }),
          });
          
          // Przekieruj do odpowiedniej strony na podstawie typu powiadomienia
          if (notification.related_entity_type && notification.related_entity_id) {
            let link;
            
            // Proste mapowanie typu encji na URL
            switch (notification.related_entity_type) {
              case 'purchase_record':
                link = `/purchases/${notification.related_entity_id}/details?from_notification=true`;
                break;
              case 'conversation':
                link = `/conversations/${notification.related_entity_id}?from_notification=true`;
                break;
              case 'group_invitation':
                link = `/groups/invitations/${notification.related_entity_id}?from_notification=true`;
                break;
              case 'dispute':
                link = `/disputes/${notification.related_entity_id}?from_notification=true`;
                break;
              default:
                link = '/notifications';
            }
            
            if (link) router.push(link);
          }
        } catch (error) {
          console.error('Error handling toast click:', error);
        }
      }
    });
    
    // Odśwież stronę, jeśli jesteśmy na stronie powiadomień
    if (pathname === '/notifications') {
      router.refresh();
    }
  }, [pathname, router]);

  // Obsłuż aktualizację powiadomienia
  const handleNotificationUpdate = useCallback((updatedNotification) => {
    // Zaktualizuj lokalną listę
    setNotifications(prev => {
      const index = prev.findIndex(n => n.id === updatedNotification.id);
      if (index === -1) return prev;
      
      // Utwórz nową tablicę z zaktualizowanym powiadomieniem
      const newNotifications = [...prev];
      newNotifications[index] = updatedNotification;
      return newNotifications;
    });
    
    // Zaktualizuj licznik nieprzeczytanych, jeśli powiadomienie zostało oznaczone jako przeczytane
    if (updatedNotification.is_read) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }
    
    // Odśwież stronę, jeśli jesteśmy na stronie powiadomień
    if (pathname === '/notifications') {
      router.refresh();
    }
  }, [pathname, router]);

  // Oznacz wszystkie jako przeczytane (zmemoryzowana funkcja)
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
      
      // Zaktualizuj stan
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      
      // Odśwież stronę, jeśli jesteśmy na stronie powiadomień
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
 * Hook do użycia kontekstu powiadomień
 */
export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};