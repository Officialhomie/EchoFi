import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db-enhanced';
import { votes, proposals } from '@/lib/db-enhanced';
import { eq, and } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { proposalId, voterAddress, vote, votingPower } = body;

    if (!proposalId || !voterAddress || !vote) {
      return NextResponse.json(
        { error: 'Missing required fields: proposalId, voterAddress, vote' },
        { status: 400 }
      );
    }

    // Check if user already voted
    const existingVote = await db
      .select()
      .from(votes)
      .where(
        and(
          eq(votes.proposalId, proposalId),
          eq(votes.voterAddress, voterAddress.toLowerCase())
        )
      );

    if (existingVote.length > 0) {
      return NextResponse.json(
        { error: 'User has already voted on this proposal' },
        { status: 400 }
      );
    }

    // Create vote
    const [newVote] = await db
      .insert(votes)
      .values({
        id: uuidv4(),
        proposalId,
        voterAddress: voterAddress.toLowerCase(),
        vote,
        votingPower: votingPower || '1.0',
      })
      .returning();

    // Update proposal vote counts
    const voteCount = await db
      .select()
      .from(votes)
      .where(eq(votes.proposalId, proposalId));

    const approvalCount = voteCount.filter(v => v.vote === 'approve').length;
    const rejectionCount = voteCount.filter(v => v.vote === 'reject').length;

    await db
      .update(proposals)
      .set({
        approvalVotes: approvalCount,
        rejectionVotes: rejectionCount,
      })
      .where(eq(proposals.id, proposalId));

    return NextResponse.json({
      vote: newVote,
      voteCount: {
        total: voteCount.length,
        approve: approvalCount,
        reject: rejectionCount,
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Vote creation API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const proposalId = searchParams.get('proposalId');
    const voterAddress = searchParams.get('voterAddress');

    if (proposalId && voterAddress) {
      // Check if specific user voted on proposal
      const userVote = await db
        .select()
        .from(votes)
        .where(
          and(
            eq(votes.proposalId, proposalId),
            eq(votes.voterAddress, voterAddress.toLowerCase())
          )
        );

      return NextResponse.json({
        hasVoted: userVote.length > 0,
        vote: userVote[0] || null
      });
    } else if (proposalId) {
      // Get all votes for proposal
      const proposalVotes = await db
        .select()
        .from(votes)
        .where(eq(votes.proposalId, proposalId));

      return NextResponse.json({ votes: proposalVotes });
    } else {
      return NextResponse.json(
        { error: 'proposalId is required' },
        { status: 400 }
      );
    }

  } catch (error) {
    console.error('❌ Votes GET API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
