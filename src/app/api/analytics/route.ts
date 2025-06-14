import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db-enhanced';
import { investmentGroups, groupMembers, proposals, votes } from '@/lib/db-enhanced';
import { eq, count } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');

    if (groupId) {
      // Group-specific analytics
      const [groupStats] = await db
        .select({
          id: investmentGroups.id,
          name: investmentGroups.name,
          totalFunds: investmentGroups.totalFunds,
          memberCount: investmentGroups.memberCount,
          createdAt: investmentGroups.createdAt,
        })
        .from(investmentGroups)
        .where(eq(investmentGroups.id, groupId));

      if (!groupStats) {
        return NextResponse.json(
          { error: 'Group not found' },
          { status: 404 }
        );
      }

      // Get proposal stats
      const proposalStats = await db
        .select({
          status: proposals.status,
          count: count(proposals.id),
        })
        .from(proposals)
        .where(eq(proposals.groupId, groupId))
        .groupBy(proposals.status);

      // Get member activity (vote participation)
      const memberActivity = await db
        .select({
          voterAddress: votes.voterAddress,
          voteCount: count(votes.id),
        })
        .from(votes)
        .innerJoin(proposals, eq(votes.proposalId, proposals.id))
        .where(eq(proposals.groupId, groupId))
        .groupBy(votes.voterAddress);

      return NextResponse.json({
        group: groupStats,
        proposals: proposalStats.reduce((acc, stat) => {
          if (stat.status == null) return acc;
          acc[stat.status] = stat.count;
          return acc;
        }, {} as Record<string, number>),
        memberActivity,
        timestamp: new Date().toISOString()
      });

    } else {
      // Platform-wide analytics
      const [platformStats] = await db
        .select({
          totalGroups: count(investmentGroups.id),
        })
        .from(investmentGroups);

      const [memberStats] = await db
        .select({
          totalMembers: count(groupMembers.id),
        })
        .from(groupMembers)
        .where(eq(groupMembers.isActive, true));

      const [proposalStats] = await db
        .select({
          totalProposals: count(proposals.id),
        })
        .from(proposals);

      const [voteStats] = await db
        .select({
          totalVotes: count(votes.id),
        })
        .from(votes);

      return NextResponse.json({
        platform: {
          totalGroups: platformStats.totalGroups,
          totalMembers: memberStats.totalMembers,
          totalProposals: proposalStats.totalProposals,
          totalVotes: voteStats.totalVotes,
        },
        timestamp: new Date().toISOString()
      });
    }

  } catch (error) {
    console.error('❌ Analytics API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}