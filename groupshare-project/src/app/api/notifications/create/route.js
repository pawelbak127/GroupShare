// src/app/api/notifications/create/route.js
import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import supabaseAdmin from '@/lib/database/supabase-admin-client';
import { notificationService } from '@/services/notification/notification-service';

/**
 * POST /api/notifications/create
 * Tworzy nowe powiadomienie
 */
export async function POST(request) {
  try {
    // Sprawdź czy supabaseAdmin został poprawnie zainicjalizowany
    if (!supabaseAdmin) {
      console.error('supabaseAdmin is not initialized');
      return NextResponse.json(
        { 
          error: 'Database client is not initialized. Check server configuration.', 
          details: 'Missing environment variables for Supabase connection'
        },
        { status: 500 }
      );
    }

    // Sprawdź autentykację
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Pobierz dane z body
    const notificationData = await request.json();
    
    // Walidacja pól obowiązkowych
    if (!notificationData.userId || !notificationData.type || !notificationData.title || !notificationData.content) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, type, title and content are required' },
        { status: 400 }
      );
    }
    
    // Sprawdź poprawność typu powiadomienia
    const validTypes = ['invite', 'message', 'purchase', 'dispute'];
    if (!validTypes.includes(notificationData.type)) {
      return NextResponse.json(
        { error: `Invalid notification type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Sprawdź poprawność priorytetu powiadomienia jeśli podany
    if (notificationData.priority) {
      const validPriorities = ['high', 'normal', 'low'];
      if (!validPriorities.includes(notificationData.priority)) {
        return NextResponse.json(
          { error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}` },
          { status: 400 }
        );
      }
    }
    
    // Pobierz ID profilu użytkownika wysyłającego powiadomienie
    try {
      const { data: userProfile, error } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('external_auth_id', user.id)
        .single();
      
      if (error) {
        console.error('Error fetching user profile:', error);
        return NextResponse.json(
          { error: 'Failed to fetch user profile', details: error.message },
          { status: 500 }
        );
      }
      
      if (!userProfile) {
        return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
      }
      
      // Sprawdź uprawnienia tylko jeśli wysyłamy powiadomienie dla innego użytkownika
      if (notificationData.userId !== userProfile.id) {
        const isAllowed = await checkPermissionToNotify(userProfile.id, notificationData.userId, notificationData);
        
        if (!isAllowed) {
          return NextResponse.json(
            { error: 'You do not have permission to create notifications for other users' },
            { status: 403 }
          );
        }
      }
      
      // Utwórz powiadomienie
      try {
        const notification = await notificationService.createNotification(
          notificationData.userId,
          notificationData.type,
          notificationData.title,
          notificationData.content,
          notificationData.relatedEntityType || null,
          notificationData.relatedEntityId || null,
          notificationData.priority || 'normal',
          notificationData.ttl || 0
        );
        
        return NextResponse.json(notification);
      } catch (notificationError) {
        console.error('Error creating notification:', notificationError);
        return NextResponse.json(
          { error: 'Failed to create notification', details: notificationError.message },
          { status: 500 }
        );
      }
    } catch (dbError) {
      console.error('Database operation error:', dbError);
      return NextResponse.json(
        { error: 'Database operation failed', details: dbError.message },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in notifications/create API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Sprawdza, czy użytkownik ma uprawnienia do wysyłania powiadomień do innego użytkownika
 * @param {string} senderId - ID użytkownika wysyłającego
 * @param {string} recipientId - ID użytkownika otrzymującego
 * @param {Object} notificationData - Dane powiadomienia
 * @returns {Promise<boolean>} - Czy użytkownik ma uprawnienia
 */
async function checkPermissionToNotify(senderId, recipientId, notificationData) {
  try {
    // Sprawdź, czy użytkownik jest administratorem systemu
    const { data: senderProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('is_admin')
      .eq('id', senderId)
      .single();
      
    if (senderProfile?.is_admin) {
      return true;
    }
    
    // Sprawdź, czy użytkownik jest właścicielem grupy, której dotyczy powiadomienie
    if (notificationData.relatedEntityType === 'group' || notificationData.relatedEntityType === 'group_invitation') {
      let groupId = notificationData.relatedEntityId;
      
      if (notificationData.relatedEntityType === 'group_invitation') {
        // Pobierz grupę z zaproszenia
        const { data: invitation } = await supabaseAdmin
          .from('group_invitations')
          .select('group_id')
          .eq('id', notificationData.relatedEntityId)
          .single();
          
        groupId = invitation?.group_id;
      }
      
      if (groupId) {
        // Sprawdź, czy użytkownik jest właścicielem grupy
        const { data: group } = await supabaseAdmin
          .from('groups')
          .select('owner_id')
          .eq('id', groupId)
          .single();
          
        if (group?.owner_id === senderId) {
          return true;
        }
        
        // Sprawdź, czy użytkownik jest administratorem grupy
        const { data: membership } = await supabaseAdmin
          .from('group_members')
          .select('role')
          .eq('group_id', groupId)
          .eq('user_id', senderId)
          .eq('status', 'active')
          .single();
          
        if (membership?.role === 'admin') {
          return true;
        }
      }
    }
    
    // Sprawdź, czy użytkownik jest sprzedawcą subskrypcji, której dotyczy powiadomienie
    if (notificationData.relatedEntityType === 'purchase') {
      const { data: purchase } = await supabaseAdmin
        .from('purchase_records')
        .select(`
          group_sub:group_subs(
            group_id,
            groups(owner_id)
          )
        `)
        .eq('id', notificationData.relatedEntityId)
        .single();
        
      if (purchase?.group_sub?.groups?.owner_id === senderId) {
        return true;
      }
    }
    
    // W innych przypadkach domyślnie odmawiamy uprawnień
    return false;
  } catch (error) {
    console.error('Error checking notification permissions:', error);
    return false;
  }
}