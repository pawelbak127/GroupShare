// src/app/api/offers/[id]/route.js
import { NextResponse } from 'next/server';
import { getSubscriptionOffer } from '@/lib/supabase';
import { currentUser } from '@clerk/nextjs/server';

/**
 * GET /api/offers/[id]
 * Get details of a specific subscription offer
 */
export async function GET(request, { params }) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'Offer ID is required' },
        { status: 400 }
      );
    }

    // Get the subscription offer
    const offer = await getSubscriptionOffer(id);

    if (!offer) {
      return NextResponse.json(
        { error: 'Subscription offer not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(offer);
  } catch (error) {
    console.error('Error fetching offer:', error);
    return NextResponse.json(
      { error: 'Failed to fetch subscription offer' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/offers/[id]
 * Update a subscription offer
 */
export async function PATCH(request, { params }) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'Offer ID is required' },
        { status: 400 }
      );
    }

    // Verify user is authenticated
    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const updates = await request.json();

    // Get the original offer to verify ownership
    const offer = await getSubscriptionOffer(id);

    if (!offer) {
      return NextResponse.json(
        { error: 'Subscription offer not found' },
        { status: 404 }
      );
    }

    // Get auth token
    const authToken = await user.getToken();

    // Get user profile ID from Supabase
    const userProfileResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/profile`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}` // Add token to the request
        }
      }
    );

    const userProfile = await userProfileResponse.json();
    if (!userProfile || !userProfile.id) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    // Verify user is the owner or admin of the group
    const groupResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/groups/${offer.group_id}/members?userId=${userProfile.id}`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}` // Add token to the request
        }
      }
    );

    const groupMembership = await groupResponse.json();
    if (!groupMembership || (groupMembership.role !== 'admin' && !groupMembership.isOwner)) {
      return NextResponse.json(
        { error: 'You do not have permission to update this offer' },
        { status: 403 }
      );
    }

    // Prepare update data
    const updateData = {
      status: updates.status || offer.status,
      price_per_slot: updates.pricePerSlot || offer.price_per_slot,
      slots_total: updates.slotsTotal || offer.slots_total,
      slots_available: updates.slotsAvailable !== undefined ? updates.slotsAvailable : offer.slots_available,
      currency: updates.currency || offer.currency,
      instant_access: true // Zawsze true w nowym modelu
    };

    // Update offer in Supabase
    const response = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/supabase/group_subs/${id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}` // Add token to the request
        },
        body: JSON.stringify(updateData)
      }
    );

    const updatedOffer = await response.json();

    // If access instructions provided, update them
    if (updates.accessInstructions) {
      await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/access-instructions`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}` // Add token to the request
          },
          body: JSON.stringify({
            groupSubId: id,
            instructions: updates.accessInstructions
          })
        }
      );
    }

    return NextResponse.json(updatedOffer);
  } catch (error) {
    console.error('Error updating offer:', error);
    return NextResponse.json(
      { error: 'Failed to update subscription offer' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/offers/[id]
 * Delete a subscription offer
 */
export async function DELETE(request, { params }) {
  try {
    const { id } = params;

    if (!id) {
      return NextResponse.json(
        { error: 'Offer ID is required' },
        { status: 400 }
      );
    }

    // Verify user is authenticated
    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the original offer to verify ownership
    const offer = await getSubscriptionOffer(id);

    if (!offer) {
      return NextResponse.json(
        { error: 'Subscription offer not found' },
        { status: 404 }
      );
    }

    // Get auth token
    const authToken = await user.getToken();

    // Get user profile ID from Supabase
    const userProfileResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/profile`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}` // Add token to the request
        }
      }
    );

    const userProfile = await userProfileResponse.json();
    if (!userProfile || !userProfile.id) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    // Verify user is the owner or admin of the group
    const groupResponse = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/groups/${offer.group_id}/members?userId=${userProfile.id}`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}` // Add token to the request
        }
      }
    );

    const groupMembership = await groupResponse.json();
    if (!groupMembership || (groupMembership.role !== 'admin' && !groupMembership.isOwner)) {
      return NextResponse.json(
        { error: 'You do not have permission to delete this offer' },
        { status: 403 }
      );
    }

    // Delete offer in Supabase
    await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL}/api/supabase/group_subs/${id}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${authToken}` // Add token to the request
        }
      }
    );

    return NextResponse.json(
      { message: 'Subscription offer deleted successfully' }
    );
  } catch (error) {
    console.error('Error deleting offer:', error);
    return NextResponse.json(
      { error: 'Failed to delete subscription offer' },
      { status: 500 }
    );
  }
}