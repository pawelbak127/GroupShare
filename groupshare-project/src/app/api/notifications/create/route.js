// src/app/api/notifications/create/route.js
import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import supabaseAdmin from '@/lib/database/supabase-admin-client';
import { notificationService } from '@/services/notification/notification-service';

/**
 * POST /api/notifications/create
 * Creates a new notification with improved error handling
 */
export async function POST(request) {
  try {
    // Check if supabaseAdmin is properly initialized
    if (!supabaseAdmin) {
      console.error('supabaseAdmin is not initialized');
      return NextResponse.json(
        { 
          error: 'Database client is not initialized. Check server configuration.', 
          details: 'Missing environment variables for Supabase connection'
        },
        { status: 500 }
      );
    }

    // Check authentication
    const user = await currentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get data from request body
    const notificationData = await request.json();
    
    // Validate required fields
    if (!notificationData.userId || !notificationData.type || !notificationData.title || !notificationData.content) {
      return NextResponse.json(
        { error: 'Missing required fields: userId, type, title and content are required' },
        { status: 400 }
      );
    }
    
    // Check notification type validity
    const validTypes = ['invite', 'message', 'purchase', 'purchase_completed', 'purchase_failed', 
                         'dispute', 'dispute_filed', 'dispute_created', 'payment', 'access', 'sale_completed'];
    if (!validTypes.includes(notificationData.type)) {
      return NextResponse.json(
        { error: `Invalid notification type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Check priority validity if provided
    if (notificationData.priority) {
      const validPriorities = ['high', 'normal', 'low'];
      if (!validPriorities.includes(notificationData.priority)) {
        return NextResponse.json(
          { error: `Invalid priority. Must be one of: ${validPriorities.join(', ')}` },
          { status: 400 }
        );
      }
    }
    
    try {
      // Get user profile ID of the sender
      const { data: userProfile, error } = await supabaseAdmin
        .from('user_profiles')
        .select('id')
        .eq('external_auth_id', user.id)
        .single();
      
      if (error) {
        console.error('Error fetching user profile:', error);
        return NextResponse.json(
          { error: 'Failed to fetch user profile', details: error.message },
          { status: 500 }
        );
      }
      
      if (!userProfile) {
        return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
      }
      
      // Check permissions only if sending notification to another user
      if (notificationData.userId !== userProfile.id) {
        const isAllowed = await checkPermissionToNotify(userProfile.id, notificationData.userId, notificationData);
        
        if (!isAllowed) {
          return NextResponse.json(
            { error: 'You do not have permission to create notifications for other users' },
            { status: 403 }
          );
        }
      }
      
      // Verify entity exists if entity is specified
      if (notificationData.relatedEntityType && notificationData.relatedEntityId) {
        const entityExists = await notificationService.verifyEntityExists(
          notificationData.relatedEntityType,
          notificationData.relatedEntityId
        );
        
        if (!entityExists) {
          return NextResponse.json(
            { error: `Referenced entity ${notificationData.relatedEntityType}:${notificationData.relatedEntityId} does not exist` },
            { status: 404 }
          );
        }
      }
      
      // Check for duplicate notifications
      if (notificationData.relatedEntityType && notificationData.relatedEntityId) {
        const hasDuplicate = await notificationService.checkForDuplicateNotification(
          notificationData.userId,
          notificationData.type,
          notificationData.relatedEntityType,
          notificationData.relatedEntityId
        );
        
        if (hasDuplicate && !notificationData.skipDuplicateCheck) {
          return NextResponse.json(
            { error: 'Similar notification already exists for this entity', skipDuplicateCheck: true },
            { status: 409 }
          );
        }
      }
      
      // Create notification using notification service
      const notification = await notificationService.createNotification(
        notificationData.userId,
        notificationData.type,
        notificationData.title,
        notificationData.content,
        notificationData.relatedEntityType || null,
        notificationData.relatedEntityId || null,
        notificationData.priority || 'normal',
        notificationData.ttl || 0,
        notificationData.skipDuplicateCheck || false
      );
      
      // Return created notification or success message if creation failed silently
      if (notification) {
        return NextResponse.json(notification);
      } else {
        return NextResponse.json(
          { message: 'Notification may have been created or skipped due to duplication check' },
          { status: 202 }
        );
      }
    } catch (dbError) {
      console.error('Database operation error:', dbError);
      return NextResponse.json(
        { error: 'Database operation failed', details: dbError.message },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in notifications/create API:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Check if a user has permission to send notifications to another user
 * @param {string} senderId - ID of the sending user
 * @param {string} recipientId - ID of the receiving user
 * @param {Object} notificationData - Notification data
 * @returns {Promise<boolean>} - Whether the user has permission
 */
async function checkPermissionToNotify(senderId, recipientId, notificationData) {
  try {
    // Check if the user is a system admin
    const { data: senderProfile } = await supabaseAdmin
      .from('user_profiles')
      .select('is_admin')
      .eq('id', senderId)
      .single();
      
    if (senderProfile?.is_admin) {
      return true;
    }
    
    // Check if the user is the owner of the group related to the notification
    if (notificationData.relatedEntityType === 'group' || notificationData.relatedEntityType === 'group_invitation') {
      let groupId = notificationData.relatedEntityId;
      
      if (notificationData.relatedEntityType === 'group_invitation') {
        // Get the group from the invitation
        const { data: invitation } = await supabaseAdmin
          .from('group_invitations')
          .select('group_id')
          .eq('id', notificationData.relatedEntityId)
          .single();
          
        groupId = invitation?.group_id;
      }
      
      if (groupId) {
        // Check if the user is the group owner
        const { data: group } = await supabaseAdmin
          .from('groups')
          .select('owner_id')
          .eq('id', groupId)
          .single();
          
        if (group?.owner_id === senderId) {
          return true;
        }
        
        // Check if the user is a group admin
        const { data: membership } = await supabaseAdmin
          .from('group_members')
          .select('role')
          .eq('group_id', groupId)
          .eq('user_id', senderId)
          .eq('status', 'active')
          .single();
          
        if (membership?.role === 'admin') {
          return true;
        }
      }
    }
    
    // Check if the user is the seller of the subscription related to the notification
    if (['purchase', 'purchase_record', 'transaction'].includes(notificationData.relatedEntityType)) {
      let purchaseId = notificationData.relatedEntityId;
      
      // If it's a transaction, get the purchase_record_id
      if (notificationData.relatedEntityType === 'transaction') {
        const { data: transaction } = await supabaseAdmin
          .from('transactions')
          .select('purchase_record_id')
          .eq('id', notificationData.relatedEntityId)
          .single();
          
        purchaseId = transaction?.purchase_record_id;
      }
      
      if (purchaseId) {
        const { data: purchase } = await supabaseAdmin
          .from('purchase_records')
          .select(`
            group_sub:group_subs(
              group_id,
              groups(owner_id)
            )
          `)
          .eq('id', purchaseId)
          .single();
          
        if (purchase?.group_sub?.groups?.owner_id === senderId) {
          return true;
        }
      }
    }
    
    // Default deny permission
    return false;
  } catch (error) {
    console.error('Error checking notification permissions:', error);
    return false;
  }
}