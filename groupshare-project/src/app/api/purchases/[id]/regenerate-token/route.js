// src/app/api/purchases/[id]/regenerate-token/route.js
import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import supabaseAdmin from '@/lib/database/supabase-admin-client';
import { tokenService } from '@/lib/security/token-service';

export async function POST(request, { params }) {
  try {
    const { id: purchaseId } = params;
    
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
    
    // Pobierz informacje o zakupie
    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from('purchase_records')
      .select('user_id, status, access_provided')
      .eq('id', purchaseId)
      .single();
    
    if (purchaseError || !purchase) {
      console.error('Error fetching purchase record:', purchaseError);
      return NextResponse.json(
        { error: 'Purchase record not found', details: purchaseError },
        { status: 404 }
      );
    }
    
    // Sprawdź czy zakup należy do użytkownika
    if (purchase.user_id !== userProfile.id) {
      console.warn(`User ${userProfile.id} attempted to access purchase ${purchaseId} belonging to user ${purchase.user_id}`);
      return NextResponse.json(
        { error: 'You do not have permission to access this purchase' },
        { status: 403 }
      );
    }
    
    // Sprawdź czy zakup ma przyznany dostęp
    if (!purchase.access_provided) {
      return NextResponse.json(
        { error: 'Access has not been provided for this purchase' },
        { status: 400 }
      );
    }
    
    // Wygeneruj nowy token dostępu
    const { token, tokenId, accessUrl } = await tokenService.generateAccessToken(
      purchaseId,
      userProfile.id,
      60 // Wydłużony czas ważności do 60 minut
    );
    
    // Zaloguj operację
    await supabaseAdmin
      .from('security_logs')
      .insert({
        user_id: userProfile.id,
        action_type: 'token_regenerated',
        resource_type: 'purchase_record',
        resource_id: purchaseId,
        status: 'success',
        details: {
          token_id: tokenId
        },
        created_at: new Date().toISOString()
      });
    
    return NextResponse.json({
      message: 'Access token regenerated successfully',
      accessUrl
    });
  } catch (error) {
    console.error('Error regenerating access token:', error);
    return NextResponse.json(
      { error: 'Failed to regenerate access token', details: error.message },
      { status: 500 }
    );
  }
}