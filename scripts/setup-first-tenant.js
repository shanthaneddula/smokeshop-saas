const { PrismaClient: MasterClient } = require('@prisma/master-client');
const { PrismaClient: TenantClient } = require('@prisma/client');

const MASTER_DB_URL = 'postgresql://postgres:hPUj9MhpvqSIy2aJ@db.gxgmtgkepikakcfpncyg.supabase.co:5432/postgres';
const TENANT_1_DB_URL = 'postgresql://postgres:jyzMyb-4fubny-goxtod@db.uxwqhvfbtfrvuvbezrdw.supabase.co:5432/postgres';

async function setupFirstTenant() {
  const masterDb = new MasterClient({
    datasources: { db: { url: MASTER_DB_URL } }
  });
  
  const tenantDb = new TenantClient({
    datasources: { db: { url: TENANT_1_DB_URL } }
  });
  
  try {
    console.log('🚀 Setting up first tenant...\n');
    
    // 1. Register tenant in master database
    console.log('1️⃣ Registering tenant in master database...');
    const tenant = await masterDb.tenant.create({
      data: {
        name: "Joe's Smoke Shop",
        slug: 'joes-smoke-shop',
        customDomain: 'joessmokeshop.local',
        
        // Database connection info
        dbHost: 'db.uxwqhvfbtfrvuvbezrdw.supabase.co',
        dbName: 'postgres',
        dbUser: 'postgres',
        dbPassword: 'jyzMyb-4fubny-goxtod', // In production, encrypt this!
        dbPort: 5432,
        
        // Supabase info
        supabaseProjectId: 'uxwqhvfbtfrvuvbezrdw',
        supabaseUrl: 'https://uxwqhvfbtfrvuvbezrdw.supabase.co',
        
        // Tenant status
        status: 'active',
        plan: 'starter',
        
        // Owner info
        ownerEmail: 'joe@joessmokeshop.com',
        ownerName: 'Joe Smith',
        phone: '+1-512-555-0100',
      }
    });
    
    console.log(`   ✅ Tenant registered: ${tenant.name} (${tenant.slug})`);
    console.log(`   📧 Owner: ${tenant.ownerEmail}`);
    console.log(`   🌐 Domain: ${tenant.customDomain}`);
    
    // 2. Create owner user in tenant database
    console.log('\n2️⃣ Creating owner user in tenant database...');
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('Password123!', 10);
    
    const owner = await tenantDb.user.create({
      data: {
        email: 'joe@joessmokeshop.com',
        name: 'Joe Smith',
        password: hashedPassword,
        role: 'owner',
        isActive: true,
      }
    });
    
    console.log(`   ✅ Owner user created: ${owner.email}`);
    
    // 3. Create default store
    console.log('\n3️⃣ Creating default store...');
    const store = await tenantDb.store.create({
      data: {
        name: 'Main Location',
        address: '123 Main St',
        city: 'Austin',
        state: 'TX',
        zipCode: '78701',
        phone: '+1-512-555-0100',
        isActive: true,
        isPrimary: true,
      }
    });
    
    console.log(`   ✅ Store created: ${store.name}`);
    
    // 4. Log activity
    console.log('\n4️⃣ Logging tenant activity...');
    await masterDb.tenantActivityLog.create({
      data: {
        tenantId: tenant.id,
        eventType: 'tenant_provisioned',
        details: {
          stores: 1,
          users: 1,
          initialSetup: true
        }
      }
    });
    
    console.log('   ✅ Activity logged');
    
    // 5. Verify setup
    console.log('\n5️⃣ Verifying tenant setup...');
    
    const tenantCheck = await masterDb.tenant.findUnique({
      where: { slug: 'joes-smoke-shop' },
      include: {
        activityLogs: true,
      }
    });
    
    const usersCount = await tenantDb.user.count();
    const storesCount = await tenantDb.store.count();
    
    console.log(`   ✅ Tenant in master DB: ${tenantCheck.name}`);
    console.log(`   ✅ Users in tenant DB: ${usersCount}`);
    console.log(`   ✅ Stores in tenant DB: ${storesCount}`);
    console.log(`   ✅ Activity logs: ${tenantCheck.activityLogs.length}`);
    
    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('🎉 TENANT SETUP COMPLETE!');
    console.log('='.repeat(50));
    console.log('\n📊 Summary:');
    console.log(`   Tenant: ${tenant.name}`);
    console.log(`   Slug: ${tenant.slug}`);
    console.log(`   Domain: ${tenant.customDomain}`);
    console.log(`   Owner: ${owner.email}`);
    console.log(`   Password: Password123!`);
    console.log(`   Store: ${store.name} - ${store.city}, ${store.state}`);
    console.log('\n🧪 Test Login:');
    console.log(`   Email: joe@joessmokeshop.com`);
    console.log(`   Password: Password123!`);
    console.log('\n🔗 Connection Info:');
    console.log(`   Master DB: ...${MASTER_DB_URL.slice(-30)}`);
    console.log(`   Tenant DB: ...${TENANT_1_DB_URL.slice(-30)}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.code) {
      console.error('   Code:', error.code);
    }
  } finally {
    await masterDb.$disconnect();
    await tenantDb.$disconnect();
  }
}

setupFirstTenant();
