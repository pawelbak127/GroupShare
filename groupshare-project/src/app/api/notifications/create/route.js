// src/app/api/notifications/create/route.js
import { NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import supabaseAdmin from '@/lib/database/supabase-admin-client';
import { notificationService } from '@/services/notification/notification-service';

/**
 * POST /api/notifications/create
 * Creates a new notification with improved error handling and deduplication
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
      
      // Prevent creating too many notifications within short time period (rate limiting)
      // Only if creating a notification for the same entity by the same user
      if (notificationData.relatedEntityType && notificationData.relatedEntityId) {
        try {
          const rateLimited = await checkRateLimit(
            userProfile.id, 
            notificationData.relatedEntityType,
            notificationData.relatedEntityId
          );
          
          if (rateLimited && !notificationData.bypassRateLimit) {
            return NextResponse.json(
              { 
                error: 'Rate limit reached for notifications', 
                bypassRateLimit: true,
                retryAfter: '60s'
              },
              { status: 429 }
            );
          }
        } catch (rateError) {
          // Just log the error but don't prevent notification creation
          console.warn('Rate limit check failed:', rateError);
        }
      }
      
      // Verify entity exists if entity is specified (with fallback)
      let entityExists = true;
      
      if (notificationData.relatedEntityType && notificationData.relatedEntityId) {
        try {
          entityExists = await notificationService.verifyEntityExists(
            notificationData.relatedEntityType,
            notificationData.relatedEntityId
          );
        } catch (verifyError) {
          // Log error but continue with a warning
          console.warn(`Entity verification failed: ${verifyError.message}`);
          // Still set entityExists based on the error type
          entityExists = !(verifyError.message && verifyError.message.includes('not found'));
        }
        
        if (!entityExists) {
          return NextResponse.json(
            { error: `Referenced entity ${notificationData.relatedEntityType}:${notificationData.relatedEntityId} does not exist` },
            { status: 404 }
          );
        }
      }
      
      // Check for duplicate notifications with improved algorithm
      let duplicateExists = false;
      
      if (notificationData.relatedEntityType && notificationData.relatedEntityId) {
        try {
          // Use improved duplicate detection that considers time window
          duplicateExists = await notificationService.checkForDuplicateNotificationAdvanced(
            notificationData.userId,
            notificationData.type,
            notificationData.relatedEntityType,
            notificationData.relatedEntityId,
            notificationData.title,
            30 // Time window in minutes
          );
          
          if (duplicateExists && !notificationData.skipDuplicateCheck) {
            console.log(`Duplicate notification prevented for ${notificationData.type}:${notificationData.relatedEntityId}`);
            
            return NextResponse.json(
              { 
                warning: 'Similar notification already exists for this entity', 
                skipDuplicateCheck: true,
                status: 'skipped'
              },
              { status: 200 } // Return 200 instead of error to indicate it's handled normally
            );
          }
        } catch (dupError) {
          // Log the error but don't prevent notification creation
          console.warn('Duplicate check failed:', dupError);
          // This is non-critical, so we continue
        }
      }
      
      // Create notification using notification service
      try {
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
        
        // Return created notification or success message
        if (notification) {
          return NextResponse.json(notification);
        } else {
          return NextResponse.json(
            { message: 'Notification may have been created or skipped due to duplication check' },
            { status: 202 }
          );
        }
      } catch (creationError) {
        console.error('Error creating notification:', creationError);
        
        // Attempt fallback insertion directly if service fails
        if (notificationData.criticality === 'high') {
          try {
            const { data: fallbackResult } = await supabaseAdmin
              .from('notifications')
              .insert({
                user_id: notificationData.userId,
                type: notificationData.type,
                title: notificationData.title,
                content: notificationData.content, 
                related_entity_type: notificationData.relatedEntityType,
                related_entity_id: notificationData.relatedEntityId,
                priority: notificationData.priority || 'normal',
                is_read: false,
                created_at: new Date().toISOString()
              })
              .select()
              .single();
              
            if (fallbackResult) {
              console.log('Fallback notification creation succeeded');
              return NextResponse.json({
                ...fallbackResult,
                _note: 'Created via fallback mechanism'
              });
            }
          } catch (fallbackError) {
            console.error('Fallback notification creation also failed:', fallbackError);
          }
        }
        
        return NextResponse.json(
          { error: 'Failed to create notification', details: creationError.message },
          { status: 500 }
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

/**
 * Check if user is hitting rate limits for notification creation
 * @param {string} userId 
 * @param {string} entityType 
 * @param {string} entityId 
 * @returns {Promise<boolean>} true if rate limited
 */
async function checkRateLimit(userId, entityType, entityId) {
  try {
    // Check how many notifications were created in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    
    const { count, error } = await supabaseAdmin
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('related_entity_type', entityType)
      .eq('related_entity_id', entityId)
      .gte('created_at', oneHourAgo);
      
    if (error) throw error;
    
    // Rate limit: 5 notifications per hour for the same entity
    return count >= 5;
  } catch (error) {
    console.error('Error checking rate limit:', error);
    // In case of error, don't rate limit
    return false;
  }
}