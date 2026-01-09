import { NextRequest, NextResponse } from 'next/server';
import { masterDb } from '@/lib/db/master-db';
import { verifyPlatformAdmin } from '@/lib/auth/platform';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { encryptDatabasePassword } from '@/lib/security/encryption';
import bcrypt from 'bcryptjs';
import { connectToMongoDB } from '@/lib/db/mongodb';
import mongoose from 'mongoose';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60; // Allow 60 seconds for provisioning

const provisionTenantSchema = z.object({
  // Business Info
  businessName: z.string().min(2, 'Business name must be at least 2 characters'),
  slug: z.string().min(2).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  customDomain: z.string().optional(),
  
  // Admin User
  ownerName: z.string().min(2, 'Owner name is required'),
  ownerEmail: z.string().email('Valid email required'),
  ownerPassword: z.string().min(8, 'Password must be at least 8 characters'),
  ownerPhone: z.string().optional(),
  
  // Database Config
  dbHost: z.string().min(1, 'Database host is required'),
  dbName: z.string().default('postgres'),
  dbUser: z.string().default('postgres'),
  dbPassword: z.string().min(1, 'Database password is required'),
  dbPort: z.number().default(5432),
  supabaseProjectId: z.string().optional(),
});

type ProvisioningStep = {
  id: string;
  name: string;
  description: string;
  status: 'pending' | 'in-progress' | 'success' | 'error';
  error?: string;
};

/**
 * POST /api/platform/tenants/provision
 * Automated tenant provisioning with database setup
 */
export async function POST(request: NextRequest) {
  let adminPayload: { adminId: string; email: string; name: string } | null = null;
  
  try {
    // Verify platform admin auth
    try {
      adminPayload = verifyPlatformAdmin(request);
    } catch {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request
    const body = await request.json();
    const validation = provisionTenantSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.issues },
        { status: 400 }
      );
    }

    const data = validation.data;
    console.log(`[Provision] Starting automated provisioning for: ${data.slug}`);

    // Initialize steps
    const steps: ProvisioningStep[] = [
      { id: 'validate', name: 'Validate Configuration', description: 'Checking for conflicts and validating settings', status: 'pending' },
      { id: 'test-db', name: 'Test Database Connection', description: 'Connecting to the tenant database', status: 'pending' },
      { id: 'create-tenant', name: 'Create Tenant Record', description: 'Registering tenant in master database', status: 'pending' },
      { id: 'migrate-db', name: 'Run Database Migrations', description: 'Creating tables in tenant database', status: 'pending' },
      { id: 'create-admin', name: 'Create Admin User', description: 'Setting up tenant admin account', status: 'pending' },
      { id: 'setup-mongodb', name: 'Setup Product Catalog', description: 'Initializing MongoDB product database', status: 'pending' },
      { id: 'activate', name: 'Activate Tenant', description: 'Finalizing tenant setup', status: 'pending' },
    ];

    let tenantId: string | null = null;
    let currentStep = 0;

    const updateStep = (stepId: string, status: ProvisioningStep['status'], error?: string) => {
      const step = steps.find(s => s.id === stepId);
      if (step) {
        step.status = status;
        if (error) step.error = error;
      }
    };

    try {
      // Step 1: Validate
      updateStep('validate', 'in-progress');
      console.log('[Provision] Step 1: Validating configuration...');
      
      // Check for existing tenant with same slug or domain
      const existingTenant = await masterDb.tenant.findFirst({
        where: {
          OR: [
            { slug: data.slug },
            ...(data.customDomain ? [{ customDomain: data.customDomain }] : []),
          ],
          deletedAt: null,
        },
      });

      if (existingTenant) {
        throw new Error(
          existingTenant.slug === data.slug
            ? `Tenant with slug "${data.slug}" already exists`
            : `Tenant with domain "${data.customDomain}" already exists`
        );
      }
      updateStep('validate', 'success');
      currentStep++;

      // Step 2: Test Database Connection
      updateStep('test-db', 'in-progress');
      console.log('[Provision] Step 2: Testing database connection...');
      
      // Build connection string for testing
      // Use pooler format for Supabase
      const poolerHost = data.dbHost.replace('db.', '').replace('.supabase.co', '');
      const testConnectionString = `postgresql://postgres.${poolerHost}:${data.dbPassword}@aws-0-us-east-2.pooler.supabase.com:5432/${data.dbName}`;
      
      const testClient = new PrismaClient({
        datasources: {
          db: { url: testConnectionString },
        },
      });

      try {
        await testClient.$connect();
        await testClient.$queryRaw`SELECT 1 as test`;
        await testClient.$disconnect();
      } catch (dbError) {
        throw new Error(`Database connection failed: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`);
      }
      updateStep('test-db', 'success');
      currentStep++;

      // Step 3: Create Tenant Record
      updateStep('create-tenant', 'in-progress');
      console.log('[Provision] Step 3: Creating tenant record...');
      
      const encryptedPassword = await encryptDatabasePassword(data.dbPassword);
      
      const tenant = await masterDb.tenant.create({
        data: {
          name: data.businessName,
          slug: data.slug,
          customDomain: data.customDomain || null,
          ownerEmail: data.ownerEmail,
          ownerName: data.ownerName,
          phone: data.ownerPhone || null,
          dbHost: data.dbHost,
          dbName: data.dbName,
          dbUser: data.dbUser,
          dbPassword: encryptedPassword,
          dbPort: data.dbPort,
          supabaseProjectId: data.supabaseProjectId || null,
          supabaseUrl: data.supabaseProjectId ? `https://${data.supabaseProjectId}.supabase.co` : null,
          supabaseAnonKey: null,
          supabaseServiceKey: null,
          status: 'provisioning',
          plan: 'starter',
        },
      });
      tenantId = tenant.id;
      updateStep('create-tenant', 'success');
      currentStep++;

      // Step 4: Run Database Migrations
      updateStep('migrate-db', 'in-progress');
      console.log('[Provision] Step 4: Running database migrations...');
      
      const tenantClient = new PrismaClient({
        datasources: {
          db: { url: testConnectionString },
        },
      });

      try {
        await tenantClient.$connect();
        
        // Create tables using raw SQL (simplified migration)
        await tenantClient.$executeRaw`
          CREATE TABLE IF NOT EXISTS users (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            email VARCHAR(255) UNIQUE NOT NULL,
            password_hash VARCHAR(255) NOT NULL,
            name VARCHAR(255) NOT NULL,
            phone VARCHAR(50),
            role VARCHAR(50) NOT NULL DEFAULT 'staff',
            is_active BOOLEAN NOT NULL DEFAULT true,
            last_login_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `;
        
        await tenantClient.$executeRaw`
          CREATE TABLE IF NOT EXISTS stores (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL,
            address TEXT,
            city VARCHAR(100),
            state VARCHAR(50),
            zip_code VARCHAR(20),
            phone VARCHAR(50),
            email VARCHAR(255),
            is_active BOOLEAN NOT NULL DEFAULT true,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `;
        
        await tenantClient.$executeRaw`
          CREATE TABLE IF NOT EXISTS customers (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255),
            phone VARCHAR(50),
            address TEXT,
            city VARCHAR(100),
            state VARCHAR(50),
            zip_code VARCHAR(20),
            notes TEXT,
            loyalty_points INTEGER DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `;
        
        await tenantClient.$executeRaw`
          CREATE TABLE IF NOT EXISTS orders (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            customer_id UUID REFERENCES customers(id),
            store_id UUID REFERENCES stores(id),
            status VARCHAR(50) NOT NULL DEFAULT 'pending',
            subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
            tax DECIMAL(10,2) NOT NULL DEFAULT 0,
            discount DECIMAL(10,2) NOT NULL DEFAULT 0,
            total DECIMAL(10,2) NOT NULL DEFAULT 0,
            notes TEXT,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `;
        
        await tenantClient.$executeRaw`
          CREATE TABLE IF NOT EXISTS order_items (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
            product_id VARCHAR(255) NOT NULL,
            name VARCHAR(255) NOT NULL,
            price DECIMAL(10,2) NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            subtotal DECIMAL(10,2) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `;
        
        await tenantClient.$executeRaw`
          CREATE TABLE IF NOT EXISTS pos_sessions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            user_id UUID REFERENCES users(id),
            store_id UUID REFERENCES stores(id),
            started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            ended_at TIMESTAMP WITH TIME ZONE,
            opening_balance DECIMAL(10,2) NOT NULL DEFAULT 0,
            closing_balance DECIMAL(10,2),
            status VARCHAR(50) NOT NULL DEFAULT 'open',
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `;
        
        await tenantClient.$executeRaw`
          CREATE TABLE IF NOT EXISTS pos_transactions (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            session_id UUID REFERENCES pos_sessions(id),
            customer_id UUID REFERENCES customers(id),
            subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
            tax DECIMAL(10,2) NOT NULL DEFAULT 0,
            discount DECIMAL(10,2) NOT NULL DEFAULT 0,
            total DECIMAL(10,2) NOT NULL DEFAULT 0,
            payment_method VARCHAR(50) NOT NULL,
            payment_status VARCHAR(50) NOT NULL DEFAULT 'completed',
            notes TEXT,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `;
        
        await tenantClient.$executeRaw`
          CREATE TABLE IF NOT EXISTS pos_transaction_items (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            transaction_id UUID REFERENCES pos_transactions(id) ON DELETE CASCADE,
            product_id VARCHAR(255) NOT NULL,
            name VARCHAR(255) NOT NULL,
            price DECIMAL(10,2) NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            subtotal DECIMAL(10,2) NOT NULL,
            created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
          )
        `;

        await tenantClient.$disconnect();
      } catch (migrateError) {
        await tenantClient.$disconnect();
        throw new Error(`Migration failed: ${migrateError instanceof Error ? migrateError.message : 'Unknown error'}`);
      }
      updateStep('migrate-db', 'success');
      currentStep++;

      // Step 5: Create Admin User
      updateStep('create-admin', 'in-progress');
      console.log('[Provision] Step 5: Creating admin user...');
      
      const adminClient = new PrismaClient({
        datasources: {
          db: { url: testConnectionString },
        },
      });

      try {
        await adminClient.$connect();
        const hashedPassword = await bcrypt.hash(data.ownerPassword, 12);
        
        await adminClient.$executeRaw`
          INSERT INTO users (email, password_hash, name, phone, role)
          VALUES (${data.ownerEmail}, ${hashedPassword}, ${data.ownerName}, ${data.ownerPhone || null}, 'owner')
          ON CONFLICT (email) DO NOTHING
        `;
        
        await adminClient.$disconnect();
      } catch (adminError) {
        await adminClient.$disconnect();
        throw new Error(`Admin creation failed: ${adminError instanceof Error ? adminError.message : 'Unknown error'}`);
      }
      updateStep('create-admin', 'success');
      currentStep++;

      // Step 6: Setup MongoDB
      updateStep('setup-mongodb', 'in-progress');
      console.log('[Provision] Step 6: Setting up MongoDB...');
      
      try {
        await connectToMongoDB();
        const tenantDbName = `tenant-${data.slug}`;
        const db = mongoose.connection.useDb(tenantDbName);
        
        // Create products collection with indexes
        const productsCollection = db.collection('products');
        await productsCollection.createIndex({ barcode: 1 }, { unique: true, sparse: true });
        await productsCollection.createIndex({ name: 'text', brand: 'text' });
        await productsCollection.createIndex({ category: 1 });
        await productsCollection.createIndex({ isActive: 1 });
        
      } catch (mongoError) {
        // MongoDB errors are not fatal - we can continue
        console.warn('[Provision] MongoDB setup warning:', mongoError);
      }
      updateStep('setup-mongodb', 'success');
      currentStep++;

      // Step 7: Activate Tenant
      updateStep('activate', 'in-progress');
      console.log('[Provision] Step 7: Activating tenant...');
      
      await masterDb.tenant.update({
        where: { id: tenantId },
        data: {
          status: 'trial',
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
        },
      });
      
      // Log activity
      await masterDb.tenantActivityLog.create({
        data: {
          tenantId,
          eventType: 'tenant_created',
          details: {
            createdBy: adminPayload?.email,
            ownerEmail: data.ownerEmail,
            slug: data.slug,
            automated: true,
          },
        },
      });
      
      updateStep('activate', 'success');

      console.log(`[Provision] ✅ Tenant ${data.slug} provisioned successfully!`);

      return NextResponse.json({
        success: true,
        tenantId,
        slug: data.slug,
        steps,
        message: 'Tenant provisioned successfully',
      });

    } catch (stepError) {
      // Mark current step as error
      const currentStepObj = steps[currentStep];
      if (currentStepObj) {
        updateStep(currentStepObj.id, 'error', stepError instanceof Error ? stepError.message : 'Unknown error');
      }

      // Cleanup: Delete tenant record if it was created
      if (tenantId) {
        try {
          await masterDb.tenant.delete({ where: { id: tenantId } });
          console.log(`[Provision] Cleaned up failed tenant: ${tenantId}`);
        } catch (cleanupError) {
          console.error('[Provision] Cleanup failed:', cleanupError);
        }
      }

      console.error('[Provision] ❌ Provisioning failed:', stepError);

      return NextResponse.json({
        success: false,
        error: stepError instanceof Error ? stepError.message : 'Provisioning failed',
        steps,
        failedStep: currentStep,
      }, { status: 500 });
    }

  } catch (error) {
    console.error('[Provision] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
