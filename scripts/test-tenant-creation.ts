/**
 * Test script for tenant creation flow
 * 
 * This script tests the tenant creation API endpoint.
 * Run: npx tsx scripts/test-tenant-creation.ts
 * 
 * Prerequisites:
 * 1. Server running on localhost:3000
 * 2. Platform admin logged in (or use auth cookie)
 */

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

interface TenantCreateData {
  name: string;
  slug: string;
  customDomain?: string;
  ownerEmail: string;
  ownerName: string;
  ownerPassword: string;
  phone?: string;
  dbHost: string;
  dbName: string;
  dbUser: string;
  dbPassword: string;
  dbPort: number;
}

async function testDomainCheck(domain: string, authCookie: string) {
  console.log(`\n🔍 Testing domain check: ${domain}`);
  
  const response = await fetch(`${BASE_URL}/api/platform/tenants/check-domain`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': authCookie,
    },
    body: JSON.stringify({ domain }),
  });
  
  const result = await response.json();
  console.log(`   Status: ${response.status}`);
  console.log(`   Result:`, result);
  
  return result;
}

async function testConnectionCheck(config: Partial<TenantCreateData>, authCookie: string) {
  console.log(`\n🔌 Testing database connection: ${config.dbHost}`);
  
  const response = await fetch(`${BASE_URL}/api/platform/tenants/test-connection`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': authCookie,
    },
    body: JSON.stringify({
      dbHost: config.dbHost,
      dbName: config.dbName || 'postgres',
      dbUser: config.dbUser || 'postgres',
      dbPassword: config.dbPassword,
      dbPort: config.dbPort || 5432,
    }),
  });
  
  const result = await response.json();
  console.log(`   Status: ${response.status}`);
  console.log(`   Result:`, result);
  
  return result;
}

async function testTenantCreation(data: TenantCreateData, authCookie: string) {
  console.log(`\n🏗️  Testing tenant creation: ${data.name} (${data.slug})`);
  
  const response = await fetch(`${BASE_URL}/api/platform/tenants`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cookie': authCookie,
    },
    body: JSON.stringify(data),
  });
  
  const result = await response.json();
  console.log(`   Status: ${response.status}`);
  console.log(`   Result:`, JSON.stringify(result, null, 2));
  
  return { success: response.ok, result };
}

async function main() {
  console.log('='.repeat(60));
  console.log('🧪 TENANT CREATION TEST SCRIPT');
  console.log('='.repeat(60));
  
  // Check for auth cookie
  const authCookie = process.env.PLATFORM_AUTH_COOKIE;
  if (!authCookie) {
    console.log('\n⚠️  No auth cookie provided.');
    console.log('   Set PLATFORM_AUTH_COOKIE environment variable to test authenticated endpoints.');
    console.log('   Example: PLATFORM_AUTH_COOKIE="platform-auth-token=xxx" npx tsx scripts/test-tenant-creation.ts');
    console.log('\n📋 Showing test data structure instead:\n');
    
    const testData: TenantCreateData = {
      name: 'Test Smoke Shop',
      slug: `test-shop-${Date.now()}`,
      customDomain: 'testsmokeshop.com',
      ownerEmail: 'owner@testsmokeshop.com',
      ownerName: 'Test Owner',
      ownerPassword: 'SecurePass123!',
      phone: '555-123-4567',
      dbHost: 'db.xxxxxxxxxxxx.supabase.co',
      dbName: 'postgres',
      dbUser: 'postgres',
      dbPassword: 'your-database-password',
      dbPort: 5432,
    };
    
    console.log('Test data structure:');
    console.log(JSON.stringify(testData, null, 2));
    console.log('\nTo run actual tests, log in to /platform/login and copy the platform-auth-token cookie.');
    return;
  }
  
  // Generate unique test data
  const timestamp = Date.now();
  const testData: TenantCreateData = {
    name: `Test Shop ${timestamp}`,
    slug: `test-shop-${timestamp}`,
    customDomain: `test-${timestamp}.example.com`,
    ownerEmail: `owner-${timestamp}@example.com`,
    ownerName: 'Test Owner',
    ownerPassword: 'SecurePass123!',
    phone: '555-123-4567',
    // Replace these with actual test database credentials
    dbHost: process.env.TEST_DB_HOST || 'db.test.supabase.co',
    dbName: process.env.TEST_DB_NAME || 'postgres',
    dbUser: process.env.TEST_DB_USER || 'postgres',
    dbPassword: process.env.TEST_DB_PASSWORD || 'test-password',
    dbPort: 5432,
  };
  
  console.log('\n📋 Test Configuration:');
  console.log(`   Base URL: ${BASE_URL}`);
  console.log(`   Test Slug: ${testData.slug}`);
  console.log(`   Test Domain: ${testData.customDomain}`);
  
  // Test 1: Domain Check
  try {
    await testDomainCheck(testData.customDomain!, authCookie);
  } catch (error) {
    console.error('   ❌ Domain check failed:', error);
  }
  
  // Test 2: Invalid Domain Format
  try {
    await testDomainCheck('invalid..domain', authCookie);
  } catch (error) {
    console.error('   ❌ Invalid domain check failed:', error);
  }
  
  // Test 3: Connection Check (will fail with fake credentials)
  if (process.env.TEST_DB_HOST) {
    try {
      await testConnectionCheck(testData, authCookie);
    } catch (error) {
      console.error('   ❌ Connection check failed:', error);
    }
  } else {
    console.log('\n⏭️  Skipping connection test (no TEST_DB_HOST provided)');
  }
  
  // Test 4: Full Tenant Creation (only if real credentials provided)
  if (process.env.TEST_DB_HOST && process.env.TEST_DB_PASSWORD) {
    try {
      const result = await testTenantCreation(testData, authCookie);
      
      if (result.success) {
        console.log('\n✅ Tenant created successfully!');
        console.log(`   Tenant ID: ${result.result.tenant?.id}`);
        console.log(`   Tenant Slug: ${result.result.tenant?.slug}`);
      } else {
        console.log('\n❌ Tenant creation failed');
      }
    } catch (error) {
      console.error('   ❌ Tenant creation failed:', error);
    }
  } else {
    console.log('\n⏭️  Skipping tenant creation test (provide TEST_DB_HOST and TEST_DB_PASSWORD)');
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🏁 TEST COMPLETE');
  console.log('='.repeat(60));
}

main().catch(console.error);
