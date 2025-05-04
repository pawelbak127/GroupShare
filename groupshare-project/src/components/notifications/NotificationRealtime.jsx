'use client';

import { useEffect, useState, useRef } from 'react';
import { useUser } from '@clerk/nextjs';
import supabase from '@/lib/database/supabase-client';
import { toast } from '@/lib/utils/notification';

/**
 * Uproszczony komponent obsługujący powiadomienia w czasie rzeczywistym
 */
const NotificationRealtime = ({ onNewNotification, onNotificationUpdate, children }) => {
  const { user, isSignedIn } = useUser();
  const [userProfileId, setUserProfileId] = useState(null);
  const channelRef = useRef(null);

  // Czyszczenie subskrypcji
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        console.log('Czyszczenie subskrypcji powiadomień');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, []);

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
          console.log('Pobrano ID profilu użytkownika dla powiadomień:', data.id);
          setUserProfileId(data.id);
        }
      } catch (error) {
        console.error('Błąd podczas pobierania ID profilu użytkownika:', error);
      }
    };

    fetchUserProfileId();
  }, [user, isSignedIn]);

  // Subskrybuj powiadomienia w czasie rzeczywistym
  useEffect(() => {
    if (!userProfileId) return;

    const setupRealTimeSubscription = async () => {
      try {
        console.log('Konfigurowanie subskrypcji powiadomień w czasie rzeczywistym dla użytkownika:', userProfileId);
        
        // Utwórz kanał dla powiadomień tego użytkownika
        const channel = supabase.channel(`user-notifications-${userProfileId}`, {
          config: {
            broadcast: { self: false }
          }
        });

        // Subskrybuj zdarzenia INSERT
        channel.on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userProfileId}`
          },
          (payload) => {
            console.log('Otrzymano nowe powiadomienie:', payload);
            
            // Pokaż powiadomienie toast
            toast.info(payload.new.title, {
              duration: 6000,
              icon: '🔔'
            });
            
            // Wywołaj callback
            if (onNewNotification) {
              onNewNotification(payload.new);
            }
          }
        );

        // Subskrybuj zdarzenia UPDATE
        channel.on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${userProfileId}`
          },
          (payload) => {
            console.log('Zaktualizowano powiadomienie:', payload);
            
            if (onNotificationUpdate) {
              onNotificationUpdate(payload.new);
            }
          }
        );

        // Subskrybuj kanał
        channel.subscribe((status) => {
          console.log(`Status kanału powiadomień: ${status}`);
        });

        // Zapisz referencję do kanału
        channelRef.current = channel;
        
      } catch (error) {
        console.error('Błąd podczas konfigurowania subskrypcji powiadomień:', error);
      }
    };

    setupRealTimeSubscription();
  }, [userProfileId, onNewNotification, onNotificationUpdate]);

  // Komponent nie renderuje nic poza swoimi dziećmi
  return children;
};

export default NotificationRealtime;