// src/__tests__/hooks/useNotifications.test.js
import { renderHook, act } from '@testing-library/react-hooks';
import { useNotifications, NotificationProvider } from '@/components/notifications/NotificationProvider';
import { useUser } from '@clerk/nextjs';
import React from 'react';

// Mock fetch
global.fetch = jest.fn();

// Mock useUser
jest.mock('@clerk/nextjs', () => ({
  useUser: jest.fn()
}));

// Mock useRouter and usePathname from next/navigation
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn()
  }),
  usePathname: () => '/test'
}));

describe('useNotifications Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mock responses
    global.fetch.mockImplementation((url) => {
      if (url.includes('/api/notifications/count')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ count: 5 })
        });
      }
      
      if (url.includes('/api/notifications?pageSize=10')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            notifications: [
              {
                id: 'notification1',
                title: 'Test Notification',
                content: 'This is a test',
                is_read: false,
                created_at: new Date().toISOString()
              }
            ]
          })
        });
      }
      
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      });
    });
    
    // Setup useUser mock
    useUser.mockReturnValue({
      isSignedIn: true,
      isLoaded: true,
      user: { id: 'user123' }
    });
  });

  const wrapper = ({ children }) => (
    <NotificationProvider>{children}</NotificationProvider>
  );

  it('should fetch unread count on mount', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useNotifications(), { wrapper });
    
    // Initial state should have isLoading true
    expect(result.current.isLoading).toBe(true);
    
    await waitForNextUpdate();
    
    // After loading, should have unread count
    expect(result.current.unreadCount).toBe(5);
    expect(result.current.isLoading).toBe(false);
    
    // Should have made a request to the count endpoint
    expect(global.fetch).toHaveBeenCalledWith('/api/notifications/count');
  });

  it('should fetch recent notifications', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useNotifications(), { wrapper });
    
    await waitForNextUpdate();
    
    // Call fetchRecentNotifications
    act(() => {
      result.current.fetchRecentNotifications();
    });
    
    // Should be loading again
    expect(result.current.isLoading).toBe(true);
    
    await waitForNextUpdate();
    
    // Should have notifications
    expect(result.current.notifications).toHaveLength(1);
    expect(result.current.notifications[0].title).toBe('Test Notification');
    
    // Should have made a request to the notifications endpoint
    expect(global.fetch).toHaveBeenCalledWith('/api/notifications?pageSize=10');
  });

  it('should mark all notifications as read', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useNotifications(), { wrapper });
    
    await waitForNextUpdate();
    
    // Setup mock for the PATCH request
    global.fetch.mockImplementationOnce(() => 
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ success: true })
      })
    );
    
    // Call markAllAsRead
    let success;
    await act(async () => {
      success = await result.current.markAllAsRead();
    });
    
    // Should return true on success
    expect(success).toBe(true);
    
    // Should reset unread count to 0
    expect(result.current.unreadCount).toBe(0);
    
    // Should have made a PATCH request
    expect(global.fetch).toHaveBeenCalledWith('/api/notifications', {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ all: true }),
    });
  });

  it('should handle new notification correctly', async () => {
    const { result, waitForNextUpdate } = renderHook(() => useNotifications(), { wrapper });
    
    await waitForNextUpdate();
    
    const newNotification = {
      id: 'new-notification',
      title: 'New Notification',
      content: 'This is new',
      is_read: false,
      created_at: new Date().toISOString()
    };
    
    // Simulate receiving a new notification
    act(() => {
      // This would be called by the NotificationRealtime component
      result.current.handleNewNotification && result.current.handleNewNotification(newNotification);
    });
    
    // Should increase unread count
    expect(result.current.unreadCount).toBe(6);
  });

  it('should not fetch anything if user is not signed in', async () => {
    // Mock user as not signed in
    useUser.mockReturnValueOnce({
      isSignedIn: false,
      isLoaded: true,
      user: null
    });
    
    renderHook(() => useNotifications(), { wrapper });
    
    // Should not make any fetch requests
    expect(global.fetch).not.toHaveBeenCalled();
  });
});