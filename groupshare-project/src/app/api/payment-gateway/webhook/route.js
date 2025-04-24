// src/app/api/payment-gateway/webhook/route.js
import { NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/database/supabase-admin-client';

export async function POST(request) {
    try {
      // Weryfikacja podpisu od dostawcy płatności
      const signature = request.headers.get('x-payment-signature');
      const payload = await request.json();
      
      // Weryfikacja autentyczności webhook'a (w rzeczywistej implementacji)
      // if (!verifyPaymentWebhookSignature(payload, signature)) {
      //   return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      // }
      
      const { transactionId, status, paymentId } = payload;
      
      console.log(`Processing payment webhook for transaction ${transactionId}, status: ${status}`);
      
      // Aktualizacja transakcji
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
        console.log(`Payment completed for transaction ${transactionId}, updating records`);
        
        const { data: transaction } = await supabaseAdmin
          .from('transactions')
          .select('purchase_record_id, group_sub_id, buyer_id, seller_id')
          .eq('id', transactionId)
          .single();
        
        if (!transaction) {
          console.error(`Transaction ${transactionId} not found`);
          return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }
        
        // Sprawdź, czy zakup już został oznaczony jako zakończony
        const { data: purchaseRecord } = await supabaseAdmin
          .from('purchase_records')
          .select('status')
          .eq('id', transaction.purchase_record_id)
          .single();
        
        // Aktualizacja zakupu tylko jeśli nie jest jeszcze zakończony
        if (purchaseRecord && purchaseRecord.status !== 'completed') {
          console.log(`Updating purchase record ${transaction.purchase_record_id} to completed`);
          
          // Aktualizacja zakupu
          await supabaseAdmin
            .from('purchase_records')
            .update({
              status: 'completed',
              updated_at: new Date().toISOString()
            })
            .eq('id', transaction.purchase_record_id);
          
          // UWAGA: Usunięto aktualizację liczby dostępnych miejsc
          // Ta operacja jest już wykonywana w payment-service.js
          // i powodowała podwójną dekrementację
          
          // Generowanie tokenu dostępu
          const token = await generateAccessToken(transaction.purchase_record_id);
          
          // Notyfikacja dla kupującego
          await createNotification(
            transaction.buyer_id,
            'purchase_completed',
            'Zakup zakończony pomyślnie',
            'Twój zakup został pomyślnie zakończony. Kliknij, aby zobaczyć szczegóły dostępu.',
            'purchase',
            transaction.purchase_record_id
          );
          
          // Notyfikacja dla sprzedającego
          await createNotification(
            transaction.seller_id,
            'sale_completed',
            'Sprzedaż zakończona pomyślnie',
            'Ktoś właśnie kupił miejsce w Twojej subskrypcji.',
            'purchase',
            transaction.purchase_record_id
          );
        } else {
          console.log(`Purchase ${transaction.purchase_record_id} already completed, skipping updates`);
        }
      }
      
      return NextResponse.json({ received: true });
    } catch (error) {
      console.error('Payment webhook error:', error);
      return NextResponse.json(
        { error: 'Payment webhook processing failed' },
        { status: 500 }
      );
    }
}

// Funkcje pomocnicze

// Generowanie tokenu dostępu
async function generateAccessToken(purchaseId) {
  try {
    // Generuj token
    const token = crypto.randomBytes(32).toString('hex');
    
    // Hashuj token
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
    
    return token;
  } catch (error) {
    console.error('Error generating access token:', error);
    return null;
  }
}

// Tworzenie powiadomienia
async function createNotification(userId, type, title, content, relatedEntityType, relatedEntityId) {
  try {
    await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: userId,
        type,
        title,
        content,
        related_entity_type: relatedEntityType,
        related_entity_id: relatedEntityId,
        created_at: new Date().toISOString(),
        is_read: false
      });
  } catch (error) {
    console.error('Error creating notification:', error);
  }
}