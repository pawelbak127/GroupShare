// src/app/api/offers/route.js
import { NextResponse } from 'next/server';
import { getSubscriptionOffers } from '../../../lib/supabase-client.js';
import { currentUser } from '@clerk/nextjs/server';  


/**
 * GET /api/offers
 * Get subscription offers with optional filtering
 */
export async function GET(request) {
  try {
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    
    // Parse filters from query parameters
    const filters = {
      platformId: searchParams.get('platformId') || undefined,
      minPrice: searchParams.get('minPrice') ? parseFloat(searchParams.get('minPrice')) : undefined,
      maxPrice: searchParams.get('maxPrice') ? parseFloat(searchParams.get('maxPrice')) : undefined,
      availableSlots: searchParams.get('availableSlots') !== 'false', // Default to true
      orderBy: searchParams.get('orderBy') || 'created_at',
      ascending: searchParams.get('ascending') === 'true',
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')) : 10,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')) : 0
    };
    
    // Get subscription offers with filters
    const offers = await getSubscriptionOffers(filters);
    
    // Return the offers
    return NextResponse.json(offers);
  } catch (error) {
    console.error('Error fetching offers:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch subscription offers', code: error.code || 'unknown' }, 
      { status: 500 }
    );
  }
}

/**
 * POST /api/offers
 * Create a new subscription offer
 */
export async function POST(request) {
  try {
    // Verify user is authenticated
    const user = await currentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    
    // Parse request body
    const body = await request.json();
    
    // Validate required fields
    const requiredFields = ['groupId', 'platformId', 'slotsTotal', 'pricePerSlot', 'accessInstructions'];
    for (const field of requiredFields) {
      if (!body[field]) {
        return NextResponse.json(
          { error: `Missing required field: ${field}` },
          { status: 400 }
        );
      }
    }
    
    // Validate numeric fields
    if (isNaN(parseFloat(body.pricePerSlot)) || parseFloat(body.pricePerSlot) <= 0) {
      return NextResponse.json(
        { error: 'Price per slot must be a positive number' },
        { status: 400 }
      );
    }
    
    if (!Number.isInteger(body.slotsTotal) || body.slotsTotal <= 0) {
      return NextResponse.json(
        { error: 'Slots total must be a positive integer' },
        { status: 400 }
      );
    }
    
    // Get user profile ID from Supabase
    let userProfileResponse;
    try {
      userProfileResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/profile`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            // Clerk zapewni autentykację
          }
        }
      );
      
      if (!userProfileResponse.ok) {
        throw new Error(`Failed to fetch user profile: ${userProfileResponse.status}`);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return NextResponse.json(
        { error: 'Failed to verify user profile' },
        { status: 500 }
      );
    }
    
    const userProfile = await userProfileResponse.json();
    if (!userProfile || !userProfile.id) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }
    
    // Verify user is the owner or admin of the group
    let groupMembershipResponse;
    try {
      groupMembershipResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/groups/${body.groupId}/members?userId=${userProfile.id}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            // Clerk zapewni autentykację
          }
        }
      );
      
      if (!groupMembershipResponse.ok) {
        if (groupMembershipResponse.status === 404) {
          return NextResponse.json(
            { error: 'Group not found' },
            { status: 404 }
          );
        } else {
          throw new Error(`Failed to verify group membership: ${groupMembershipResponse.status}`);
        }
      }
    } catch (error) {
      console.error('Error verifying group membership:', error);
      return NextResponse.json(
        { error: 'Failed to verify group membership' },
        { status: 500 }
      );
    }
    
    const groupMembership = await groupMembershipResponse.json();
    if (!groupMembership || (groupMembership.role !== 'admin' && !groupMembership.isOwner)) {
      return NextResponse.json(
        { error: 'You do not have permission to create offers for this group' },
        { status: 403 }
      );
    }
    
    // Przygotowanie danych oferty
    const offerData = {
      group_id: body.groupId,
      platform_id: body.platformId,
      status: 'active',
      slots_total: body.slotsTotal,
      slots_available: body.slotsTotal,
      price_per_slot: body.pricePerSlot,
      currency: body.currency || 'PLN',
      instant_access: true // Wszystkie oferty mają teraz natychmiastowy dostęp
    };
    
    // Tworzenie oferty w Supabase
    let response;
    try {
      response = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/supabase/group_subs`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await user.getToken()}`
          },
          body: JSON.stringify(offerData)
        }
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('Failed to create offer:', errorData);
        
        if (response.status === 403) {
          return NextResponse.json(
            { error: 'You do not have permission to create offers for this group' },
            { status: 403 }
          );
        } else if (response.status === 400) {
          return NextResponse.json(
            { error: errorData.error || 'Invalid offer data' },
            { status: 400 }
          );
        } else {
          return NextResponse.json(
            { error: errorData.error || 'Failed to create subscription offer' },
            { status: response.status || 500 }
          );
        }
      }
    } catch (error) {
      console.error('Error creating offer in Supabase:', error);
      return NextResponse.json(
        { error: 'Failed to create subscription offer in database' },
        { status: 500 }
      );
    }
    
    const createdOffer = await response.json();
    
    // Sprawdzenie wyniku
    if (!createdOffer || !createdOffer.id) {
      console.warn('Offer creation response missing ID');
      return NextResponse.json(
        { error: 'Offer was created but returned invalid data' },
        { status: 500 }
      );
    }
    
    // Store access instructions in Supabase
    try {
      const instructionsResponse = await fetch(
        `${process.env.NEXT_PUBLIC_APP_URL}/api/access-instructions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await user.getToken()}`
          },
          body: JSON.stringify({
            groupSubId: createdOffer.id,
            instructions: body.accessInstructions
          })
        }
      );
      
      if (!instructionsResponse.ok) {
        const errorData = await instructionsResponse.json();
        console.error('Failed to save access instructions:', errorData);
        
        // Don't fail the entire operation, but log the error
        // Could clean up the created offer, but it's still usable
      }
    } catch (error) {
      console.error('Error saving access instructions:', error);
      // Don't fail the entire operation
    }
    
    return NextResponse.json(createdOffer, { status: 201 });
  } catch (error) {
    console.error('Error creating offer:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create subscription offer' }, 
      { status: 500 }
    );
  }
}