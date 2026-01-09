import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Paths that don't require tenant resolution
const PUBLIC_PATHS = [
  '/api/health',
  '/api/platform', // Platform admin APIs
  '/platform',     // Platform admin UI pages
  '/_next',
  '/favicon.ico',
  '/static',
];

// Localhost testing domains
const LOCALHOST_DOMAINS = [
  'localhost:3000',
  'localhost',
  '127.0.0.1:3000',
  '127.0.0.1',
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for public paths
  if (PUBLIC_PATHS.some(path => pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Extract domain from request
  const host = request.headers.get('host') || '';
  
  // Handle localhost during development
  let domain = host;
  if (LOCALHOST_DOMAINS.includes(host)) {
    // For localhost, use test domain
    domain = 'joessmokeshop.local';
  } else {
    // Remove www prefix if present
    domain = host.replace(/^www\./, '');
  }

  // Pass domain to API routes via header (they'll do the tenant lookup in Node.js runtime)
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-tenant-domain', domain);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
