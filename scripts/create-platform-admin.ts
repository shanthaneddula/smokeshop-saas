#!/usr/bin/env tsx

/**
 * Create Platform Admin User
 * 
 * Creates an admin user in the master database for platform management.
 * Run: npx tsx scripts/create-platform-admin.ts
 */

import { PrismaClient as MasterPrismaClient } from '@prisma/master-client';
import bcrypt from 'bcryptjs';
import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';

// Load .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

if (!process.env.MASTER_DATABASE_URL) {
  console.error('❌ MASTER_DATABASE_URL not found in .env.local');
  process.exit(1);
}

const masterDb = new MasterPrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(query, resolve);
  });
}

async function createPlatformAdmin() {
  console.log('🔐 Create Platform Admin User\n');
  console.log('This will create a super admin account for managing all tenants.\n');

  try {
    // Get admin details
    const name = await question('Admin Name: ');
    const email = await question('Admin Email: ');
    const password = await question('Password (min 8 chars): ');
    const role = await question('Role (admin/support/developer) [admin]: ') || 'admin';

    if (!name || !email || !password) {
      console.error('❌ All fields are required');
      process.exit(1);
    }

    if (password.length < 8) {
      console.error('❌ Password must be at least 8 characters');
      process.exit(1);
    }

    // Check if admin already exists
    const existing = await masterDb.adminUser.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      console.error(`❌ Admin user with email ${email} already exists`);
      process.exit(1);
    }

    // Hash password
    console.log('\n🔒 Hashing password...');
    const passwordHash = await bcrypt.hash(password, 12);

    // Create admin user
    console.log('💾 Creating admin user...');
    const admin = await masterDb.adminUser.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash,
        role,
        isActive: true,
      },
    });

    console.log('\n✅ Platform admin created successfully!\n');
    console.log('Details:');
    console.log(`  ID:    ${admin.id}`);
    console.log(`  Name:  ${admin.name}`);
    console.log(`  Email: ${admin.email}`);
    console.log(`  Role:  ${admin.role}`);
    console.log('\nYou can now login at: http://localhost:3000/platform/login');
    
  } catch (error) {
    console.error('\n❌ Error creating admin user:', error);
    process.exit(1);
  } finally {
    await masterDb.$disconnect();
    rl.close();
  }
}

createPlatformAdmin();
