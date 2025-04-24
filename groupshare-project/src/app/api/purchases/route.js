export const dynamic = "force-dynamic";
import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import supabaseAdmin from '@/lib/database/supabase-admin-client';

/**
 * GET /api/purchases
 * Pobiera zakupy użytkownika
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

    console.log(`Fetching purchases for user: ${user.id}`);

    // Pobierz profil użytkownika
    let userProfileId = null;
    
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
        userProfileId = existingProfile.id;
        console.log(`Found existing user profile: ${userProfileId}`);
      } else {
        // Jeśli nie znaleziono profilu, utwórz nowy
        console.log(`Creating new user profile for: ${user.id}`);
        
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
        
        userProfileId = newProfile.id;
        console.log(`Created new user profile: ${userProfileId}`);
      }
    } catch (error) {
      console.error('Exception while fetching/creating user profile:', error);
      return NextResponse.json(
        { error: 'Failed to process user profile', details: error.message },
        { status: 500 }
      );
    }

    // Pobierz parametry z URL
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status'); // można filtrować po statusie
    const active = searchParams.get('active') === 'true'; // tylko aktywne zakupy

    // Buduj zapytanie
    let query = supabaseAdmin
      .from('purchase_records')
      .select(`
        *,
        group_sub:group_subs(
          *,
          subscription_platforms(*),
          groups(id, name, owner_id)
        ),
        transaction:transactions(
          id, 
          amount, 
          currency,
          status,
          completed_at
        )
      `)
      .eq('user_id', userProfileId);

    // Dodaj filtry
    if (status) {
      query = query.eq('status', status);
    } else if (active) {
      query = query.in('status', ['pending_payment', 'payment_processing', 'completed']);
    }

    // Sortowanie - najpierw najnowsze
    query = query.order('created_at', { ascending: false });

    // Wykonaj zapytanie
    const { data, error } = await query;

    if (error) {
      console.error('Error fetching purchases:', error);
      return NextResponse.json(
        { error: 'Failed to fetch purchases', details: error },
        { status: 500 }
      );
    }

    console.log(`Retrieved ${data?.length || 0} purchases for user ${userProfileId}`);
    
    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Unexpected error in /api/purchases:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error.message },
      { status: 500 }
    );
  }
}