// src/__tests__/services/notification-service.test.js
import { notificationService } from '@/services/notification/notification-service';
import supabaseAdmin from '@/lib/database/supabase-admin-client';

// Mock supabaseAdmin
jest.mock('@/lib/database/supabase-admin-client', () => ({
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  single: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis()
}));

describe('NotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createNotification', () => {
    it('should create a notification successfully', async () => {
      // Arrange
      const mockNotification = {
        id: 'notification123',
        user_id: 'user123',
        type: 'payment',
        title: 'Payment Success',
        content: 'Your payment was successful',
        related_entity_type: 'purchase_record',
        related_entity_id: 'purchase123',
        is_read: false,
        created_at: '2023-01-01T00:00:00.000Z'
      };

      supabaseAdmin.from().insert().select().single.mockResolvedValue({
        data: mockNotification,
        error: null
      });

      // Act
      const result = await notificationService.createNotification(
        'user123',
        'payment',
        'Payment Success',
        'Your payment was successful',
        'purchase_record',
        'purchase123',
        'normal'
      );

      // Assert
      expect(supabaseAdmin.from).toHaveBeenCalledWith('notifications');
      expect(supabaseAdmin.from().insert).toHaveBeenCalled();
      expect(result).toEqual(mockNotification);
    });

    it('should return null if required fields are missing', async () => {
      // Act
      const result = await notificationService.createNotification(
        'user123',
        '',
        'Payment Success',
        'Your payment was successful'
      );

      // Assert
      expect(supabaseAdmin.from).not.toHaveBeenCalled();
      expect(result).toBeNull();
    });

    it('should handle database errors gracefully', async () => {
      // Arrange
      supabaseAdmin.from().insert().select().single.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      // Act
      const result = await notificationService.createNotification(
        'user123',
        'payment',
        'Payment Success',
        'Your payment was successful'
      );

      // Assert
      expect(supabaseAdmin.from).toHaveBeenCalledWith('notifications');
      expect(result).toBeNull();
    });
  });

  describe('createPaymentNotification', () => {
    it('should create a payment success notification', async () => {
      // Arrange
      const mockUserId = 'user123';
      const mockPurchaseId = 'purchase123';
      const mockPlatformName = 'Netflix';
      
      const mockNotification = {
        id: 'notification123',
        user_id: mockUserId,
        type: 'payment',
        title: `Zakup ${mockPlatformName} zakończony pomyślnie`,
        content: expect.any(String),
        is_read: false
      };

      // Mocking the internal createNotification call
      jest.spyOn(notificationService, 'createNotification').mockResolvedValue(mockNotification);

      // Act
      const result = await notificationService.createPaymentNotification(
        mockUserId,
        'completed',
        mockPurchaseId,
        mockPlatformName
      );

      // Assert
      expect(notificationService.createNotification).toHaveBeenCalledWith(
        mockUserId,
        'payment',
        expect.stringContaining(mockPlatformName),
        expect.any(String),
        'purchase_record',
        mockPurchaseId,
        'normal'
      );
      expect(result).toEqual(mockNotification);
    });

    it('should create a payment failed notification with high priority', async () => {
      // Arrange
      const mockUserId = 'user123';
      const mockPurchaseId = 'purchase123';
      
      const mockNotification = {
        id: 'notification123',
        user_id: mockUserId,
        type: 'payment',
        title: expect.stringContaining('Problem z zakupem'),
        content: expect.any(String),
        is_read: false
      };

      // Mocking the internal createNotification call
      jest.spyOn(notificationService, 'createNotification').mockResolvedValue(mockNotification);

      // Act
      const result = await notificationService.createPaymentNotification(
        mockUserId,
        'failed',
        mockPurchaseId
      );

      // Assert
      expect(notificationService.createNotification).toHaveBeenCalledWith(
        mockUserId,
        'payment',
        expect.any(String),
        expect.any(String),
        'purchase_record',
        mockPurchaseId,
        'high'
      );
      expect(result).toEqual(mockNotification);
    });
  });

  describe('getUnreadCount', () => {
    it('should return the correct count of unread notifications', async () => {
      // Arrange
      supabaseAdmin.from().select().eq().eq.mockResolvedValue({
        count: 5,
        error: null
      });

      // Act
      const result = await notificationService.getUnreadCount('user123');

      // Assert
      expect(supabaseAdmin.from).toHaveBeenCalledWith('notifications');
      expect(supabaseAdmin.from().select).toHaveBeenCalledWith('*', { count: 'exact', head: true });
      expect(supabaseAdmin.from().select().eq).toHaveBeenCalledWith('user_id', 'user123');
      expect(supabaseAdmin.from().select().eq().eq).toHaveBeenCalledWith('is_read', false);
      expect(result).toBe(5);
    });

    it('should return 0 if there is an error', async () => {
      // Arrange
      supabaseAdmin.from().select().eq().eq.mockResolvedValue({
        count: null,
        error: { message: 'Database error' }
      });

      // Act
      const result = await notificationService.getUnreadCount('user123');

      // Assert
      expect(result).toBe(0);
    });
  });

  describe('markAsRead', () => {
    it('should mark notifications as read successfully', async () => {
      // Arrange
      supabaseAdmin.from().update().in().eq.mockResolvedValue({
        error: null
      });

      // Act
      const result = await notificationService.markAsRead(['notification1', 'notification2'], 'user123');

      // Assert
      expect(supabaseAdmin.from).toHaveBeenCalledWith('notifications');
      expect(supabaseAdmin.from().update).toHaveBeenCalledWith({ is_read: true });
      expect(supabaseAdmin.from().update().in).toHaveBeenCalledWith('id', ['notification1', 'notification2']);
      expect(supabaseAdmin.from().update().in().eq).toHaveBeenCalledWith('user_id', 'user123');
      expect(result).toBe(true);
    });

    it('should handle errors when marking notifications as read', async () => {
      // Arrange
      supabaseAdmin.from().update().in().eq.mockResolvedValue({
        error: { message: 'Database error' }
      });

      // Act
      const result = await notificationService.markAsRead(['notification1'], 'user123');

      // Assert
      expect(result).toBe(false);
    });
  });

  describe('checkForDuplicate', () => {
    it('should correctly identify duplicate notifications', async () => {
      // Arrange
      const mockUserId = 'user123';
      const mockType = 'payment';
      const mockEntityType = 'purchase_record';
      const mockEntityId = 'purchase123';
      
      supabaseAdmin.from().select().eq().eq().eq().eq().gte.mockResolvedValue({
        count: 1,
        error: null
      });

      // Act
      const result = await notificationService.checkForDuplicate(
        mockUserId,
        mockType,
        mockEntityType,
        mockEntityId
      );

      // Assert
      expect(supabaseAdmin.from).toHaveBeenCalledWith('notifications');
      expect(supabaseAdmin.from().select).toHaveBeenCalledWith('*', { count: 'exact', head: true });
      expect(result).toBe(true);
    });

    it('should return false when no duplicates exist', async () => {
      // Arrange
      supabaseAdmin.from().select().eq().eq().eq().eq().gte.mockResolvedValue({
        count: 0,
        error: null
      });

      // Act
      const result = await notificationService.checkForDuplicate('user123', 'payment', 'purchase_record', 'purchase123');

      // Assert
      expect(result).toBe(false);
    });
  });
});