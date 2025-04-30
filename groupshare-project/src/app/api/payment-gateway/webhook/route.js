// src/app/api/payment-gateway/webhook/route.js
import { NextResponse } from 'next/server';
import supabaseAdmin from '@/lib/database/supabase-admin-client';
import { notificationService } from '@/services/notification/notification-service';
import crypto from 'crypto';

export async function POST(request) {
    try {
      // Verify payment provider signature
      const signature = request.headers.get('x-payment-signature');
      const payload = await request.json();
      
      // In a real implementation, verify webhook signature here
      // if (!verifyPaymentWebhookSignature(payload, signature)) {
      //   return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
      // }
      
      const { transactionId, status, paymentId } = payload;
      
      console.log(`Processing payment webhook for transaction ${transactionId}, status: ${status}`);
      
      // Update transaction
      await supabaseAdmin
        .from('transactions')
        .update({
          status: status,
          payment_id: paymentId,
          updated_at: new Date().toISOString(),
          completed_at: status === 'completed' ? new Date().toISOString() : null
        })
        .eq('id', transactionId);
      
      // If payment is completed successfully
      if (status === 'completed') {
        console.log(`Payment completed for transaction ${transactionId}, updating records`);
        
        // Fetch transaction with related purchase record
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
          console.error(`Transaction ${transactionId} not found or error:`, transactionError);
          return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
        }
        
        // Check if purchase is already marked as completed
        const purchaseId = transaction.purchase_record_id;
        const purchaseStatus = transaction.purchase?.status;
        
        // Only update purchase if it's not already completed
        if (purchaseStatus !== 'completed') {
          console.log(`Updating purchase record ${purchaseId} to completed`);
          
          // Update purchase status
          await supabaseAdmin
            .from('purchase_records')
            .update({
              status: 'completed',
              access_provided: true,
              access_provided_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', purchaseId);
          
          // Decrement available slots only if not already done
          if (!transaction.purchase?.slots_decremented) {
            console.log(`Decrementing available slots for offer ${transaction.group_sub_id}`);
            
            try {
              // First get current slots information
              const { data: offer } = await supabaseAdmin
                .from('group_subs')
                .select('slots_available, slots_total')
                .eq('id', transaction.group_sub_id)
                .single();
                
              if (offer && typeof offer.slots_available === 'number' && offer.slots_available > 0) {
                // Update slots available
                await supabaseAdmin
                  .from('group_subs')
                  .update({ 
                    slots_available: Math.max(0, offer.slots_available - 1),
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', transaction.group_sub_id);
                  
                // Mark as decremented in purchase record
                await supabaseAdmin
                  .from('purchase_records')
                  .update({ slots_decremented: true })
                  .eq('id', purchaseId);
                  
                console.log(`Slots decremented for offer ${transaction.group_sub_id}`);
              } else {
                console.warn(`No available slots to decrement for offer ${transaction.group_sub_id}`);
              }
            } catch (slotError) {
              console.error('Error updating available slots:', slotError);
              // Continue despite error - the purchase is still valid
            }
          }
          
          // Generate access token
          try {
            const token = await generateAccessToken(purchaseId);
            console.log(`Access token generated for purchase ${purchaseId}`);
          } catch (tokenError) {
            console.error('Error generating access token:', tokenError);
            // Continue despite error - the purchase is still valid
          }
          
          // Create a single consolidated notification instead of multiple
          try {
            await createConsolidatedPurchaseNotification(
              transaction.buyer_id,
              transaction.seller_id,
              purchaseId,
              transactionId
            );
          } catch (notificationError) {
            console.error('Error creating notifications:', notificationError);
            // Continue despite error - this is non-critical
            
            // Attempt direct fallback notification creation for critical user notification
            try {
              await supabaseAdmin
                .from('notifications')
                .insert({
                  user_id: transaction.buyer_id,
                  type: 'purchase_completed',
                  title: 'Zakup zakończony pomyślnie',
                  content: 'Twój zakup został potwierdzony. Możesz teraz uzyskać dostęp do subskrypcji.',
                  related_entity_type: 'purchase_record',
                  related_entity_id: purchaseId,
                  priority: 'high',
                  is_read: false,
                  created_at: new Date().toISOString()
                });
            } catch (fallbackError) {
              console.error('Fallback notification also failed:', fallbackError);
            }
          }
        } else {
          console.log(`Purchase ${purchaseId} already completed, skipping updates`);
        }
      } else if (status === 'failed') {
        // Handle failed payment
        const { data: transaction } = await supabaseAdmin
          .from('transactions')
          .select('purchase_record_id, buyer_id')
          .eq('id', transactionId)
          .single();
          
        if (transaction) {
          // Update purchase status
          await supabaseAdmin
            .from('purchase_records')
            .update({
              status: 'failed',
              updated_at: new Date().toISOString()
            })
            .eq('id', transaction.purchase_record_id);
          
          // Send failure notification with fallback mechanism
          try {
            await notificationService.createNotification(
              transaction.buyer_id,
              'purchase_failed',
              'Płatność zakończona niepowodzeniem',
              'Twoja płatność nie została zrealizowana. Możesz ponowić próbę w szczegółach zakupu.',
              'purchase_record',
              transaction.purchase_record_id,
              'high'
            );
          } catch (notificationError) {
            console.error('Error creating failure notification:', notificationError);
            
            // Direct fallback for critical notification
            try {
              await supabaseAdmin
                .from('notifications')
                .insert({
                  user_id: transaction.buyer_id,
                  type: 'purchase_failed',
                  title: 'Płatność zakończona niepowodzeniem',
                  content: 'Twoja płatność nie została zrealizowana. Możesz ponowić próbę w szczegółach zakupu.',
                  related_entity_type: 'purchase_record',
                  related_entity_id: transaction.purchase_record_id,
                  priority: 'high',
                  is_read: false,
                  created_at: new Date().toISOString()
                });
            } catch (fallbackError) {
              console.error('Fallback failure notification also failed:', fallbackError);
            }
          }
        }
      }
      
      return NextResponse.json({ received: true });
    } catch (error) {
      console.error('Payment webhook error:', error);
      return NextResponse.json(
        { error: 'Payment webhook processing failed', details: error.message },
        { status: 500 }
      );
    }
}

/**
 * Create a consolidated notification for purchase completion
 * Replaces multiple separate notifications with a single comprehensive one
 */
async function createConsolidatedPurchaseNotification(buyerId, sellerId, purchaseId, transactionId) {
  // Notification for buyer - more detailed since this is important
  try {
    await notificationService.createNotification(
      buyerId,
      'purchase_completed',
      'Zakup zakończony pomyślnie',
      'Twój zakup został potwierdzony. Możesz teraz uzyskać dostęp do subskrypcji z poziomu szczegółów zakupu.',
      'purchase_record',
      purchaseId,
      'high', // High priority for buyer
      0,      // No TTL
      true    // Skip duplicate check - this is important
    );
  } catch (error) {
    console.error('Error creating buyer notification:', error);
    throw error; // Re-throw to trigger fallback
  }
  
  // Notification for seller (less critical)
  try {
    await notificationService.createNotification(
      sellerId,
      'sale_completed',
      'Sprzedaż zakończona pomyślnie',
      'Ktoś właśnie kupił miejsce w Twojej subskrypcji.',
      'purchase_record', // Point to purchase record instead of transaction for consistency
      purchaseId,
      'normal'
    );
  } catch (error) {
    // Log but don't re-throw for seller notification (non-critical)
    console.error('Error creating seller notification:', error);
  }
}

// Generate access token
async function generateAccessToken(purchaseId) {
  try {
    // Generate token
    const token = crypto.randomBytes(32).toString('hex');
    
    // Hash token
    const tokenHash = crypto
      .createHash('sha256')
      .update(token + (process.env.TOKEN_SALT || ''))
      .digest('hex');
    
    // Set expiration date (30 minutes)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30);
    
    // Save token in database
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
    console.error('Error generating access token:', error);
    throw error;
  }
}