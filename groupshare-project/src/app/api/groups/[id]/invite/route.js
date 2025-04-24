// src/app/api/groups/[id]/invite/route.js
import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import supabaseAdmin from '@/lib/database/supabase-admin-client';
import crypto from 'crypto';

/**
 * POST /api/groups/[id]/invite
 * Wysyła zaproszenie do grupy poprzez email
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
    const { email, role = 'member' } = await request.json();
    
    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }
    
    // Pobierz profil użytkownika zapraszającego
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('id, display_name')
      .eq('external_auth_id', user.id)
      .maybeSingle();
    
    if (profileError && profileError.code !== 'PGRST116') {
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
    
    // Sprawdź, czy użytkownik ma uprawnienia do zapraszania
    const isOwner = group.owner_id === userProfile.id;
    
    if (!isOwner) {
      // Sprawdź, czy użytkownik jest adminem grupy
      const { data: membership, error: membershipError } = await supabaseAdmin
        .from('group_members')
        .select('role')
        .eq('group_id', groupId)
        .eq('user_id', userProfile.id)
        .eq('status', 'active')
        .eq('role', 'admin')
        .maybeSingle();
      
      if (membershipError || !membership) {
        console.error('Error checking membership or not admin:', membershipError);
        return NextResponse.json(
          { error: 'You do not have permission to invite members to this group' },
          { status: 403 }
        );
      }
    }
    
    // Sprawdź, czy użytkownik z podanym emailem już istnieje
    const { data: existingUser, error: existingUserError } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();
    
    if (existingUserError && existingUserError.code !== 'PGRST116') {
      console.error('Error checking existing user:', existingUserError);
      return NextResponse.json(
        { error: 'Failed to check if user exists', details: existingUserError },
        { status: 500 }
      );
    }
    
    if (existingUser) {
      // Użytkownik już istnieje - sprawdź, czy już jest w grupie
      const { data: existingMember, error: existingMemberError } = await supabaseAdmin
        .from('group_members')
        .select('id, status')
        .eq('group_id', groupId)
        .eq('user_id', existingUser.id)
        .maybeSingle();
      
      if (existingMemberError && existingMemberError.code !== 'PGRST116') {
        console.error('Error checking existing member:', existingMemberError);
        return NextResponse.json(
          { error: 'Failed to check if user is already a member', details: existingMemberError },
          { status: 500 }
        );
      }
      
      if (existingMember) {
        if (existingMember.status === 'active') {
          return NextResponse.json(
            { error: 'User is already a member of this group' },
            { status: 400 }
          );
        } else {
          // Reaktywuj członkostwo
          const { error: updateError } = await supabaseAdmin
            .from('group_members')
            .update({
              status: 'invited',
              role: role,
              invited_by: userProfile.id
              // Usunięto: updated_at: new Date().toISOString()
            })
            .eq('id', existingMember.id);
          
          if (updateError) {
            console.error('Error updating member:', updateError);
            return NextResponse.json(
              { error: 'Failed to update member status', details: updateError },
              { status: 500 }
            );
          }
          
          // W tym miejscu wysłalibyśmy email z zaproszeniem w rzeczywistej aplikacji
          
          return NextResponse.json({
            message: 'Invitation sent successfully',
            invitedUser: {
              email,
              status: 'reinvited'
            }
          });
        }
      }
      
      // Użytkownik istnieje, ale nie jest członkiem grupy - dodaj go
      const { data: newMember, error: createError } = await supabaseAdmin
        .from('group_members')
        .insert({
          group_id: groupId,
          user_id: existingUser.id,
          role: role,
          status: 'invited',
          invited_by: userProfile.id,
          created_at: new Date().toISOString()
          // Usunięto: updated_at: new Date().toISOString()
        })
        .select('id')
        .single();
      
      if (createError) {
        console.error('Error creating member:', createError);
        return NextResponse.json(
          { error: 'Failed to create invitation', details: createError },
          { status: 500 }
        );
      }
      
      // W tym miejscu wysłalibyśmy email z zaproszeniem w rzeczywistej aplikacji
      
      return NextResponse.json({
        message: 'Invitation sent successfully',
        invitedUser: {
          email,
          status: 'invited'
        }
      });
    }
    
    // Jeśli użytkownik nie istnieje, tworzymy zaproszenie
    // Generuj kod zaproszenia
    const inviteCode = crypto.randomBytes(16).toString('hex');
    
    // Zapisz zaproszenie
    const { data: invitation, error: inviteError } = await supabaseAdmin
      .from('group_invitations')
      .insert({
        group_id: groupId,
        email: email,
        role: role,
        invite_code: inviteCode,
        invited_by: userProfile.id,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // Ważne przez 7 dni
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString() // Zachowano, bo w tabeli group_invitations ta kolumna istnieje
      })
      .select('id')
      .single();
    
    if (inviteError) {
      console.error('Error creating invitation:', inviteError);
      return NextResponse.json(
        { error: 'Failed to create invitation', details: inviteError },
        { status: 500 }
      );
    }
    
    // W tym miejscu wysłalibyśmy email z zaproszeniem w rzeczywistej aplikacji
    // const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invitation/${inviteCode}`;
    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/groups/join?code=${inviteCode}`;
    
    // Zaloguj akcję
    await supabaseAdmin
      .from('security_logs')
      .insert({
        user_id: userProfile.id,
        action_type: 'group_invitation',
        resource_type: 'group',
        resource_id: groupId,
        status: 'success',
        details: {
          invited_email: email,
          role: role,
          invitation_id: invitation.id,
          invite_url: inviteUrl
        },
        created_at: new Date().toISOString()
      });
    
    return NextResponse.json({
      message: 'Invitation sent successfully',
      invitedUser: {
        email,
        status: 'pending',
        inviteId: invitation.id,
        inviteUrl: inviteUrl
      }
    });
  } catch (error) {
    console.error('Unexpected error in POST /api/groups/[id]/invite:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error.message },
      { status: 500 }
    );
  }
}