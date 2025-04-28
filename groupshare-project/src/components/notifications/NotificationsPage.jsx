'use client';

import { useState, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import NotificationList from './NotificationList';
import NotificationFilters from './NotificationFilters';
import Pagination from '../common/Pagination';
import LoadingSpinner from '../common/LoadingSpinner';
import { toast } from '@/lib/utils/notification';

/**
 * Komponent strony powiadomień z filtrowaniem i paginacją
 */
const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: 20,
    total: 0,
    totalPages: 0
  });
  
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const type = searchParams.get('type');
  const read = searchParams.get('read');
  const priority = searchParams.get('priority');
  const page = parseInt(searchParams.get('page') || '1');

  // Pobieranie powiadomień z uwzględnieniem filtrów i paginacji
  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setIsLoading(true);
        setError(null);
        
        // Budowanie URL z parametrami
        const params = new URLSearchParams();
        if (type) params.append('type', type);
        if (read !== null) params.append('read', read);
        if (priority) params.append('priority', priority);
        params.append('page', page.toString());
        params.append('pageSize', pagination.pageSize.toString());
        
        const response = await fetch(`/api/notifications?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch notifications');
        }
        
        const data = await response.json();
        
        setNotifications(data.notifications || []);
        setPagination(data.pagination || {
          page,
          pageSize: pagination.pageSize,
          total: 0,
          totalPages: 0
        });
      } catch (err) {
        console.error('Error fetching notifications:', err);
        setError(err.message);
        toast.error('Nie udało się pobrać powiadomień');
      } finally {
        setIsLoading(false);
      }
    };

    fetchNotifications();
  }, [type, read, priority, page, pagination.pageSize]);

  // Obsługa zmiany filtrów
  const handleFilterChange = (newFilters) => {
    const params = new URLSearchParams(searchParams);
    
    // Aktualizuj parametry URL na podstawie nowych filtrów
    Object.entries(newFilters).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    
    // Zresetuj stronę do 1 przy zmianie filtrów
    params.set('page', '1');
    
    // Zaktualizuj URL
    router.push(`/notifications?${params.toString()}`);
  };

  // Obsługa zmiany strony
  const handlePageChange = (newPage) => {
    const params = new URLSearchParams(searchParams);
    params.set('page', newPage.toString());
    router.push(`/notifications?${params.toString()}`);
  };

  // Obsługa oznaczania jako przeczytane
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

      // Aktualizuj lokalny stan
      setNotifications(prevNotifications => 
        prevNotifications.map(notif => 
          notif.id === notificationId ? { ...notif, is_read: true } : notif
        )
      );
    } catch (err) {
      console.error('Error marking notification as read:', err);
      toast.error('Nie udało się oznaczyć powiadomienia jako przeczytane');
    }
  };

  // Obsługa oznaczania wszystkich jako przeczytane
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
        throw new Error('Failed to mark all notifications as read');
      }

      // Aktualizuj lokalny stan
      setNotifications(prevNotifications => 
        prevNotifications.map(notif => ({ ...notif, is_read: true }))
      );
      
      toast.success('Wszystkie powiadomienia oznaczone jako przeczytane');
    } catch (err) {
      console.error('Error marking all as read:', err);
      toast.error('Nie udało się oznaczyć wszystkich powiadomień jako przeczytane');
    }
  };

  // Obsługa usuwania powiadomienia
  const handleDeleteNotification = async (notificationId) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete notification');
      }

      // Aktualizuj lokalny stan
      setNotifications(prevNotifications => 
        prevNotifications.filter(notif => notif.id !== notificationId)
      );
      
      // Aktualizuj licznik
      setPagination(prev => ({
        ...prev,
        total: Math.max(0, prev.total - 1)
      }));
      
      toast.success('Powiadomienie zostało usunięte');
    } catch (err) {
      console.error('Error deleting notification:', err);
      toast.error('Nie udało się usunąć powiadomienia');
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
      {/* Filtry */}
      <NotificationFilters 
        initialFilters={{
          type: type || '',
          read: read || '',
          priority: priority || ''
        }}
        onFilterChange={handleFilterChange}
        onMarkAllAsRead={handleMarkAllAsRead}
      />

      {/* Lista powiadomień */}
      {isLoading ? (
        <div className="p-12">
          <LoadingSpinner />
        </div>
      ) : error ? (
        <div className="p-8 text-center text-red-500">
          <p>Wystąpił błąd podczas pobierania powiadomień.</p>
          <button 
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
            onClick={() => handleFilterChange({})}
          >
            Spróbuj ponownie
          </button>
        </div>
      ) : notifications.length === 0 ? (
        <div className="p-12 text-center text-gray-500">
          <p>Brak powiadomień spełniających podane kryteria.</p>
        </div>
      ) : (
        <NotificationList 
          notifications={notifications}
          onMarkAsRead={handleMarkAsRead}
          onDelete={handleDeleteNotification}
        />
      )}

      {/* Paginacja */}
      {!isLoading && !error && notifications.length > 0 && pagination.totalPages > 1 && (
        <div className="border-t border-gray-200 px-4 py-4">
          <Pagination 
            currentPage={pagination.page}
            totalPages={pagination.totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  );
};

export default NotificationsPage;