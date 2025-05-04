// src/app/api/conversations/[id]/messages/route.js
import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import supabaseAdmin from '@/lib/database/supabase-admin-client';
import { notificationService } from '@/services/notification/notification-service';

/**
 * POST /api/conversations/[id]/messages
 * Dodaje nową wiadomość do konwersacji i wysyła powiadomienia
 */
export async function POST(request, { params }) {
  try {
    const { id: conversationId } = params;
    const { content } = await request.json();

    // Sprawdź autentykację
    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Pobierz ID profilu użytkownika
    const { data: userProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('external_auth_id', user.id)
      .single();

    if (!userProfile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    // Sprawdź, czy konwersacja istnieje i czy użytkownik ma do niej dostęp
    const { data: conversation, error: conversationError } = await supabaseAdmin
      .from('conversations')
      .select('*, participants:conversation_participants(*)')
      .eq('id', conversationId)
      .single();

    if (conversationError || !conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Sprawdź, czy użytkownik jest uczestnikiem konwersacji
    const isParticipant = conversation.participants.some(
      p => p.user_id === userProfile.id
    );

    if (!isParticipant) {
      return NextResponse.json(
        { error: 'You are not a participant in this conversation' },
        { status: 403 }
      );
    }

    // Utwórz nową wiadomość
    const { data: message, error: messageError } = await supabaseAdmin
      .from('conversation_messages')
      .insert({
        conversation_id: conversationId,
        sender_id: userProfile.id,
        content,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (messageError) {
      return NextResponse.json(
        { error: 'Failed to send message', details: messageError.message },
        { status: 500 }
      );
    }

    // Zaktualizuj konwersację (ostatnia wiadomość, czas aktualizacji)
    await supabaseAdmin
      .from('conversations')
      .update({
        last_message_preview: content.substring(0, 100),
        last_message_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', conversationId);

    // Wyślij powiadomienia do wszystkich uczestników (oprócz nadawcy)
    const otherParticipants = conversation.participants
      .filter(p => p.user_id !== userProfile.id)
      .map(p => p.user_id);

    if (otherParticipants.length > 0) {
      const isGroupConversation = conversation.participants.length > 2;
      const messagePreview = content.length > 50 
        ? content.substring(0, 50) + '...' 
        : content;

      // Wyślij powiadomienie do każdego uczestnika
      for (const recipientId of otherParticipants) {
        await notificationService.createMessageNotification(
          recipientId,
          userProfile.id,
          conversationId,
          messagePreview,
          isGroupConversation
        );
      }
    }

    return NextResponse.json(message);
  } catch (error) {
    console.error('Error sending message:', error);
    return NextResponse.json(
      { error: 'Failed to send message', details: error.message },
      { status: 500 }
    );
  }
}