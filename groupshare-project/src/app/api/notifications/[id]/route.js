// src/app/api/notifications/[id]/route.js
import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import supabaseAdmin from '@/lib/database/supabase-admin-client';
import { notificationService } from '@/services/notification/notification-service';

/**
 * GET /api/notifications/[id]
 * Pobiera pojedyncze powiadomienie
 */
export async function GET(request, { params }) {
  try {
    const { id } = params;
    
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

    // Pobierz powiadomienie z bazy danych
    const { data: notification, error } = await supabaseAdmin
      .from('notifications')
      .select('*')
      .eq('id', id)
      .eq('user_id', userProfile.id)
      .single();

    if (error) {
      console.error('Error fetching notification:', error);
      return NextResponse.json(
        { error: 'Failed to fetch notification', details: error.message },
        { status: 500 }
      );
    }

    if (!notification) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    return NextResponse.json(notification);
  } catch (error) {
    console.error('Error fetching notification:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notification', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/notifications/[id]
 * Aktualizuje status przeczytania pojedynczego powiadomienia
 */
export async function PATCH(request, { params }) {
  try {
    const { id } = params;
    
    // Sprawdź autentykację
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Pobierz parametry z body (is_read)
    const body = await request.json();
    const { is_read } = body;

    if (is_read === undefined) {
      return NextResponse.json(
        { error: 'is_read field is required' },
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

    // Zaktualizuj powiadomienie - używając bezpośredniego update zamiast service dla większej kontroli
    const { data, error } = await supabaseAdmin
      .from('notifications')
      .update({
        is_read
        // Usunięto read_at, które nie istnieje w schemacie
      })
      .eq('id', id)
      .eq('user_id', userProfile.id)
      .select()
      .single();

    if (error) {
      console.error('Error updating notification:', error);
      return NextResponse.json(
        { error: 'Failed to update notification', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating notification:', error);
    return NextResponse.json(
      { error: 'Failed to update notification', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/notifications/[id]
 * Usuwa pojedyncze powiadomienie
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    
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

    // Usuń powiadomienie przy użyciu serwisu
    const success = await notificationService.deleteNotification(id, userProfile.id);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete notification' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting notification:', error);
    return NextResponse.json(
      { error: 'Failed to delete notification', details: error.message },
      { status: 500 }
    );
  }
}