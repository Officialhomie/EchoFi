import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db-enhanced';
import { investmentGroups, groupMembers, proposals } from '@/lib/db-enhanced';
import { eq, sql, and, inArray } from 'drizzle-orm';
import { recordMetric, recordError } from '@/lib/monitoring';
import { getCachedOrFetch, CACHE_TAGS } from '@/lib/cache-manager';
import { isNetworkError } from '@/lib/network-utils';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');

    if (!address) {
      recordMetric('user_groups.validation_error', 1, 'count');
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    console.log('🔍 Fetching groups for address:', address);

    // Create cache key for this request
    const cacheKey = `user-groups:${address.toLowerCase()}`;

    // Use cache-with-revalidation pattern
    const groups = await getCachedOrFetch(
      cacheKey,
      async () => {
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
        const proposalCounts: Record<string, { active: number; total: number }> = {};

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
        return memberGroups.map(mg => ({
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
      },
      {
        ttl: 30000, // 30 seconds cache
        tags: [CACHE_TAGS.USER_GROUPS, `user:${address.toLowerCase()}`],
        stale: true, // Allow stale data while revalidating
      }
    );

    const responseTime = Date.now() - startTime;
    
    // Record metrics
    recordMetric('user_groups.response_time', responseTime, 'ms');
    recordMetric('user_groups.groups_found', groups.length, 'count');
    recordMetric('user_groups.requests', 1, 'count', { cached: groups ? 'hit' : 'miss' });

    console.log(`✅ Found ${groups.length} groups for address ${address} in ${responseTime}ms`);

    return NextResponse.json({
      groups,
      total: groups.length,
      metadata: {
        responseTime,
        cached: !!groups,
        timestamp: new Date().toISOString(),
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    console.error('❌ API error:', error);
    
    // Record error metrics
    recordError('User groups API error', 'high', 'user-groups-api');
    recordMetric('user_groups.error_response_time', responseTime, 'ms');
    
    // Handle network errors gracefully
    if (isNetworkError(error)) {
      return NextResponse.json({
        error: 'Service temporarily unavailable',
        message: 'Database connectivity issues. Please try again later.',
        code: error.code,
        retryAfter: error.retryAfter,
        timestamp: new Date().toISOString(),
      }, { status: 503 });
    }
    
    // Handle database errors
    if (error instanceof Error && error.message.includes('database')) {
      return NextResponse.json({
        error: 'Database error',
        message: 'Unable to retrieve user groups at this time.',
        timestamp: new Date().toISOString(),
      }, { status: 503 });
    }
    
    return NextResponse.json({
      error: 'Internal server error',
      message: 'An unexpected error occurred while retrieving user groups.',
      timestamp: new Date().toISOString(),
    }, { status: 500 });
  }
}