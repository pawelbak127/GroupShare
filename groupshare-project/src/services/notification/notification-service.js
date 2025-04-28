// src/services/notification/notification-service.js
import supabaseAdmin from '@/lib/database/supabase-admin-client';

/**
 * Serwis do zarządzania powiadomieniami użytkowników
 */
export class NotificationService {
  constructor() {
    // Sprawdź czy supabaseAdmin jest dostępny przy inicjalizacji
    if (!supabaseAdmin) {
      console.warn('NotificationService: supabaseAdmin is not initialized. Service functionality will be limited.');
    }
  }

  /**
   * Metoda pomocnicza sprawdzająca dostępność klienta supabase
   * @private
   */
  _checkSupabaseClient() {
    if (!supabaseAdmin) {
      throw new Error('Database client is not initialized. Check server configuration.');
    }
  }

  /**
   * Tworzy nowe powiadomienie
   * @param {string} userId - ID użytkownika, który ma otrzymać powiadomienie
   * @param {string} type - Typ powiadomienia (invite, message, purchase, dispute)
   * @param {string} title - Tytuł powiadomienia
   * @param {string} content - Treść powiadomienia
   * @param {string} relatedEntityType - Typ powiązanego zasobu (np. group, purchase)
   * @param {string} relatedEntityId - ID powiązanego zasobu
   * @param {string} priority - Priorytet powiadomienia (high, normal, low)
   * @param {number} ttl - Czas życia w sekundach, 0 oznacza brak wygaśnięcia
   * @returns {Promise<Object>} - Utworzone powiadomienie
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
      this._checkSupabaseClient();

      // Walidacja podstawowych danych
      if (!userId || !type || !title || !content) {
        throw new Error('Missing required fields: userId, type, title and content are required');
      }

      // Walidacja typu
      const validTypes = ['invite', 'message', 'purchase', 'dispute'];
      if (!validTypes.includes(type)) {
        throw new Error(`Invalid notification type. Must be one of: ${validTypes.join(', ')}`);
      }

      // Walidacja priorytetu
      const validPriorities = ['high', 'normal', 'low'];
      if (!validPriorities.includes(priority)) {
        throw new Error(`Invalid priority. Must be one of: ${validPriorities.join(', ')}`);
      }

      // Oblicz datę wygaśnięcia, jeśli podano TTL
      let expiresAt = null;
      if (ttl > 0) {
        expiresAt = new Date();
        expiresAt.setSeconds(expiresAt.getSeconds() + ttl);
      }

      const notification = {
        user_id: userId,
        type,
        title,
        content,
        related_entity_type: relatedEntityType,
        related_entity_id: relatedEntityId,
        priority,
        expires_at: expiresAt ? expiresAt.toISOString() : null,
        created_at: new Date().toISOString(),
        is_read: false
      };

      const { data, error } = await supabaseAdmin
        .from('notifications')
        .insert(notification)
        .select()
        .single();

      if (error) {
        console.error('Error creating notification:', error);
        throw new Error(`Failed to create notification: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Exception in createNotification:', error);
      throw error;
    }
  }

  /**
   * Pobiera powiadomienia użytkownika z filtrowaniem i paginacją
   * @param {string} userId - ID użytkownika
   * @param {Object} options - Opcje filtrowania i paginacji
   * @returns {Promise<Object>} - Powiadomienia i informacje o paginacji
   */
  async getUserNotifications(userId, options = {}) {
    try {
      this._checkSupabaseClient();

      if (!userId) {
        throw new Error('User ID is required');
      }

      const {
        type = null,
        read = null,
        priority = null,
        page = 1,
        pageSize = 10,
        relatedEntityType = null,
        relatedEntityId = null,
        olderThan = null,
        newerThan = null,
      } = options;

      // Oblicz paginację
      const from = (page - 1) * pageSize;
      const to = from + pageSize - 1;

      // Zbuduj zapytanie
      let query = supabaseAdmin
        .from('notifications')
        .select('*', { count: 'exact' })
        .eq('user_id', userId);

      // Zastosuj filtry
      if (type) {
        query = query.eq('type', type);
      }

      if (read !== null) {
        query = query.eq('is_read', read);
      }

      if (priority) {
        query = query.eq('priority', priority);
      }

      if (relatedEntityType) {
        query = query.eq('related_entity_type', relatedEntityType);
      }

      if (relatedEntityId) {
        query = query.eq('related_entity_id', relatedEntityId);
      }

      // Filtry dat
      if (olderThan) {
        query = query.lt('created_at', olderThan);
      }

      if (newerThan) {
        query = query.gt('created_at', newerThan);
      }

      // Wykluczanie wygasłych powiadomień
      query = query.or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

      // Sortowanie i paginacja
      query = query
        .order('created_at', { ascending: false })
        .range(from, to);

      const { data, error, count } = await query;

      if (error) {
        console.error('Error fetching notifications:', error);
        throw new Error(`Failed to fetch notifications: ${error.message}`);
      }

      return {
        notifications: data || [],
        pagination: {
          page,
          pageSize,
          total: count || 0,
          totalPages: count ? Math.ceil(count / pageSize) : 0
        }
      };
    } catch (error) {
      console.error('Exception in getUserNotifications:', error);
      
      // Zwróć domyślną strukturę w przypadku błędu, aby aplikacja mogła działać dalej
      return {
        notifications: [],
        pagination: {
          page: options.page || 1,
          pageSize: options.pageSize || 10,
          total: 0,
          totalPages: 0
        },
        error: error.message
      };
    }
  }

  /**
   * Pobiera liczbę nieprzeczytanych powiadomień dla użytkownika
   * @param {string} userId - ID użytkownika
   * @returns {Promise<number>} - Liczba nieprzeczytanych powiadomień
   */
  async getUnreadCount(userId) {
    try {
      this._checkSupabaseClient();

      if (!userId) {
        return 0;
      }

      const { count, error } = await supabaseAdmin
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false)
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

      if (error) {
        console.error('Error counting unread notifications:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Exception in getUnreadCount:', error);
      return 0;
    }
  }

  /**
   * Oznacza powiadomienia jako przeczytane
   * @param {Array<string>} notificationIds - Tablica ID powiadomień do oznaczenia
   * @param {string} userId - ID użytkownika (dla weryfikacji bezpieczeństwa)
   * @returns {Promise<boolean>} - Czy operacja się powiodła
   */
  async markAsRead(notificationIds, userId) {
    try {
      this._checkSupabaseClient();

      if (!Array.isArray(notificationIds) || notificationIds.length === 0 || !userId) {
        return false;
      }

      // Aktualizuj powiadomienia, upewniając się, że należą do użytkownika
      const { error } = await supabaseAdmin
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .in('id', notificationIds)
        .eq('user_id', userId);

      if (error) {
        console.error('Error marking notifications as read:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Exception in markAsRead:', error);
      return false;
    }
  }

  /**
   * Oznacza wszystkie powiadomienia użytkownika jako przeczytane
   * @param {string} userId - ID użytkownika
   * @returns {Promise<boolean>} - Czy operacja się powiodła
   */
  async markAllAsRead(userId) {
    try {
      this._checkSupabaseClient();

      if (!userId) {
        return false;
      }

      const { error } = await supabaseAdmin
        .from('notifications')
        .update({
          is_read: true,
          read_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('is_read', false);

      if (error) {
        console.error('Error marking all notifications as read:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Exception in markAllAsRead:', error);
      return false;
    }
  }

  /**
   * Usuwa powiadomienie
   * @param {string} notificationId - ID powiadomienia do usunięcia
   * @param {string} userId - ID użytkownika (dla weryfikacji bezpieczeństwa)
   * @returns {Promise<boolean>} - Czy operacja się powiodła
   */
  async deleteNotification(notificationId, userId) {
    try {
      this._checkSupabaseClient();

      if (!notificationId || !userId) {
        return false;
      }

      // Usuń powiadomienie, upewniając się, że należy do użytkownika
      const { error } = await supabaseAdmin
        .from('notifications')
        .delete()
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (error) {
        console.error('Error deleting notification:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Exception in deleteNotification:', error);
      return false;
    }
  }

  /**
   * Pobiera preferencje powiadomień dla użytkownika
   * @param {string} userId - ID użytkownika
   * @returns {Promise<Object>} - Preferencje powiadomień
   */
  async getNotificationPreferences(userId) {
    try {
      this._checkSupabaseClient();

      if (!userId) {
        return this.getDefaultPreferences();
      }

      const { data, error } = await supabaseAdmin
        .from('notification_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = not found
        console.error('Error fetching notification preferences:', error);
        return this.getDefaultPreferences();
      }

      // Jeśli nie znaleziono preferencji, zwróć domyślne
      if (!data) {
        return this.getDefaultPreferences();
      }

      return data;
    } catch (error) {
      console.error('Exception in getNotificationPreferences:', error);
      return this.getDefaultPreferences();
    }
  }

  /**
   * Aktualizuje preferencje powiadomień dla użytkownika
   * @param {string} userId - ID użytkownika
   * @param {Object} preferences - Preferencje powiadomień do aktualizacji
   * @returns {Promise<Object>} - Zaktualizowane preferencje
   */
  async updateNotificationPreferences(userId, preferences) {
    try {
      this._checkSupabaseClient();

      if (!userId) {
        throw new Error('User ID is required');
      }

      // Pobierz aktualne preferencje
      const currentPrefs = await this.getNotificationPreferences(userId);
      
      // Sprawdź, czy trzeba wstawić czy zaktualizować
      const operation = currentPrefs.id 
        ? supabaseAdmin.from('notification_preferences').update({
            ...preferences,
            updated_at: new Date().toISOString()
          }).eq('id', currentPrefs.id)
        : supabaseAdmin.from('notification_preferences').insert({
            user_id: userId,
            ...preferences,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });
      
      const { data, error } = await operation.select().single();

      if (error) {
        console.error('Error updating notification preferences:', error);
        throw new Error(`Failed to update notification preferences: ${error.message}`);
      }

      return data;
    } catch (error) {
      console.error('Exception in updateNotificationPreferences:', error);
      throw error;
    }
  }

  /**
   * Pobiera domyślne preferencje powiadomień
   * @returns {Object} - Domyślne preferencje
   */
  getDefaultPreferences() {
    return {
      email_notifications: true,
      push_notifications: false,
      notify_on_invite: true,
      notify_on_message: true,
      notify_on_purchase: true,
      notify_on_dispute: true,
      email_digest: 'daily', // daily, weekly, never
    };
  }

  /**
   * Grupuje powiązane powiadomienia
   * @param {Array<Object>} notifications - Powiadomienia do pogrupowania
   * @returns {Array<Object>} - Pogrupowane powiadomienia
   */
  groupNotifications(notifications) {
    if (!notifications || notifications.length === 0) {
      return [];
    }

    const groups = {};

    // Grupuj powiadomienia według powiązanego zasobu, jeśli dostępny
    notifications.forEach(notification => {
      if (notification.related_entity_type && notification.related_entity_id) {
        const key = `${notification.related_entity_type}_${notification.related_entity_id}`;
        
        if (!groups[key]) {
          groups[key] = {
            type: notification.type,
            related_entity_type: notification.related_entity_type,
            related_entity_id: notification.related_entity_id,
            latest: notification,
            count: 1,
            notifications: [notification]
          };
        } else {
          groups[key].count++;
          groups[key].notifications.push(notification);
          
          // Zaktualizuj najnowsze, jeśli to powiadomienie jest nowsze
          if (new Date(notification.created_at) > new Date(groups[key].latest.created_at)) {
            groups[key].latest = notification;
          }
        }
      } else {
        // Dla powiadomień bez powiązań utwórz unikalną grupę
        const key = `individual_${notification.id}`;
        groups[key] = {
          type: notification.type,
          latest: notification,
          count: 1,
          notifications: [notification]
        };
      }
    });

    // Konwertuj na tablicę i sortuj według daty najnowszego powiadomienia
    return Object.values(groups).sort((a, b) => 
      new Date(b.latest.created_at) - new Date(a.latest.created_at)
    );
  }

  /**
   * Czyści wygasłe powiadomienia
   * @returns {Promise<number>} - Liczba usuniętych powiadomień
   */
  async cleanupExpiredNotifications() {
    try {
      this._checkSupabaseClient();

      const now = new Date().toISOString();
      
      const { data, error } = await supabaseAdmin
        .from('notifications')
        .delete()
        .lt('expires_at', now)
        .not('expires_at', 'is', null)
        .select('id');

      if (error) {
        console.error('Error cleaning up expired notifications:', error);
        return 0;
      }

      return data ? data.length : 0;
    } catch (error) {
      console.error('Exception in cleanupExpiredNotifications:', error);
      return 0;
    }
  }
}

// Instancja singletona
export const notificationService = new NotificationService();