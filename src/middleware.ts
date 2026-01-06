import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getTenantByDomain } from './lib/db/master-db';

// Paths that don't require tenant resolution
const PUBLIC_PATHS = [
  '/api/health',
  '/api/platform', // Platform admin APIs
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
    console.log(`[Middleware] Localhost detected, using test domain: ${domain}`);
  } else {
    // Remove www prefix if present
    domain = host.replace(/^www\./, '');
    console.log(`[Middleware] Resolving domain: ${domain}`);
  }

  try {
    // Lookup tenant by domain
    const tenant = await getTenantByDomain(domain);

    if (!tenant) {
      console.error(`[Middleware] Tenant not found for domain: ${domain}`);
      return new NextResponse(
        JSON.stringify({
          error: 'Domain not found',
          message: 'This domain is not registered with our platform.',
          domain,
        }),
        {
          status: 404,
          headers: {
            'content-type': 'application/json',
          },
        }
      );
    }

    // Check tenant status
    if (tenant.status !== 'active') {
      console.error(`[Middleware] Tenant inactive: ${tenant.name} (${tenant.status})`);
      return new NextResponse(
        JSON.stringify({
          error: 'Tenant inactive',
          message: 'This account is currently inactive. Please contact support.',
          status: tenant.status,
        }),
        {
          status: 403,
          headers: {
            'content-type': 'application/json',
          },
        }
      );
    }

    console.log(`[Middleware] Tenant resolved: ${tenant.name} (${tenant.slug})`);

    // Create response with tenant context in headers
    const response = NextResponse.next();
    
    // Inject tenant information into request headers for API routes to access
    response.headers.set('x-tenant-id', tenant.id);
    response.headers.set('x-tenant-slug', tenant.slug);
    response.headers.set('x-tenant-name', tenant.name);
    response.headers.set('x-tenant-domain', tenant.customDomain);
    
    // Store database connection info (encoded to avoid special chars in header)
    const dbConfig = {
      host: tenant.dbHost,
      user: tenant.dbUser,
      password: tenant.dbPassword,
      port: tenant.dbPort,
      database: tenant.dbName,
      projectId: tenant.supabaseProjectId,
    };
    response.headers.set('x-tenant-db-config', Buffer.from(JSON.stringify(dbConfig)).toString('base64'));

    return response;

  } catch (error) {
    console.error('[Middleware] Error resolving tenant:', error);
    return new NextResponse(
      JSON.stringify({
        error: 'Internal server error',
        message: 'Failed to resolve tenant for this domain.',
      }),
      {
        status: 500,
        headers: {
          'content-type': 'application/json',
        },
      }
    );
  }
}

// Configure which routes use this middleware
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
