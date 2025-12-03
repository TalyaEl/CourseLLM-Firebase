import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy API route for DSPy quiz generation service.
 * 
 * This route forwards quiz generation requests from the frontend to the Python DSPy service.
 * In development: forwards to http://localhost:8000/api/quiz
 * In production: reads DSPY_SERVICE_URL from environment variables
 */

interface QuizRequest {
  topic: string;
  level: string;
}

export async function POST(req: NextRequest) {
  try {
    const body: QuizRequest = await req.json();
    
    // Validate request body
    if (!body.topic || !body.level) {
      return NextResponse.json(
        { error: 'Missing required fields: topic and level are required' },
        { status: 400 }
      );
    }
    
    // Validate level
    const validLevels = ['easy', 'medium', 'hard'];
    if (!validLevels.includes(body.level.toLowerCase())) {
      return NextResponse.json(
        { error: `level must be one of: ${validLevels.join(', ')}` },
        { status: 400 }
      );
    }
    
    // Determine DSPy service URL
    // In production, read from environment variable
    // In development, default to localhost:8000
    const dspyServiceUrl = 
      process.env.DSPY_SERVICE_URL || 
      process.env.NEXT_PUBLIC_DSPY_SERVICE_URL ||
      'http://localhost:8000';
    
    const serviceUrl = `${dspyServiceUrl}/api/quiz`;
    
    // Forward request to DSPy service
    const response = await fetch(serviceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: body.topic,
        level: body.level.toLowerCase(),
      }),
    });
    
    // Handle non-OK responses
    if (!response.ok) {
      const errorText = await response.text();
      let errorData;
      try {
        errorData = JSON.parse(errorText);
      } catch {
        errorData = { detail: errorText };
      }
      
      // If service is unreachable, return 502
      if (response.status === 0 || response.status >= 500) {
        return NextResponse.json(
          { 
            error: 'DSPy service is unreachable',
            detail: errorData.detail || 'The quiz generation service is not available. Please ensure it is running.'
          },
          { status: 502 }
        );
      }
      
      // Propagate other errors (400, etc.)
      return NextResponse.json(
        { error: errorData.detail || errorData.error || 'Failed to generate quiz' },
        { status: response.status }
      );
    }
    
    // Return successful response
    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Error in DSPy quiz proxy:', error);
    
    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        { 
          error: 'Failed to connect to DSPy service',
          detail: 'The quiz generation service appears to be down. Please ensure it is running on port 8000.'
        },
        { status: 502 }
      );
    }
    
    // Handle other errors
    return NextResponse.json(
      { error: 'Internal server error', detail: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

