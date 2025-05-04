// src/app/api/payment-gateway/webhook/route.js
import { NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/database/supabase-admin-client';
import { notificationService } from '@/services/notification/notification-service';
import crypto from 'crypto';

export async function POST(request) {
    try {
      // Pobierz dane z webhook'a
      const payload = await request.json();
      const { transactionId, status, paymentId } = payload;
      
      console.log(`Przetwarzanie webhook'a płatności dla transakcji ${transactionId}, status: ${status}`);
      
      // Zaktualizuj transakcję
      await supabaseAdmin
        .from('transactions')
        .update({
          status: status,
          payment_id: paymentId,
          updated_at: new Date().toISOString(),
          completed_at: status === 'completed' ? new Date().toISOString() : null
        })
        .eq('id', transactionId);
      
      // Jeśli płatność została zakończona pomyślnie
      if (status === 'completed') {
        console.log(`Płatność zakończona dla transakcji ${transactionId}, aktualizacja rekordów`);
        
        // Pobierz transakcję z powiązanym rekordem zakupu
        const { data: transaction, error: transactionError } = await supabaseAdmin
          .from('transactions')
          .select(`
            purchase_record_id, 
            group_sub_id, 
            buyer_id, 
            seller_id,
            purchase:purchase_records!purchase_record_id(
              status,
              slots_decremented
            )
          `)
          .eq('id', transactionId)
          .single();
        
        if (transactionError || !transaction) {
          console.error(`Nie znaleziono transakcji ${transactionId}:`, transactionError);
          return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }
        
        // Sprawdź, czy zakup jest już oznaczony jako zakończony
        const purchaseId = transaction.purchase_record_id;
        const purchaseStatus = transaction.purchase?.status;
        
        // Zaktualizuj tylko jeśli zakup nie jest jeszcze zakończony
        if (purchaseStatus !== 'completed') {
          console.log(`Aktualizuję rekord zakupu ${purchaseId} na zakończony`);
          
          // Zaktualizuj status zakupu
          await supabaseAdmin
            .from('purchase_records')
            .update({
              status: 'completed',
              access_provided: true,
              access_provided_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', purchaseId);
          
          // Zmniejsz dostępne sloty, jeśli jeszcze nie zostały zmniejszone
          if (!transaction.purchase?.slots_decremented) {
            console.log(`Zmniejszam dostępne sloty dla oferty ${transaction.group_sub_id}`);
            
            try {
              // Najpierw pobierz aktualne informacje o slotach
              const { data: offer } = await supabaseAdmin
                .from('group_subs')
                .select('slots_available, slots_total')
                .eq('id', transaction.group_sub_id)
                .single();
                
              if (offer && typeof offer.slots_available === 'number' && offer.slots_available > 0) {
                // Zaktualizuj dostępne sloty
                await supabaseAdmin
                  .from('group_subs')
                  .update({ 
                    slots_available: Math.max(0, offer.slots_available - 1),
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', transaction.group_sub_id);
                  
                // Oznacz jako zmniejszone w rekordzie zakupu
                await supabaseAdmin
                  .from('purchase_records')
                  .update({ slots_decremented: true })
                  .eq('id', purchaseId);
                  
                console.log(`Sloty zmniejszone dla oferty ${transaction.group_sub_id}`);
              }
            } catch (slotError) {
              console.error('Błąd aktualizacji dostępnych slotów:', slotError);
            }
          }
          
          // Wygeneruj token dostępu
          try {
            const token = await generateAccessToken(purchaseId);
            console.log(`Token dostępu wygenerowany dla zakupu ${purchaseId}`);
          } catch (tokenError) {
            console.error('Błąd generowania tokenu dostępu:', tokenError);
          }
          
          // Pobierz nazwę platformy subskrypcyjnej
          let platformName = 'subskrypcji';
          try {
            const { data: subscriptionData } = await supabaseAdmin
              .from('group_subs')
              .select(`
                subscription_platforms(name)
              `)
              .eq('id', transaction.group_sub_id)
              .single();
            
            if (subscriptionData?.subscription_platforms?.name) {
              platformName = subscriptionData.subscription_platforms.name;
            }
          } catch (error) {
            console.warn('Nie udało się pobrać nazwy platformy:', error);
          }
          
          // Wyślij powiadomienia
          // 1. Powiadomienie dla kupującego
          try {
            await notificationService.createPaymentNotification(
              transaction.buyer_id,
              'completed', 
              purchaseId,
              platformName
            );
          } catch (error) {
            console.error('Błąd tworzenia powiadomienia dla kupującego:', error);
          }
          
          // 2. Powiadomienie dla sprzedającego
          try {
            await notificationService.createNotification(
              transaction.seller_id,
              'payment',
              'Sprzedaż zakończona pomyślnie',
              `Ktoś właśnie kupił miejsce w Twojej subskrypcji ${platformName}.`,
              'purchase_record',
              purchaseId,
              'normal'
            );
          } catch (error) {
            console.error('Błąd tworzenia powiadomienia dla sprzedającego:', error);
          }
        } else {
          console.log(`Zakup ${purchaseId} już zakończony, pomijam aktualizacje`);
        }
      } else if (status === 'failed') {
        // Obsługa nieudanej płatności
        const { data: transaction } = await supabaseAdmin
          .from('transactions')
          .select('purchase_record_id, buyer_id')
          .eq('id', transactionId)
          .single();
          
        if (transaction) {
          // Zaktualizuj status zakupu
          await supabaseAdmin
            .from('purchase_records')
            .update({
              status: 'failed',
              updated_at: new Date().toISOString()
            })
            .eq('id', transaction.purchase_record_id);
          
          // Wyślij powiadomienie o niepowodzeniu
          try {
            await notificationService.createPaymentNotification(
              transaction.buyer_id,
              'failed',
              transaction.purchase_record_id
            );
          } catch (error) {
            console.error('Błąd tworzenia powiadomienia o niepowodzeniu:', error);
          }
        }
      }
      
      return NextResponse.json({ received: true });
    } catch (error) {
      console.error('Błąd webhook płatności:', error);
      return NextResponse.json(
        { error: 'Przetwarzanie webhook płatności nie powiodło się', details: error.message },
        { status: 500 }
      );
    }
}

// Funkcja generująca token dostępu
async function generateAccessToken(purchaseId) {
  try {
    // Wygeneruj token
    const token = crypto.randomBytes(32).toString('hex');
    
    // Skrót tokenu
    const tokenHash = crypto
      .createHash('sha256')
      .update(token + (process.env.TOKEN_SALT || ''))
      .digest('hex');
    
    // Ustaw datę wygaśnięcia (30 minut)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30);
    
    // Zapisz token w bazie danych
    const { data, error } = await supabaseAdmin
      .from('access_tokens')
      .insert({
        purchase_record_id: purchaseId,
        token_hash: tokenHash,
        expires_at: expiresAt.toISOString(),
        used: false,
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();
    
    if (error) {
      throw error;
    }
    
    return { token, tokenId: data.id };
  } catch (error) {
    console.error('Błąd generowania tokenu dostępu:', error);
    throw error;
  }
}