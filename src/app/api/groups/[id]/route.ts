// src/app/api/groups/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getGroupAnalytics } from '@/lib/db-queries';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// Handles GET /api/groups/[id] (fetch group details and members)
export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    // FIXED: Await the params Promise in Next.js 13+
    const params = await context.params;
    const groupId = params.id;

    if (!groupId || typeof groupId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid group ID provided' },
        { status: 400 }
      );
    }

    const analytics = await getGroupAnalytics(groupId);
    if (!analytics.group) {
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(analytics);
  } catch (error) {
    console.error('Failed to fetch group details:', error);
    
    // Enhanced error handling
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch group details',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}

// FIXED: POST handler without unused variables
export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const params = await context.params;
    const groupId = params.id;
    
    if (!groupId || typeof groupId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid group ID provided' },
        { status: 400 }
      );
    }

    // When you implement POST functionality, parse body here:
    // const body = await request.json();
    
    return NextResponse.json(
      { message: 'POST operation not yet implemented', groupId },
      { status: 501 }
    );
  } catch (error) {
    console.error('Failed to process POST request:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { 
        error: 'Failed to process request',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}

// FIXED: PATCH handler without unused variables  
export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const params = await context.params;
    const groupId = params.id;
    
    if (!groupId || typeof groupId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid group ID provided' },
        { status: 400 }
      );
    }

    // When you implement PATCH functionality, parse body here:
    // const body = await request.json();
    
    return NextResponse.json(
      { message: 'PATCH operation not yet implemented', groupId },
      { status: 501 }
    );
  } catch (error) {
    console.error('Failed to process PATCH request:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { 
        error: 'Failed to update group',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}

// FIXED: Optional DELETE handler
export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const params = await context.params;
    const groupId = params.id;
    
    if (!groupId || typeof groupId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid group ID provided' },
        { status: 400 }
      );
    }

    // Handle DELETE operations for the group
    // Implementation depends on your specific requirements
    return NextResponse.json(
      { message: 'DELETE operation not yet implemented', groupId },
      { status: 501 }
    );
  } catch (error) {
    console.error('Failed to process DELETE request:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return NextResponse.json(
      { 
        error: 'Failed to delete group',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}