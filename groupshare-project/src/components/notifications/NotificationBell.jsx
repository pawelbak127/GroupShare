'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { BellIcon } from '@heroicons/react/24/outline';
import { BellAlertIcon } from '@heroicons/react/24/solid';
import NotificationDropdown from './NotificationDropdown.jsx';
import { toast } from '@/lib/utils/notification';
import { useNotifications } from './NotificationProvider';

/**
 * Notification bell component with unread count badge
 */
const NotificationBell = () => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const router = useRouter();
  
  // Use the notification context
  const { 
    unreadCount, 
    setUnreadCount, 
    notifications, 
    isLoading,
    fetchRecentNotifications,
    markAllAsRead
  } = useNotifications();

  // Handle click outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch notifications when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchRecentNotifications();
    }
  }, [isOpen, fetchRecentNotifications]);

  // Handle bell click
  const handleBellClick = () => {
    setIsOpen(!isOpen);
  };

  // Go to notifications page
  const handleViewAllClick = () => {
    setIsOpen(false);
    router.push('/notifications');
  };

  // Close dropdown - function for child components
  const closeDropdown = () => {
    setIsOpen(false);
  };

  // Mark notifications as read
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

      // Update the unread count
      setUnreadCount(prev => Math.max(0, prev - 1));
      
      return true;
    } catch (err) {
      console.error('Error marking notification as read:', err);
      toast.error('Nie udało się oznaczyć powiadomienia jako przeczytane');
      return false;
    }
  };

  // Handle marking all as read
  const handleMarkAllAsRead = async () => {
    const success = await markAllAsRead();
    if (success) {
      toast.success('Wszystkie powiadomienia oznaczone jako przeczytane');
    }
  };

  // Handle refresh
  const handleRefresh = async () => {
    await fetchRecentNotifications();
    toast.success('Powiadomienia odświeżone');
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell icon with counter */}
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

      {/* Notifications dropdown */}
      {isOpen && (
        <NotificationDropdown
          notifications={notifications}
          isLoading={isLoading}
          onViewAllClick={handleViewAllClick}
          onMarkAllAsRead={handleMarkAllAsRead}
          onRefresh={handleRefresh}
          onMarkAsRead={handleMarkAsRead}
          closeDropdown={closeDropdown}
        />
      )}
    </div>
  );
};

export default NotificationBell;