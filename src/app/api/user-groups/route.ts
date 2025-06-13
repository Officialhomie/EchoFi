import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { investmentGroups, groupMembers, proposals } from '@/lib/db';
import { eq, sql, and, inArray } from 'drizzle-orm';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    console.log('🔍 Fetching groups for address:', address);

    // Get groups where the user is a member with group details
    const memberGroups = await db
      .select({
        memberId: groupMembers.id,
        joinedAt: groupMembers.joinedAt,
        contributedAmount: groupMembers.contributedAmount,
        votingPower: groupMembers.votingPower,
        memberIsActive: groupMembers.isActive,
        groupId: investmentGroups.id,
        groupName: investmentGroups.name,
        groupDescription: investmentGroups.description,
        xmtpGroupId: investmentGroups.xmtpGroupId,
        createdBy: investmentGroups.createdBy,
        createdAt: investmentGroups.createdAt,
        totalFunds: investmentGroups.totalFunds,
        memberCount: investmentGroups.memberCount,
      })
      .from(groupMembers)
      .innerJoin(investmentGroups, eq(groupMembers.groupId, investmentGroups.id))
      .where(
        and(
          eq(groupMembers.walletAddress, address.toLowerCase()),
          eq(groupMembers.isActive, true)
        )
      );

    // Get proposal counts for each group
    const groupIds = memberGroups.map(mg => mg.groupId);
    let proposalCounts: Record<string, { active: number; total: number }> = {};

    if (groupIds.length > 0) {
      const proposalData = await db
        .select({
          groupId: proposals.groupId,
          status: proposals.status,
          count: sql<number>`count(*)`.as('count'),
        })
        .from(proposals)
        .where(inArray(proposals.groupId, groupIds))
        .groupBy(proposals.groupId, proposals.status);

      // Process proposal counts
      proposalData.forEach(item => {
        if (item.groupId == null) return; // Skip if groupId is null
        if (!proposalCounts[item.groupId]) {
          proposalCounts[item.groupId] = { active: 0, total: 0 };
        }
        proposalCounts[item.groupId].total += Number(item.count);
        if (item.status === 'active') {
            proposalCounts[item.groupId].active += Number(item.count);
        }
      });
    }

    // Format response
    const groups = memberGroups.map(mg => ({
      member: {
        id: mg.memberId,
        joinedAt: mg.joinedAt,
        contributedAmount: mg.contributedAmount,
        votingPower: mg.votingPower,
        isActive: mg.memberIsActive,
      },
      group: {
        id: mg.groupId,
        name: mg.groupName,
        description: mg.groupDescription,
        xmtpGroupId: mg.xmtpGroupId,
        createdBy: mg.createdBy,
        createdAt: mg.createdAt,
        totalFunds: mg.totalFunds,
        memberCount: mg.memberCount,
        activeProposals: proposalCounts[mg.groupId]?.active || 0,
        totalProposals: proposalCounts[mg.groupId]?.total || 0,
      }
    }));

    console.log(`✅ Found ${groups.length} groups for address ${address}`);

    return NextResponse.json({
      groups,
      total: groups.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}