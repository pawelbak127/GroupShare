// src/services/notification/notification-service.js
import supabaseAdmin from '@/lib/database/supabase-admin-client';

class NotificationService {
  /**
   * Creates a new notification
   * @param {string} userId - ID of the user to notify
   * @param {string} type - Type of notification (invite, message, purchase, dispute)
   * @param {string} title - Title of the notification
   * @param {string} content - Content of the notification
   * @param {string} relatedEntityType - Type of related entity (optional)
   * @param {string} relatedEntityId - ID of related entity (optional)
   * @param {string} priority - Priority (high, normal, low) (optional)
   * @param {number} ttl - Time to live in days (0 = no expiration) (optional)
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
    ttl = 0
  ) {
    try {
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

      const { data, error } = await supabaseAdmin
        .from('notifications')
        .insert(notification)
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Error creating notification:', error);
      throw new Error(`Failed to create notification: ${error.message}`);
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
      
      const { error } = await supabaseAdmin
        .from('notifications')
        .update({
          is_read: true
          // Removed read_at as it doesn't exist in the schema
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
          // Removed read_at as it doesn't exist in the schema
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