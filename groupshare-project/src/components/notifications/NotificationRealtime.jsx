'use client';

import { useEffect, useState, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import supabase from '@/lib/database/supabase-client';
import { toast } from '@/lib/utils/notification';

/**
 * Component that handles real-time notifications
 * Uses Supabase Realtime to subscribe to changes in the notifications table
 */
const NotificationRealtime = ({ onNewNotification, onNotificationUpdate, children }) => {
  const { user, isSignedIn, isLoaded } = useUser();
  const [userProfileId, setUserProfileId] = useState(null);
  const channelRef = useRef(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;

  // Handle subscription cleanup
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        console.log('Cleaning up notification subscription');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
        setIsSubscribed(false);
      }
    };
  }, []);

  // Get user profile ID
  useEffect(() => {
    const fetchUserProfileId = async () => {
      if (!isSignedIn || !user) return;

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
        }
      } catch (error) {
        console.error('Error fetching user profile ID:', error);
        
        // Retry mechanism for profile fetching
        if (retryCount < MAX_RETRIES) {
          const timeout = Math.pow(2, retryCount) * 1000; // Exponential backoff
          console.log(`Retrying profile fetch in ${timeout}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
          setTimeout(() => {
            setRetryCount(prev => prev + 1);
          }, timeout);
        }
      }
    };

    fetchUserProfileId();
  }, [user, isSignedIn, isLoaded, retryCount]);

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
          (payload) => {
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
          }
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
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
            setIsSubscribed(false);
            
            // Attempt to reconnect
            if (channelRef.current === channel) {
              channelRef.current = null;
              console.log('Lost notification subscription, will attempt to reconnect');
              
              // Wait a bit before attempting to reconnect
              setTimeout(() => {
                setIsSubscribed(false);
              }, 5000);
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
      }
    };

    setupRealTimeSubscription();
  }, [userProfileId, onNewNotification, onNotificationUpdate, isSubscribed]);

  // Component doesn't render anything other than its children
  return children;
};

export default NotificationRealtime;