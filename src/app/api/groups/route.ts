// src/app/api/groups/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createInvestmentGroup, getUserGroups } from '@/lib/db-queries';

// This file should only handle /api/groups (not /groups/[id], /proposals, /votes, or /analytics)

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const walletAddress = searchParams.get('address');

    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Wallet address is required' },
        { status: 400 }
      );
    }

    const groups = await getUserGroups(walletAddress);
    return NextResponse.json({ groups });
  } catch (error) {
    console.error('Failed to fetch groups:', error);
    return NextResponse.json(
      { error: 'Failed to fetch groups' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, xmtpGroupId, createdBy } = body;

    if (!name || !xmtpGroupId || !createdBy) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    const group = await createInvestmentGroup({
      name,
      description,
      xmtpGroupId,
      createdBy,
    });

    return NextResponse.json({ group }, { status: 201 });
  } catch (error) {
    console.error('Failed to create group:', error);
    return NextResponse.json(
      { error: 'Failed to create group' },
      { status: 500 }
    );
  }
}

// Move the following code to their own files if not already present:
// - /api/groups/[id]/route.ts
// - /api/proposals/route.ts
// - /api/votes/route.ts
// - /api/analytics/route.ts