// src/app/api/proposals/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createProposal, getGroupProposals } from '@/lib/db-queries';

// Validation schemas
const GetProposalsSchema = z.object({
  groupId: z.string().min(1, 'Group ID is required'),
  status: z.enum(['active', 'approved', 'rejected', 'executed']).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  offset: z.coerce.number().min(0).optional(),
});

const CreateProposalSchema = z.object({
  groupId: z.string().min(1, 'Group ID is required'),
  title: z.string().min(5, 'Title must be at least 5 characters').max(100, 'Title too long'),
  description: z.string().min(20, 'Description must be at least 20 characters').max(1000, 'Description too long'),
  strategy: z.string().min(10, 'Strategy must be at least 10 characters'),
  requestedAmount: z.string().regex(/^\d+(\.\d+)?$/, 'Invalid amount format'),
  proposedBy: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address'),
  deadline: z.string().datetime('Invalid deadline format'),
  requiredVotes: z.number().min(1, 'At least 1 vote required'),
});

// Handles GET /api/proposals (list proposals)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Validate query parameters
    const validationResult = GetProposalsSchema.safeParse({
      groupId: searchParams.get('groupId'),
      status: searchParams.get('status'),
      limit: searchParams.get('limit'),
      offset: searchParams.get('offset'),
    });

    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid query parameters',
          details: validationResult.error.flatten().fieldErrors
        },
        { status: 400 }
      );
    }

    const { groupId, status, limit, offset } = validationResult.data;

    // Fetch proposals from database
    const proposals = await getGroupProposals(groupId, status);
    
    // Apply pagination if specified
    let paginatedProposals = proposals;
    if (limit || offset) {
      const startIndex = offset || 0;
      const endIndex = limit ? startIndex + limit : proposals.length;
      paginatedProposals = proposals.slice(startIndex, endIndex);
    }

    // Return with metadata
    const response = {
      proposals: paginatedProposals,
      metadata: {
        total: proposals.length,
        filtered: paginatedProposals.length,
        offset: offset || 0,
        limit: limit || proposals.length,
      }
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Failed to fetch proposals:', error);
    
    // Return appropriate error response
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json(
          { error: 'Group not found' },
          { status: 404 }
        );
      }
      if (error.message.includes('permission')) {
        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to fetch proposals' },
      { status: 500 }
    );
  }
}

// Handles POST /api/proposals (create proposal)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate request body
    const validationResult = CreateProposalSchema.safeParse(body);
    
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid proposal data',
          details: validationResult.error.flatten().fieldErrors
        },
        { status: 400 }
      );
    }

    const {
      groupId,
      title,
      description,
      strategy,
      requestedAmount,
      proposedBy,
      deadline,
      requiredVotes,
    } = validationResult.data;

    // Additional business logic validation
    const deadlineDate = new Date(deadline);
    const now = new Date();
    
    if (deadlineDate <= now) {
      return NextResponse.json(
        { error: 'Deadline must be in the future' },
        { status: 400 }
      );
    }

    if (deadlineDate > new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)) {
      return NextResponse.json(
        { error: 'Deadline cannot be more than 1 year in the future' },
        { status: 400 }
      );
    }

    // Create proposal in database
    const proposal = await createProposal({
      groupId,
      title,
      description,
      strategy,
      requestedAmount,
      proposedBy,
      deadline: deadlineDate,
      requiredVotes,
    });

    return NextResponse.json(
      { 
        proposal,
        message: 'Proposal created successfully'
      }, 
      { status: 201 }
    );

  } catch (error) {
    console.error('Failed to create proposal:', error);
    
    // Return appropriate error response
    if (error instanceof Error) {
      if (error.message.includes('already exists')) {
        return NextResponse.json(
          { error: 'Proposal with similar details already exists' },
          { status: 409 }
        );
      }
      if (error.message.includes('group not found')) {
        return NextResponse.json(
          { error: 'Investment group not found' },
          { status: 404 }
        );
      }
      if (error.message.includes('permission')) {
        return NextResponse.json(
          { error: 'You do not have permission to create proposals in this group' },
          { status: 403 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to create proposal' },
      { status: 500 }
    );
  }
}