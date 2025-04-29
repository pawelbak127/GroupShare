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
    case 'group_sub':
      return `/offers/${notification.related_entity_id}?${fromNotificationParam}`;
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
    case 'system':
      return { name: 'Cog', color: 'gray-500' };
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
  // High priority notifications get a warm background even if read
  if (notification.priority === 'high') {
    return notification.is_read 
      ? 'bg-red-50 hover:bg-red-100' 
      : 'bg-red-100 hover:bg-red-200';
  }
  
  if (!notification.is_read) {
    return 'bg-indigo-50 hover:bg-indigo-100';
  }
  
  // For read notifications, differentiate by type
  switch (notification.type) {
    case 'purchase_completed':
    case 'sale_completed':
      return 'hover:bg-green-50';
    case 'purchase_failed':
      return 'hover:bg-red-50';
    case 'invite':
      return 'hover:bg-indigo-50';
    case 'message':
      return 'hover:bg-blue-50';
    case 'dispute':
    case 'dispute_filed':
    case 'dispute_created':
      return 'hover:bg-yellow-50';
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
    case 'group':
      return { text: 'Grupa', color: 'indigo' };
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
    case 'group_sub':
      return { text: 'Oferta', color: 'purple' };
    default:
      return { text: entityType, color: 'gray' };
  }
};

/**
 * Group similar notifications for better display
 * @param {Array} notifications - Array of notifications
 * @returns {Array} Grouped notifications
 */
export const groupSimilarNotifications = (notifications) => {
  if (!notifications || !Array.isArray(notifications) || notifications.length <= 1) {
    return notifications || [];
  }
  
  // Group by related entity and type
  const groupedNotifications = notifications.reduce((groups, notification) => {
    // Skip grouping for high priority notifications
    if (notification.priority === 'high') {
      groups.push([notification]);
      return groups;
    }
    
    // Find an existing group that this notification might belong to
    const existingGroupIndex = groups.findIndex(group => {
      const firstNotif = group[0];
      
      // Check if notifications are related (same entity type, entity id, and similar type)
      return (
        notification.related_entity_type === firstNotif.related_entity_type &&
        notification.related_entity_id === firstNotif.related_entity_id &&
        areSimilarTypes(notification.type, firstNotif.type) &&
        // Only group notifications created within 24 hours of each other
        Math.abs(new Date(notification.created_at) - new Date(firstNotif.created_at)) < 24 * 60 * 60 * 1000
      );
    });
    
    if (existingGroupIndex !== -1) {
      groups[existingGroupIndex].push(notification);
    } else {
      groups.push([notification]);
    }
    
    return groups;
  }, []);
  
  // For each group, if it contains only one notification, just return it
  // Otherwise, create a grouped notification
  return groupedNotifications.map(group => {
    if (group.length === 1) {
      return group[0];
    }
    
    const firstNotif = group[0];
    const latestNotif = [...group].sort((a, b) => 
      new Date(b.created_at) - new Date(a.created_at)
    )[0];
    
    // Create a grouped notification
    return {
      ...firstNotif,
      id: `group-${firstNotif.id}`,
      title: getGroupTitle(group),
      content: getGroupContent(group),
      is_read: group.every(n => n.is_read),
      created_at: latestNotif.created_at,
      grouped: true,
      group_count: group.length,
      // Store original notifications for reference
      original_notifications: group
    };
  });
};

/**
 * Check if two notification types are similar
 * @param {string} type1 - First notification type
 * @param {string} type2 - Second notification type
 * @returns {boolean} Whether the types are similar
 */
const areSimilarTypes = (type1, type2) => {
  if (type1 === type2) return true;
  
  const purchaseTypes = ['purchase', 'purchase_completed', 'purchase_failed', 'payment'];
  const disputeTypes = ['dispute', 'dispute_filed', 'dispute_created'];
  
  if (purchaseTypes.includes(type1) && purchaseTypes.includes(type2)) return true;
  if (disputeTypes.includes(type1) && disputeTypes.includes(type2)) return true;
  
  return false;
};

/**
 * Generate a title for a group of notifications
 * @param {Array} group - Group of similar notifications
 * @returns {string} Group title
 */
const getGroupTitle = (group) => {
  const count = group.length;
  const firstNotif = group[0];
  
  // Purchase group
  if (['purchase', 'purchase_completed', 'purchase_failed', 'payment'].includes(firstNotif.type)) {
    return `${count} aktualizacji zakupu`;
  }
  
  // Dispute group
  if (['dispute', 'dispute_filed', 'dispute_created'].includes(firstNotif.type)) {
    return `${count} aktualizacji sporu`;
  }
  
  // Message group
  if (firstNotif.type === 'message') {
    return `${count} nowych wiadomości`;
  }
  
  // Invite group
  if (firstNotif.type === 'invite') {
    return `${count} nowych zaproszeń`;
  }
  
  // Default
  return `${count} podobnych powiadomień`;
};

/**
 * Generate content for a group of notifications
 * @param {Array} group - Group of similar notifications
 * @returns {string} Group content
 */
const getGroupContent = (group) => {
  const count = group.length;
  const firstNotif = group[0];
  
  return `Masz ${count} podobnych powiadomień związanych z ${
    firstNotif.related_entity_type === 'purchase' || firstNotif.related_entity_type === 'purchase_record'
      ? 'zakupem'
      : firstNotif.related_entity_type === 'dispute'
      ? 'sporem'
      : firstNotif.related_entity_type === 'conversation'
      ? 'konwersacją'
      : firstNotif.related_entity_type === 'group'
      ? 'grupą'
      : 'encją'
  }. Kliknij, aby zobaczyć szczegóły.`;
};