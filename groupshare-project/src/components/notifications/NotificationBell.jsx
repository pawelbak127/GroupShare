'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { BellIcon } from '@heroicons/react/24/outline';
import { BellAlertIcon } from '@heroicons/react/24/solid';
import NotificationDropdown from './NotificationDropdown.jsx';
import { toast } from '@/lib/utils/notification';

/**
 * Komponent dzwonka powiadomień z licznikiem nieprzeczytanych powiadomień
 */
const NotificationBell = () => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isOpen, setIsOpen] = useState(false);
  const [recentNotifications, setRecentNotifications] = useState([]);
  const dropdownRef = useRef(null);
  const router = useRouter();

  // Pobierz liczbę nieprzeczytanych powiadomień przy montowaniu komponentu
  useEffect(() => {
    const fetchUnreadCount = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        const response = await fetch('/api/notifications/count');
        if (!response.ok) {
          throw new Error('Failed to fetch unread count');
        }
        
        const data = await response.json();
        setUnreadCount(data.count || 0);
      } catch (err) {
        console.error('Error fetching unread count:', err);
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUnreadCount();
    
    // Ustaw interwał odświeżania co 30 sekund
    const intervalId = setInterval(fetchUnreadCount, 30000);
    
    return () => clearInterval(intervalId);
  }, []);

  // Efekt dla zamykania dropdown po kliknięciu poza komponentem
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Pobierz ostatnie powiadomienia gdy dropdown jest otwarty
  useEffect(() => {
    if (isOpen) {
      fetchRecentNotifications();
    }
  }, [isOpen]);

  // Funkcja pobierająca ostatnie powiadomienia
  const fetchRecentNotifications = async () => {
    try {
      const response = await fetch('/api/notifications?pageSize=10');
      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }
      
      const data = await response.json();
      setRecentNotifications(data.notifications || []);
    } catch (err) {
      console.error('Error fetching recent notifications:', err);
      toast.error('Nie udało się pobrać powiadomień');
    }
  };

  // Obsługa kliknięcia w dzwonek
  const handleBellClick = () => {
    setIsOpen(!isOpen);
  };

  // Przejście do strony wszystkich powiadomień
  const handleViewAllClick = () => {
    setIsOpen(false);
    router.push('/notifications');
  };

  // Oznaczenie wszystkich jako przeczytane
  const handleMarkAllAsRead = async () => {
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

      // Aktualizuj stan komponentu
      setUnreadCount(0);
      setRecentNotifications(prevNotifications => 
        prevNotifications.map(notif => ({ ...notif, is_read: true }))
      );
      
      toast.success('Wszystkie powiadomienia oznaczone jako przeczytane');
    } catch (err) {
      console.error('Error marking all as read:', err);
      toast.error('Nie udało się oznaczyć powiadomień jako przeczytane');
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Ikona dzwonka z licznikiem */}
      <button
        className="p-1 rounded-full text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        onClick={handleBellClick}
        aria-label={`Powiadomienia${unreadCount > 0 ? ` (${unreadCount} nieprzeczytanych)` : ''}`}
      >
        <div className="relative">
          {unreadCount > 0 ? (
            <BellAlertIcon className="h-6 w-6 text-indigo-600" />
          ) : (
            <BellIcon className="h-6 w-6" />
          )}
          
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center rounded-full bg-red-500 text-white text-xs">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
      </button>

      {/* Dropdown z powiadomieniami */}
      {isOpen && (
        <NotificationDropdown
          notifications={recentNotifications}
          isLoading={isLoading}
          onViewAllClick={handleViewAllClick}
          onMarkAllAsRead={handleMarkAllAsRead}
          onRefresh={fetchRecentNotifications}
          setUnreadCount={setUnreadCount}
        />
      )}
    </div>
  );
};

export default NotificationBell;