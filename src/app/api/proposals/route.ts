import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { proposals, investmentGroups, votes } from '@/lib/db';
import { eq, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

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
      requiredVotes 
    } = body;

    if (!groupId || !title || !description || !strategy || !requestedAmount || !proposedBy) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    console.log('🏗️ Creating new proposal:', { title, groupId, proposedBy });

    const proposalId = uuidv4();

    const [proposal] = await db
      .insert(proposals)
      .values({
        id: proposalId,
        groupId,
        title,
        description,
        strategy,
        requestedAmount,
        proposedBy: proposedBy.toLowerCase(),
        deadline: new Date(deadline),
        requiredVotes,
        status: 'active',
      })
      .returning();

    return NextResponse.json({
      proposal,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Proposal creation API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');
    const proposalId = searchParams.get('id');

    if (proposalId) {
      // Get specific proposal with vote counts
      const proposalWithVotes = await db
        .select({
          id: proposals.id,
          groupId: proposals.groupId,
          title: proposals.title,
          description: proposals.description,
          strategy: proposals.strategy,
          requestedAmount: proposals.requestedAmount,
          proposedBy: proposals.proposedBy,
          createdAt: proposals.createdAt,
          deadline: proposals.deadline,
          status: proposals.status,
          approvalVotes: proposals.approvalVotes,
          rejectionVotes: proposals.rejectionVotes,
          requiredVotes: proposals.requiredVotes,
          totalVotes: sql<number>`count(${votes.id})`.as('totalVotes'),
        })
        .from(proposals)
        .leftJoin(votes, eq(proposals.id, votes.proposalId))
        .where(eq(proposals.id, proposalId))
        .groupBy(proposals.id);

      if (!proposalWithVotes[0]) {
        return NextResponse.json(
          { error: 'Proposal not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ proposal: proposalWithVotes[0] });
    } else if (groupId) {
      // Get proposals for specific group
      const groupProposals = await db
        .select()
        .from(proposals)
        .where(eq(proposals.groupId, groupId))
        .orderBy(proposals.createdAt);

      return NextResponse.json({ proposals: groupProposals });
    } else {
      // Get all proposals
      const allProposals = await db
        .select()
        .from(proposals)
        .orderBy(proposals.createdAt);

      return NextResponse.json({ proposals: allProposals });
    }

  } catch (error) {
    console.error('❌ Proposals GET API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}