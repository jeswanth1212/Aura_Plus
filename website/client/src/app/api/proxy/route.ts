import { NextRequest, NextResponse } from 'next/server';

// Base URL for our backend server
const API_BASE_URL = process.env.API_URL || 'http://localhost:5000';

/**
 * Helper to validate token and create error response if invalid
 */
function validateAuthToken(authHeader: string | null) {
  if (!authHeader) {
    console.error('Missing Authorization header in proxy request');
    return {
      isValid: false,
      response: NextResponse.json(
        { error: 'Authentication required', details: 'No authorization token provided' },
        { status: 401 }
      )
    };
  }

  const tokenParts = authHeader.split(' ');
  
  if (tokenParts.length !== 2 || tokenParts[0] !== 'Bearer') {
    console.error('Invalid Authorization header format');
    return {
      isValid: false,
      response: NextResponse.json(
        { error: 'Authentication required', details: 'Invalid authorization header format' },
        { status: 401 }
      )
    };
  }

  const token = tokenParts[1];
  
  if (!token || token.length < 10) { // Simple token length validation
    console.error('Invalid token in Authorization header');
    return {
      isValid: false,
      response: NextResponse.json(
        { error: 'Authentication required', details: 'Invalid token format' },
        { status: 401 }
      )
    };
  }

  return { isValid: true, token };
}

/**
 * Generic API proxy route handler
 * Forwards requests to the backend server and maintains authentication
 */
export async function POST(request: NextRequest) {
  try {
    // Extract the target endpoint from the request
    const { endpoint, ...payload } = await request.json();
    
    if (!endpoint) {
      return NextResponse.json(
        { error: 'Bad request', details: 'Missing endpoint parameter' },
        { status: 400 }
      );
    }
    
    // Get the authorization header from the request
    const authHeader = request.headers.get('Authorization');
    
    // Validate the token
    const validation = validateAuthToken(authHeader);
    if (!validation.isValid) {
      return validation.response;
    }
    
    console.log(`Forwarding POST request to ${API_BASE_URL}/api/${endpoint}`);
    
    try {
      // Forward the request to the backend server
      const response = await fetch(`${API_BASE_URL}/api/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader as string,
        },
        body: JSON.stringify(payload),
      });
      
      // Get the response data
      const data = await response.json();
      
      // Handle non-success responses
      if (!response.ok) {
        console.error(`Backend server error (${response.status}):`, data);
        
        // Handle specific error codes
        if (response.status === 401) {
          return NextResponse.json(
            { error: 'Authentication failed', details: data.error || data.details || 'Session expired or invalid token' },
            { status: 401 }
          );
        } else if (response.status === 403) {
          return NextResponse.json(
            { error: 'Access denied', details: data.error || data.details || 'You do not have permission to access this resource' },
            { status: 403 }
          );
        }
        
        return NextResponse.json(
          { error: data.error || 'Server error', details: data.details || 'An unexpected error occurred' },
          { status: response.status }
        );
      }
      
      // Forward the successful response
      return NextResponse.json(data, { status: response.status });
    } catch (fetchError: any) {
      console.error('Fetch error in proxy request:', fetchError);
      return NextResponse.json(
        { error: 'Connection error', details: 'Could not connect to backend server' },
        { status: 502 }
      );
    }
  } catch (error: any) {
    console.error('API proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * GET proxy handler
 */
export async function GET(request: NextRequest) {
  try {
    // Get the URL parameters
    const url = new URL(request.url);
    const endpoint = url.searchParams.get('endpoint');
    
    if (!endpoint) {
      return NextResponse.json(
        { error: 'Bad request', details: 'Missing endpoint parameter' },
        { status: 400 }
      );
    }
    
    // Get the authorization header from the request
    const authHeader = request.headers.get('Authorization');
    
    // Validate the token
    const validation = validateAuthToken(authHeader);
    if (!validation.isValid) {
      return validation.response;
    }
    
    console.log(`Forwarding GET request to ${API_BASE_URL}/api/${endpoint}`);
    
    try {
      // Forward the request to the backend server
      const response = await fetch(`${API_BASE_URL}/api/${endpoint}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader as string,
        },
      });
      
      // Get the response data
      const data = await response.json();
      
      // Handle non-success responses
      if (!response.ok) {
        console.error(`Backend server error (${response.status}):`, data);
        
        // Handle specific error codes
        if (response.status === 401) {
          return NextResponse.json(
            { error: 'Authentication failed', details: data.error || data.details || 'Session expired or invalid token' },
            { status: 401 }
          );
        } else if (response.status === 403) {
          return NextResponse.json(
            { error: 'Access denied', details: data.error || data.details || 'You do not have permission to access this resource' },
            { status: 403 }
          );
        }
        
        return NextResponse.json(
          { error: data.error || 'Server error', details: data.details || 'An unexpected error occurred' },
          { status: response.status }
        );
      }
      
      // Forward the successful response
      return NextResponse.json(data, { status: response.status });
    } catch (fetchError: any) {
      console.error('Fetch error in proxy request:', fetchError);
      return NextResponse.json(
        { error: 'Connection error', details: 'Could not connect to backend server' },
        { status: 502 }
      );
    }
  } catch (error: any) {
    console.error('API proxy error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message || 'Unknown error' },
      { status: 500 }
    );
  }
} 