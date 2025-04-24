// src/app/api/groups/[id]/subscriptions/route.js
import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import supabaseAdmin from '@/lib/database/supabase-admin-client';

/**
 * GET /api/groups/[id]/subscriptions
 * Pobiera subskrypcje grupy
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
    
    console.log(`Fetching subscriptions for group ${groupId}, user: ${user.id}`);
    
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
    
    // Sprawdź, czy użytkownik ma dostęp do grupy
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
      // Sprawdź, czy użytkownik jest członkiem grupy
      const { data: membership, error: membershipError } = await supabaseAdmin
        .from('group_members')
        .select('role, status')
        .eq('user_id', userProfile.id)
        .eq('group_id', groupId)
        .eq('status', 'active')
        .maybeSingle();
      
      if (membershipError && membershipError.code !== 'PGRST116') {
        console.error('Error checking group membership:', membershipError);
        return NextResponse.json(
          { error: 'Failed to check group membership', details: membershipError },
          { status: 500 }
        );
      }
      
      if (!membership) {
        return NextResponse.json(
          { error: 'You do not have access to this group' },
          { status: 403 }
        );
      }
    }
    
    // Pobierz subskrypcje grupy
    const { data: subscriptions, error: subscriptionsError } = await supabaseAdmin
      .from('group_subs')
      .select(`
        *,
        subscription_platforms(*),
        members:purchase_records(id)
      `)
      .eq('group_id', groupId)
      .order('created_at', { ascending: false });
    
    if (subscriptionsError) {
      console.error('Error fetching group subscriptions:', subscriptionsError);
      return NextResponse.json(
        { error: 'Failed to fetch group subscriptions', details: subscriptionsError },
        { status: 500 }
      );
    }
    
    // Wzbogać dane subskrypcji o liczbę zakupów
    const enrichedSubscriptions = subscriptions.map(sub => ({
      ...sub,
      purchase_count: sub.members?.length || 0
    }));
    
    console.log(`Fetched ${enrichedSubscriptions.length} subscriptions for group ${groupId}`);
    return NextResponse.json(enrichedSubscriptions);
  } catch (error) {
    console.error('Unexpected error in GET /api/groups/[id]/subscriptions:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error.message },
      { status: 500 }
    );
  }
}