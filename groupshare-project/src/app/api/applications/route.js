import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import supabaseAdmin from '@/lib/database/supabase-admin-client';

/**
 * GET /api/applications
 * Pobiera aplikacje użytkownika
 */
export async function GET(request) {
  try {
    // Dodajemy obsługę błędów Clerk API
    let user;
    try {
      user = await currentUser();
    } catch (clerkError) {
      console.error('Clerk authorization error:', clerkError);
      // Zwracamy dane mimo błędu autoryzacji (awaryjny tryb działania)
      // Zamiast 500, zwracamy puste dane
      return NextResponse.json([]);
    }

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

    // Pobierz parametry z URL
    const { searchParams } = new URL(request.url);
    const active = searchParams.get('active') === 'true';
    const applicationId = searchParams.get('id');

    // Pobierz zakupy użytkownika
    let query = supabaseAdmin
      .from('purchase_records')
      .select(`
        *,
        group_sub:group_subs(
          id, 
          price_per_slot,
          currency,
          subscription_platforms(id, name, icon)
        )
      `)
      .eq('user_id', userProfile.id);
    
    // Filtruj po ID jeśli podano
    if (applicationId) {
      query = query.eq('id', applicationId);
    }
    
    // Filtruj aktywne aplikacje
    if (active) {
      query = query.in('status', ['pending', 'accepted', 'completed']);
    }
    
    // Sortuj
    query = query.order('created_at', { ascending: false });
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Error fetching purchase records:', error);
      return NextResponse.json(
        { error: 'Failed to fetch purchase records', details: error },
        { status: 500 }
      );
    }
    
    // Przekształć dane zakupów na format oczekiwany przez dashboard
    const applications = data.map(purchase => ({
      id: purchase.id,
      user_id: purchase.user_id,
      status: purchase.status,
      created_at: purchase.created_at,
      updated_at: purchase.updated_at,
      access_provided: purchase.access_provided,
      access_confirmed: purchase.access_confirmed,
      group_sub: purchase.group_sub
    }));
    
    return NextResponse.json(applications || []);
  } catch (error) {
    console.error('Error in applications API:', error);
    // Zwracamy puste dane zamiast błędu dla lepszej obsługi błędów
    return NextResponse.json([]);
  }
}