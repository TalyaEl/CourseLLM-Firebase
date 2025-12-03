import { NextRequest, NextResponse } from 'next/server';
import { analyzeMessage } from '@/ai/flows/analyze-message';
import type { AnalyzeMessageRequest } from '../../../../functions/src/types/analyzeMessage';

export async function POST(req: NextRequest) {
  const body = (await req.json()) as AnalyzeMessageRequest;

  if (!body.threadId || !body.messageText) {
    return NextResponse.json(
      { error: 'threadId and messageText are required' },
      { status: 400 }
    );
  }

  try {
    const analysis = await analyzeMessage(body);
    console.log('🔥 Analysis API result:', analysis);

    // ⛔️ הורדנו את ה-Firestore Web SDK מה-API route
    // אין כאן setDoc / doc / db

    return NextResponse.json(analysis);
  } catch (error) {
    console.error('🔥 Error in analyze-message API:', error);
    return NextResponse.json(
      { error: 'Failed to analyze message' },
      { status: 500 }
    );
  }
}
