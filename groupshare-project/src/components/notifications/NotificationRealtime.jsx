'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import supabase from '@/lib/database/supabase-client';
import { toast } from '@/lib/utils/notification';

/**
 * Komponent obsługujący powiadomienia w czasie rzeczywistym
 * Używa Supabase Realtime do subskrypcji zmian w tabeli notifications
 */
const NotificationRealtime = ({ onNewNotification, onNotificationUpdate, children }) => {
  const { user, isSignedIn, isLoaded } = useUser();
  const [userProfileId, setUserProfileId] = useState(null);
  const [subscription, setSubscription] = useState(null);

  // Pobierz ID profilu użytkownika
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
          setUserProfileId(data.id);
        }
      } catch (error) {
        console.error('Error fetching user profile ID:', error);
      }
    };

    fetchUserProfileId();
  }, [user, isSignedIn, isLoaded]);

  // Subskrybuj powiadomienia w czasie rzeczywistym
  useEffect(() => {
    if (!userProfileId) return;

    // Ustaw subskrypcję na tabeli powiadomień
    const notificationSubscription = supabase
      .channel('notifications-channel')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userProfileId}`
        },
        (payload) => {
          console.log('New notification received:', payload);
          
          // Wyświetl toast z nowym powiadomieniem
          toast.info(payload.new.title, {
            duration: 6000,
            icon: '🔔'
          });
          
          // Wywołaj callback dla nowego powiadomienia
          if (onNewNotification) {
            onNewNotification(payload.new);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userProfileId}`
        },
        (payload) => {
          console.log('Notification updated:', payload);
          
          // Wywołaj callback dla zaktualizowanego powiadomienia
          if (onNotificationUpdate) {
            onNotificationUpdate(payload.new);
          }
        }
      )
      .subscribe();

    setSubscription(notificationSubscription);

    // Sprzątanie przy odmontowaniu
    return () => {
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [userProfileId, onNewNotification, onNotificationUpdate]);

  // Komponent nie renderuje niczego poza swoimi dziećmi
  return children;
};

export default NotificationRealtime;