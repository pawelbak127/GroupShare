// src/app/api/notifications/route.js
import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import supabaseAdmin from '@/lib/database/supabase-admin-client';
import { notificationService } from '@/services/notification/notification-service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/notifications
 * Pobiera powiadomienia dla zalogowanego użytkownika
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
      priority: searchParams.get('priority'),
      page: parseInt(searchParams.get('page') || '1'),
      pageSize: parseInt(searchParams.get('pageSize') || '10'),
      relatedEntityType: searchParams.get('relatedEntityType'),
      relatedEntityId: searchParams.get('relatedEntityId'),
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

    // Pobierz powiadomienia za pomocą serwisu
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
 * Oznacza wiele powiadomień jako przeczytane
 */
export async function PATCH(request) {
  try {
    // Sprawdź autentykację
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Pobierz dane z body
    const { ids, all = false } = await request.json();

    // Pobierz ID profilu użytkownika
    const { data: userProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('external_auth_id', user.id)
      .single();

    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    let success;
    if (all) {
      // Oznacz wszystkie jako przeczytane
      success = await notificationService.markAllAsRead(userProfile.id);
    } else if (ids && ids.length > 0) {
      // Oznacz konkretne powiadomienia jako przeczytane
      success = await notificationService.markAsRead(ids, userProfile.id);
    } else {
      return NextResponse.json(
        { error: 'Either ids array or all=true is required' },
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