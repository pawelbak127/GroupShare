'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
    ArrowPathIcon as RefreshIcon, 
    CheckIcon, 
    ArrowRightIcon 
  } from '@heroicons/react/24/outline';
import NotificationItem from './NotificationItem';
import { toast } from '@/lib/utils/notification';

/**
 * Dropdown z listą ostatnich powiadomień
 */
const NotificationDropdown = ({
  notifications = [],
  isLoading = false,
  onViewAllClick,
  onMarkAllAsRead,
  onRefresh,
  setUnreadCount
}) => {
  const [markingRead, setMarkingRead] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Obsługa oznaczania pojedynczego powiadomienia jako przeczytane
  const handleMarkAsRead = async (notificationId) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_read: true }),
      });

      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }

      // Aktualizuj stan 
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      // Zaktualizuj listę powiadomień
      const updatedNotifications = notifications.map(notif => 
        notif.id === notificationId ? { ...notif, is_read: true } : notif
      );
      
      return updatedNotifications;
    } catch (err) {
      console.error('Error marking notification as read:', err);
      toast.error('Nie udało się oznaczyć powiadomienia jako przeczytane');
      return notifications;
    }
  };

  // Obsługa odświeżania listy
  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  };

  // Obsługa oznaczania wszystkich jako przeczytane
  const handleMarkAllAsRead = async () => {
    setMarkingRead(true);
    await onMarkAllAsRead();
    setMarkingRead(false);
  };

  return (
    <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg z-10 overflow-hidden border border-gray-200">
      {/* Nagłówek */}
      <div className="border-b border-gray-200 px-4 py-3 flex justify-between items-center">
        <h3 className="text-sm font-semibold text-gray-700">Powiadomienia</h3>
        <div className="flex space-x-2">
          <button
            className={`text-xs text-gray-500 hover:text-gray-700 ${refreshing ? 'opacity-50 cursor-wait' : ''}`}
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Odśwież powiadomienia"
          >
            <RefreshIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            className={`text-xs text-gray-500 hover:text-gray-700 ${markingRead ? 'opacity-50 cursor-wait' : ''}`}
            onClick={handleMarkAllAsRead}
            disabled={markingRead}
          >
            Oznacz wszystkie jako przeczytane
          </button>
        </div>
      </div>

      {/* Lista powiadomień */}
      <div className="max-h-96 overflow-y-auto">
        {isLoading ? (
          <div className="flex justify-center items-center py-6">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500"></div>
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-6 px-4 text-center text-sm text-gray-500">
            Brak powiadomień
          </div>
        ) : (
          <ul className="divide-y divide-gray-200">
            {notifications.map(notification => (
              <NotificationItem
                key={notification.id}
                notification={notification}
                onMarkAsRead={handleMarkAsRead}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Stopka */}
      <div className="border-t border-gray-200 p-2">
        <button
          className="w-full text-center text-xs text-indigo-600 hover:text-indigo-800 py-2 flex items-center justify-center"
          onClick={onViewAllClick}
        >
          Zobacz wszystkie powiadomienia
          <ArrowRightIcon className="ml-1 h-3 w-3" />
        </button>
      </div>
    </div>
  );
};

export default NotificationDropdown;