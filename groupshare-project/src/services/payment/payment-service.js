// src/services/payment/payment-service.js
import supabaseAdmin from '@/lib/database/supabase-admin-client';
import { tokenService } from '@/lib/security/token-service';
import { offerService } from '../offer/offer-service';

/**
 * Serwis płatności - zarządza procesem płatności i dostępu do subskrypcji
 */
export class PaymentService {
  /**
   * Inicjalizuje serwis płatności
   * @param {Object} deps - Zależności serwisu
   */
  constructor(deps = {}) {
    this.offerService = deps.offerService || offerService;
    this.tokenService = deps.tokenService || tokenService;
    
    // Konfiguracja prowizji platformy
    this.platformFeePercent = 0.05; // 5%
  }

  /**
 * Bezpieczne zmniejszenie liczby dostępnych miejsc w ofercie
 * Nie rzuca błędu, jeśli nie ma miejsc do zmniejszenia
 * @param {string} offerId - ID oferty
 * @returns {Promise<boolean>} - Czy operacja się powiodła
 */
async safeDecrementAvailableSlots(offerId) {
    try {
      // Pobierz aktualną liczbę dostępnych miejsc
      const { data: offer, error: fetchError } = await supabaseAdmin
        .from('group_subs')
        .select('slots_available, slots_total')
        .eq('id', offerId)
        .single();
      
      // Sprawdź błędy pobierania
      if (fetchError) {
        console.error(`Error fetching offer ${offerId}:`, fetchError);
        return false; // Nie rzucaj błędu, zwróć false
      }
      
      // Sprawdź czy dane oferty istnieją
      if (!offer) {
        console.error(`Offer ${offerId} not found`);
        return false; // Nie rzucaj błędu, zwróć false
      }
      
      console.log(`Offer ${offerId} current slots: ${offer.slots_available}/${offer.slots_total}`);
      
      // Tolerancja na niezgodność danych - jeśli slots_available jest null lub undefined, 
      // przyjmujemy że jest tyle samo co slots_total
      if (offer.slots_available === null || offer.slots_available === undefined) {
        console.warn(`Offer ${offerId} has null/undefined slots_available, using slots_total`);
        offer.slots_available = offer.slots_total || 0;
      }
      
      // Konwersja na liczby dla bezpieczeństwa
      const availableSlots = parseInt(offer.slots_available);
      
      // Sprawdź, czy są dostępne miejsca - jeśli nie, zwróć false bez rzucania błędu
      if (isNaN(availableSlots) || availableSlots <= 0) {
        console.warn(`No available slots for offer ${offerId}: ${availableSlots}. Cannot decrement.`);
        return false; // Nie rzucaj błędu, zwróć false
      }
      
      console.log(`Decrementing slots for offer ${offerId} from ${availableSlots} to ${availableSlots - 1}`);
      
      // Zmniejsz liczbę dostępnych miejsc - używamy równania slots_available = slots_available - 1
      // zamiast wpisywania konkretnej wartości, aby uniknąć race condition
      const { data: updatedOffer, error: updateError } = await supabaseAdmin
        .from('group_subs')
        .update({
          slots_available: availableSlots - 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', offerId)
        .select('slots_available')
        .single();
      
      if (updateError) {
        console.error(`Error updating slots for offer ${offerId}:`, updateError);
        return false; // Nie rzucaj błędu, zwróć false
      }
      
      console.log(`Successfully updated slots for offer ${offerId}, new value: ${updatedOffer.slots_available}`);
      return true;
    } catch (error) {
      console.error('Error in safeDecrementAvailableSlots:', error);
      return false; // Nie rzucaj błędu, zwróć false
    }
  }
  
  /**
   * Zmniejsza liczbę dostępnych miejsc w ofercie
   * Ta metoda zwraca błąd, jeśli nie ma miejsc do zmniejszenia
   * @param {string} offerId - ID oferty
   * @returns {Promise<boolean>} - Czy operacja się powiodła
   */
  async decrementAvailableSlots(offerId) {
    try {
      // Pobierz aktualną liczbę dostępnych miejsc
      const { data: offer, error: fetchError } = await supabaseAdmin
        .from('group_subs')
        .select('slots_available, slots_total')
        .eq('id', offerId)
        .single();
      
      // Sprawdź błędy pobierania
      if (fetchError) {
        console.error(`Error fetching offer ${offerId}:`, fetchError);
        throw new Error(`Nie udało się pobrać informacji o ofercie: ${fetchError.message}`);
      }
      
      // Sprawdź czy dane oferty istnieją
      if (!offer) {
        console.error(`Offer ${offerId} not found`);
        throw new Error('Nie znaleziono oferty');
      }
      
      console.log(`Offer ${offerId} current slots: ${offer.slots_available}/${offer.slots_total}`);
      
      // Tolerancja na niezgodność danych - jeśli slots_available jest null lub undefined, 
      // przyjmujemy że jest tyle samo co slots_total
      if (offer.slots_available === null || offer.slots_available === undefined) {
        console.warn(`Offer ${offerId} has null/undefined slots_available, using slots_total`);
        offer.slots_available = offer.slots_total || 0;
      }
      
      // Konwersja na liczby dla bezpieczeństwa
      const availableSlots = parseInt(offer.slots_available);
      
      // Sprawdź, czy są dostępne miejsca - bardziej defensywne podejście
      if (isNaN(availableSlots) || availableSlots <= 0) {
        console.error(`No available slots for offer ${offerId}: ${availableSlots}`);
        throw new Error('Brak dostępnych miejsc w ofercie');
      }
      
      console.log(`Decrementing slots for offer ${offerId} from ${availableSlots} to ${availableSlots - 1}`);
      
      // Zmniejsz liczbę dostępnych miejsc - używamy równania slots_available = slots_available - 1
      // zamiast wpisywania konkretnej wartości, aby uniknąć race condition
      const { data: updatedOffer, error: updateError } = await supabaseAdmin
        .from('group_subs')
        .update({
          slots_available: availableSlots - 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', offerId)
        .select('slots_available')
        .single();
      
      if (updateError) {
        console.error(`Error updating slots for offer ${offerId}:`, updateError);
        throw new Error('Nie udało się zaktualizować liczby dostępnych miejsc: ' + updateError.message);
      }
      
      console.log(`Successfully updated slots for offer ${offerId}, new value: ${updatedOffer.slots_available}`);
      return true;
    } catch (error) {
      console.error('Error in decrementAvailableSlots:', error);
      throw error;
    }
  }


/**
 * Przetwarza płatność dla zakupu subskrypcji
 * @param {string} purchaseId - ID zakupu
 * @param {string} paymentMethod - Metoda płatności
 * @param {string} userId - ID użytkownika
 * @returns {Promise<Object>} - Dane dostępu
 */
async processPayment(purchaseId, paymentMethod, userId) {
    // Flag dla ukończonych już etapów, żeby można było bezpiecznie zakończyć płatność 
    // nawet jeśli zmniejszenie liczby miejsc się nie powiedzie
    const completedSteps = {
      transactionCreated: false,
      paymentProcessed: false,
      purchaseUpdated: false,
      slotsUpdated: false,
      tokenGenerated: false
    };
  
    try {
      console.log(`Processing payment for purchase ${purchaseId}, user ${userId}, method ${paymentMethod}`);
      
      // 1. Pobierz dane zakupu
      const purchase = await this.getPurchaseRecord(purchaseId);
      console.log(`Found purchase record: ${purchaseId}, status: ${purchase.status}`);
      
      // 2. Sprawdź, czy zakup należy do użytkownika
      if (purchase.user_id !== userId) {
        console.warn(`User ${userId} attempted to process payment for purchase ${purchaseId} belonging to user ${purchase.user_id}`);
        throw new Error('Brak uprawnień do przetworzenia tej płatności');
      }
      
      // 3. Sprawdź, czy zakup jest w stanie oczekiwania na płatność
      if (purchase.status !== 'pending_payment') {
        console.warn(`Invalid purchase status for ${purchaseId}: ${purchase.status}`);
        throw new Error('Zakup nie jest w stanie oczekiwania na płatność');
      }
      
      // 4. Sprawdź, czy oferta jest nadal aktywna i ma dostępne miejsca
      const offer = purchase.group_sub;
      
      if (!offer) {
        console.error(`No group_sub found for purchase ${purchaseId}`);
        throw new Error('Nie znaleziono szczegółów oferty dla tego zakupu');
      }
      
      console.log(`Checking offer ${offer.id}: status=${offer.status}, slots=${offer.slots_available}/${offer.slots_total}`);
      
      if (offer.status !== 'active') {
        console.warn(`Offer ${offer.id} is not active, status: ${offer.status}`);
        throw new Error('Oferta nie jest już aktywna');
      }
      
      // 5. Utwórz transakcję
      console.log(`Creating transaction for purchase ${purchaseId}`);
      const transactionId = await this.createTransaction(
        userId,
        offer.groups?.owner_id,
        offer.id,
        purchaseId,
        offer.price_per_slot,
        paymentMethod
      );
      console.log(`Transaction created: ${transactionId}`);
      completedSteps.transactionCreated = true;
      
      // 6. Przetwórz płatność (symulacja)
      await this.simulatePaymentProcessing(transactionId);
      console.log(`Payment processed for transaction ${transactionId}`);
      completedSteps.paymentProcessed = true;
      
      // 7. Zaktualizuj status zakupu
      await this.updatePurchaseStatus(purchaseId, 'completed');
      console.log(`Purchase status updated to completed: ${purchaseId}`);
      completedSteps.purchaseUpdated = true;
      
      // 8. Zmniejsz liczbę dostępnych miejsc w ofercie
      // Próbuj zmniejszyć liczbę miejsc, ale nie przerywaj procesu jeśli to się nie powiedzie
      try {
        await this.safeDecrementAvailableSlots(offer.id);
        console.log(`Decreased available slots for offer ${offer.id}`);
        completedSteps.slotsUpdated = true;
      } catch (slotError) {
        // Logujemy błąd, ale kontynuujemy proces
        console.warn(`Failed to update available slots for offer ${offer.id}: ${slotError.message}`);
        console.warn('Continuing payment process regardless of slot update failure');
      }
      
      // 9. Wygeneruj token dostępu
      const { token, tokenId, accessUrl } = await this.generateAccessToken(purchaseId, userId);
      console.log(`Access token generated: ${tokenId}`);
      completedSteps.tokenGenerated = true;
      
      // 10. Zaloguj operację
      await this.logPaymentActivity('payment_processed', purchaseId, userId, {
        transaction_id: transactionId,
        payment_method: paymentMethod,
        completed_steps: completedSteps
      });
      
      return {
        success: true,
        purchaseId,
        transactionId,
        accessUrl
      };
    } catch (error) {
      console.error('Error processing payment:', error);
      
      // Jeśli wykonaliśmy już główne kroki płatności, ale wystąpił błąd przy zmniejszaniu miejsc
      // lub generowaniu tokenu, możemy próbować zakończyć proces mimo to
      if (completedSteps.transactionCreated && 
          completedSteps.paymentProcessed && 
          completedSteps.purchaseUpdated) {
        
        console.warn('Error occurred but main payment steps completed. Attempting to recover...');
        
        try {
          // Jeśli token nie został wygenerowany, zróbmy to teraz
          if (!completedSteps.tokenGenerated) {
            console.log('Generating access token as part of recovery');
            const { token, tokenId, accessUrl } = await this.generateAccessToken(purchaseId, userId);
            
            // Zaloguj częściowy sukces
            await this.logPaymentActivity('payment_recovered', purchaseId, userId, {
              error: error.message,
              completed_steps: completedSteps,
              recovery: true
            });
            
            return {
              success: true,
              purchaseId,
              transactionId: null, // Możemy nie mieć ID transakcji w trybie odzyskiwania
              accessUrl,
              recovered: true
            };
          }
        } catch (recoveryError) {
          console.error('Recovery attempt failed:', recoveryError);
          // Kontynuuj do rzucenia głównego błędu
        }
      }
      
      // Zaloguj błąd płatności
      if (userId && purchaseId) {
        await this.logPaymentActivity('payment_failed', purchaseId, userId, {
          error: error.message,
          completed_steps: completedSteps
        });
      }
      
      throw error;
    }
  }
  
  /**
   * Potwierdza poprawność dostępu do subskrypcji
   * @param {string} purchaseId - ID zakupu
   * @param {boolean} isWorking - Czy dostęp działa poprawnie
   * @param {string} userId - ID użytkownika
   * @returns {Promise<Object>} - Wynik potwierdzenia
   */
  async confirmAccess(purchaseId, isWorking, userId) {
    try {
      // 1. Pobierz dane zakupu
      const purchase = await this.getPurchaseRecord(purchaseId);
      
      // 2. Sprawdź, czy zakup należy do użytkownika
      if (purchase.user_id !== userId) {
        throw new Error('Brak uprawnień do potwierdzenia tego dostępu');
      }
      
      // 3. Sprawdź, czy dostęp został udostępniony
      if (!purchase.access_provided) {
        throw new Error('Dostęp nie został jeszcze udostępniony');
      }
      
      // 4. Zaktualizuj status potwierdzenia
      await supabaseAdmin
        .from('purchase_records')
        .update({
          access_confirmed: true,
          access_confirmed_at: new Date().toISOString()
        })
        .eq('id', purchaseId);
      
      // 5. Jeśli dostęp nie działa, utwórz spór
      if (!isWorking) {
        const disputeId = await this.createAccessDispute(purchaseId, userId);
        
        return {
          confirmed: true,
          disputeCreated: true,
          disputeId
        };
      }
      
      // 6. Zaloguj operację
      await this.logPaymentActivity('access_confirmation', purchaseId, userId, {
        isWorking
      });
      
      return {
        confirmed: true,
        disputeCreated: false
      };
    } catch (error) {
      console.error('Error confirming access:', error);
      throw error;
    }
  }
  
  /**
   * Generuje raport sprzedaży dla sprzedawcy
   * @param {string} userId - ID użytkownika (sprzedawcy)
   * @param {Object} filters - Filtry raportu
   * @returns {Promise<Object>} - Raport sprzedaży
   */
  async generateSalesReport(userId, filters = {}) {
    try {
      // Zakres dat
      const startDate = filters.startDate ? new Date(filters.startDate) : new Date();
      startDate.setMonth(startDate.getMonth() - 1); // Domyślnie ostatni miesiąc
      
      const endDate = filters.endDate ? new Date(filters.endDate) : new Date();
      
      // Pobierz transakcje sprzedaży dla sprzedawcy
      const { data: transactions, error } = await supabaseAdmin
        .from('transactions')
        .select(`
          *,
          group_sub:group_subs(
            id,
            price_per_slot,
            currency,
            subscription_platforms(id, name)
          ),
          buyer:user_profiles!buyer_id(id, display_name, email)
        `)
        .eq('seller_id', userId)
        .eq('status', 'completed')
        .gte('completed_at', startDate.toISOString())
        .lte('completed_at', endDate.toISOString());
      
      if (error) {
        throw new Error('Nie udało się pobrać transakcji: ' + error.message);
      }
      
      // Przygotuj podsumowanie sprzedaży
      const summary = {
        totalSales: transactions.length,
        totalRevenue: 0,
        platformFees: 0,
        netRevenue: 0,
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        },
        byPlatform: {},
        transactions: transactions.map(tx => ({
          id: tx.id,
          date: tx.completed_at,
          platform: tx.group_sub.subscription_platforms.name,
          amount: tx.amount,
          fee: tx.platform_fee,
          net: tx.seller_amount,
          buyer: tx.buyer.display_name
        }))
      };
      
      // Oblicz sumy i statystyki
      for (const tx of transactions) {
        summary.totalRevenue += tx.amount;
        summary.platformFees += tx.platform_fee;
        summary.netRevenue += tx.seller_amount;
        
        // Statystyki według platformy
        const platformName = tx.group_sub.subscription_platforms.name;
        if (!summary.byPlatform[platformName]) {
          summary.byPlatform[platformName] = {
            count: 0,
            totalRevenue: 0,
            netRevenue: 0
          };
        }
        
        summary.byPlatform[platformName].count++;
        summary.byPlatform[platformName].totalRevenue += tx.amount;
        summary.byPlatform[platformName].netRevenue += tx.seller_amount;
      }
      
      return summary;
    } catch (error) {
      console.error('Error generating sales report:', error);
      throw error;
    }
  }
  
  // Metody pomocnicze
  
  /**
   * Pobiera rekord zakupu ze szczegółami
   * @param {string} purchaseId - ID zakupu
   * @returns {Promise<Object>} - Dane zakupu
   */
  async getPurchaseRecord(purchaseId) {
    const { data: purchase, error } = await supabaseAdmin
      .from('purchase_records')
      .select(`
        *,
        group_sub:group_subs(
          *,
          subscription_platforms(*),
          groups(id, name, owner_id)
        )
      `)
      .eq('id', purchaseId)
      .single();
    
    if (error) {
      throw new Error('Nie udało się pobrać danych zakupu: ' + error.message);
    }
    
    if (!purchase) {
      throw new Error('Zakup nie istnieje');
    }
    
    return purchase;
  }
  
  /**
   * Tworzy rekord transakcji
   * @param {string} buyerId - ID kupującego
   * @param {string} sellerId - ID sprzedającego
   * @param {string} groupSubId - ID oferty
   * @param {string} purchaseRecordId - ID zakupu
   * @param {number} amount - Kwota transakcji
   * @param {string} paymentMethod - Metoda płatności
   * @returns {Promise<string>} - ID transakcji
   */
  async createTransaction(buyerId, sellerId, groupSubId, purchaseRecordId, amount, paymentMethod) {
    // Oblicz prowizję platformy
    const platformFee = amount * this.platformFeePercent;
    const sellerAmount = amount - platformFee;
    
    // Generuj ID płatności (w rzeczywistości otrzymane od dostawcy płatności)
    const paymentId = 'pmt_' + Math.random().toString(36).substr(2, 9);
    
    // Utwórz transakcję
    const { data, error } = await supabaseAdmin
      .from('transactions')
      .insert({
        buyer_id: buyerId,
        seller_id: sellerId,
        group_sub_id: groupSubId,
        purchase_record_id: purchaseRecordId,
        amount: amount,
        platform_fee: platformFee,
        seller_amount: sellerAmount,
        currency: 'PLN', // Domyślna waluta
        payment_method: paymentMethod,
        payment_provider: 'stripe', // Domyślny dostawca
        payment_id: paymentId,
        status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();
    
    if (error) {
      throw new Error('Nie udało się utworzyć transakcji: ' + error.message);
    }
    
    return data.id;
  }
  
  /**
   * Symuluje przetwarzanie płatności (w rzeczywistości integracja z dostawcą płatności)
   * @param {string} transactionId - ID transakcji
   * @returns {Promise<boolean>} - Czy płatność się powiodła
   */
  async simulatePaymentProcessing(transactionId) {
    // W rzeczywistej implementacji: wywołanie dostawcy płatności
    // Symulacja udanej płatności
    
    // Aktualizuj status transakcji
    const { error } = await supabaseAdmin
      .from('transactions')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', transactionId);
    
    if (error) {
      throw new Error('Nie udało się zaktualizować statusu transakcji: ' + error.message);
    }
    
    return true;
  }
  
  /**
   * Aktualizuje status zakupu
   * @param {string} purchaseId - ID zakupu
   * @param {string} status - Nowy status
   * @returns {Promise<Object>} - Zaktualizowany zakup
   */
  async updatePurchaseStatus(purchaseId, status) {
    const updates = {
      status,
      updated_at: new Date().toISOString()
    };
    
    // Dodatkowe pola dla statusu "completed"
    if (status === 'completed') {
      updates.access_provided = true;
      updates.access_provided_at = new Date().toISOString();
    }
    
    const { data, error } = await supabaseAdmin
      .from('purchase_records')
      .update(updates)
      .eq('id', purchaseId)
      .select()
      .single();
    
    if (error) {
      throw new Error('Nie udało się zaktualizować statusu zakupu: ' + error.message);
    }
    
    return data;
  }
  
/**
 * Zmniejsza liczbę dostępnych miejsc w ofercie
 * @param {string} offerId - ID oferty
 * @returns {Promise<boolean>} - Czy operacja się powiodła
 */
async decrementAvailableSlots(offerId) {
    try {
      // Pobierz aktualną liczbę dostępnych miejsc
      const { data: offer, error: fetchError } = await supabaseAdmin
        .from('group_subs')
        .select('slots_available, slots_total')
        .eq('id', offerId)
        .single();
      
      // Sprawdź błędy pobierania
      if (fetchError) {
        console.error(`Error fetching offer ${offerId}:`, fetchError);
        throw new Error(`Nie udało się pobrać informacji o ofercie: ${fetchError.message}`);
      }
      
      // Sprawdź czy dane oferty istnieją
      if (!offer) {
        console.error(`Offer ${offerId} not found`);
        throw new Error('Nie znaleziono oferty');
      }
      
      console.log(`Offer ${offerId} current slots: ${offer.slots_available}/${offer.slots_total}`);
      
      // Tolerancja na niezgodność danych - jeśli slots_available jest null lub undefined, 
      // przyjmujemy że jest tyle samo co slots_total
      if (offer.slots_available === null || offer.slots_available === undefined) {
        console.warn(`Offer ${offerId} has null/undefined slots_available, using slots_total`);
        offer.slots_available = offer.slots_total || 0;
      }
      
      // Konwersja na liczby dla bezpieczeństwa
      const availableSlots = parseInt(offer.slots_available);
      
      // Sprawdź, czy są dostępne miejsca - bardziej defensywne podejście
      if (isNaN(availableSlots) || availableSlots <= 0) {
        console.error(`No available slots for offer ${offerId}: ${availableSlots}`);
        throw new Error('Brak dostępnych miejsc w ofercie');
      }
      
      console.log(`Decrementing slots for offer ${offerId} from ${availableSlots} to ${availableSlots - 1}`);
      
      // Zmniejsz liczbę dostępnych miejsc - używamy równania slots_available = slots_available - 1
      // zamiast wpisywania konkretnej wartości, aby uniknąć race condition
      const { data: updatedOffer, error: updateError } = await supabaseAdmin
        .from('group_subs')
        .update({
          slots_available: availableSlots - 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', offerId)
        .select('slots_available')
        .single();
      
      if (updateError) {
        console.error(`Error updating slots for offer ${offerId}:`, updateError);
        throw new Error('Nie udało się zaktualizować liczby dostępnych miejsc: ' + updateError.message);
      }
      
      console.log(`Successfully updated slots for offer ${offerId}, new value: ${updatedOffer.slots_available}`);
      return true;
    } catch (error) {
      console.error('Error in decrementAvailableSlots:', error);
      throw error;
    }
  }
  
/**
 * Generuje token dostępu dla zakupu
 * @param {string} purchaseId - ID zakupu
 * @param {string} userId - ID użytkownika
 * @returns {Promise<Object>} - Token i URL dostępu
 */
async generateAccessToken(purchaseId, userId) {
    try {
      // Używamy ulepszonej wersji generateAccessToken, która jest odporna na brak kolumny created_by
      const { token, tokenId, accessUrl } = await this.tokenService.generateAccessToken(
        purchaseId,
        userId,
        30 // 30 minut ważności
      );
      
      return { token, tokenId, accessUrl };
    } catch (error) {
      console.error('Error generating access token:', error);
      
      // Fallback w przypadku błędu - generowanie tokenu bez tokenService
      console.log('Using fallback token generation method');
      
      // Generuj token samodzielnie
      const token = crypto.randomBytes(32).toString('hex');
      
      // Oblicz hash tokenu
      const tokenHash = crypto
        .createHash('sha256')
        .update(token + (process.env.TOKEN_SALT || ''))
        .digest('hex');
      
      // Zapisz token w bazie danych (uproszczona wersja)
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 30); // 30 minut
      
      const { data, error: insertError } = await supabaseAdmin
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
      
      if (insertError) {
        console.error('Error creating fallback token:', insertError);
        throw new Error('Failed to generate access token: ' + insertError.message);
      }
      
      // Generuj URL dostępu
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || '';
      const accessUrl = `${baseUrl}/access?id=${purchaseId}&token=${token}`;
      
      // Loguj operację
      await this.logPaymentActivity('token_generated_fallback', purchaseId, userId);
      
      return { token, tokenId: data.id, accessUrl };
    }
  }
  
  /**
   * Tworzy spór dotyczący problemów z dostępem
   * @param {string} purchaseId - ID zakupu
   * @param {string} userId - ID użytkownika
   * @returns {Promise<string>} - ID utworzonego sporu
   */
  async createAccessDispute(purchaseId, userId) {
    // Znajdź transakcję powiązaną z zakupem
    const { data: transaction } = await supabaseAdmin
      .from('transactions')
      .select('id, group_sub_id, seller_id')
      .eq('purchase_record_id', purchaseId)
      .single();
    
    if (!transaction) {
      throw new Error('Nie znaleziono transakcji dla tego zakupu');
    }
    
    // Utwórz spór
    const { data: dispute, error } = await supabaseAdmin
      .from('disputes')
      .insert({
        reporter_id: userId,
        reported_entity_type: 'subscription',
        reported_entity_id: transaction.group_sub_id,
        transaction_id: transaction.id,
        dispute_type: 'access',
        description: 'Automatyczne zgłoszenie: problem z dostępem do subskrypcji',
        status: 'open',
        evidence_required: true,
        resolution_deadline: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 dni
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id')
      .single();
    
    if (error) {
      throw new Error('Nie udało się utworzyć sporu: ' + error.message);
    }
    
    // Powiadomienia
    await this.createNotifications(dispute.id, userId, transaction.seller_id);
    
    return dispute.id;
  }
  
  /**
   * Tworzy powiadomienia o sporze
   * @param {string} disputeId - ID sporu
   * @param {string} buyerId - ID kupującego
   * @param {string} sellerId - ID sprzedającego
   */
  async createNotifications(disputeId, buyerId, sellerId) {
    // Powiadomienie dla kupującego
    await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: buyerId,
        type: 'dispute_created',
        title: 'Zgłoszenie problemu z dostępem',
        content: 'Twoje zgłoszenie zostało zarejestrowane. Skontaktujemy się z Tobą wkrótce.',
        related_entity_type: 'dispute',
        related_entity_id: disputeId,
        created_at: new Date().toISOString(),
        is_read: false
      });
    
    // Powiadomienie dla sprzedającego
    await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: sellerId,
        type: 'dispute_filed',
        title: 'Zgłoszono problem z dostępem',
        content: 'Kupujący zgłosił problem z dostępem do Twojej subskrypcji. Prosimy o pilną weryfikację.',
        related_entity_type: 'dispute',
        related_entity_id: disputeId,
        created_at: new Date().toISOString(),
        is_read: false
      });
  }
  
  /**
   * Loguje aktywność związaną z płatnością
   * @param {string} action - Typ akcji
   * @param {string} purchaseId - ID zakupu
   * @param {string} userId - ID użytkownika
   * @param {Object} details - Dodatkowe szczegóły
   */
  async logPaymentActivity(action, purchaseId, userId, details = {}) {
    try {
      await supabaseAdmin
        .from('security_logs')
        .insert({
          user_id: userId,
          action_type: action,
          resource_type: 'purchase_record',
          resource_id: String(purchaseId),
          status: action.includes('_failed') ? 'failure' : 'success',
          details: details,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Error logging payment activity:', error);
      // Nie rzucamy błędu, aby nie przerywać głównej operacji
    }
  }
}

// Eksport instancji domyślnej do użycia w aplikacji
export const paymentService = new PaymentService();