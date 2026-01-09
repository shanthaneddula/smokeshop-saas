import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/auth/platform';
import { PrismaClient } from '@prisma/client';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/platform/tenants/test-connection
 * Test database connection for a new tenant before creating
 * 
 * This validates that the provided Supabase credentials are correct
 * and the database is accessible.
 */
export async function POST(request: NextRequest) {
  let testClient: PrismaClient | null = null;
  
  try {
    // Verify platform admin authentication
    requirePlatformAdmin(request);

    const { dbHost, dbName, dbUser, dbPassword, dbPort } = await request.json();

    // Validate required fields
    if (!dbHost || !dbPassword) {
      return NextResponse.json({
        success: false,
        error: 'Database host and password are required',
      });
    }

    // Build connection URL
    const connectionUrl = `postgresql://${dbUser || 'postgres'}:${encodeURIComponent(dbPassword)}@${dbHost}:${dbPort || 5432}/${dbName || 'postgres'}?sslmode=require&connect_timeout=10`;

    // Create test client
    testClient = new PrismaClient({
      datasources: {
        db: { url: connectionUrl },
      },
      log: ['error'],
    });

    // Test connection with a simple query
    await testClient.$queryRaw`SELECT 1 as test`;

    return NextResponse.json({
      success: true,
      message: 'Connection successful!',
      details: {
        host: dbHost,
        database: dbName || 'postgres',
        user: dbUser || 'postgres',
        port: dbPort || 5432,
      },
    });
  } catch (error) {
    console.error('[TestConnection] Error:', error);
    
    if (error instanceof Error && error.message.includes('Unauthorized')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse common Prisma/PostgreSQL errors for user-friendly messages
    let errorMessage = 'Failed to connect to database';
    
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      
      if (msg.includes('password authentication failed')) {
        errorMessage = 'Invalid password. Please check your database password.';
      } else if (msg.includes('could not connect') || msg.includes('connection refused')) {
        errorMessage = 'Could not connect to database host. Please verify the host address.';
      } else if (msg.includes('database') && msg.includes('does not exist')) {
        errorMessage = 'Database does not exist. Please check the database name.';
      } else if (msg.includes('timeout')) {
        errorMessage = 'Connection timed out. Please check if the database is accessible.';
      } else if (msg.includes('ssl') || msg.includes('certificate')) {
        errorMessage = 'SSL connection error. Please verify SSL settings.';
      } else if (msg.includes('role') && msg.includes('does not exist')) {
        errorMessage = 'Database user does not exist. Please check the username.';
      }
    }

    return NextResponse.json({
      success: false,
      error: errorMessage,
    });
  } finally {
    // Always disconnect test client
    if (testClient) {
      await testClient.$disconnect().catch(() => {});
    }
  }
}
