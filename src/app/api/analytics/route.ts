// src/app/api/analytics/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getGroupAnalytics, getUserAnalytics } from '@/lib/db-queries';

// Handles GET /api/analytics (fetch group or user analytics)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('groupId');
    const walletAddress = searchParams.get('address');

    if (groupId) {
      const analytics = await getGroupAnalytics(groupId);
      return NextResponse.json({ analytics });
    } else if (walletAddress) {
      const analytics = await getUserAnalytics(walletAddress);
      return NextResponse.json({ analytics });
    } else {
      return NextResponse.json(
        { error: 'Either groupId or address is required' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Failed to fetch analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
} 