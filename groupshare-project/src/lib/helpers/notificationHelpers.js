// src/lib/helpers/notificationHelpers.js
/**
 * Zestaw pomocniczych funkcji do tworzenia powiadomień w różnych częściach aplikacji
 * 
 * Ten plik zawiera gotowe funkcje z szablonami powiadomień, które można łatwo wykorzystać
 * w rożnych częściach aplikacji bez konieczności importowania całego serwisu powiadomień.
 */

/**
 * Wysyła powiadomienie o zaproszeniu do grupy
 * @param {string} userId - ID użytkownika, który ma otrzymać powiadomienie
 * @param {string} groupName - Nazwa grupy
 * @param {string} inviterName - Nazwa osoby zapraszającej
 * @param {string} groupId - ID grupy
 * @param {string} inviteId - ID zaproszenia
 * @returns {Promise<Response>} - Odpowiedź z API
 */
export async function sendGroupInvitationNotification(userId, groupName, inviterName, groupId, inviteId) {
    const notificationData = {
      userId,
      type: 'invite',
      title: `Zaproszenie do grupy ${groupName}`,
      content: `${inviterName} zaprosił(a) Cię do dołączenia do grupy ${groupName}.`,
      relatedEntityType: 'group_invitation',
      relatedEntityId: inviteId,
      priority: 'high'
    };
  
    return createNotification(notificationData);
  }
  
  /**
   * Wysyła powiadomienie o nowej wiadomości
   * @param {string} userId - ID użytkownika, który ma otrzymać powiadomienie
   * @param {string} senderName - Nazwa nadawcy
   * @param {string} messageContent - Treść wiadomości (zostanie skrócona)
   * @param {string} conversationId - ID konwersacji
   * @returns {Promise<Response>} - Odpowiedź z API
   */
  export async function sendNewMessageNotification(userId, senderName, messageContent, conversationId) {
    // Skróć treść wiadomości, jeśli jest zbyt długa
    const shortContent = messageContent.length > 100 
      ? `${messageContent.substring(0, 97)}...` 
      : messageContent;
  
    const notificationData = {
      userId,
      type: 'message',
      title: `Nowa wiadomość od ${senderName}`,
      content: shortContent,
      relatedEntityType: 'conversation',
      relatedEntityId: conversationId,
      priority: 'normal'
    };
  
    return createNotification(notificationData);
  }
  
  /**
   * Wysyła powiadomienie o zakupie
   * @param {string} userId - ID użytkownika, który ma otrzymać powiadomienie
   * @param {string} purchaseType - Typ zakupu (completed, refunded, expiring_soon, expired)
   * @param {string} platformName - Nazwa platformy
   * @param {string} purchaseId - ID zakupu
   * @returns {Promise<Response>} - Odpowiedź z API
   */
  export async function sendPurchaseNotification(userId, purchaseType, platformName, purchaseId) {
    let title, content, priority;
    
    switch (purchaseType) {
      case 'completed':
        title = `Zakup subskrypcji ${platformName} zakończony`;
        content = `Twój zakup subskrypcji ${platformName} został pomyślnie zakończony. Kliknij, aby zobaczyć szczegóły dostępu.`;
        priority = 'high';
        break;
      case 'refunded':
        title = `Zwrot za subskrypcję ${platformName}`;
        content = `Otrzymałeś zwrot środków za subskrypcję ${platformName}.`;
        priority = 'high';
        break;
      case 'expiring_soon':
        title = `Subskrypcja ${platformName} wkrótce wygaśnie`;
        content = `Twoja subskrypcja ${platformName} wygaśnie wkrótce. Kliknij, aby odnowić.`;
        priority = 'normal';
        break;
      case 'expired':
        title = `Subskrypcja ${platformName} wygasła`;
        content = `Twoja subskrypcja ${platformName} wygasła.`;
        priority = 'normal';
        break;
      default:
        title = `Aktualizacja subskrypcji ${platformName}`;
        content = `Twoja subskrypcja ${platformName} została zaktualizowana.`;
        priority = 'normal';
    }
  
    const notificationData = {
      userId,
      type: 'purchase',
      title,
      content,
      relatedEntityType: 'purchase',
      relatedEntityId: purchaseId,
      priority
    };
  
    return createNotification(notificationData);
  }
  
  /**
   * Wysyła powiadomienie o sprzedaży dla sprzedającego
   * @param {string} sellerId - ID sprzedającego
   * @param {string} platformName - Nazwa platformy
   * @param {string} buyerName - Nazwa kupującego
   * @param {string} purchaseId - ID zakupu
   * @returns {Promise<Response>} - Odpowiedź z API
   */
  export async function sendSaleNotification(sellerId, platformName, buyerName, purchaseId) {
    const notificationData = {
      userId: sellerId,
      type: 'purchase',
      title: `Nowa sprzedaż subskrypcji ${platformName}`,
      content: `${buyerName} właśnie zakupił miejsce w Twojej subskrypcji ${platformName}.`,
      relatedEntityType: 'purchase',
      relatedEntityId: purchaseId,
      priority: 'high'
    };
  
    return createNotification(notificationData);
  }
  
  /**
   * Wysyła powiadomienie o sporze
   * @param {string} userId - ID użytkownika, który ma otrzymać powiadomienie
   * @param {string} disputeType - Typ sporu (created, updated, resolved)
   * @param {string} disputeId - ID sporu
   * @param {string} relatedTo - Opcjonalny tekst opisujący czego dotyczy spór
   * @returns {Promise<Response>} - Odpowiedź z API
   */
  export async function sendDisputeNotification(userId, disputeType, disputeId, relatedTo = '') {
    let title, content, priority;
    
    const relatedInfo = relatedTo ? ` dotyczący ${relatedTo}` : '';
    
    switch (disputeType) {
      case 'created':
        title = `Nowe zgłoszenie problemu${relatedInfo}`;
        content = `Utworzono nowe zgłoszenie problemu. Nasz zespół zajmie się nim jak najszybciej.`;
        priority = 'high';
        break;
      case 'updated':
        title = `Aktualizacja zgłoszenia${relatedInfo}`;
        content = `Twoje zgłoszenie zostało zaktualizowane. Kliknij, aby zobaczyć szczegóły.`;
        priority = 'high';
        break;
      case 'resolved':
        title = `Zgłoszenie rozwiązane${relatedInfo}`;
        content = `Twoje zgłoszenie zostało rozwiązane. Kliknij, aby zobaczyć szczegóły.`;
        priority = 'normal';
        break;
      default:
        title = `Aktualizacja zgłoszenia${relatedInfo}`;
        content = `Zaktualizowano informacje o Twoim zgłoszeniu.`;
        priority = 'normal';
    }
  
    const notificationData = {
      userId,
      type: 'dispute',
      title,
      content,
      relatedEntityType: 'dispute',
      relatedEntityId: disputeId,
      priority
    };
  
    return createNotification(notificationData);
  }
  
  /**
   * Wysyła niestandardowe powiadomienie
   * @param {string} userId - ID użytkownika
   * @param {string} type - Typ powiadomienia (invite, message, purchase, dispute)
   * @param {string} title - Tytuł powiadomienia
   * @param {string} content - Treść powiadomienia
   * @param {string} relatedEntityType - Typ powiązanego zasobu
   * @param {string} relatedEntityId - ID powiązanego zasobu
   * @param {string} priority - Priorytet (high, normal, low)
   * @returns {Promise<Response>} - Odpowiedź z API
   */
  export async function sendCustomNotification(
    userId,
    type,
    title,
    content,
    relatedEntityType = null,
    relatedEntityId = null,
    priority = 'normal'
  ) {
    const notificationData = {
      userId,
      type,
      title,
      content,
      relatedEntityType,
      relatedEntityId,
      priority
    };
  
    return createNotification(notificationData);
  }
  
  /**
   * Podstawowa funkcja do tworzenia powiadomień poprzez API
   * @param {Object} notificationData - Dane powiadomienia
   * @returns {Promise<Response>} - Odpowiedź z API
   */
  async function createNotification(notificationData) {
    try {
      const response = await fetch('/api/notifications/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(notificationData)
      });
  
      if (!response.ok) {
        throw new Error(`Failed to create notification: ${response.statusText}`);
      }
  
      return await response.json();
    } catch (error) {
      console.error('Error creating notification:', error);
      return { error: error.message };
    }
  }