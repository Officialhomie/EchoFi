// src/app/api/analytics/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getGroupAnalytics, getUserAnalytics } from '@/lib/db-queries';

// Validation schemas
const AnalyticsSchema = z.object({
  groupId: z.string().optional(),
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address').optional(),
  timeframe: z.enum(['24h', '7d', '30d', '90d', '1y']).optional(),
}).refine(
  (data) => data.groupId || data.address,
  {
    message: "Either groupId or address is required",
  }
);

// Handles GET /api/analytics (fetch group or user analytics)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Validate query parameters
    const validationResult = AnalyticsSchema.safeParse({
      groupId: searchParams.get('groupId'),
      address: searchParams.get('address'),
      timeframe: searchParams.get('timeframe'),
    });

    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid parameters',
          details: validationResult.error.flatten().fieldErrors
        },
        { status: 400 }
      );
    }

    const { groupId, address, timeframe } = validationResult.data;

    if (groupId) {
      // Fetch group analytics
      const analytics = await getGroupAnalytics(groupId);
      
      if (!analytics) {
        return NextResponse.json(
          { error: 'Group not found' },
          { status: 404 }
        );
      }

      // Enhance analytics with computed metrics
      const memberCount = analytics.group?.memberCount ?? 0;
      const totalProposals = analytics.proposalStats.reduce((sum, p) => sum + p.count, 0) || 0;
      const approvedProposals = analytics.proposalStats.find(p => p.status === 'approved')?.count || 0;
      const recentActivityLength = analytics.recentActivity.length;
      const enhancedAnalytics = {
        ...analytics,
        computed: {
          proposalSuccessRate: memberCount > 0 && totalProposals > 0
            ? (approvedProposals / totalProposals) * 100
            : 0,
          averageProposalsPerMember: memberCount > 0
            ? totalProposals / memberCount
            : 0,
          activeMemberPercentage: memberCount > 0
            ? (recentActivityLength / memberCount) * 100
            : 0,
        },
        requestedAt: new Date().toISOString(),
        timeframe: timeframe || '30d',
      };

      return NextResponse.json({ 
        analytics: enhancedAnalytics,
        type: 'group'
      });

    } else if (address) {
      // Fetch user analytics
      const analytics = await getUserAnalytics(address);
      
      if (!analytics) {
        return NextResponse.json(
          { error: 'User not found or no activity' },
          { status: 404 }
        );
      }

      // Enhance analytics with computed metrics
      const proposals = analytics.proposals.map(p => p.proposal);
      const votes = analytics.votes;
      const groups = analytics.groups;
      const approvedProposalsCount = proposals.filter(p => p.status === 'approved').length;
      const proposalApprovalRate = proposals.length > 0
        ? (approvedProposalsCount / proposals.length) * 100
        : 0;
      const enhancedAnalytics = {
        ...analytics,
        computed: {
          averageVotingParticipation: votes.length > 0
            ? (votes.length / (proposals.length || 1)) * 100
            : 0,
          proposalApprovalRate,
          groupParticipationScore: groups.length > 0
            ? (votes.length + proposals.length) / groups.length
            : 0,
        },
        requestedAt: new Date().toISOString(),
        timeframe: timeframe || '30d',
      };

      return NextResponse.json({ 
        analytics: enhancedAnalytics,
        type: 'user'
      });
    }

    // This should never happen due to validation, but just in case
    return NextResponse.json(
      { error: 'No valid parameters provided' },
      { status: 400 }
    );

  } catch (error) {
    console.error('Failed to fetch analytics:', error);
    
    // Return appropriate error response
    if (error instanceof Error) {
      if (error.message.includes('not found')) {
        return NextResponse.json(
          { error: 'Resource not found' },
          { status: 404 }
        );
      }
      if (error.message.includes('permission')) {
        return NextResponse.json(
          { error: 'Insufficient permissions' },
          { status: 403 }
        );
      }
      if (error.message.includes('timeout')) {
        return NextResponse.json(
          { error: 'Request timeout - please try again' },
          { status: 408 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}