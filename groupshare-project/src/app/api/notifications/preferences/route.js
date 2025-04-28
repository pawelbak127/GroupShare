// src/app/api/notifications/preferences/route.js
import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import supabaseAdmin from '@/lib/database/supabase-admin-client';
import { notificationService } from '@/services/notification/notification-service';

/**
 * GET /api/notifications/preferences
 * Pobiera preferencje powiadomień dla zalogowanego użytkownika
 */
export async function GET(request) {
  try {
    // Sprawdź autentykację
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Pobierz ID profilu użytkownika
    const { data: userProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('external_auth_id', user.id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Pobierz preferencje powiadomień
    const preferences = await notificationService.getNotificationPreferences(userProfile.id);

    return NextResponse.json(preferences);
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notification preferences', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/notifications/preferences
 * Aktualizuje preferencje powiadomień dla zalogowanego użytkownika
 */
export async function PATCH(request) {
  try {
    // Sprawdź autentykację
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Pobierz dane z body
    const preferences = await request.json();

    // Walidacja danych
    const validKeys = [
      'email_enabled',
      'push_enabled',
      'type_preferences',
      'type_preferences',
      'notify_on_purchase',
      'notify_on_dispute',
      'email_digest'
    ];

    // Sprawdź, czy przesłane dane zawierają poprawne klucze
    const invalidKeys = Object.keys(preferences).filter(key => !validKeys.includes(key));
    if (invalidKeys.length > 0) {
      return NextResponse.json(
        { error: `Invalid preference keys: ${invalidKeys.join(', ')}` },
        { status: 400 }
      );
    }

    // Pobierz ID profilu użytkownika
    const { data: userProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('external_auth_id', user.id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Aktualizuj preferencje powiadomień
    const updatedPreferences = await notificationService.updateNotificationPreferences(
      userProfile.id,
      preferences
    );

    return NextResponse.json(updatedPreferences);
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    return NextResponse.json(
      { error: 'Failed to update notification preferences', details: error.message },
      { status: 500 }
    );
  }
}