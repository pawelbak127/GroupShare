// src/app/api/groups/[id]/join/route.js
import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import supabaseAdmin from '@/lib/database/supabase-admin-client';

/**
 * POST /api/groups/[id]/join
 * Dołączanie do grupy za pomocą kodu zaproszenia
 */
export async function POST(request, { params }) {
  try {
    const { id: groupId } = params;
    
    // Sprawdź autentykację
    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Pobierz dane z żądania
    const { inviteCode, role = 'member' } = await request.json();
    
    if (!inviteCode) {
      return NextResponse.json(
        { error: 'Invite code is required' },
        { status: 400 }
      );
    }
    
    // Pobierz profil użytkownika
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, email')
      .eq('external_auth_id', user.id)
      .single();
    
    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return NextResponse.json(
        { error: 'Failed to fetch user profile', details: profileError },
        { status: 500 }
      );
    }
    
    if (!userProfile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }
    
    // Sprawdź, czy grupa istnieje
    const { data: group, error: groupError } = await supabaseAdmin
      .from('groups')
      .select('id, name, owner_id')
      .eq('id', groupId)
      .single();
    
    if (groupError) {
      console.error('Error fetching group:', groupError);
      return NextResponse.json(
        { error: 'Group not found', details: groupError },
        { status: 404 }
      );
    }
    
    // Sprawdź zaproszenie
    const { data: invitation, error: invitationError } = await supabaseAdmin
      .from('group_invitations')
      .select('*')
      .eq('group_id', groupId)
      .eq('invite_code', inviteCode)
      .gt('expires_at', new Date().toISOString())
      .eq('status', 'pending')
      .maybeSingle();
    
    // Sprawdź, czy zaproszenie dotyczy użytkownika z tym adresem email
    if (invitation && invitation.email && invitation.email !== userProfile.email) {
      return NextResponse.json(
        { error: 'This invitation is for a different email address' },
        { status: 403 }
      );
    }
    
    // Sprawdź, czy użytkownik jest już członkiem grupy
    const { data: existingMember, error: membershipError } = await supabaseAdmin
      .from('group_members')
      .select('id, status')
      .eq('group_id', groupId)
      .eq('user_id', userProfile.id)
      .maybeSingle();
    
    if (existingMember) {
      if (existingMember.status === 'active') {
        return NextResponse.json(
          { error: 'You are already a member of this group' },
          { status: 400 }
        );
      } else {
        // Reaktywuj członkostwo
        const { error: updateError } = await supabaseAdmin
          .from('group_members')
          .update({
            status: 'active',
            role: role,
            joined_at: new Date().toISOString()
          })
          .eq('id', existingMember.id);
        
        if (updateError) {
          console.error('Error updating membership:', updateError);
          return NextResponse.json(
            { error: 'Failed to update membership', details: updateError },
            { status: 500 }
          );
        }
        
        // Zaktualizuj status zaproszenia, jeśli istnieje
        if (invitation) {
          await supabaseAdmin
            .from('group_invitations')
            .update({
              status: 'accepted',
              updated_at: new Date().toISOString()
            })
            .eq('id', invitation.id);
        }
        
        return NextResponse.json({
          message: 'Successfully joined the group',
          groupId,
          groupName: group.name
        });
      }
    }
    
    // Dodaj użytkownika do grupy jako nowego członka
    const { data: newMember, error: createError } = await supabaseAdmin
      .from('group_members')
      .insert({
        group_id: groupId,
        user_id: userProfile.id,
        role: invitation ? invitation.role : role,
        status: 'active',
        invited_by: invitation ? invitation.invited_by : null,
        joined_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (createError) {
      console.error('Error creating membership:', createError);
      return NextResponse.json(
        { error: 'Failed to join group', details: createError },
        { status: 500 }
      );
    }
    
    // Zaktualizuj status zaproszenia, jeśli istnieje
    if (invitation) {
      await supabaseAdmin
        .from('group_invitations')
        .update({
          status: 'accepted',
          updated_at: new Date().toISOString()
        })
        .eq('id', invitation.id);
    }
    
    // Zaloguj akcję
    await supabaseAdmin
      .from('security_logs')
      .insert({
        user_id: userProfile.id,
        action_type: 'group_joined',
        resource_type: 'group',
        resource_id: groupId,
        status: 'success',
        details: {
          invite_code: inviteCode,
          role: newMember.role
        },
        created_at: new Date().toISOString()
      });
    
    return NextResponse.json({
      message: 'Successfully joined the group',
      groupId,
      groupName: group.name
    });
  } catch (error) {
    console.error('Unexpected error in POST /api/groups/[id]/join:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error.message },
      { status: 500 }
    );
  }
}