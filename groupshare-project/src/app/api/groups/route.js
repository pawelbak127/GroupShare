// src/app/api/groups/route.js
import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import supabaseAdmin from '@/lib/database/supabase-admin-client';

/**
 * GET /api/groups
 * Pobiera grupy użytkownika
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
    
    console.log('Fetching groups for user:', user.id);
    
    // Pobierz lub utwórz profil użytkownika
    let userProfile = null;
    
    try {
      // Próba pobrania profilu
      const { data: existingProfile, error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('external_auth_id', user.id)
        .maybeSingle(); // Używamy maybeSingle zamiast single!
      
      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error fetching user profile:', profileError);
        return NextResponse.json(
          { error: 'Failed to fetch user profile', details: profileError },
          { status: 500 }
        );
      }
      
      // Jeśli znaleziono profil, użyj go
      if (existingProfile) {
        userProfile = existingProfile;
        console.log('Found existing user profile:', userProfile.id);
      } else {
        // Jeśli nie znaleziono profilu, utwórz nowy
        console.log('Creating new user profile for:', user.id);
        
        // Przygotuj dane nowego profilu
        const newProfileData = {
          external_auth_id: user.id,
          display_name: user.firstName 
            ? `${user.firstName} ${user.lastName || ''}`.trim() 
            : (user.username || 'Nowy użytkownik'),
          email: user.emailAddresses[0]?.emailAddress || '',
          profile_type: 'both',
          verification_level: 'basic',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        // Utwórz nowy profil
        const { data: newProfile, error: createError } = await supabaseAdmin
          .from('user_profiles')
          .insert([newProfileData])
          .select('id')
          .single();
          
        if (createError) {
          console.error('Error creating user profile:', createError);
          return NextResponse.json(
            { error: 'Failed to create user profile', details: createError },
            { status: 500 }
          );
        }
        
        userProfile = newProfile;
        console.log('Created new user profile:', userProfile.id);
      }
    } catch (error) {
      console.error('Exception fetching/creating user profile:', error);
      return NextResponse.json(
        { error: 'Failed to process user profile', details: error.message },
        { status: 500 }
      );
    }
    
    if (!userProfile || !userProfile.id) {
      console.error('No user profile available after profile handling');
      return NextResponse.json(
        { error: 'User profile not available', details: 'Profile processing failed' },
        { status: 500 }
      );
    }
    
    console.log('User profile ID:', userProfile.id);
    
    // Grupy, których użytkownik jest właścicielem
    let ownedGroups = [];
    try {
      const { data: owned, error: ownedError } = await supabaseAdmin
        .from('groups')
        .select(`
          id,
          name,
          description,
          created_at,
          owner_id,
          status
        `)
        .eq('owner_id', userProfile.id);
      
      if (ownedError) {
        console.error('Error fetching owned groups:', ownedError);
        return NextResponse.json(
          { error: 'Failed to fetch owned groups', details: ownedError },
          { status: 500 }
        );
      }
      
      // Dodaj informacje o roli i uzupełnij dane
      ownedGroups = owned.map(group => ({
        ...group,
        isOwner: true,
        role: 'owner'
      }));
    } catch (error) {
      console.error('Exception fetching owned groups:', error);
    }
    
    // Grupy, których użytkownik jest członkiem
    let memberGroups = [];
    try {
      const { data: memberships, error: membershipError } = await supabaseAdmin
        .from('group_members')
        .select(`
          role,
          group:groups(
            id, 
            name,
            description,
            created_at,
            owner_id,
            status
          )
        `)
        .eq('user_id', userProfile.id)
        .eq('status', 'active');
      
      if (membershipError) {
        console.error('Error fetching group memberships:', membershipError);
      } else {
        // Formatuj dane grup, do których użytkownik należy
        memberGroups = memberships
          .filter(m => m.group) // Odfiltruj null/undefined
          .map(membership => ({
            ...membership.group,
            isOwner: false,
            role: membership.role
          }));
      }
    } catch (error) {
      console.error('Exception fetching member groups:', error);
    }
    
    // Pobierz dodatkowe informacje o grupach - liczba subskrypcji, członków itp.
    const allGroups = [...ownedGroups, ...memberGroups];
    const enrichedGroups = await Promise.all(allGroups.map(async (group) => {
      try {
        // Liczba członków grupy
        const { count: memberCount } = await supabaseAdmin
          .from('group_members')
          .select('id', { count: 'exact', head: true })
          .eq('group_id', group.id)
          .eq('status', 'active');
        
        // Liczba subskrypcji grupy
        const { count: subscriptionCount } = await supabaseAdmin
          .from('group_subs')
          .select('id', { count: 'exact', head: true })
          .eq('group_id', group.id);
        
        return {
          ...group,
          member_count: memberCount || 0,
          subscription_count: subscriptionCount || 0
        };
      } catch (error) {
        console.error(`Error enriching group ${group.id}:`, error);
        return group;
      }
    }));
    
    return NextResponse.json(enrichedGroups);
  } catch (error) {
    console.error('Unexpected error in /api/groups:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/groups
 * Tworzy nową grupę
 */
export async function POST(request) {
  try {
    // Sprawdź autentykację
    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Pobierz dane z żądania
    const body = await request.json();
    
    // Podstawowa walidacja
    if (!body.name || body.name.trim().length < 3) {
      return NextResponse.json(
        { error: 'Group name is required and must be at least 3 characters long' },
        { status: 400 }
      );
    }
    
    // Pobierz lub utwórz profil użytkownika
    let userProfile = null;
    
    try {
      // Próba pobrania profilu
      const { data: existingProfile, error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('external_auth_id', user.id)
        .maybeSingle(); // Używamy maybeSingle zamiast single!
      
      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Error fetching user profile:', profileError);
        return NextResponse.json(
          { error: 'Failed to fetch user profile', details: profileError },
          { status: 500 }
        );
      }
      
      // Jeśli znaleziono profil, użyj go
      if (existingProfile) {
        userProfile = existingProfile;
      } else {
        // Jeśli nie znaleziono profilu, utwórz nowy
        const newProfileData = {
          external_auth_id: user.id,
          display_name: user.firstName 
            ? `${user.firstName} ${user.lastName || ''}`.trim() 
            : (user.username || 'Nowy użytkownik'),
          email: user.emailAddresses[0]?.emailAddress || '',
          profile_type: 'both',
          verification_level: 'basic',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };
        
        // Utwórz nowy profil
        const { data: newProfile, error: createError } = await supabaseAdmin
          .from('user_profiles')
          .insert([newProfileData])
          .select('id')
          .single();
          
        if (createError) {
          console.error('Error creating user profile:', createError);
          return NextResponse.json(
            { error: 'Failed to create user profile', details: createError },
            { status: 500 }
          );
        }
        
        userProfile = newProfile;
      }
    } catch (error) {
      console.error('Exception fetching/creating user profile:', error);
      return NextResponse.json(
        { error: 'Failed to process user profile', details: error.message },
        { status: 500 }
      );
    }
    
    // Przygotuj dane grupy - używając tylko kolumn, które faktycznie istnieją w tabeli
    const groupData = {
      name: body.name.trim(),
      description: body.description?.trim() || null,
      owner_id: userProfile.id,
      status: 'active',
      visibility: body.visibility || 'private', // Dodanie pola visibility
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Utwórz grupę
    const { data: group, error: createError } = await supabaseAdmin
      .from('groups')
      .insert([groupData])
      .select()
      .single();
    
    if (createError) {
      console.error('Error creating group:', createError);
      return NextResponse.json(
        { error: 'Failed to create group', details: createError },
        { status: 500 }
      );
    }
    
    // Dodaj właściciela jako członka grupy
    const { error: memberError } = await supabaseAdmin
      .from('group_members')
      .insert({
        group_id: group.id,
        user_id: userProfile.id,
        role: 'admin', // Właściciel jest automatycznie adminem
        status: 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    
    if (memberError) {
      console.error('Error adding owner as member:', memberError);
      // Kontynuujemy mimo błędu - grupa została utworzona
    }
    
    // Dodaj informacje o roli
    const enrichedGroup = {
      ...group,
      isOwner: true,
      role: 'admin'
    };
    
    return NextResponse.json(enrichedGroup, { status: 201 });
  } catch (error) {
    console.error('Unexpected error in POST /api/groups:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error.message },
      { status: 500 }
    );
  }
}