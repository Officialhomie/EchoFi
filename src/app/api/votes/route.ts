// src/app/api/votes/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createVote, getProposalVotes, getVoteSummary } from '@/lib/db-queries';

// Handles GET and POST /api/votes (list and create votes)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const proposalId = searchParams.get('proposalId');
    const summary = searchParams.get('summary') === 'true';

    if (!proposalId) {
      return NextResponse.json(
        { error: 'Proposal ID is required' },
        { status: 400 }
      );
    }

    if (summary) {
      const voteSummary = await getVoteSummary(proposalId);
      return NextResponse.json({ summary: voteSummary });
    } else {
      const votes = await getProposalVotes(proposalId);
      return NextResponse.json({ votes });
    }
  } catch (error) {
    console.error('Failed to fetch votes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch votes' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { proposalId, voterAddress, vote, votingPower } = body;

    if (!proposalId || !voterAddress || !vote) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!['approve', 'reject', 'abstain'].includes(vote)) {
      return NextResponse.json(
        { error: 'Invalid vote value' },
        { status: 400 }
      );
    }

    const voteRecord = await createVote({
      proposalId,
      voterAddress,
      vote,
      votingPower,
    });

    return NextResponse.json({ vote: voteRecord }, { status: 201 });
  } catch (error) {
    console.error('Failed to create vote:', error);
    if (error instanceof Error && error.message.includes('already voted')) {
      return NextResponse.json(
        { error: 'User has already voted on this proposal' },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: 'Failed to create vote' },
      { status: 500 }
    );
  }
} 