// src/app/api/groups/[id]/members/route.js
import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import supabaseAdmin from '@/lib/database/supabase-admin-client';

/**
 * GET /api/groups/[id]/members
 * Pobiera członków grupy
 */
export async function GET(request, { params }) {
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
    
    // Pobierz profil użytkownika
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('external_auth_id', user.id)
      .maybeSingle(); // używamy maybeSingle zamiast single
    
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
    
    // Sprawdź, czy użytkownik należy do grupy
    const { data: membership, error: membershipError } = await supabaseAdmin
      .from('group_members')
      .select('role, status')
      .eq('user_id', userProfile.id)
      .eq('group_id', groupId)
      .maybeSingle();
    
    // Sprawdź, czy użytkownik jest właścicielem grupy
    const { data: group, error: groupError } = await supabaseAdmin
      .from('groups')
      .select('owner_id')
      .eq('id', groupId)
      .single();
    
    if (groupError) {
      console.error('Error fetching group:', groupError);
      return NextResponse.json(
        { error: 'Group not found', details: groupError },
        { status: 404 }
      );
    }
    
    const isOwner = group.owner_id === userProfile.id;
    const isMember = membership && membership.status === 'active';
    
    // Sprawdź uprawnienia - tylko członkowie grupy mogą widzieć innych członków
    if (!isOwner && !isMember) {
      return NextResponse.json(
        { error: 'You do not have permission to view group members' },
        { status: 403 }
      );
    }

    // Podejście alternatywne - najpierw pobieramy członków bez zagnieżdżania
    const { data: members, error: membersError } = await supabaseAdmin
      .from('group_members')
      .select('id, user_id, role, status, joined_at, created_at')
      .eq('group_id', groupId)
      .eq('status', 'active'); // tylko aktywni członkowie
    
    if (membersError) {
      console.error('Error fetching group members:', membersError);
      return NextResponse.json(
        { error: 'Failed to fetch group members', details: membersError },
        { status: 500 }
      );
    }

    // Teraz pobieramy dane profilowe dla każdego członka osobno
    const membersWithProfiles = await Promise.all(members.map(async (member) => {
      const { data: userProfile, error: userError } = await supabaseAdmin
        .from('user_profiles')
        .select('id, display_name, avatar_url, email, verification_level, rating_avg')
        .eq('id', member.user_id)
        .single();
      
      if (userError) {
        console.warn(`Error fetching profile for user ${member.user_id}:`, userError);
        return {
          ...member,
          user: null,
          isOwner: member.user_id === group.owner_id
        };
      }
      
      return {
        ...member,
        user: userProfile,
        isOwner: member.user_id === group.owner_id
      };
    }));
    
    console.log(`Successfully fetched ${membersWithProfiles.length} members for group ${groupId}`);
    return NextResponse.json(membersWithProfiles);
  } catch (error) {
    console.error('Unexpected error in GET /api/groups/[id]/members:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/groups/[id]/members
 * Dodaje nowego członka do grupy
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
    const { email, role = 'member', userId } = await request.json();
    
    if (!email && !userId) {
      return NextResponse.json(
        { error: 'Either email or userId is required' },
        { status: 400 }
      );
    }
    
    // Pobierz profil użytkownika
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
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
    
    // Sprawdź, czy użytkownik ma uprawnienia do dodawania członków
    const { data: group, error: groupError } = await supabaseAdmin
      .from('groups')
      .select('owner_id')
      .eq('id', groupId)
      .single();
    
    if (groupError) {
      console.error('Error fetching group:', groupError);
      return NextResponse.json(
        { error: 'Group not found', details: groupError },
        { status: 404 }
      );
    }
    
    const isOwner = group.owner_id === userProfile.id;
    
    if (!isOwner) {
      // Sprawdź, czy użytkownik jest administratorem
      const { data: membership, error: membershipError } = await supabaseAdmin
        .from('group_members')
        .select('role')
        .eq('user_id', userProfile.id)
        .eq('group_id', groupId)
        .eq('status', 'active')
        .eq('role', 'admin')
        .maybeSingle();
      
      if (membershipError || !membership) {
        return NextResponse.json(
          { error: 'You do not have permission to add members to this group' },
          { status: 403 }
        );
      }
    }
    
    // Znajdź ID użytkownika do dodania
    let targetUserId = userId;
    
    if (!targetUserId && email) {
      // Znajdź użytkownika po adresie email
      const { data: targetUser, error: targetUserError } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('email', email)
        .maybeSingle();
      
      if (targetUserError && targetUserError.code !== 'PGRST116') {
        console.error('Error finding user by email:', targetUserError);
        return NextResponse.json(
          { error: 'Failed to find user by email', details: targetUserError },
          { status: 500 }
        );
      }
      
      if (!targetUser) {
        return NextResponse.json(
          { error: 'User with this email not found' },
          { status: 404 }
        );
      }
      
      targetUserId = targetUser.id;
    }
    
    // Sprawdź, czy użytkownik już jest członkiem grupy
    const { data: existingMember, error: existingMemberError } = await supabaseAdmin
      .from('group_members')
      .select('id, status')
      .eq('user_id', targetUserId)
      .eq('group_id', groupId)
      .maybeSingle();
    
    if (existingMember) {
      // Jeśli członek już istnieje, ale został wcześniej usunięty/zawieszony
      if (existingMember.status !== 'active') {
        // Aktualizuj istniejące członkostwo
        const { data: updatedMember, error: updateError } = await supabaseAdmin
          .from('group_members')
          .update({
            status: 'active',
            role: role,
            joined_at: new Date().toISOString(),
          })
          .eq('id', existingMember.id)
          .select()
          .single();
        
        if (updateError) {
          console.error('Error updating group member:', updateError);
          return NextResponse.json(
            { error: 'Failed to update group member', details: updateError },
            { status: 500 }
          );
        }
        
        return NextResponse.json(updatedMember);
      }
      
      return NextResponse.json(
        { error: 'User is already a member of this group' },
        { status: 400 }
      );
    }
    
    // Dodaj nowego członka
    const { data: newMember, error: createError } = await supabaseAdmin
      .from('group_members')
      .insert({
        group_id: groupId,
        user_id: targetUserId,
        role: role,
        status: 'active',
        invited_by: userProfile.id,
        joined_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (createError) {
      console.error('Error adding group member:', createError);
      return NextResponse.json(
        { error: 'Failed to add group member', details: createError },
        { status: 500 }
      );
    }
    
    return NextResponse.json(newMember);
  } catch (error) {
    console.error('Unexpected error in POST /api/groups/[id]/members:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/groups/[id]/members/[memberId]
 * Usuwa członka z grupy
 */
export async function DELETE(request, { params }) {
  try {
    const { id: groupId } = params;
    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');
    
    if (!memberId) {
      return NextResponse.json(
        { error: 'Member ID is required' },
        { status: 400 }
      );
    }
    
    // Sprawdź autentykację
    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Pobierz profil użytkownika
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
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
    
    // Pobierz dane grupy
    const { data: group, error: groupError } = await supabaseAdmin
      .from('groups')
      .select('owner_id')
      .eq('id', groupId)
      .single();
    
    if (groupError) {
      console.error('Error fetching group:', groupError);
      return NextResponse.json(
        { error: 'Group not found', details: groupError },
        { status: 404 }
      );
    }
    
    // Pobierz członka do usunięcia
    const { data: member, error: memberError } = await supabaseAdmin
      .from('group_members')
      .select('user_id, role')
      .eq('id', memberId)
      .eq('group_id', groupId)
      .single();
    
    if (memberError) {
      console.error('Error fetching group member:', memberError);
      return NextResponse.json(
        { error: 'Member not found in this group', details: memberError },
        { status: 404 }
      );
    }
    
    // Sprawdź uprawnienia do usunięcia członka
    const isOwner = group.owner_id === userProfile.id;
    const isAdmin = await isGroupAdmin(groupId, userProfile.id);
    const isSelf = member.user_id === userProfile.id;
    
    // Właściciel może usunąć każdego, admin może usunąć zwykłych członków, użytkownik może usunąć siebie
    if (!isOwner && !isSelf && !(isAdmin && member.role !== 'admin')) {
      return NextResponse.json(
        { error: 'You do not have permission to remove this member' },
        { status: 403 }
      );
    }
    
    // Nie można usunąć właściciela grupy
    if (member.user_id === group.owner_id) {
      return NextResponse.json(
        { error: 'Cannot remove the group owner' },
        { status: 400 }
      );
    }
    
    // Usuń członka (w praktyce oznacz jako nieaktywnego)
    const { error: deleteError } = await supabaseAdmin
      .from('group_members')
      .update({
        status: 'removed',
      })
      .eq('id', memberId);
    
    if (deleteError) {
      console.error('Error removing group member:', deleteError);
      return NextResponse.json(
        { error: 'Failed to remove group member', details: deleteError },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ message: 'Member removed successfully' });
  } catch (error) {
    console.error('Unexpected error in DELETE /api/groups/[id]/members:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/groups/[id]/members/[memberId]
 * Zmienia rolę członka grupy
 */
export async function PATCH(request, { params }) {
  try {
    const { id: groupId } = params;
    
    // Pobierz dane z żądania
    const { memberId, role } = await request.json();
    
    if (!memberId || !role) {
      return NextResponse.json(
        { error: 'Member ID and role are required' },
        { status: 400 }
      );
    }
    
    if (!['admin', 'member'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be either "admin" or "member"' },
        { status: 400 }
      );
    }
    
    // Sprawdź autentykację
    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Pobierz profil użytkownika
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
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
    
    // Sprawdź, czy użytkownik ma uprawnienia do zmiany roli
    const { data: group, error: groupError } = await supabaseAdmin
      .from('groups')
      .select('owner_id')
      .eq('id', groupId)
      .single();
    
    if (groupError) {
      console.error('Error fetching group:', groupError);
      return NextResponse.json(
        { error: 'Group not found', details: groupError },
        { status: 404 }
      );
    }
    
    // Tylko właściciel grupy może zmieniać role
    if (group.owner_id !== userProfile.id) {
      return NextResponse.json(
        { error: 'Only the group owner can change member roles' },
        { status: 403 }
      );
    }
    
    // Pobierz członka do aktualizacji
    const { data: member, error: memberError } = await supabaseAdmin
      .from('group_members')
      .select('user_id')
      .eq('id', memberId)
      .eq('group_id', groupId)
      .single();
    
    if (memberError) {
      console.error('Error fetching group member:', memberError);
      return NextResponse.json(
        { error: 'Member not found in this group', details: memberError },
        { status: 404 }
      );
    }
    
    // Nie można zmienić roli właściciela
    if (member.user_id === group.owner_id) {
      return NextResponse.json(
        { error: 'Cannot change the role of the group owner' },
        { status: 400 }
      );
    }
    
    // Aktualizuj rolę członka
    const { data: updatedMember, error: updateError } = await supabaseAdmin
      .from('group_members')
      .update({
        role: role,
      })
      .eq('id', memberId)
      .select()
      .single();
    
    if (updateError) {
      console.error('Error updating member role:', updateError);
      return NextResponse.json(
        { error: 'Failed to update member role', details: updateError },
        { status: 500 }
      );
    }
    
    return NextResponse.json(updatedMember);
  } catch (error) {
    console.error('Unexpected error in PATCH /api/groups/[id]/members:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error.message },
      { status: 500 }
    );
  }
}

// Funkcja pomocnicza do sprawdzania, czy użytkownik jest administratorem grupy
async function isGroupAdmin(groupId, userId) {
  const { data, error } = await supabaseAdmin
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('role', 'admin')
    .maybeSingle();
  
  return !error && !!data;
}