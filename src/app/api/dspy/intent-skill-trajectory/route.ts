import { NextRequest, NextResponse } from 'next/server';

/**
 * Proxy API route for DSPy Intent-Skill-Trajectory extraction service.
 * 
 * This route forwards IST extraction requests from the frontend to the Python DSPy service.
 * In development: forwards to http://localhost:8000/api/intent-skill-trajectory
 * In production: reads DSPY_SERVICE_URL from environment variables
 */

interface IntentSkillTrajectoryRequest {
  utterance: string;
  course_context?: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const body: IntentSkillTrajectoryRequest = await req.json();
    
    // Validate request body
    if (!body.utterance || typeof body.utterance !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: utterance must be a non-empty string' },
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
    
    const serviceUrl = `${dspyServiceUrl}/api/intent-skill-trajectory`;
    
    // Forward request to DSPy service
    const response = await fetch(serviceUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        utterance: body.utterance,
        course_context: body.course_context ?? null,
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
            detail: errorData.detail || 'The IST extraction service is not available. Please ensure it is running.'
          },
          { status: 502 }
        );
      }
      
      // Propagate other errors (400, etc.)
      return NextResponse.json(
        { error: errorData.detail || errorData.error || 'Failed to extract IST' },
        { status: response.status }
      );
    }
    
    // Return successful response
    const data = await response.json();
    return NextResponse.json(data);
    
  } catch (error) {
    console.error('Error in DSPy IST proxy:', error);
    
    // Handle network errors
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return NextResponse.json(
        { 
          error: 'Failed to connect to DSPy service',
          detail: 'The IST extraction service appears to be down. Please ensure it is running on port 8000.'
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

