// src/app/api/offers/user-accessible/route.js
import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import supabaseAdmin from '@/lib/database/supabase-admin-client';
import { offerService } from '@/services/offer/offer-service';

/**
 * GET /api/offers/user-accessible
 * Pobiera oferty dostępne dla zalogowanego użytkownika (publiczne i z prywatnych grup)
 */
export async function GET(request) {
  try {
    console.log('GET /api/offers/user-accessible - Request received');
    
    // Parsuj parametry zapytania
    const { searchParams } = new URL(request.url);
    console.log('Search params:', Object.fromEntries(searchParams.entries()));
    
    // Przygotuj filtry na podstawie parametrów
    const filters = {
      platformId: searchParams.get('platformId'),
      minPrice: searchParams.get('minPrice') ? parseFloat(searchParams.get('minPrice')) : undefined,
      maxPrice: searchParams.get('maxPrice') ? parseFloat(searchParams.get('maxPrice')) : undefined,
      availableSlots: searchParams.get('availableSlots') !== 'false', // Domyślnie true
      orderBy: searchParams.get('orderBy') || 'created_at',
      ascending: searchParams.get('ascending') === 'true',
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')) : 20,
      page: searchParams.get('page') ? parseInt(searchParams.get('page')) : 1
    };
    
    // Oblicz offset na podstawie strony i limitu
    filters.offset = (filters.page - 1) * filters.limit;
    
    // Pobierz zalogowanego użytkownika
    const user = await currentUser();
    let userProfileId = null;
    
    if (user) {
      // Pobierz profil użytkownika
      const { data: userProfile } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('external_auth_id', user.id)
        .maybeSingle();
        
      if (userProfile) {
        userProfileId = userProfile.id;
      }
    }
    
    // Pobierz oferty dostępne dla użytkownika
    const offers = await offerService.getUserAccessibleOffers(filters, userProfileId);
    
    console.log(`Query successful, returned ${offers?.length || 0} offers`);
    
    // Zwróć odpowiedź
    return NextResponse.json(offers || []);
  } catch (error) {
    console.error('Unexpected error in /api/offers/user-accessible:', error);
    return NextResponse.json(
      { error: 'Nie udało się pobrać ofert subskrypcji', details: error.message },
      { status: 500 }
    );
  }
}