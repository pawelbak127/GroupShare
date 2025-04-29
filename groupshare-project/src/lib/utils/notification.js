// src/lib/utils/notification-utils.js
/**
 * Generate a link to the entity related to the notification
 * @param {Object} notification - Notification object
 * @param {boolean} includeFromNotification - Whether to include from_notification param
 * @returns {string|null} URL to the entity or null if no entity
 */
export const getNotificationLink = (notification, includeFromNotification = true) => {
  if (!notification.related_entity_type || !notification.related_entity_id) {
    console.warn("Missing related_entity_type or related_entity_id in notification:", notification);
    return null;
  }

  const fromNotificationParam = includeFromNotification ? 'from_notification=true' : '';
  const separator = includeFromNotification ? '&' : '';

  // Generate appropriate URL based on entity type
  switch (notification.related_entity_type) {
    case 'group':
      return `/groups/${notification.related_entity_id}?${fromNotificationParam}`;
    case 'group_invitation':
      return `/groups/join?code=${notification.related_entity_id}${separator}${fromNotificationParam}`;
    case 'purchase':
    case 'purchase_record': // Handle purchase_record from database
      return `/purchases/${notification.related_entity_id}/details?${fromNotificationParam}`;
    case 'dispute':
      return `/disputes/${notification.related_entity_id}?${fromNotificationParam}`;
    case 'transaction':
      // For transactions, redirect to purchase details, but with transactionId=true
      return `/purchases/${notification.related_entity_id}/details?transactionId=true${separator}${fromNotificationParam}`;
    case 'conversation':
      return `/messages/${notification.related_entity_id}?${fromNotificationParam}`;
    default:
      console.warn(`Unsupported entity type in notification: ${notification.related_entity_type}`, notification);
      return null;
  }
};

/**
 * Get icon component based on notification type
 * @param {string} type - Notification type
 * @returns {Object} Icon configuration
 */
export const getNotificationIconConfig = (type) => {
  switch (type) {
    case 'invite':
      return { name: 'UserPlus', color: 'indigo-500' };
    case 'message':
      return { name: 'Envelope', color: 'blue-500' };
    case 'purchase':
    case 'purchase_completed':
      return { name: 'Ticket', color: 'green-500' };
    case 'purchase_failed':
      return { name: 'XCircle', color: 'red-500' };
    case 'dispute':
    case 'dispute_filed':
    case 'dispute_created':
      return { name: 'ExclamationTriangle', color: 'red-500' };
    case 'payment':
    case 'sale_completed':
      return { name: 'CreditCard', color: 'green-500' };
    case 'access':
      return { name: 'Key', color: 'blue-500' };
    default:
      return { name: 'Bell', color: 'gray-400' };
  }
};

/**
 * Get background color class based on notification state
 * @param {Object} notification - Notification object
 * @returns {string} Tailwind CSS class for background
 */
export const getNotificationBackgroundColor = (notification) => {
  if (!notification.is_read) {
    return 'bg-indigo-50 hover:bg-indigo-100';
  }
  
  switch (notification.priority) {
    case 'high':
      return 'hover:bg-red-50';
    case 'low':
      return 'hover:bg-gray-50';
    default:
      return 'hover:bg-gray-50';
  }
};

/**
 * Get badge for entity type display
 * @param {string} entityType - Entity type
 * @returns {Object} Badge configuration
 */
export const getEntityBadgeConfig = (entityType) => {
  switch (entityType) {
    case 'group_invitation':
      return { text: 'Zaproszenie', color: 'blue' };
    case 'purchase':
    case 'purchase_record':
      return { text: 'Zakup', color: 'green' };
    case 'dispute':
      return { text: 'Spór', color: 'red' };
    case 'conversation':
      return { text: 'Wiadomość', color: 'blue' };
    case 'transaction':
      return { text: 'Transakcja', color: 'green' };
    default:
      return { text: entityType, color: 'gray' };
  }
};