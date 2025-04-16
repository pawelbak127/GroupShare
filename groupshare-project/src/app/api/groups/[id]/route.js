// src/app/api/groups/[id]/route.js
import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import supabaseAdmin from '@/lib/database/supabase-admin-client';

/**
 * GET /api/groups/[id]
 * Pobiera szczegóły grupy
 */
export async function GET(request, { params }) {
  try {
    const { id } = params;
    
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
      .single();
    
    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return NextResponse.json(
        { error: 'Failed to fetch user profile', details: profileError },
        { status: 500 }
      );
    }
    
    // Pobierz dane grupy
    const { data: group, error: groupError } = await supabaseAdmin
      .from('groups')
      .select(`
        id,
        name,
        description,
        created_at,
        updated_at,
        owner_id
      `)
      .eq('id', id)
      .single();
    
    if (groupError) {
      console.error('Error fetching group:', groupError);
      return NextResponse.json(
        { error: 'Group not found', details: groupError },
        { status: 404 }
      );
    }
    
    // Sprawdź, czy użytkownik należy do tej grupy
    const isOwner = group.owner_id === userProfile.id;
    
    let role = isOwner ? 'owner' : null;
    
    if (!isOwner) {
      // Sprawdź członkostwo w grupie
      const { data: membership, error: membershipError } = await supabaseAdmin
        .from('group_members')
        .select('role, status')
        .eq('user_id', userProfile.id)
        .eq('group_id', id)
        .single();
      
      if (membershipError || !membership || membership.status !== 'active') {
        // Użytkownik nie należy do grupy lub jego członkostwo nie jest aktywne
        return NextResponse.json(
          { error: 'You do not have permission to access this group' },
          { status: 403 }
        );
      }
      
      role = membership.role;
    }
    
    // Wzbogać dane grupy o informacje o użytkowniku
    const { count: memberCount } = await supabaseAdmin
      .from('group_members')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', id)
      .eq('status', 'active');
    
    const { count: subscriptionCount } = await supabaseAdmin
      .from('group_subs')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', id);
    
    // Dane o właścicielu grupy
    const { data: ownerData } = await supabaseAdmin
      .from('user_profiles')
      .select('display_name, avatar_url')
      .eq('id', group.owner_id)
      .single();
    
    const enrichedGroup = {
      ...group,
      isOwner,
      role,
      member_count: memberCount || 0,
      subscription_count: subscriptionCount || 0,
      owner: ownerData || { display_name: 'Unknown' }
    };
    
    return NextResponse.json(enrichedGroup);
  } catch (error) {
    console.error('Unexpected error in GET /api/groups/[id]:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/groups/[id]
 * Aktualizuje istniejącą grupę
 */
export async function PATCH(request, { params }) {
  try {
    const { id } = params;
    
    // Sprawdź autentykację
    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Pobierz dane z żądania
    const updates = await request.json();
    
    // Pobierz profil użytkownika
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('external_auth_id', user.id)
      .single();
    
    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return NextResponse.json(
        { error: 'Failed to fetch user profile', details: profileError },
        { status: 500 }
      );
    }
    
    // Pobierz dane grupy aby sprawdzić uprawnienia
    const { data: group, error: groupError } = await supabaseAdmin
      .from('groups')
      .select('owner_id')
      .eq('id', id)
      .single();
    
    if (groupError) {
      console.error('Error fetching group:', groupError);
      return NextResponse.json(
        { error: 'Group not found', details: groupError },
        { status: 404 }
      );
    }
    
    // Sprawdź, czy użytkownik jest właścicielem lub adminem grupy
    const isOwner = group.owner_id === userProfile.id;
    
    if (!isOwner) {
      // Sprawdź, czy użytkownik jest adminem
      const { data: membership, error: membershipError } = await supabaseAdmin
        .from('group_members')
        .select('role')
        .eq('user_id', userProfile.id)
        .eq('group_id', id)
        .eq('status', 'active')
        .eq('role', 'admin')
        .single();
      
      if (membershipError || !membership) {
        return NextResponse.json(
          { error: 'You do not have permission to update this group' },
          { status: 403 }
        );
      }
    }
    
    // Przygotuj dane do aktualizacji - używając tylko kolumn, które faktycznie istnieją w tabeli
    const updateData = {
      updated_at: new Date().toISOString()
    };
    
    // Selektywnie aktualizuj tylko te pola, które zostały przekazane
    if (updates.name && typeof updates.name === 'string' && updates.name.trim().length >= 3) {
      updateData.name = updates.name.trim();
    }
    
    if (updates.description !== undefined) {
      updateData.description = updates.description?.trim() || null;
    }
    
    // Aktualizuj grupę
    const { data: updatedGroup, error: updateError } = await supabaseAdmin
      .from('groups')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (updateError) {
      console.error('Error updating group:', updateError);
      return NextResponse.json(
        { error: 'Failed to update group', details: updateError },
        { status: 500 }
      );
    }
    
    // Wzbogać dane grupy o informacje o użytkowniku
    const enrichedGroup = {
      ...updatedGroup,
      isOwner,
      role: isOwner ? 'owner' : 'admin'
    };
    
    return NextResponse.json(enrichedGroup);
  } catch (error) {
    console.error('Unexpected error in PATCH /api/groups/[id]:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/groups/[id]
 * Usuwa grupę (tylko właściciel może to zrobić)
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    
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
      .single();
    
    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return NextResponse.json(
        { error: 'Failed to fetch user profile', details: profileError },
        { status: 500 }
      );
    }
    
    // Pobierz dane grupy aby sprawdzić uprawnienia
    const { data: group, error: groupError } = await supabaseAdmin
      .from('groups')
      .select('owner_id')
      .eq('id', id)
      .single();
    
    if (groupError) {
      console.error('Error fetching group:', groupError);
      return NextResponse.json(
        { error: 'Group not found', details: groupError },
        { status: 404 }
      );
    }
    
    // Tylko właściciel może usunąć grupę
    if (group.owner_id !== userProfile.id) {
      return NextResponse.json(
        { error: 'Only the group owner can delete a group' },
        { status: 403 }
      );
    }
    
    // Usuń grupę
    const { error: deleteError } = await supabaseAdmin
      .from('groups')
      .delete()
      .eq('id', id);
    
    if (deleteError) {
      console.error('Error deleting group:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete group', details: deleteError },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { message: 'Group deleted successfully' }
    );
  } catch (error) {
    console.error('Unexpected error in DELETE /api/groups/[id]:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error.message },
      { status: 500 }
    );
  }
}