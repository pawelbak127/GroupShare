// src/app/api/groups/user-groups/route.js
import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import supabaseAdmin from '@/lib/database/supabase-admin-client';

/**
 * GET /api/groups/user-groups
 * Pobiera wszystkie grupy do których należy użytkownik (publiczne i prywatne)
 */
export async function GET(request) {
  try {
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
    
    if (profileError || !userProfile) {
      console.error('Error fetching user profile:', profileError);
      return NextResponse.json(
        { error: 'User profile not found', details: profileError },
        { status: 404 }
      );
    }
    
    // Pobierz grupy, których użytkownik jest właścicielem
    const { data: ownedGroups, error: ownedError } = await supabaseAdmin
      .from('groups')
      .select('*')
      .eq('owner_id', userProfile.id);
    
    if (ownedError) {
      console.error('Error fetching owned groups:', ownedError);
      return NextResponse.json(
        { error: 'Failed to fetch owned groups', details: ownedError },
        { status: 500 }
      );
    }
    
    // Pobierz grupy, których użytkownik jest członkiem
    const { data: memberships, error: membershipError } = await supabaseAdmin
      .from('group_members')
      .select(`
        group:groups(*)
      `)
      .eq('user_id', userProfile.id)
      .eq('status', 'active');
    
    if (membershipError) {
      console.error('Error fetching memberships:', membershipError);
      return NextResponse.json(
        { error: 'Failed to fetch memberships', details: membershipError },
        { status: 500 }
      );
    }
    
    // Wyodrębnij grupy z członkostw
    const memberGroups = memberships
      .filter(m => m.group)
      .map(m => ({
        ...m.group,
        role: 'member'
      }));
    
    // Połącz wszystkie grupy (własne i członkowskie)
    const allGroups = [
      ...ownedGroups.map(group => ({ ...group, role: 'owner', isOwner: true })),
      ...memberGroups.filter(group => !ownedGroups.some(og => og.id === group.id))
    ];
    
    return NextResponse.json(allGroups);
  } catch (error) {
    console.error('Error fetching user groups:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error.message },
      { status: 500 }
    );
  }
}