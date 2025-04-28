'use client';

import { useState } from 'react';
import NotificationCard from './NotificationCard';

/**
 * Komponent listy powiadomień
 */
const NotificationList = ({ notifications = [], onMarkAsRead, onDelete }) => {
  return (
    <div className="divide-y divide-gray-200">
      {notifications.map(notification => (
        <NotificationCard
          key={notification.id}
          notification={notification}
          onMarkAsRead={onMarkAsRead}
          onDelete={onDelete}
        />
      ))}
    </div>
  );
};

export default NotificationList;