// src/services/notification/notification-service.js
import supabaseAdmin from '@/lib/database/supabase-admin-client';

class NotificationService {
  /**
   * Creates a new notification with duplication check
   * @param {string} userId - ID of the user to notify
   * @param {string} type - Type of notification (invite, message, purchase, dispute)
   * @param {string} title - Title of the notification
   * @param {string} content - Content of the notification
   * @param {string} relatedEntityType - Type of related entity (optional)
   * @param {string} relatedEntityId - ID of related entity (optional)
   * @param {string} priority - Priority (high, normal, low) (optional)
   * @param {number} ttl - Time to live in days (0 = no expiration) (optional)
   * @param {boolean} skipDuplicateCheck - Whether to skip duplicate check (optional)
   * @returns {Promise<Object>} Created notification
   */
  async createNotification(
    userId,
    type,
    title,
    content,
    relatedEntityType = null,
    relatedEntityId = null,
    priority = 'normal',
    ttl = 0,
    skipDuplicateCheck = false
  ) {
    try {
      // Verify user exists
      if (!userId || !(await this.verifyUserExists(userId))) {
        console.warn(`User ${userId} does not exist. Skipping notification.`);
        return null;
      }

      // Verify entity exists if entityId and entityType are provided
      if (relatedEntityId && relatedEntityType && !skipDuplicateCheck) {
        try {
          const entityExists = await this.verifyEntityExists(relatedEntityType, relatedEntityId);
          if (!entityExists) {
            console.warn(`Entity ${relatedEntityType}:${relatedEntityId} does not exist. Skipping notification.`);
            return null;
          }
        } catch (verifyError) {
          console.warn(`Entity verification error for ${relatedEntityType}:${relatedEntityId}:`, verifyError);
          // Log but don't block critical notifications
          if (priority !== 'high') {
            return null;
          }
        }
      }

      // Check for similar recent notifications to avoid duplication
      if (!skipDuplicateCheck && relatedEntityType && relatedEntityId) {
        try {
          // Use the advanced duplicate detection that considers content similarity
          const hasDuplicate = await this.checkForDuplicateNotificationAdvanced(
            userId, 
            type, 
            relatedEntityType, 
            relatedEntityId,
            title
          );
          
          if (hasDuplicate) {
            console.log(`Skipping duplicate notification: ${type} for ${relatedEntityType}:${relatedEntityId}`);
            return null;
          }
        } catch (dupError) {
          console.warn('Duplicate check error:', dupError);
          // Don't block high priority notifications if duplicate check fails
          if (priority !== 'high') {
            console.log('Skipping notification due to duplicate check error');
            return null;
          }
        }
      }

      const notification = {
        user_id: userId,
        type,
        title,
        content,
        related_entity_type: relatedEntityType,
        related_entity_id: relatedEntityId,
        priority,
        is_read: false,
        created_at: new Date().toISOString(),
      };

      // Try insertion with retry logic for important notifications
      let retryCount = 0;
      const maxRetries = priority === 'high' ? 3 : 1;
      
      while (retryCount <= maxRetries) {
        try {
          const { data, error } = await supabaseAdmin
            .from('notifications')
            .insert(notification)
            .select()
            .single();

          if (error) throw error;
          return data;
        } catch (insertError) {
          retryCount++;
          console.warn(`Notification insertion failed (attempt ${retryCount}/${maxRetries + 1}):`, insertError);
          
          if (retryCount <= maxRetries) {
            // Exponential backoff
            await new Promise(r => setTimeout(r, Math.pow(2, retryCount) * 100));
          } else {
            // For high priority notifications, try direct DB insertion as final fallback
            if (priority === 'high') {
              try {
                console.log('Attempting emergency direct insertion for high priority notification');
                const { data: emergencyData, error: emergencyError } = await supabaseAdmin
                  .from('notifications')
                  .insert({
                    ...notification,
                    created_at: new Date().toISOString(), // Fresh timestamp
                    _emergency_fallback: true // Mark as emergency insertion
                  })
                  .select()
                  .single();
                
                if (!emergencyError) {
                  console.log('Emergency notification insertion succeeded');
                  return emergencyData;
                }
              } catch (emergencyError) {
                console.error('Emergency notification insertion also failed:', emergencyError);
              }
            }
            throw insertError;
          }
        }
      }
    } catch (error) {
      console.error('Error creating notification:', error);
      // Don't throw - fail silently for notifications
      return null;
    }
  }

  /**
   * Verify if a user exists
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Whether the user exists
   */
  async verifyUserExists(userId) {
    try {
      // Check cache first (optional optimization)
      const cacheKey = `user_exists_${userId}`;
      const cachedResult = this.getCache(cacheKey);
      if (cachedResult !== undefined) {
        return cachedResult;
      }

      const { count, error } = await supabaseAdmin
        .from('user_profiles')
        .select('id', { count: 'exact', head: true })
        .eq('id', userId);
      
      if (error) throw error;
      
      const exists = count > 0;
      this.setCache(cacheKey, exists, 300); // Cache for 5 minutes
      return exists;
    } catch (error) {
      console.error(`Error verifying user ${userId}:`, error);
      // Assume user exists if verification fails to ensure notification delivery
      return true;
    }
  }

  // Simple in-memory cache implementation
  cache = {};
  setCache(key, value, ttlSeconds = 60) {
    this.cache[key] = {
      value,
      expires: Date.now() + (ttlSeconds * 1000)
    };
  }
  getCache(key) {
    const cached = this.cache[key];
    if (!cached) return undefined;
    if (cached.expires < Date.now()) {
      delete this.cache[key];
      return undefined;
    }
    return cached.value;
  }

  /**
   * Create consolidated notifications for a transaction
   * Sends notifications to all involved parties (buyer, seller)
   * 
   * @param {Object} options - Transaction notification options
   * @param {string} options.transactionId - Transaction ID
   * @param {string} options.purchaseId - Purchase ID
   * @param {string} options.status - Transaction status
   * @param {boolean} options.sendToSeller - Whether to send notification to seller
   * @returns {Promise<Object[]>} Created notifications
   */
  async createTransactionNotification({
    transactionId, 
    purchaseId, 
    status = 'completed',
    sendToSeller = true
  }) {
    try {
      // Get complete transaction details with related entities
      const { data: transaction, error: transactionError } = await supabaseAdmin
        .from('transactions')
        .select(`
          *,
          buyer:buyer_id(id, display_name),
          seller:seller_id(id, display_name),
          purchase:purchase_records!purchase_record_id(
            group_sub_id,
            group_sub:group_subs(
              subscription_platforms(name)
            )
          )
        `)
        .eq('id', transactionId)
        .single();
      
      if (transactionError || !transaction) {
        console.error('Error fetching transaction for notification:', transactionError);
        return [];
      }
      
      const result = [];
      const platformName = transaction.purchase?.group_sub?.subscription_platforms?.name || 'subskrypcji';
      
      // 1. Notification for buyer
      if (transaction.buyer_id) {
        let buyerType, buyerTitle, buyerContent, buyerPriority;
        
        if (status === 'completed') {
          buyerType = 'purchase_completed';
          buyerTitle = `Zakup ${platformName} zakończony pomyślnie`;
          buyerContent = `Twój zakup subskrypcji ${platformName} został pomyślnie zrealizowany. Możesz teraz uzyskać dostęp do instrukcji.`;
          buyerPriority = 'normal';
        } else if (status === 'failed') {
          buyerType = 'purchase_failed';
          buyerTitle = `Problem z zakupem ${platformName}`;
          buyerContent = `Wystąpił problem z Twoim zakupem subskrypcji ${platformName}. Sprawdź szczegóły płatności.`;
          buyerPriority = 'high';
        } else {
          buyerType = 'purchase_update';
          buyerTitle = `Aktualizacja zakupu ${platformName}`;
          buyerContent = `Status Twojego zakupu subskrypcji ${platformName} został zaktualizowany.`;
          buyerPriority = 'normal';
        }
        
        const buyerNotification = await this.createNotification(
          transaction.buyer_id,
          buyerType,
          buyerTitle,
          buyerContent,
          'transaction',
          transactionId,
          buyerPriority,
          0,
          true // Skip duplicate check
        );
        
        if (buyerNotification) {
          result.push(buyerNotification);
        }
      }
      
      // 2. Notification for seller (if enabled)
      if (sendToSeller && transaction.seller_id && status === 'completed') {
        const sellerNotification = await this.createNotification(
          transaction.seller_id,
          'sale_completed',
          'Sprzedaż zakończona pomyślnie',
          `Użytkownik ${transaction.buyer?.display_name || 'Ktoś'} właśnie kupił miejsce w Twojej subskrypcji ${platformName}.`,
          'transaction',
          transactionId,
          'normal',
          0,
          true // Skip duplicate check
        );
        
        if (sellerNotification) {
          result.push(sellerNotification);
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error creating transaction notifications:', error);
      // Fall back to basic notification
      const buyerNotification = await this.createNotification(
        transaction?.buyer_id,
        'purchase_update',
        'Aktualizacja zakupu',
        'Twój zakup został zaktualizowany.',
        'purchase_record',
        purchaseId
      );
      
      return buyerNotification ? [buyerNotification] : [];
    }
  }

  /**
   * Create consolidated notifications for a dispute
   * Sends notifications to all involved parties
   * 
   * @param {Object} options - Dispute notification options
   * @param {string} options.disputeId - Dispute ID
   * @param {string} options.reporterId - User ID who reported the dispute
   * @param {string} options.reportedId - User ID being reported
   * @param {string} options.type - Dispute type
   * @returns {Promise<Object[]>} Created notifications
   */
  async createDisputeNotifications({
    disputeId,
    reporterId,
    reportedId,
    type = 'access'
  }) {
    try {
      // Get dispute details
      const { data: dispute, error } = await supabaseAdmin
        .from('disputes')
        .select('*')
        .eq('id', disputeId)
        .single();
        
      if (error || !dispute) {
        console.error('Error fetching dispute for notification:', error);
        return [];
      }
      
      const result = [];
      
      // 1. Notification for reporter
      const reporterNotification = await this.createNotification(
        reporterId,
        'dispute_created',
        'Zgłoszenie problemu zostało zarejestrowane',
        `Twoje zgłoszenie problemu z ${type === 'access' ? 'dostępem' : 'usługą'} zostało zarejestrowane. Skontaktujemy się z Tobą wkrótce.`,
        'dispute',
        disputeId,
        'normal',
        0,
        true // Skip duplicate check
      );
      
      if (reporterNotification) {
        result.push(reporterNotification);
      }
      
      // 2. Notification for reported user
      if (reportedId) {
        const reportedNotification = await this.createNotification(
          reportedId,
          'dispute_filed',
          'Zgłoszono problem z Twoją ofertą',
          `Kupujący zgłosił problem z ${type === 'access' ? 'dostępem do subskrypcji' : 'usługą'}. Prosimy o pilną weryfikację.`,
          'dispute',
          disputeId,
          'high',
          0,
          true // Skip duplicate check
        );
        
        if (reportedNotification) {
          result.push(reportedNotification);
        }
      }
      
      return result;
    } catch (error) {
      console.error('Error creating dispute notifications:', error);
      return [];
    }
  }

  /**
   * Check if a similar notification already exists for this entity and user
   * to prevent duplicate notifications
   * @param {string} userId - User ID
   * @param {string} type - Notification type
   * @param {string} entityType - Entity type
   * @param {string} entityId - Entity ID
   * @returns {Promise<boolean>} Whether a duplicate exists
   */
  async checkForDuplicateNotification(userId, type, entityType, entityId) {
    try {
      // Check for similar notifications in the last hour
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);
      
      const { count, error } = await supabaseAdmin
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('type', type)
        .eq('related_entity_type', entityType)
        .eq('related_entity_id', entityId)
        .gte('created_at', oneHourAgo.toISOString());
      
      if (error) throw error;
      
      return count > 0;
    } catch (error) {
      console.error('Error checking for duplicate notifications:', error);
      // If check fails, assume no duplicate to ensure notification is sent
      return false;
    }
  }

  /**
   * Advanced check for similar notifications with content comparison
   * @param {string} userId - User ID
   * @param {string} type - Notification type
   * @param {string} entityType - Entity type
   * @param {string} entityId - Entity ID
   * @param {string} title - Title to compare
   * @param {number} timeWindowMinutes - Time window to check, default 30 min
   * @returns {Promise<boolean>} Whether a similar notification exists
   */
  async checkForDuplicateNotificationAdvanced(
    userId, 
    type, 
    entityType, 
    entityId, 
    title,
    timeWindowMinutes = 30
  ) {
    try {
      // Calculate time window
      const timeWindow = new Date();
      timeWindow.setMinutes(timeWindow.getMinutes() - timeWindowMinutes);
      const timeWindowStr = timeWindow.toISOString();
      
      // Check for notifications in the time window
      const { data, error } = await supabaseAdmin
        .from('notifications')
        .select('id, title, content, created_at')
        .eq('user_id', userId)
        .eq('type', type)
        .eq('related_entity_type', entityType)
        .eq('related_entity_id', entityId)
        .gte('created_at', timeWindowStr)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      if (!data || data.length === 0) {
        return false;
      }
      
      // Check title similarity
      const similarTitle = data.some(notification => {
        // Normalize titles for comparison
        const normalizedExisting = notification.title.toLowerCase().trim();
        const normalizedNew = title.toLowerCase().trim();
        
        // Exact match
        if (normalizedExisting === normalizedNew) {
          return true;
        }
        
        // Similarity match > 80%
        if (this.calculateStringSimilarity(normalizedExisting, normalizedNew) > 0.8) {
          return true;
        }
        
        return false;
      });
      
      return similarTitle;
    } catch (error) {
      console.error('Error in advanced duplicate check:', error);
      // If check fails, assume no duplicate to ensure notification is sent
      return false;
    }
  }

  /**
   * Calculate string similarity using Levenshtein distance
   * @param {string} str1 - First string
   * @param {string} str2 - Second string
   * @returns {number} Similarity score between 0 and 1
   */
  calculateStringSimilarity(str1, str2) {
    // Handle edge cases
    if (str1 === str2) return 1.0;
    if (!str1 || !str2) return 0.0;
    
    // Initialize the matrix
    const track = Array(str2.length + 1).fill(null).map(() => 
      Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i += 1) {
      track[0][i] = i;
    }
    
    for (let j = 0; j <= str2.length; j += 1) {
      track[j][0] = j;
    }
    
    // Fill the matrix
    for (let j = 1; j <= str2.length; j += 1) {
      for (let i = 1; i <= str1.length; i += 1) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        track[j][i] = Math.min(
          track[j][i - 1] + 1, // deletion
          track[j - 1][i] + 1, // insertion
          track[j - 1][i - 1] + indicator, // substitution
        );
      }
    }
    
    // Calculate similarity
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1.0; // Both strings are empty
    
    const levenshteinDistance = track[str2.length][str1.length];
    return 1 - (levenshteinDistance / maxLength);
  }

  /**
   * Verify that an entity exists before sending a notification about it
   * @param {string} entityType - Type of entity
   * @param {string} entityId - ID of entity
   * @returns {Promise<boolean>} Whether the entity exists
   */
  async verifyEntityExists(entityType, entityId) {
    try {
      // Check cache first for performance
      const cacheKey = `entity_exists_${entityType}_${entityId}`;
      const cachedResult = this.getCache(cacheKey);
      if (cachedResult !== undefined) {
        return cachedResult;
      }

      // Map entity type to database table
      let table;
      switch (entityType) {
        case 'group':
          table = 'groups';
          break;
        case 'purchase':
        case 'purchase_record':
          table = 'purchase_records';
          break;
        case 'dispute':
          table = 'disputes';
          break;
        case 'transaction':
          table = 'transactions';
          break;
        case 'group_invitation':
          table = 'group_invitations';
          break;
        case 'group_sub':
          table = 'group_subs';
          break;
        case 'conversation':
          table = 'conversations';
          break;
        default:
          console.warn(`Unknown entity type: ${entityType}`);
          return false;
      }
      
      // Query the database
      const { count, error } = await supabaseAdmin
        .from(table)
        .select('id', { count: 'exact', head: true })
        .eq('id', entityId);
      
      if (error) throw error;
      
      const exists = count > 0;
      this.setCache(cacheKey, exists, 300); // Cache for 5 minutes
      return exists;
    } catch (error) {
      console.error(`Error verifying entity ${entityType}:${entityId}:`, error);
      
      // Entity existence verification is very important, so we'll throw
      // So the caller knows there was a problem with verification
      throw new Error(`Entity verification failed: ${error.message}`);
    }
  }

  /**
   * Create system notification for multiple recipients
   * @param {string[]} userIds - Array of user IDs to notify
   * @param {string} type - Notification type
   * @param {string} title - Notification title
   * @param {string} content - Notification content
   * @param {string} relatedEntityType - Entity type
   * @param {string} relatedEntityId - Entity ID
   * @returns {Promise<Object[]>} Created notifications
   */
  async createBulkNotifications(userIds, type, title, content, relatedEntityType = null, relatedEntityId = null) {
    if (!userIds || !Array.isArray(userIds) || userIds.length === 0) {
      return [];
    }
    
    try {
      // Verify entity exists
      let entityExists = true;
      if (relatedEntityType && relatedEntityId) {
        try {
          entityExists = await this.verifyEntityExists(relatedEntityType, relatedEntityId);
        } catch (verifyError) {
          console.warn(`Entity verification error in bulk notifications:`, verifyError);
          // Continue anyway for bulk notifications
          entityExists = true;
        }
        
        if (!entityExists) {
          console.warn(`Entity ${relatedEntityType}:${relatedEntityId} does not exist. Skipping bulk notifications.`);
          return [];
        }
      }
      
      // Create notification objects for each user
      const notifications = userIds.map(userId => ({
        user_id: userId,
        type,
        title,
        content,
        related_entity_type: relatedEntityType,
        related_entity_id: relatedEntityId,
        is_read: false,
        created_at: new Date().toISOString()
      }));
      
      // Process in batches of 50 to prevent request size limits
      const batchSize = 50;
      const results = [];
      
      for (let i = 0; i < notifications.length; i += batchSize) {
        const batch = notifications.slice(i, i + batchSize);
        
        try {
          const { data, error } = await supabaseAdmin
            .from('notifications')
            .insert(batch)
            .select();
            
          if (error) throw error;
          if (data) results.push(...data);
        } catch (batchError) {
          console.error(`Error processing notification batch ${i / batchSize + 1}:`, batchError);
          // Continue with next batch
        }
      }
      
      return results;
    } catch (error) {
      console.error('Error creating bulk notifications:', error);
      // Don't throw - fail silently for notifications
      return [];
    }
  }

  /**
   * Create a transaction notification that consolidates payment/purchase info
   * @param {string} userId - User ID
   * @param {string} transactionId - Transaction ID
   * @param {string} purchaseId - Purchase ID
   * @param {string} status - Transaction status
   * @returns {Promise<Object>} Created notification
   */
  async createTransactionNotification(userId, transactionId, purchaseId, status = 'completed') {
    try {
      // Get transaction details
      const { data: transaction, error: transactionError } = await supabaseAdmin
        .from('transactions')
        .select(`
          *,
          purchase:purchase_records!purchase_record_id(
            group_sub_id,
            group_sub:group_subs(
              subscription_platforms(name)
            )
          )
        `)
        .eq('id', transactionId)
        .single();
      
      if (transactionError || !transaction) {
        console.error('Error fetching transaction for notification:', transactionError);
        
        // Fallback - try to get info from purchase record instead
        const { data: purchase } = await supabaseAdmin
          .from('purchase_records')
          .select(`
            group_sub:group_subs(
              subscription_platforms(name)
            )
          `)
          .eq('id', purchaseId)
          .single();
          
        const platformName = purchase?.group_sub?.subscription_platforms?.name || 'subskrypcji';
        
        // Create notification with fallback content
        return this.createNotification(
          userId,
          status === 'completed' ? 'purchase_completed' : 'purchase_update',
          `Aktualizacja zakupu ${platformName}`,
          `Status Twojego zakupu został zaktualizowany.`,
          'purchase_record', // Use purchase_record instead of transaction as fallback
          purchaseId,
          status === 'failed' ? 'high' : 'normal',
          0,
          true // Skip duplicate check
        );
      }
      
      // Determine notification content based on status
      let title, content, type;
      const platformName = transaction.purchase?.group_sub?.subscription_platforms?.name || 'subskrypcji';
      
      if (status === 'completed') {
        type = 'purchase_completed';
        title = `Zakup ${platformName} zakończony pomyślnie`;
        content = `Twój zakup subskrypcji ${platformName} został pomyślnie zrealizowany. Możesz teraz uzyskać dostęp do instrukcji.`;
      } else if (status === 'failed') {
        type = 'purchase_failed';
        title = `Problem z zakupem ${platformName}`;
        content = `Wystąpił problem z Twoim zakupem subskrypcji ${platformName}. Sprawdź szczegóły płatności.`;
      } else {
        type = 'purchase_update';
        title = `Aktualizacja zakupu ${platformName}`;
        content = `Status Twojego zakupu subskrypcji ${platformName} został zaktualizowany.`;
      }
      
      // Create notification with transaction as the related entity
      // and a reference to purchase record in the notification content
      const notification = await this.createNotification(
        userId,
        type,
        title,
        content,
        'purchase_record', // Use purchase_record as entity type for consistency
        purchaseId,  // Now referencing purchase record directly for better frontend navigation
        status === 'failed' ? 'high' : 'normal',
        0,
        true // Skip duplicate check since we've already customized this
      );
      
      return notification;
    } catch (error) {
      console.error('Error creating transaction notification:', error);
      
      // Fall back to basic notification - critical for purchase notifications
      try {
        // Direct DB insert for critical notifications as final fallback
        if (status === 'completed' || status === 'failed') {
          const { data } = await supabaseAdmin
            .from('notifications')
            .insert({
              user_id: userId,
              type: status === 'completed' ? 'purchase_completed' : 'purchase_failed',
              title: status === 'completed' ? 'Zakup zakończony pomyślnie' : 'Problem z zakupem',
              content: status === 'completed' 
                ? 'Twój zakup został pomyślnie zrealizowany. Możesz teraz uzyskać dostęp do instrukcji.'
                : 'Wystąpił problem z Twoim zakupem. Sprawdź szczegóły płatności.',
              related_entity_type: 'purchase_record',
              related_entity_id: purchaseId,
              priority: status === 'failed' ? 'high' : 'normal',
              is_read: false,
              created_at: new Date().toISOString(),
              _emergency_fallback: true
            })
            .select()
            .single();
          
          return data;
        }
      } catch (fallbackError) {
        console.error('Emergency fallback notification also failed:', fallbackError);
      }
      
      return null;
    }
  }

  /**
   * Get unread notification count for a user
   * @param {string} userId - User ID
   * @returns {Promise<number>} Number of unread notifications
   */
  async getUnreadCount(userId) {
    try {
      const { count, error } = await supabaseAdmin
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;

      return count || 0;
    } catch (error) {
      console.error('Error counting unread notifications:', error);
      return 0;
    }
  }

  /**
   * Mark notification as read
   * @param {string|string[]} notificationIds - Notification ID or array of IDs
   * @param {string} userId - User ID for verification
   * @returns {Promise<boolean>} Success status
   */
  async markAsRead(notificationIds, userId) {
    try {
      // Convert single ID to array if needed
      const ids = Array.isArray(notificationIds) ? notificationIds : [notificationIds];
      
      if (ids.length === 0) {
        return true; // Nothing to mark
      }
      
      const { error } = await supabaseAdmin
        .from('notifications')
        .update({
          is_read: true
        })
        .in('id', ids)
        .eq('user_id', userId);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error marking notifications as read:', error);
      return false;
    }
  }

  /**
   * Mark all notifications as read for a user
   * @param {string} userId - User ID
   * @returns {Promise<boolean>} Success status
   */
  async markAllAsRead(userId) {
    try {
      const { error } = await supabaseAdmin
        .from('notifications')
        .update({
          is_read: true
        })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      return false;
    }
  }

  /**
   * Delete a notification
   * @param {string} notificationId - Notification ID
   * @param {string} userId - User ID for verification
   * @returns {Promise<boolean>} Success status
   */
  async deleteNotification(notificationId, userId) {
    try {
      const { error } = await supabaseAdmin
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (error) throw error;

      return true;
    } catch (error) {
      console.error('Error deleting notification:', error);
      return false;
    }
  }

  /**
   * Get user notifications with filtering and pagination
   * @param {string} userId - User ID
   * @param {Object} options - Filter and pagination options
   * @returns {Promise<Object>} Notifications and pagination info
   */
  async getUserNotifications(userId, options = {}) {
    try {
      // Build the query
      let query = supabaseAdmin
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', userId);

      // Apply filters
      if (options.type) {
        query = query.eq('type', options.type);
      }

      if (options.read !== null && options.read !== undefined) {
        query = query.eq('is_read', options.read);
      }

      if (options.priority) {
        query = query.eq('priority', options.priority);
      }

      if (options.relatedEntityType) {
        query = query.eq('related_entity_type', options.relatedEntityType);
      }

      if (options.relatedEntityId) {
        query = query.eq('related_entity_id', options.relatedEntityId);
      }

      // Order by creation date, newest first
      query = query.order('created_at', { ascending: false });

      // Apply pagination
      const page = options.page || 1;
      const pageSize = options.pageSize || 10;
      const start = (page - 1) * pageSize;
      const end = start + pageSize - 1;

      query = query.range(start, end);

      // Execute the query
      const { data, error, count } = await query;

      if (error) throw error;

      // Calculate pagination info
      const totalPages = Math.ceil((count || 0) / pageSize);

      return {
        notifications: data || [],
        pagination: {
          page,
          pageSize,
          total: count || 0,
          totalPages
        }
      };
    } catch (error) {
      console.error('Exception in getUserNotifications:', error);
      throw new Error(`Failed to fetch notifications: ${error.message}`);
    }
  }

  /**
   * Get notification preferences for a user
   * @param {string} userId - User ID
   * @returns {Promise<Object>} Notification preferences
   */
  async getNotificationPreferences(userId) {
    try {
      const { data, error } = await supabaseAdmin
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;

      // If no preferences exist, return defaults
      if (!data) {
        return {
          user_id: userId,
          email_enabled: true,
          push_enabled: false,
          notify_on_invite: true,
          notify_on_message: true,
          notify_on_purchase: true,
          notify_on_dispute: true,
          email_digest: 'daily'
        };
      }

      return data;
    } catch (error) {
      console.error('Error fetching notification preferences:', error);
      // Return defaults on error
      return {
        user_id: userId,
        email_enabled: true,
        push_enabled: false,
        notify_on_invite: true,
        notify_on_message: true,
        notify_on_purchase: true,
        notify_on_dispute: true,
        email_digest: 'daily'
      };
    }
  }

  /**
   * Update notification preferences for a user
   * @param {string} userId - User ID
   * @param {Object} preferences - Updated preferences
   * @returns {Promise<Object>} Updated preferences
   */
  async updateNotificationPreferences(userId, preferences) {
    try {
      // Check if preferences already exist
      const { data: existing } = await supabaseAdmin
        .from('notification_preferences')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      let result;

      if (existing) {
        // Update existing preferences
        const { data, error } = await supabaseAdmin
          .from('notification_preferences')
          .update(preferences)
          .eq('user_id', userId)
          .select()
          .single();

        if (error) throw error;
        result = data;
      } else {
        // Create new preferences
        const { data, error } = await supabaseAdmin
          .from('notification_preferences')
          .insert({
            user_id: userId,
            ...preferences
          })
          .select()
          .single();

        if (error) throw error;
        result = data;
      }

      return result;
    } catch (error) {
      console.error('Error updating notification preferences:', error);
      throw new Error(`Failed to update notification preferences: ${error.message}`);
    }
  }
}

// Create and export a singleton instance
export const notificationService = new NotificationService();