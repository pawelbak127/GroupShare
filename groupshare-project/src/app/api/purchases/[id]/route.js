import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import supabase from '../../../../lib/database/supabase-client';
import supabaseAdmin from '../../../../lib/database/supabase-admin-client';

/**
 * GET /api/purchases/[id]
 * Pobiera szczegóły zakupu
 */
export async function GET(request, { params }) {
  try {
    const { id } = params;
    
    // Sprawdź parametry URL
    const { searchParams } = new URL(request.url);
    const isTransactionId = searchParams.get('transactionId') === 'true';
    console.log(`Pobieranie szczegółów ${isTransactionId ? 'transakcji' : 'zakupu'} ${id}`);
    
    // Sprawdź autentykację
    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    console.log(`Pobieranie dla użytkownika ${user.id}`);
    
    // Pobierz profil użytkownika
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('id')
      .eq('external_auth_id', user.id)
      .single();
    
    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return NextResponse.json(
        { error: 'Failed to verify user profile', details: profileError },
        { status: 500 }
      );
    }
    
    if (!userProfile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }
    
    let purchase;
    let purchaseError;
    
    if (isTransactionId) {
      // Pobierz zakup na podstawie ID transakcji
      console.log(`Szukam zakupu po ID transakcji: ${id}`);
      
      const { data, error } = await supabaseAdmin
        .from('transactions')
        .select('purchase_record_id')
        .eq('id', id)
        .single();
      
      if (error) {
        console.error('Error fetching transaction:', error);
        return NextResponse.json(
          { error: 'Transaction not found', details: error },
          { status: 404 }
        );
      }
      
      if (!data || !data.purchase_record_id) {
        return NextResponse.json(
          { error: 'Transaction does not have an associated purchase record' },
          { status: 404 }
        );
      }
      
      // Pobierz dane zakupu za pomocą ID purchase_record
      const purchaseId = data.purchase_record_id;
      console.log(`Znaleziono powiązany purchase_record_id: ${purchaseId}`);
      
      const purchaseResult = await supabaseAdmin
        .from('purchase_records')
        .select(`
          *,
          group_sub:group_subs(
            *,
            subscription_platforms(
              id,
              name,
              icon
            )
          )
        `)
        .eq('id', purchaseId)
        .single();
      
      purchase = purchaseResult.data;
      purchaseError = purchaseResult.error;
    } else {
      // Standardowe pobieranie zakupu po ID
      const result = await supabaseAdmin
        .from('purchase_records')
        .select(`
          *,
          group_sub:group_subs(
            *,
            subscription_platforms(
              id,
              name,
              icon
            )
          )
        `)
        .eq('id', id)
        .single();
      
      purchase = result.data;
      purchaseError = result.error;
    }
    
    if (purchaseError) {
      console.error('Error fetching purchase details:', purchaseError);
      return NextResponse.json(
        { error: 'Purchase record not found', details: purchaseError },
        { status: 404 }
      );
    }
    
    // Sprawdź, czy zakup należy do użytkownika
    if (purchase.user_id !== userProfile.id) {
      console.warn(`Attempted unauthorized access to purchase ${id} by user ${userProfile.id}`);
      return NextResponse.json(
        { error: 'You do not have permission to view this purchase' },
        { status: 403 }
      );
    }
    
    console.log(`Szczegóły zakupu pobrane pomyślnie`);
    return NextResponse.json(purchase);
  } catch (error) {
    console.error('Error fetching purchase details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch purchase details', details: error.message },
      { status: 500 }
    );
  }
}