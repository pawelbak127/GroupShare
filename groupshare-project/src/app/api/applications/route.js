import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import supabaseAdmin from '@/lib/database/supabase-admin-client';

/**
 * GET /api/applications
 * Pobiera aplikacje użytkownika
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

    // Pobierz parametry z URL
    const { searchParams } = new URL(request.url);
    const active = searchParams.get('active') === 'true';

    // Pobierz profil użytkownika bezpośrednio z supabaseAdmin
    let userProfileId = null;
    
    try {
      const { data: userProfile, error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('external_auth_id', user.id)
        .single();

      if (profileError) {
        // Jeśli błąd to PGRST116 (no rows), utworzymy profil
        if (profileError.code === 'PGRST116') {
          // Tworzenie nowego profilu
          const newProfile = {
            external_auth_id: user.id,
            display_name: user.firstName 
              ? `${user.firstName} ${user.lastName || ''}`.trim() 
              : (user.username || 'Nowy użytkownik'),
            email: user.emailAddresses[0]?.emailAddress || '',
            profile_type: 'both', // Domyślna wartość
            verification_level: 'basic', // Domyślna wartość
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
          
          const { data: createdProfile, error: createError } = await supabaseAdmin
            .from('user_profiles')
            .insert([newProfile])
            .select('id')
            .single();
            
          if (createError) {
            console.error('Error creating user profile:', createError);
            return NextResponse.json(
              { error: 'Failed to create user profile', details: createError },
              { status: 500 }
            );
          }
          
          userProfileId = createdProfile.id;
        } else {
          console.error('Error fetching user profile:', profileError);
          return NextResponse.json(
            { error: 'Failed to fetch user profile', details: profileError },
            { status: 500 }
          );
        }
      } else if (userProfile) {
        userProfileId = userProfile.id;
      }
    } catch (error) {
      console.error('Exception while handling user profile:', error);
      return NextResponse.json(
        { error: 'Failed to process user profile', details: error.message },
        { status: 500 }
      );
    }

    // Jeśli nie udało się uzyskać ID profilu, zwróć pustą tablicę zamiast błędu
    if (!userProfileId) {
      console.warn('No user profile ID available, returning empty array');
      return NextResponse.json([]);
    }

    // Zapytanie do bazy danych
    let query = supabaseAdmin
      .from('purchase_records')  // Zmieniono z 'applications' na 'purchase_records'
      .select(`
        *,
        group_sub:group_subs(
          id, 
          price_per_slot,
          currency,
          subscription_platforms(id, name, icon)
        ),
        seller:group_subs(
          groups(
            owner_id, 
            user_profiles!inner(id, display_name, avatar_url)
          )
        )
      `)
      .eq('user_id', userProfileId);

    // Filtruj aktywne aplikacje
    if (active) {
      query = query.in('status', ['pending', 'accepted', 'completed']);
    }
    
    // Sortuj
    query = query.order('created_at', { ascending: false });
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching applications:', error);
      return NextResponse.json(
        { error: 'Failed to fetch applications', details: error },
        { status: 500 }
      );
    }
    
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error in applications API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error.message },
      { status: 500 }
    );
  }
}