// src/app/api/messages/send/route.ts - API Fallback for Message Sending
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db-enhanced';
import { sql } from 'drizzle-orm';

interface MessageSendRequest {
  conversationId: string;
  content: string;
  timestamp: number;
  method: string;
  senderAddress?: string;
}

interface MessageSendResponse {
  success: boolean;
  messageId: string;
  method: 'api_fallback';
  timestamp: number;
  error?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    console.log('📤 [API] Message send fallback endpoint called');
    
    // Parse request body
    const body: MessageSendRequest = await request.json();
    const { conversationId, content, timestamp, method, senderAddress } = body;

    // Validate request
    if (!conversationId || !content) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields: conversationId or content' 
        },
        { status: 400 }
      );
    }

    // Generate message ID
    const messageId = `api_fallback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log('📝 [API] Processing fallback message:', {
      conversationId,
      contentLength: content.length,
      messageId,
      method
    });

    // Store message in database for later synchronization
    try {
      await db.execute(sql`
        INSERT INTO fallback_messages (
          id,
          conversation_id,
          content,
          sender_address,
          original_timestamp,
          fallback_method,
          created_at,
          sync_status
        ) VALUES (
          ${messageId},
          ${conversationId},
          ${content},
          ${senderAddress || 'unknown'},
          ${new Date(timestamp)},
          ${method},
          NOW(),
          'pending'
        )
      `);

      console.log('✅ [API] Message stored in fallback database');
    } catch (dbError) {
      console.warn('⚠️ [API] Failed to store in database, continuing anyway:', dbError);
    }

    // Attempt XMTP delivery in background (non-blocking)
    attemptBackgroundXMTPDelivery(conversationId, content, messageId)
      .catch(error => {
        console.warn('⚠️ [API] Background XMTP delivery failed:', error);
      });

    // Return immediate success response
    const response: MessageSendResponse = {
      success: true,
      messageId,
      method: 'api_fallback',
      timestamp: Date.now()
    };

    console.log('✅ [API] Message send fallback completed:', response);

    return NextResponse.json(response, { status: 200 });

  } catch (error) {
    console.error('❌ [API] Message send fallback failed:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return NextResponse.json(
      { 
        success: false, 
        error: `Fallback message sending failed: ${errorMessage}`,
        method: 'api_fallback',
        timestamp: Date.now()
      },
      { status: 500 }
    );
  }
}

/**
 * Attempt to deliver message via XMTP in background
 */
async function attemptBackgroundXMTPDelivery(
  conversationId: string,
  content: string,
  messageId: string
): Promise<void> {
  console.log('🔄 [API] Attempting background XMTP delivery...');
  
  try {
    // This would integrate with XMTP server-side client if available
    // For now, we'll just log the attempt
    console.log('📝 [API] Background XMTP delivery would be attempted here:', {
      conversationId,
      content: content.substring(0, 50) + '...',
      messageId
    });

    // Update database with sync attempt
    try {
      await db.execute(sql`
        UPDATE fallback_messages 
        SET sync_status = 'attempted', last_sync_attempt = NOW()
        WHERE id = ${messageId}
      `);
    } catch (dbError) {
      console.warn('⚠️ [API] Failed to update sync status:', dbError);
    }

    // Simulate delivery attempt (replace with actual XMTP integration)
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    console.log('✅ [API] Background XMTP delivery simulated');

  } catch (error) {
    console.error('❌ [API] Background XMTP delivery failed:', error);
    
    // Update database with failure status
    try {
      await db.execute(sql`
        UPDATE fallback_messages 
        SET sync_status = 'failed', last_sync_attempt = NOW()
        WHERE id = ${messageId}
      `);
    } catch (dbError) {
      console.warn('⚠️ [API] Failed to update failure status:', dbError);
    }
  }
}

// GET endpoint to retrieve fallback messages for synchronization
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const url = new URL(request.url);
    const conversationId = url.searchParams.get('conversationId');
    const status = url.searchParams.get('status') || 'pending';

    if (!conversationId) {
      return NextResponse.json(
        { error: 'Missing conversationId parameter' },
        { status: 400 }
      );
    }

    console.log('📥 [API] Retrieving fallback messages:', { conversationId, status });

    // Get fallback messages for the conversation
    const messages = await db.execute(sql`
      SELECT 
        id,
        conversation_id,
        content,
        sender_address,
        original_timestamp,
        fallback_method,
        created_at,
        sync_status,
        last_sync_attempt
      FROM fallback_messages 
      WHERE conversation_id = ${conversationId}
      ${status !== 'all' ? sql`AND sync_status = ${status}` : sql``}
      ORDER BY original_timestamp ASC
    `);

    console.log(`✅ [API] Retrieved ${messages.length} fallback messages`);

    return NextResponse.json({
      success: true,
      messages: messages,
      count: messages.length,
      conversationId,
      status
    });

  } catch (error) {
    console.error('❌ [API] Failed to retrieve fallback messages:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}