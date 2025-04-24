// src/app/api/groups/invitations/verify/route.js
import { NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/database/supabase-admin-client';

/**
 * GET /api/groups/invitations/verify
 * Weryfikuje kod zaproszenia i zwraca podstawowe informacje o zaproszeniu
 */
export async function GET(request) {
  try {
    // Pobierz kod zaproszenia z query parameters
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    
    if (!code) {
      return NextResponse.json(
        { error: 'Invite code is required' },
        { status: 400 }
      );
    }
    
    // Sprawdź zaproszenie
    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from('group_invitations')
      .select(`
        id, 
        group_id, 
        email, 
        role, 
        status, 
        expires_at,
        group:groups(name)
      `)
      .eq('invite_code', code)
      .gt('expires_at', new Date().toISOString())
      .eq('status', 'pending')
      .maybeSingle();
    
    if (invitationError && invitationError.code !== 'PGRST116') {
      console.error('Error verifying invitation:', invitationError);
      return NextResponse.json(
        { error: 'Failed to verify invitation', details: invitationError },
        { status: 500 }
      );
    }
    
    if (!invitation) {
      return NextResponse.json(
        { error: 'Invalid or expired invitation code' },
        { status: 404 }
      );
    }
    
    // Zwróć podstawowe informacje o zaproszeniu
    return NextResponse.json({
      invitationId: invitation.id,
      groupId: invitation.group_id,
      groupName: invitation.group?.name || 'Grupa',
      email: invitation.email,
      role: invitation.role || 'member',
      expireDate: invitation.expires_at
    });
  } catch (error) {
    console.error('Unexpected error in GET /api/groups/invitations/verify:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error.message },
      { status: 500 }
    );
  }
}