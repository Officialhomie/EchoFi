// src/app/api/groups/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getInvestmentGroup, getGroupMembers } from '@/lib/db-queries';

// Handles GET /api/groups/[id] (fetch group details and members)
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const groupId = params.id;

    const [group, members] = await Promise.all([
      getInvestmentGroup(groupId),
      getGroupMembers(groupId),
    ]);

    if (!group) {
      return NextResponse.json(
        { error: 'Group not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ group, members });
  } catch (error) {
    console.error('Failed to fetch group details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch group details' },
      { status: 500 }
    );
  }
} 