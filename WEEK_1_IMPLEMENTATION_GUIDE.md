# 🚀 Week 1 Implementation Guide - Tenant Creation System

**Goal**: Build a complete tenant onboarding system with automated database provisioning  
**Time**: 5 days  
**Difficulty**: Advanced

---

## 📅 Day-by-Day Breakdown

### **Day 1: Tenant Creation Form (UI)**

#### Task 1.1: Create Registration Wizard Component
**File**: `src/components/platform/tenants/TenantCreationWizard.tsx`

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Step = 'business' | 'domain' | 'plan' | 'admin' | 'review';

interface TenantFormData {
  // Business Info
  businessName: string;
  businessType: 'single' | 'multi';
  industry: string;
  
  // Domain
  subdomain: string;
  customDomain?: string;
  
  // Plan
  planId: string;
  billingCycle: 'monthly' | 'annual';
  
  // Admin User
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  
  // Location
  timezone: string;
  currency: string;
}

export default function TenantCreationWizard() {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState<Step>('business');
  const [formData, setFormData] = useState<TenantFormData>({
    businessName: '',
    businessType: 'single',
    industry: 'smoke-shop',
    subdomain: '',
    planId: 'basic',
    billingCycle: 'monthly',
    ownerName: '',
    ownerEmail: '',
    ownerPhone: '',
    timezone: 'America/Chicago',
    currency: 'USD',
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const steps: Step[] = ['business', 'domain', 'plan', 'admin', 'review'];
  const currentStepIndex = steps.indexOf(currentStep);

  const handleNext = () => {
    const nextStep = steps[currentStepIndex + 1];
    if (nextStep) setCurrentStep(nextStep);
  };

  const handleBack = () => {
    const prevStep = steps[currentStepIndex - 1];
    if (prevStep) setCurrentStep(prevStep);
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/platform/tenants/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create tenant');
      }

      const { tenant } = await response.json();
      router.push(`/platform/tenants/${tenant.id}?created=true`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Progress Bar */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          {steps.map((step, index) => (
            <div
              key={step}
              className={`flex-1 ${index !== 0 ? 'ml-2' : ''}`}
            >
              <div
                className={`h-2 rounded-none ${
                  index <= currentStepIndex
                    ? 'bg-black'
                    : 'bg-gray-200'
                }`}
              />
              <p className="text-xs mt-2 uppercase tracking-wide">
                {step}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <div className="bg-white border border-gray-200 p-8">
        {currentStep === 'business' && (
          <BusinessInfoStep
            data={formData}
            onChange={setFormData}
          />
        )}
        {currentStep === 'domain' && (
          <DomainStep
            data={formData}
            onChange={setFormData}
          />
        )}
        {currentStep === 'plan' && (
          <PlanSelectionStep
            data={formData}
            onChange={setFormData}
          />
        )}
        {currentStep === 'admin' && (
          <AdminUserStep
            data={formData}
            onChange={setFormData}
          />
        )}
        {currentStep === 'review' && (
          <ReviewStep data={formData} />
        )}
      </div>

      {/* Navigation */}
      <div className="mt-6 flex justify-between">
        <button
          onClick={handleBack}
          disabled={currentStepIndex === 0 || isSubmitting}
          className="px-6 py-3 border border-black text-black uppercase tracking-wide disabled:opacity-50"
        >
          Back
        </button>

        {currentStep === 'review' ? (
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-3 bg-black text-white uppercase tracking-wide disabled:opacity-50"
          >
            {isSubmitting ? 'Creating Tenant...' : 'Create Tenant'}
          </button>
        ) : (
          <button
            onClick={handleNext}
            className="px-6 py-3 bg-black text-white uppercase tracking-wide"
          >
            Next
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 text-red-800">
          {error}
        </div>
      )}
    </div>
  );
}
```

#### Task 1.2: Create Step Components
Create individual components for each step (BusinessInfoStep, DomainStep, etc.)

#### Task 1.3: Create Main Page
**File**: `src/app/platform/tenants/create/page.tsx`

```tsx
import { Metadata } from 'next';
import TenantCreationWizard from '@/components/platform/tenants/TenantCreationWizard';

export const metadata: Metadata = {
  title: 'Create New Tenant | Platform Admin',
};

export default function CreateTenantPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold uppercase tracking-wide mb-8">
        Create New Tenant
      </h1>
      <TenantCreationWizard />
    </div>
  );
}
```

---

### **Day 2: Subdomain Validation & API Setup**

#### Task 2.1: Subdomain Availability Check API
**File**: `src/app/api/platform/tenants/check-subdomain/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getMasterDb } from '@/lib/db/master-db';
import { verifyPlatformAdmin } from '@/lib/auth/platform';

export async function POST(request: NextRequest) {
  try {
    // Verify platform admin authentication
    const admin = await verifyPlatformAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { subdomain } = await request.json();

    // Validate subdomain format
    const subdomainRegex = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/;
    if (!subdomainRegex.test(subdomain)) {
      return NextResponse.json({
        available: false,
        error: 'Invalid subdomain format. Use lowercase letters, numbers, and hyphens only.',
      });
    }

    // Check length
    if (subdomain.length < 3 || subdomain.length > 30) {
      return NextResponse.json({
        available: false,
        error: 'Subdomain must be between 3 and 30 characters.',
      });
    }

    // Reserved subdomains
    const reserved = [
      'www', 'admin', 'api', 'app', 'blog', 'docs', 'help',
      'mail', 'platform', 'status', 'support', 'test',
    ];
    if (reserved.includes(subdomain)) {
      return NextResponse.json({
        available: false,
        error: 'This subdomain is reserved.',
      });
    }

    // Check if subdomain exists
    const masterDb = getMasterDb();
    const existing = await masterDb.tenant.findUnique({
      where: { subdomain },
    });

    if (existing) {
      return NextResponse.json({
        available: false,
        error: 'This subdomain is already taken.',
      });
    }

    return NextResponse.json({
      available: true,
      subdomain,
      domain: `${subdomain}.yourdomain.com`,
    });
  } catch (error: any) {
    console.error('Check subdomain error:', error);
    return NextResponse.json(
      { error: 'Failed to check subdomain availability' },
      { status: 500 }
    );
  }
}
```

#### Task 2.2: Real-Time Subdomain Validation in Form
Update `DomainStep` component to check availability as user types (debounced)

---

### **Day 3: Tenant Creation API + Database Provisioning**

#### Task 3.1: Tenant Creation API
**File**: `src/app/api/platform/tenants/create/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getMasterDb } from '@/lib/db/master-db';
import { verifyPlatformAdmin } from '@/lib/auth/platform';
import { provisionTenantDatabase } from '@/lib/platform/tenant-provisioning';
import { createTenantMongoDatabase } from '@/lib/db/mongodb';
import { sendWelcomeEmail } from '@/lib/notifications/email-service';
import { hashPassword } from '@/lib/auth/password';

export const maxDuration = 300; // 5 minutes for provisioning

export async function POST(request: NextRequest) {
  try {
    const admin = await verifyPlatformAdmin(request);
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const data = await request.json();
    const {
      businessName,
      subdomain,
      planId,
      ownerName,
      ownerEmail,
      ownerPhone,
      timezone,
      currency,
    } = data;

    const masterDb = getMasterDb();

    // 1. Create tenant record in master database
    const tenant = await masterDb.tenant.create({
      data: {
        name: businessName,
        slug: subdomain,
        subdomain,
        domain: `${subdomain}.yourdomain.com`,
        planId,
        status: 'trial',
        trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
        timezone,
        currency,
        metadata: {
          ownerName,
          ownerEmail,
          ownerPhone,
          createdBy: admin.email,
        },
      },
    });

    // 2. Provision PostgreSQL database (Supabase)
    console.log(`Provisioning database for tenant: ${tenant.id}`);
    const dbConfig = await provisionTenantDatabase(tenant);

    // 3. Update tenant with database credentials (encrypted)
    await masterDb.tenant.update({
      where: { id: tenant.id },
      data: {
        databaseUrl: dbConfig.connectionString, // Store encrypted
        projectRef: dbConfig.projectRef,
      },
    });

    // 4. Create MongoDB tenant database
    await createTenantMongoDatabase(tenant.slug);

    // 5. Create initial admin user in tenant database
    const { getTenantDb } = await import('@/lib/tenant-context');
    const tenantDb = await getTenantDb(tenant);
    
    const hashedPassword = await hashPassword('ChangeMe123!'); // Temporary password
    
    await tenantDb.user.create({
      data: {
        name: ownerName,
        email: ownerEmail,
        phone: ownerPhone,
        password: hashedPassword,
        role: 'owner',
        isActive: true,
      },
    });

    // 6. Send welcome email
    await sendWelcomeEmail({
      email: ownerEmail,
      name: ownerName,
      subdomain,
      tempPassword: 'ChangeMe123!',
    });

    // 7. Log activity
    await masterDb.tenantActivityLog.create({
      data: {
        tenantId: tenant.id,
        action: 'tenant.created',
        actor: admin.email,
        metadata: {
          planId,
          subdomain,
        },
      },
    });

    return NextResponse.json({
      success: true,
      tenant: {
        id: tenant.id,
        name: tenant.name,
        subdomain: tenant.subdomain,
        domain: tenant.domain,
        status: tenant.status,
      },
    });
  } catch (error: any) {
    console.error('Tenant creation error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create tenant' },
      { status: 500 }
    );
  }
}
```

#### Task 3.2: Database Provisioning Service
**File**: `src/lib/platform/tenant-provisioning.ts`

```typescript
import { Tenant } from '@prisma/master-client';
import { createClient } from '@supabase/supabase-js';

interface DatabaseConfig {
  projectRef: string;
  connectionString: string;
  apiUrl: string;
  anonKey: string;
}

/**
 * Provisions a new Supabase project for a tenant
 */
export async function provisionTenantDatabase(
  tenant: Tenant
): Promise<DatabaseConfig> {
  // Option 1: Use Supabase Management API (requires API key)
  if (process.env.SUPABASE_MANAGEMENT_TOKEN) {
    return await provisionViaSupabaseAPI(tenant);
  }

  // Option 2: Manual provisioning (for now)
  // You'll manually create the Supabase project and return credentials
  console.log('⚠️  Manual database provisioning required');
  console.log(`Create Supabase project for: ${tenant.name}`);
  console.log(`Project name: ${tenant.slug}`);
  
  // For MVP, return a pre-created database URL
  // In production, automate this with Supabase Management API
  throw new Error(
    'Automatic provisioning not configured. Please create Supabase project manually.'
  );
}

/**
 * Automated provisioning using Supabase Management API
 */
async function provisionViaSupabaseAPI(
  tenant: Tenant
): Promise<DatabaseConfig> {
  const SUPABASE_MANAGEMENT_API = 'https://api.supabase.com/v1';
  const token = process.env.SUPABASE_MANAGEMENT_TOKEN!;

  // 1. Create new organization (if needed)
  const orgResponse = await fetch(`${SUPABASE_MANAGEMENT_API}/organizations`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: `${tenant.name} (${tenant.slug})`,
    }),
  });

  if (!orgResponse.ok) {
    throw new Error('Failed to create organization');
  }

  const { id: orgId } = await orgResponse.json();

  // 2. Create new project
  const projectResponse = await fetch(`${SUPABASE_MANAGEMENT_API}/projects`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      organization_id: orgId,
      name: tenant.slug,
      region: 'us-east-1', // Choose appropriate region
      plan: 'free', // or 'pro' based on tenant plan
    }),
  });

  if (!projectResponse.ok) {
    throw new Error('Failed to create project');
  }

  const project = await projectResponse.json();

  // 3. Wait for project to be ready
  await waitForProject(project.id, token);

  // 4. Run schema migrations
  await runTenantMigrations(project.database_url);

  // 5. Return connection details
  return {
    projectRef: project.ref,
    connectionString: project.database_url,
    apiUrl: project.endpoint,
    anonKey: project.anon_key,
  };
}

/**
 * Wait for Supabase project to be provisioned
 */
async function waitForProject(
  projectId: string,
  token: string,
  maxAttempts = 60
): Promise<void> {
  for (let i = 0; i < maxAttempts; i++) {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${projectId}`,
      {
        headers: { 'Authorization': `Bearer ${token}` },
      }
    );

    const project = await response.json();
    if (project.status === 'active') {
      return;
    }

    // Wait 5 seconds before retry
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  throw new Error('Timeout waiting for project provisioning');
}

/**
 * Run Prisma migrations on new tenant database
 */
async function runTenantMigrations(databaseUrl: string): Promise<void> {
  const { execSync } = await import('child_process');
  
  // Set environment variable for migration
  process.env.DATABASE_URL = databaseUrl;
  
  try {
    // Run migrations
    execSync(
      'npx prisma migrate deploy --schema=prisma/schema-tenant.prisma',
      { stdio: 'inherit' }
    );
  } catch (error) {
    console.error('Migration failed:', error);
    throw new Error('Failed to run tenant database migrations');
  }
}
```

---

### **Day 4: MongoDB Tenant Database Creation**

#### Task 4.1: MongoDB Tenant Database Service
**File**: `src/lib/platform/mongodb-provisioning.ts`

```typescript
import mongoose from 'mongoose';
import { getMongoConnection } from '@/lib/db/mongodb';

/**
 * Creates a new MongoDB database for a tenant
 * and sets up initial collections
 */
export async function createTenantMongoDatabase(
  tenantSlug: string
): Promise<void> {
  const dbName = `tenant-${tenantSlug}`;
  
  try {
    // Connect to MongoDB
    const connection = await getMongoConnection();
    
    // Create database (MongoDB creates it on first write)
    const db = connection.useDb(dbName);
    
    // Create collections with validation schema
    await db.createCollection('products', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['tenantId', 'name', 'sku'],
          properties: {
            tenantId: { bsonType: 'string' },
            masterProductId: { bsonType: ['string', 'null'] },
            name: { bsonType: 'string' },
            sku: { bsonType: 'string' },
            barcode: { bsonType: ['string', 'null'] },
            category: { bsonType: 'string' },
            brand: { bsonType: 'string' },
            description: { bsonType: ['string', 'null'] },
            costPrice: { bsonType: 'number' },
            salePrice: { bsonType: 'number' },
            msrp: { bsonType: ['number', 'null'] },
            stockQuantity: { bsonType: 'number' },
            lowStockThreshold: { bsonType: 'number' },
            isActive: { bsonType: 'bool' },
            images: { bsonType: 'array' },
            createdAt: { bsonType: 'date' },
            updatedAt: { bsonType: 'date' },
          },
        },
      },
    });
    
    // Create indexes
    await db.collection('products').createIndexes([
      { key: { tenantId: 1 } },
      { key: { sku: 1 }, unique: true },
      { key: { barcode: 1 } },
      { key: { category: 1 } },
      { key: { brand: 1 } },
      { key: { name: 'text', description: 'text' } },
    ]);
    
    console.log(`✅ Created MongoDB database: ${dbName}`);
  } catch (error) {
    console.error('MongoDB database creation error:', error);
    throw new Error(`Failed to create tenant database: ${dbName}`);
  }
}

/**
 * Deletes a tenant's MongoDB database (use with caution!)
 */
export async function deleteTenantMongoDatabase(
  tenantSlug: string
): Promise<void> {
  const dbName = `tenant-${tenantSlug}`;
  
  try {
    const connection = await getMongoConnection();
    await connection.dropDatabase();
    console.log(`✅ Deleted MongoDB database: ${dbName}`);
  } catch (error) {
    console.error('MongoDB database deletion error:', error);
    throw error;
  }
}
```

---

### **Day 5: Testing & Polish**

#### Task 5.1: Create Test Script
**File**: `scripts/test-tenant-creation.ts`

```typescript
/**
 * Test script for tenant creation
 * Run: npx tsx scripts/test-tenant-creation.ts
 */

async function testTenantCreation() {
  const testData = {
    businessName: 'Test Smoke Shop',
    subdomain: `test-${Date.now()}`,
    planId: 'basic',
    billingCycle: 'monthly',
    ownerName: 'Test Owner',
    ownerEmail: `test-${Date.now()}@example.com`,
    ownerPhone: '512-555-1234',
    timezone: 'America/Chicago',
    currency: 'USD',
  };

  console.log('🧪 Testing tenant creation...');
  console.log('Test data:', testData);

  try {
    const response = await fetch('http://localhost:3000/api/platform/tenants/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add authentication cookie here
      },
      body: JSON.stringify(testData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message);
    }

    const result = await response.json();
    console.log('✅ Tenant created successfully!');
    console.log(result);
  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

testTenantCreation();
```

#### Task 5.2: Error Handling & Validation
- Add comprehensive error messages
- Handle edge cases (database connection failures, etc.)
- Add loading states to UI
- Add success/failure notifications

#### Task 5.3: Documentation
- Document the tenant creation flow
- Add JSDoc comments to all functions
- Create troubleshooting guide

---

## ✅ Week 1 Checklist

- [ ] Tenant creation wizard UI (5 steps)
- [ ] Subdomain validation (real-time check)
- [ ] Tenant creation API endpoint
- [ ] Database provisioning (PostgreSQL + MongoDB)
- [ ] Initial admin user creation
- [ ] Welcome email automation
- [ ] Activity logging
- [ ] Error handling
- [ ] Test script
- [ ] Documentation

---

## 🚀 Week 2 Preview

Next week, you'll build:
1. Tenant suspend/activate functionality
2. Tenant detail page (enhanced)
3. Billing integration (Stripe)
4. Subscription plan management

---

## 💡 Tips

1. **Test Locally First**: Use ngrok or localhost testing before deploying
2. **Manual Fallback**: For MVP, manual database creation is fine
3. **Idempotency**: Make creation API idempotent (handle retries)
4. **Audit Everything**: Log all actions for debugging
5. **Fail Fast**: Validate early, rollback on any error

Good luck! 🎉
