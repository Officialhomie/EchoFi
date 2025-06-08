// src/app/api/proposals/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createProposal, getGroupProposals } from '@/lib/db-queries';

// Handles GET and POST /api/proposals (list and create proposals)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');
    const status = searchParams.get('status');

    if (!groupId) {
      return NextResponse.json(
        { error: 'Group ID is required' },
        { status: 400 }
      );
    }

    const proposals = await getGroupProposals(groupId, status || undefined);
    return NextResponse.json({ proposals });
  } catch (error) {
    console.error('Failed to fetch proposals:', error);
    return NextResponse.json(
      { error: 'Failed to fetch proposals' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      groupId,
      title,
      description,
      strategy,
      requestedAmount,
      proposedBy,
      deadline,
      requiredVotes,
    } = body;

    if (!groupId || !title || !description || !strategy || !requestedAmount || !proposedBy || !deadline || !requiredVotes) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const proposal = await createProposal({
      groupId,
      title,
      description,
      strategy,
      requestedAmount,
      proposedBy,
      deadline: new Date(deadline),
      requiredVotes,
    });

    return NextResponse.json({ proposal }, { status: 201 });
  } catch (error) {
    console.error('Failed to create proposal:', error);
    return NextResponse.json(
      { error: 'Failed to create proposal' },
      { status: 500 }
    );
  }
} 