# Multi-Tenant SaaS Testing Guide

## ✅ Server Status: Running on http://localhost:3000

---

## 📋 Test Plan

### **Test 1: Verify Master Database Connection**

Check if the master database (tenant registry) is accessible:

```bash
node check-master-db.js
```

**Expected Output:**
- ✅ Connected to master database
- ✅ Lists all tenants (should see joessmokeshop.local)

---

### **Test 2: Verify Middleware Domain Extraction**

Open browser and navigate to:
```
http://localhost:3000
```

**What's Happening:**
1. Middleware detects `localhost:3000`
2. Maps to test domain: `joessmokeshop.local`
3. Sets `x-tenant-domain` header
4. Passes request to Next.js

**Check Browser Console:**
- Should NOT see any 404 errors
- Should see homepage or login page

---

### **Test 3: Test Tenant Info API (Tenant Resolution)**

In a new terminal, run:
```bash
curl http://localhost:3000/api/tenant/info
```

**Expected Response:**
```json
{
  "tenant": {
    "id": "uuid-here",
    "name": "Joe's Smoke Shop",
    "slug": "joessmokeshop",
    "domain": "joessmokeshop.local"
  },
  "resolved": {
    "from": "domain",
    "domain": "joessmokeshop.local"
  }
}
```

**What This Tests:**
- ✅ Middleware sets x-tenant-domain header
- ✅ API route reads header in Node.js runtime
- ✅ Queries master DB for tenant
- ✅ Returns tenant info

**If you see "Tenant not found":**
- Master DB doesn't have a tenant with customDomain = "joessmokeshop.local"
- Need to run tenant setup script first

---

### **Test 4: Test Login Flow (Complete Multi-Tenant Auth)**

**Option A: Using cURL**

```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "joe@joessmokeshop.com",
    "password": "Password123!"
  }'
```

**Option B: Using Browser**

1. Open http://localhost:3000/login
2. Enter credentials:
   - Email: `joe@joessmokeshop.com`
   - Password: `Password123!`
3. Click "Sign In"

**Expected Response:**
```json
{
  "success": true,
  "user": {
    "id": "user-uuid",
    "email": "joe@joessmokeshop.com",
    "name": "Joe Smith",
    "role": "owner"
  },
  "tenant": {
    "id": "tenant-uuid",
    "name": "Joe's Smoke Shop",
    "slug": "joessmokeshop"
  }
}
```

**What This Tests:**
- ✅ Middleware passes domain
- ✅ Login API resolves tenant from domain (master DB query)
- ✅ Gets pooled connection to tenant's database
- ✅ Queries user from TENANT database (complete isolation)
- ✅ Verifies password with bcrypt
- ✅ Generates JWT with tenant context
- ✅ Sets httpOnly auth cookie

**If Login Fails:**
- Check if tenant exists in master DB
- Check if user exists in tenant's database
- Verify tenant DB connection string is correct
- Check console logs for connection errors

---

### **Test 5: Verify Connection Pooling**

Login 3-5 times rapidly, then check server logs:

```bash
# Should see in terminal:
[TenantContext] Looking up tenant for domain: joessmokeshop.local
[TenantContext] Found tenant: Joe's Smoke Shop (joessmokeshop)
[TenantPool] Getting connection for tenant {tenant-id}
```

**On first login:**
```
[TenantPool] Created new connection for tenant {id} (1 total)
```

**On subsequent logins (within 5 minutes):**
- Should NOT see "Created new connection"
- Connection is reused from pool ✅

---

### **Test 6: Test Complete Isolation (Database Separation)**

**Verify tenant database has user:**

```bash
# Connect to tenant 1 database directly
psql "postgresql://postgres:jyzMyb-4fubny-goxtod@db.uxwqhvfbtfrvuvbezrdw.supabase.co:5432/postgres"

# Run query
SELECT id, email, name, role FROM "User";
```

**Should see:**
- joe@joessmokeshop.com user

**Verify NO tenant_id or organization_id fields:**
```sql
\d "User"
```

**Expected:** Complete isolation - no cross-tenant foreign keys

---

## 🚨 Common Issues & Fixes

### Issue 1: "Tenant not found" Error

**Cause:** Master database doesn't have tenant record

**Fix:** Run setup script
```bash
node scripts/setup-first-tenant.js
```

---

### Issue 2: "Failed to connect to tenant database"

**Cause:** Invalid connection string or credentials

**Fix:** Check .env.local
```bash
# Verify these exist:
MASTER_DATABASE_URL="postgresql://..."
TENANT_1_DATABASE_URL="postgresql://..."
```

**Test connection manually:**
```bash
psql "$TENANT_1_DATABASE_URL" -c "SELECT 1"
```

---

### Issue 3: Prisma Client Not Generated

**Symptoms:** 
- `Cannot find module '@prisma/master-client'`
- `Cannot find module '@prisma/client'`

**Fix:**
```bash
# Generate both Prisma clients
npx prisma generate --schema=prisma/schema-master.prisma
npx prisma generate --schema=prisma/schema-tenant.prisma
```

---

### Issue 4: Login Returns 401 "Invalid email or password"

**Possible Causes:**
1. User doesn't exist in tenant database
2. Password is incorrect
3. Email case mismatch

**Debug:**
```bash
# Check if user exists in tenant DB
psql "$TENANT_1_DATABASE_URL" -c "SELECT email, name FROM \"User\""
```

**If no users exist, create one:**
```sql
-- Password is bcrypt hash of "Password123!"
INSERT INTO "User" (id, email, name, password, role, "createdAt", "updatedAt")
VALUES (
  gen_random_uuid(),
  'joe@joessmokeshop.com',
  'Joe Smith',
  '$2a$10$abcdefghijklmnopqrstuvwxyz...',  -- Use bcrypt hash
  'owner',
  NOW(),
  NOW()
);
```

---

## 📊 Architecture Validation Checklist

After running all tests, verify:

- [ ] Middleware extracts domain (NO Prisma in Edge runtime)
- [ ] API routes resolve tenant using master DB (Node.js runtime)
- [ ] Connection pooling reuses database connections
- [ ] Each tenant has separate PostgreSQL database
- [ ] No tenant_id fields in tenant schemas (complete isolation)
- [ ] JWT includes tenant context
- [ ] Auth cookies are httpOnly and secure

---

## 🎯 Next Steps After Verification

Once all tests pass:

1. **Build Dashboard UI** - Display tenant-specific data
2. **Add POS Module** - Sales transactions for tenant
3. **Product Management** - Link to MongoDB catalog
4. **Multi-Store Support** - Physical locations per tenant
5. **Custom Domain Setup** - Vercel domain configuration

---

## 📝 Test Credentials

**Test Tenant:**
- Domain: `joessmokeshop.local` (localhost maps here)
- Admin Email: `joe@joessmokeshop.com`
- Password: `Password123!`

**Database Connections:**
- Master DB: `gxgmtgkepikakcfpncyg.supabase.co`
- Tenant 1 DB: `uxwqhvfbtfrvuvbezrdw.supabase.co`
