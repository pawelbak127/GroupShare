// src/app/api/access/[id]/route.js
import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import crypto from 'crypto';
import supabaseAdmin from '@/lib/database/supabase-admin-client';

/**
 * GET /api/access/[id]
 * Weryfikuje token dostępu i zwraca instrukcje dostępu do subskrypcji
 */
export async function GET(request, { params }) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');
    
    console.log(`Processing access request for purchase ${id}`);
    
    // Specjalny przypadek dla bezpośredniego dostępu z panelu aplikacji
    let directAccess = false;
    if (token === 'direct') {
      // Pomijamy weryfikację tokenu, bo dostęp jest z panelu aplikacji
      // Nadal sprawdzamy czy użytkownik ma dostęp do zakupu
      directAccess = true;
      console.log(`Direct access requested for purchase ${id}`);
    }
    
    // Sprawdź czy token jest prawidłowy
    if (!token && !directAccess) {
      await logSecurityEvent(null, 'access_attempt', 'purchase_record', id, 'failed', {
        reason: 'Missing token',
        ip: request.headers.get('x-forwarded-for') || 'unknown'
      });
      
      return NextResponse.json(
        { error: 'Access token is required' },
        { status: 401 }
      );
    }
    
    // Sprawdź autentykację
    const user = await currentUser();
    let userProfileId = null;
    
    if (user) {
      // Pobierz profil użytkownika
      const { data: profile } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('external_auth_id', user.id)
        .single();
      
      if (profile) {
        userProfileId = profile.id;
        console.log(`Authenticated user: ${userProfileId}`);
      }
    }
    
    // Pobierz informacje o zakupie
    const { data: purchase, error: purchaseError } = await supabaseAdmin
      .from('purchase_records')
      .select(`
        id, status, user_id, access_provided, group_sub_id,
        user:user_profiles(id, display_name, email),
        group_sub:group_subs(
          id, group_id,
          platform:subscription_platforms(id, name, icon, name)
        )
      `)
      .eq('id', id)
      .single();
    
    if (purchaseError || !purchase) {
      console.error('Error fetching purchase:', purchaseError);
      
      await logSecurityEvent(userProfileId, 'access_attempt', 'purchase_record', id, 'failed', {
        reason: 'Purchase not found',
        error: purchaseError?.message
      });
      
      return NextResponse.json(
        { error: 'Purchase record not found' },
        { status: 404 }
      );
    }
    
    // Sprawdź status zakupu
    if (purchase.status !== 'completed' || !purchase.access_provided) {
      await logSecurityEvent(userProfileId, 'access_attempt', 'purchase_record', id, 'failed', {
        reason: 'Access not provided',
        purchase_status: purchase.status,
        access_provided: purchase.access_provided
      });
      
      return NextResponse.json(
        { error: 'Access not available for this purchase' },
        { status: 403 }
      );
    }
    
    // Jeśli nie jest to dostęp bezpośredni, sprawdź token
    if (!directAccess) {
      // Pobierz i sprawdź token dostępu
      const tokenHash = hashToken(token);
      console.log(`Verifying token hash: ${tokenHash.substring(0, 10)}...`);
      
      // Najpierw sprawdź, czy istnieją jakiekolwiek tokeny dla tego zakupu
      const { data: allTokens, error: tokensError } = await supabaseAdmin
        .from('access_tokens')
        .select('id, token_hash, expires_at, used')
        .eq('purchase_record_id', id);
      
      if (tokensError) {
        console.error('Error checking tokens:', tokensError);
      } else {
        console.log(`Found ${allTokens?.length || 0} tokens for purchase ${id}`);
        if (allTokens && allTokens.length > 0) {
          for (const t of allTokens) {
            console.log(`Token: ${t.id}, hash prefix: ${t.token_hash?.substring(0, 10)}..., expires: ${t.expires_at}, used: ${t.used}`);
          }
        }
      }
      
      // *** WAŻNA ZMIANA: Sprawdzaj wszystkie tokeny, nawet użyte ***
      const { data: matchingToken, error: tokenError } = await supabaseAdmin
        .from('access_tokens')
        .select('*')
        .eq('purchase_record_id', id)
        .eq('token_hash', tokenHash)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();  // Używamy maybeSingle zamiast single, aby nie rzucać błędu jeśli nie znajdzie
      
      // Jeśli nie znaleziono pasującego tokenu lub token nie istnieje
      if (tokenError || !matchingToken) {
        console.error('Error finding matching token:', tokenError);
        
        await logSecurityEvent(userProfileId, 'access_attempt', 'purchase_record', id, 'failed', {
          reason: 'Token not found or expired',
          error: tokenError?.message
        });
        
        return NextResponse.json(
          { error: 'Invalid or expired access token' },
          { status: 401 }
        );
      }
      
      console.log(`Matching token found: ${matchingToken.id}, used: ${matchingToken.used}`);
      
      // Jeśli token został już użyty wcześniej, to akceptujemy to - po prostu nie oznaczamy go ponownie
      if (!matchingToken.used) {
        // Oznacz token jako użyty tylko jeśli jeszcze nie był użyty
        const { error: updateError } = await supabaseAdmin
          .from('access_tokens')
          .update({
            used: true,
            used_at: new Date().toISOString(),
            ip_address: request.headers.get('x-forwarded-for') || null,
            user_agent: request.headers.get('user-agent') || null
          })
          .eq('id', matchingToken.id);
        
        if (updateError) {
          console.error('Error updating access token:', updateError);
          // Kontynuujemy pomimo błędu
        } else {
          console.log(`Token ${matchingToken.id} marked as used`);
        }
      } else {
        console.log(`Token ${matchingToken.id} was already used, continuing anyway`);
      }
    }
    
    // Jeśli użytkownik jest zalogowany, sprawdź czy zakup należy do niego
    // Uwaga: Pozwalamy niezalogowanym użytkownikom na dostęp przy użyciu tokenu
    if (userProfileId && purchase.user_id !== userProfileId) {
      console.warn(`Security warning: User ${userProfileId} attempted to access purchase ${id} belonging to user ${purchase.user_id}`);
      
      await logSecurityEvent(userProfileId, 'access_attempt', 'purchase_record', id, 'failed', {
        reason: 'User mismatch',
        owner_id: purchase.user_id
      });
      
      return NextResponse.json(
        { error: 'You do not have permission to access this purchase' },
        { status: 403 }
      );
    }
    
    // Potwierdzenie dostępu w rejestrze zakupów
    await supabaseAdmin
      .from('purchase_records')
      .update({
        access_confirmed: true,
        access_confirmed_at: new Date().toISOString()
      })
      .eq('id', id);
    
    // Pobierz instrukcje dostępu
    const { data: accessInstructions, error: instructionsError } = await supabaseAdmin
      .from('access_instructions')
      .select('*')
      .eq('group_sub_id', purchase.group_sub_id)
      .maybeSingle();
    
    let decryptedInstructions = "";
    
    // Obsługa przypadku braku instrukcji
    if (instructionsError) {
      console.error('Error fetching access instructions:', instructionsError);
      
      await logSecurityEvent(userProfileId, 'access_attempt', 'purchase_record', id, 'warning', {
        reason: 'Error fetching access instructions',
        error: instructionsError?.message,
        group_sub_id: purchase.group_sub_id
      });
      
      // Tworzymy domyślne instrukcje zamiast zwracać błąd
      decryptedInstructions = "Instrukcje dostępu nie zostały jeszcze skonfigurowane przez sprzedawcę. Prosimy o kontakt ze sprzedawcą, aby uzyskać dane dostępowe.";
    } else if (!accessInstructions) {
      console.warn(`No access instructions found for group_sub_id: ${purchase.group_sub_id}`);
      
      await logSecurityEvent(userProfileId, 'access_attempt', 'purchase_record', id, 'warning', {
        reason: 'No access instructions found',
        group_sub_id: purchase.group_sub_id
      });
      
      // Tworzymy domyślne instrukcje zamiast zwracać błąd
      decryptedInstructions = "Instrukcje dostępu nie zostały jeszcze skonfigurowane przez sprzedawcą. Prosimy o kontakt ze sprzedawcą, aby uzyskać dane dostępowe.";
    } else {
      // Symulacja deszyfrowania instrukcji dostępu
      // W rzeczywistości tutaj byłoby prawdziwe deszyfrowanie
      if (accessInstructions.encrypted_data && accessInstructions.encrypted_data.startsWith("ENCRYPTED:")) {
        // Przykładowe "deszyfrowanie" - w produkcji należy użyć odpowiednich metod kryptograficznych
        const base64Data = accessInstructions.encrypted_data.replace("ENCRYPTED:", "");
        decryptedInstructions = Buffer.from(base64Data, 'base64').toString('utf-8');
      } else {
        decryptedInstructions = accessInstructions.encrypted_data || "Instrukcje dostępu nie są dostępne w czytelnym formacie.";
      }
    }
    
    // Pobierz dane kontaktowe właściciela grupy, aby kupujący mógł się skontaktować w razie problemów
    const { data: groupOwner } = await supabaseAdmin
      .from('groups')
      .select(`
        owner:user_profiles!owner_id(display_name, email)
      `)
      .eq('id', purchase.group_sub.group_id)
      .single();
    
    const ownerContact = groupOwner?.owner || { display_name: "Sprzedawca", email: "Niedostępny" };
    
    // Zaloguj udany dostęp
    await logSecurityEvent(userProfileId || purchase.user_id, 'access_success', 'purchase_record', id, 'success', {
      platform: purchase.group_sub.platform.name,
      token_id: directAccess ? 'direct_access' : matchingToken.id,
      has_instructions: !!accessInstructions
    });
    
    console.log(`Access successful for purchase ${id}`);
    
    // Zwróć dane dostępowe
    return NextResponse.json({
      purchase_id: id,
      platform: purchase.group_sub.platform.name,
      instructions: decryptedInstructions,
      purchased_at: purchase.created_at,
      user: purchase.user.display_name,
      email: purchase.user.email,
      owner_contact: ownerContact,
      has_instructions: !!accessInstructions,
      direct_access: directAccess
    });
  } catch (error) {
    console.error('Error processing access request:', error);
    
    try {
      await logSecurityEvent(null, 'access_attempt', 'purchase_record', params?.id || 'unknown', 'error', {
        error: error.message
      });
    } catch (logError) {
      console.error('Failed to log security event:', logError);
    }
    
    return NextResponse.json(
      { error: 'Failed to process access request' },
      { status: 500 }
    );
  }
}

// Funkcja do logowania zdarzeń bezpieczeństwa
async function logSecurityEvent(userId, actionType, resourceType, resourceId, status, details = {}) {
  try {
    const { error } = await supabaseAdmin
      .from('security_logs')
      .insert({
        user_id: userId,
        action_type: actionType,
        resource_type: resourceType,
        resource_id: String(resourceId),
        status: status,
        details: details,
        created_at: new Date().toISOString()
      });
    
    if (error) {
      console.error('Error logging security event:', error);
    }
  } catch (error) {
    console.error('Exception logging security event:', error);
  }
}

// Bezpieczna funkcja hashująca token
function hashToken(token) {
  const salt = process.env.TOKEN_SALT || '';
  return crypto
    .createHash('sha256')
    .update(token + salt)
    .digest('hex');
}