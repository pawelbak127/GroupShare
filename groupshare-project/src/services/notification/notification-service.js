// src/services/notification/notification-service.js
import supabaseAdmin from '@/lib/database/supabase-admin-client';

class NotificationService {
  /**
   * Creates a new notification
   * @param {string} userId - ID of the user to notify
   * @param {string} type - Type of notification (payment, access, message, invite, system)
   * @param {string} title - Title of the notification
   * @param {string} content - Content of the notification
   * @param {string} relatedEntityType - Type of related entity (optional)
   * @param {string} relatedEntityId - ID of related entity (optional)
   * @param {string} priority - Priority (high, normal) (optional)
   * @returns {Promise<Object>} Created notification
   */
  async createNotification(
    userId,
    type,
    title,
    content,
    relatedEntityType = null,
    relatedEntityId = null,
    priority = 'normal'
  ) {
    try {
      // Basic validation
      if (!userId || !type || !title || !content) {
        console.warn('Missing required fields for notification');
        return null;
      }

      // Simple duplicate check for the same entity in the last 10 minutes
      if (relatedEntityType && relatedEntityId) {
        const isDuplicate = await this.checkForDuplicate(
          userId, 
          type, 
          relatedEntityType, 
          relatedEntityId
        );
        
        if (isDuplicate) {
          console.log(`Skipping duplicate notification: ${type} for ${relatedEntityType}:${relatedEntityId}`);
          return null;
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

      // For high priority notifications, try with one retry
      if (priority === 'high') {
        try {
          const { data, error } = await supabaseAdmin
            .from('notifications')
            .insert(notification)
            .select()
            .single();

          if (error) throw error;
          return data;
        } catch (firstError) {
          console.warn('First attempt failed, retrying critical notification:', firstError);
          
          // Wait 500ms and retry once
          await new Promise(r => setTimeout(r, 500));
          
          const { data, error } = await supabaseAdmin
            .from('notifications')
            .insert(notification)
            .select()
            .single();
            
          if (error) throw error;
          return data;
        }
      } else {
        // Normal priority - just one attempt
        const { data, error } = await supabaseAdmin
          .from('notifications')
          .insert(notification)
          .select()
          .single();

        if (error) throw error;
        return data;
      }
    } catch (error) {
      console.error('Error creating notification:', error);
      return null;
    }
  }

  /**
   * Simple check for duplicate notifications in the last 10 minutes
   */
  async checkForDuplicate(userId, type, entityType, entityId) {
    try {
      // Check for similar notifications in the last 10 minutes
      const tenMinutesAgo = new Date();
      tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10);
      
      const { count, error } = await supabaseAdmin
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('type', type)
        .eq('related_entity_type', entityType)
        .eq('related_entity_id', entityId)
        .gte('created_at', tenMinutesAgo.toISOString());
      
      if (error) throw error;
      
      return count > 0;
    } catch (error) {
      console.error('Error checking for duplicates:', error);
      return false; // If check fails, assume no duplicate
    }
  }

  /**
   * Create notification for a message/conversation
   */
  async createMessageNotification(recipientId, senderId, conversationId, messagePreview, isGroupConversation = false) {
    try {
      // Get sender info
      const { data: sender } = await supabaseAdmin
        .from('user_profiles')
        .select('display_name')
        .eq('id', senderId)
        .single();
      
      const senderName = sender?.display_name || 'Użytkownik';
      const title = isGroupConversation ? 'Nowa wiadomość w konwersacji grupowej' : 'Nowa wiadomość';
      const content = `${senderName}: ${messagePreview}`;
      
      return this.createNotification(
        recipientId,
        'message',
        title,
        content,
        'conversation',
        conversationId,
        'normal'
      );
    } catch (error) {
      console.error('Error creating message notification:', error);
      return null;
    }
  }

  /**
   * Create payment notification
   */
  async createPaymentNotification(userId, status, purchaseId, platformName = 'subskrypcji') {
    try {
      let title, content, type, priority;
      
      if (status === 'completed') {
        type = 'payment';
        title = `Zakup ${platformName} zakończony pomyślnie`;
        content = `Twój zakup subskrypcji ${platformName} został pomyślnie zrealizowany. Możesz teraz uzyskać dostęp do instrukcji.`;
        priority = 'normal';
      } else if (status === 'failed') {
        type = 'payment';
        title = `Problem z zakupem ${platformName}`;
        content = `Wystąpił problem z Twoim zakupem subskrypcji ${platformName}. Sprawdź szczegóły płatności.`;
        priority = 'high';
      } else {
        type = 'payment';
        title = `Aktualizacja zakupu ${platformName}`;
        content = `Status Twojego zakupu subskrypcji ${platformName} został zaktualizowany.`;
        priority = 'normal';
      }
      
      return this.createNotification(
        userId,
        type,
        title,
        content,
        'purchase_record',
        purchaseId,
        priority
      );
    } catch (error) {
      console.error('Error creating payment notification:', error);
      return null;
    }
  }

  /**
   * Get unread notification count for a user
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
   */
  async markAsRead(notificationIds, userId) {
    try {
      const ids = Array.isArray(notificationIds) ? notificationIds : [notificationIds];
      
      if (ids.length === 0) return true;
      
      const { error } = await supabaseAdmin
        .from('notifications')
        .update({ is_read: true })
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
   */
  async markAllAsRead(userId) {
    try {
      const { error } = await supabaseAdmin
        .from('notifications')
        .update({ is_read: true })
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
   */
  async getUserNotifications(userId, options = {}) {
    try {
      let query = supabaseAdmin
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', userId);

      // Apply simple filters
      if (options.type) {
        query = query.eq('type', options.type);
      }

      if (options.read !== null && options.read !== undefined) {
        query = query.eq('is_read', options.read);
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
      console.error('Error in getUserNotifications:', error);
      throw new Error(`Failed to fetch notifications: ${error.message}`);
    }
  }
}

// Create and export a singleton instance
export const notificationService = new NotificationService();