const { PrismaClient } = require('@prisma/master-client');

const masterDb = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:hPUj9MhpvqSIy2aJ@db.gxgmtgkepikakcfpncyg.supabase.co:5432/postgres'
    }
  }
});

async function checkTenants() {
  try {
    console.log('🔍 Checking Tenants in Master Database...\n');
    
    const tenants = await masterDb.tenant.findMany();
    
    if (tenants.length === 0) {
      console.log('❌ No tenants found in master database');
      console.log('\nRun: node scripts/setup-first-tenant.js');
      return;
    }
    
    tenants.forEach((tenant, index) => {
      console.log(`\n📦 Tenant ${index + 1}:`);
      console.log(`   ID: ${tenant.id}`);
      console.log(`   Name: ${tenant.name}`);
      console.log(`   Slug: ${tenant.slug}`);
      console.log(`   Custom Domain: ${tenant.customDomain || 'Not set'}`);
      console.log(`   Status: ${tenant.status}`);
      console.log(`   Plan: ${tenant.plan}`);
      console.log(`   DB Host: ${tenant.dbHost}`);
      console.log(`   DB Name: ${tenant.dbName}`);
      console.log(`   DB User: ${tenant.dbUser}`);
      console.log(`   DB Port: ${tenant.dbPort}`);
      console.log(`   Supabase Project: ${tenant.supabaseProjectId || 'Not set'}`);
    });
    
    console.log('\n✅ Found', tenants.length, 'tenant(s)');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await masterDb.$disconnect();
  }
}

checkTenants();
