'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
    ArrowPathIcon, 
    CheckIcon, 
    ArrowRightIcon,
    XMarkIcon
  } from '@heroicons/react/24/outline';
import NotificationItem from './NotificationItem';
import { toast } from '@/lib/utils/notification';

/**
 * Dropdown component with recent notifications list
 */
const NotificationDropdown = ({
  notifications = [],
  isLoading = false,
  onViewAllClick,
  onMarkAllAsRead,
  onRefresh,
  setUnreadCount,
  closeDropdown // Function to close dropdown
}) => {
  const [markingRead, setMarkingRead] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Handle marking individual notification as read
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

      // Update state 
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      // Update notifications list locally
      const updatedNotifications = notifications.map(notif => 
        notif.id === notificationId ? { ...notif, is_read: true } : notif
      );
      
      console.log(`Notification ${notificationId} marked as read`);
      
      return updatedNotifications;
    } catch (err) {
      console.error('Error marking notification as read:', err);
      toast.error('Nie udało się oznaczyć powiadomienia jako przeczytane');
      return notifications;
    }
  };

  // Handle refreshing notifications list
  const handleRefresh = async () => {
    if (refreshing) return;
    
    setRefreshing(true);
    try {
      await onRefresh();
      toast.success('Powiadomienia odświeżone');
    } catch (error) {
      console.error('Error refreshing notifications:', error);
      toast.error('Nie udało się odświeżyć powiadomień');
    } finally {
      setRefreshing(false);
    }
  };

  // Handle marking all as read
  const handleMarkAllAsRead = async () => {
    if (markingRead) return;
    
    setMarkingRead(true);
    try {
      await onMarkAllAsRead();
      toast.success('Wszystkie powiadomienia oznaczone jako przeczytane');
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      toast.error('Nie udało się oznaczyć wszystkich powiadomień jako przeczytane');
    } finally {
      setMarkingRead(false);
    }
  };

  // Display loading message when necessary
  if (isLoading) {
    return (
      <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg z-10 overflow-hidden border border-gray-200">
        <div className="border-b border-gray-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-700">Powiadomienia</h3>
        </div>
        <div className="flex justify-center items-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-500"></div>
          <span className="ml-2 text-sm text-gray-500">Ładowanie powiadomień...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="absolute right-0 mt-2 w-80 bg-white rounded-md shadow-lg z-10 overflow-hidden border border-gray-200">
      {/* Header */}
      <div className="border-b border-gray-200 px-4 py-3 flex justify-between items-center">
        <h3 className="text-sm font-semibold text-gray-700">Powiadomienia</h3>
        <div className="flex space-x-2">
          <button
            className={`text-xs text-gray-500 hover:text-gray-700 ${refreshing ? 'opacity-50 cursor-wait' : ''}`}
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Odśwież powiadomienia"
          >
            <ArrowPathIcon className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
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

      {/* Notifications list */}
      <div className="max-h-96 overflow-y-auto">
        {notifications.length === 0 ? (
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
                closeDropdown={closeDropdown}
              />
            ))}
          </ul>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-gray-200 p-2">
        <button
          className="w-full text-center text-xs text-indigo-600 hover:text-indigo-800 py-2 flex items-center justify-center"
          onClick={() => {
            if (typeof closeDropdown === 'function') {
              closeDropdown(); // Close dropdown before redirecting
            }
            onViewAllClick();
          }}
        >
          Zobacz wszystkie powiadomienia
          <ArrowRightIcon className="ml-1 h-3 w-3" />
        </button>
      </div>
    </div>
  );
};

export default NotificationDropdown;