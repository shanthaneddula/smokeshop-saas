const { PrismaClient } = require('@prisma/master-client');

const masterDb = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://postgres:hPUj9MhpvqSIy2aJ@db.gxgmtgkepikakcfpncyg.supabase.co:5432/postgres'
    }
  }
});

async function checkTables() {
  try {
    console.log('📊 Checking Master Database Tables...\n');
    
    // Check if tables exist by querying
    const tenants = await masterDb.tenant.findMany();
    console.log(`✅ tenants table: ${tenants.length} records`);
    
    const admins = await masterDb.adminUser.findMany();
    console.log(`✅ admin_users table: ${admins.length} records`);
    
    const migrations = await masterDb.tenantMigration.findMany();
    console.log(`✅ tenant_migrations table: ${migrations.length} records`);
    
    const logs = await masterDb.tenantActivityLog.findMany();
    console.log(`✅ tenant_activity_logs table: ${logs.length} records`);
    
    console.log('\n🎉 Master database successfully initialized!');
    console.log('\nNext steps:');
    console.log('1. Create 3 new Supabase projects for tenant databases');
    console.log('2. Run provisioning script to add test tenants');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await masterDb.$disconnect();
  }
}

checkTables();
