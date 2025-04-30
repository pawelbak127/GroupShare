'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import supabase from '@/lib/database/supabase-client';
import { toast } from '@/lib/utils/notification';

/**
 * Component that handles real-time notifications with improved reliability
 * Uses Supabase Realtime to subscribe to changes in the notifications table
 * Includes automatic reconnection, error handling and debouncing
 */
const NotificationRealtime = ({ onNewNotification, onNotificationUpdate, children }) => {
  const { user, isSignedIn, isLoaded } = useUser();
  const [userProfileId, setUserProfileId] = useState(null);
  const channelRef = useRef(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [lastNotificationTime, setLastNotificationTime] = useState(0);
  const [reconnectTimeout, setReconnectTimeout] = useState(null);
  const MAX_RETRIES = 5;
  const NOTIFICATION_DEBOUNCE_MS = 500; // Prevent multiple notifications in this timeframe

  // Handle subscription cleanup
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        console.log('Cleaning up notification subscription');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        setIsSubscribed(false);
        
        // Clear any pending reconnect timeouts
        if (reconnectTimeout) {
          clearTimeout(reconnectTimeout);
        }
      }
    };
  }, [reconnectTimeout]);

  // Get user profile ID with caching
  useEffect(() => {
    const fetchUserProfileId = async () => {
      if (!isSignedIn || !user) return;

      // Check cache first
      const cachedId = localStorage.getItem('userProfileId');
      const cacheTime = localStorage.getItem('userProfileIdTime');
      const now = Date.now();
      
      // Use cache if it exists and is less than 1 hour old
      if (cachedId && cacheTime && (now - parseInt(cacheTime)) < 3600000) {
        console.log('Using cached user profile ID for notifications');
        setUserProfileId(cachedId);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('external_auth_id', user.id)
          .single();

        if (error) throw error;
        if (data) {
          console.log('User profile ID fetched for notifications:', data.id);
          setUserProfileId(data.id);
          
          // Cache the ID for 1 hour
          localStorage.setItem('userProfileId', data.id);
          localStorage.setItem('userProfileIdTime', now.toString());
        }
      } catch (error) {
        console.error('Error fetching user profile ID:', error);
        
        // Retry mechanism for profile fetching with exponential backoff
        if (retryCount < MAX_RETRIES) {
          const timeout = Math.min(30000, Math.pow(2, retryCount) * 1000); // Exponential backoff, max 30 sec
          console.log(`Retrying profile fetch in ${timeout}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
          
          const timeoutId = setTimeout(() => {
            setRetryCount(prev => prev + 1);
          }, timeout);
          
          setReconnectTimeout(timeoutId);
        }
      }
    };

    fetchUserProfileId();
    
    return () => {
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
      }
    };
  }, [user, isSignedIn, isLoaded, retryCount]);

  // Debounced handler for new notifications
  const debouncedHandleNewNotification = useCallback((payload) => {
    const now = Date.now();
    
    // Debounce notifications that come in too quickly
    if (now - lastNotificationTime < NOTIFICATION_DEBOUNCE_MS) {
      console.log('Debouncing notification due to rapid sequence');
      return;
    }
    
    setLastNotificationTime(now);
    
    console.log('New notification received:', payload);
    
    // Show toast notification
    toast.info(payload.new.title, {
      duration: 6000,
      icon: '🔔',
      onClick: () => {
        // Optional: add click handler for toast
      }
    });
    
    // Call callback
    if (onNewNotification) {
      onNewNotification(payload.new);
    }
  }, [lastNotificationTime, onNewNotification]);

  // Subscribe to real-time notifications
  useEffect(() => {
    if (!userProfileId || isSubscribed) return;

    const setupRealTimeSubscription = async () => {
      try {
        console.log('Setting up real-time notification subscription for user:', userProfileId);
        
        // Create a channel for this user's notifications
        const channel = supabase.channel(`user-notifications-${userProfileId}`, {
          config: {
            broadcast: { self: false },
            presence: { key: userProfileId }
          }
        });

        // Subscribe to INSERT events
        channel.on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userProfileId}`
          },
          debouncedHandleNewNotification
        );

        // Subscribe to UPDATE events
        channel.on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userProfileId}`
          },
          (payload) => {
            console.log('Notification updated:', payload);
            
            if (onNotificationUpdate) {
              onNotificationUpdate(payload.new);
            }
          }
        );

        // Handle subscription status changes
        channel.on('subscription', (status) => {
          console.log(`Notification subscription status: ${status}`);
          if (status === 'SUBSCRIBED') {
            setIsSubscribed(true);
            // Reset retry counter on successful subscription
            setRetryCount(0);
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            setIsSubscribed(false);
            
            // Attempt to reconnect
            if (channelRef.current === channel) {
              channelRef.current = null;
              console.log('Lost notification subscription, will attempt to reconnect');
              
              // Wait before attempting to reconnect, with exponential backoff
              const timeout = Math.min(30000, Math.pow(2, retryCount) * 1000);
              console.log(`Attempting reconnection in ${timeout}ms`);
              
              const timeoutId = setTimeout(() => {
                setRetryCount(prev => Math.min(MAX_RETRIES, prev + 1));
                setIsSubscribed(false);
              }, timeout);
              
              setReconnectTimeout(timeoutId);
            }
          }
        });

        // Subscribe to the channel
        channel.subscribe((status) => {
          console.log(`Notification channel status: ${status}`);
        });

        // Store reference to the channel for cleanup
        channelRef.current = channel;
        
      } catch (error) {
        console.error('Error setting up notification subscription:', error);
        setIsSubscribed(false);
        
        // Attempt to reconnect after a delay
        const timeoutId = setTimeout(() => {
          setRetryCount(prev => Math.min(MAX_RETRIES, prev + 1));
          setIsSubscribed(false);
        }, 5000);
        
        setReconnectTimeout(timeoutId);
      }
    };

    setupRealTimeSubscription();
  }, [userProfileId, debouncedHandleNewNotification, onNotificationUpdate, isSubscribed, retryCount]);

  // Component doesn't render anything other than its children
  return children;
};

export default NotificationRealtime;