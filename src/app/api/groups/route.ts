import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { investmentGroups, groupMembers } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, description, xmtpGroupId, createdBy, members } = body;

    if (!name || !xmtpGroupId || !createdBy) {
      return NextResponse.json(
        { error: 'Missing required fields: name, xmtpGroupId, createdBy' },
        { status: 400 }
      );
    }

    console.log('🏗️ Creating new group:', { name, xmtpGroupId, createdBy });

    const groupId = uuidv4();

    // Create group
    const [group] = await db
      .insert(investmentGroups)
      .values({
        id: groupId,
        name,
        description,
        xmtpGroupId,
        createdBy: createdBy.toLowerCase(),
        memberCount: (members?.length || 0) + 1,
      })
      .returning();

    // Add creator as first member
    const membersToAdd = [
      {
        id: uuidv4(),
        groupId: group.id,
        walletAddress: createdBy.toLowerCase(),
        votingPower: '1.0',
        isActive: true,
      }
    ];

    // Add additional members if provided
    if (members && members.length > 0) {
      members.forEach((memberAddress: string) => {
        membersToAdd.push({
          id: uuidv4(),
          groupId: group.id,
          walletAddress: memberAddress.toLowerCase(),
          votingPower: '1.0',
          isActive: true,
        });
      });
    }

    await db.insert(groupMembers).values(membersToAdd);

    console.log(`✅ Group created successfully: ${group.id}`);

    return NextResponse.json({
      group: {
        id: group.id,
        name: group.name,
        description: group.description,
        xmtpGroupId: group.xmtpGroupId,
        createdBy: group.createdBy,
        createdAt: group.createdAt,
        totalFunds: group.totalFunds,
        memberCount: group.memberCount,
      },
      members: membersToAdd.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('❌ Group creation API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const groupId = searchParams.get('id');

    if (groupId) {
      // Get specific group
      const [group] = await db
        .select()
        .from(investmentGroups)
        .where(eq(investmentGroups.id, groupId));

      if (!group) {
        return NextResponse.json(
          { error: 'Group not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({ group });
    } else {
      // Get all groups
      const groups = await db
        .select()
        .from(investmentGroups)
        .orderBy(investmentGroups.createdAt);

      return NextResponse.json({ groups: groups || [] });
    }

  } catch (error) {
    console.error('❌ Groups GET API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}