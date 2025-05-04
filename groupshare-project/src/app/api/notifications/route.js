// src/app/api/notifications/route.js
import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import supabaseAdmin from '@/lib/database/supabase-admin-client';
import { notificationService } from '@/services/notification/notification-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/notifications
 * Pobierz powiadomienia dla zalogowanego użytkownika
 */
export async function GET(request) {
  try {
    // Sprawdź autentykację
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Pobierz parametry zapytania
    const { searchParams } = new URL(request.url);
    const options = {
      type: searchParams.get('type'),
      read: searchParams.get('read') === 'true' ? true : 
            searchParams.get('read') === 'false' ? false : null,
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: parseInt(searchParams.get('pageSize') || '10'),
    };

    // Pobierz ID profilu użytkownika
    const { data: userProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('external_auth_id', user.id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Pobierz powiadomienia używając serwisu
    const result = await notificationService.getUserNotifications(userProfile.id, options);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notifications', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/notifications
 * Oznacz wiele powiadomień jako przeczytane
 */
export async function PATCH(request) {
  try {
    // Sprawdź autentykację
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Pobierz body żądania
    const { ids, all = false, entityType, entityId } = await request.json();

    // Pobierz ID profilu użytkownika
    const { data: userProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('external_auth_id', user.id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    let success = false;
    
    // Obsłuż różne strategie oznaczania
    if (all) {
      // Oznacz wszystkie jako przeczytane
      success = await notificationService.markAllAsRead(userProfile.id);
    } else if (ids && ids.length > 0) {
      // Oznacz konkretne powiadomienia jako przeczytane
      success = await notificationService.markAsRead(ids, userProfile.id);
    } else if (entityType && entityId) {
      // Oznacz wszystkie powiadomienia dla konkretnej encji jako przeczytane
      const { data: notifications } = await supabaseAdmin
        .from('notifications')
        .select('id')
        .eq('user_id', userProfile.id)
        .eq('related_entity_type', entityType)
        .eq('related_entity_id', entityId)
        .eq('is_read', false);
      
      if (notifications && notifications.length > 0) {
        const notificationIds = notifications.map(n => n.id);
        success = await notificationService.markAsRead(notificationIds, userProfile.id);
      } else {
        success = true; // Brak powiadomień do oznaczenia
      }
    } else {
      return NextResponse.json(
        { error: 'Either ids array, all=true, or entityType+entityId is required' },
        { status: 400 }
      );
    }

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to update notifications' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating notifications:', error);
    return NextResponse.json(
      { error: 'Failed to update notifications', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/notifications
 * Usuń wiele powiadomień
 */
export async function DELETE(request) {
  try {
    // Sprawdź autentykację
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Pobierz body żądania
    const { ids, all = false, read = false } = await request.json();

    // Pobierz ID profilu użytkownika
    const { data: userProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('external_auth_id', user.id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    let result;

    if (all) {
      // Usuń wszystkie powiadomienia tego użytkownika
      const { error } = await supabaseAdmin
        .from('notifications')
        .delete()
        .eq('user_id', userProfile.id);
      
      result = !error;
    } else if (read) {
      // Usuń wszystkie przeczytane powiadomienia
      const { error } = await supabaseAdmin
        .from('notifications')
        .delete()
        .eq('user_id', userProfile.id)
        .eq('is_read', true);
      
      result = !error;
    } else if (ids && ids.length > 0) {
      // Usuń konkretne powiadomienia
      const { error } = await supabaseAdmin
        .from('notifications')
        .delete()
        .in('id', ids)
        .eq('user_id', userProfile.id);
      
      result = !error;
    } else {
      return NextResponse.json(
        { error: 'Either ids array, all=true, or read=true is required' },
        { status: 400 }
      );
    }

    if (!result) {
      return NextResponse.json(
        { error: 'Failed to delete notifications' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting notifications:', error);
    return NextResponse.json(
      { error: 'Failed to delete notifications', details: error.message },
      { status: 500 }
    );
  }
}