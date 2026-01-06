# 🏗️ SmokeShop SaaS - Multi-Tenant Architecture V2

**Updated:** January 4, 2026  
**Model:** Custom Domains + Separate Databases per Tenant

---

## 🎯 Architecture Overview

### Core Principle
Each tenant (smoke shop owner) gets:
- ✅ Their own custom domain (`joessmokeshop.com`)
- ✅ Their own isolated PostgreSQL database
- ✅ Complete data ownership
- ✅ They pay for their own database costs

You provide:
- ✅ Master product catalog (MongoDB)
- ✅ Platform software & updates
- ✅ Central tenant registry
- ✅ Migration management
- ✅ Support & onboarding

---

## 🗄️ Three-Tier Database Strategy

### 1. Master Database (Your PostgreSQL)
**Purpose:** Central registry of all tenants  
**Location:** Your Supabase project  
**Contains:**
- Tenant registry (domains → DB connections)
- Admin users (your team)
- Migration tracking
- Activity logs
- Billing/subscription data

**Schema:**
```sql
tenants (id, name, slug, custom_domain, db_host, db_password, status, plan, created_at)
admin_users (id, email, password_hash, role)
tenant_migrations (id, tenant_id, migration_name, status, executed_at)
tenant_activity_log (id, tenant_id, event_type, details)
```

### 2. Tenant Databases (Each Shop's PostgreSQL)
**Purpose:** All operational data for one shop  
**Location:** Separate Supabase projects (or self-hosted PostgreSQL)  
**Contains:**
- Users (shop employees)
- Stores (physical locations)
- Products (inventory)
- Customers
- Orders (pickup/delivery)
- POS transactions
- Cash drawer sessions

**Schema:**
```sql
users, stores, products, customers, orders, order_items,
pos_transactions, pos_transaction_items, pos_sessions
```

**Key Difference from V1:** NO `organization_id` fields - complete isolation!

### 3. Master Product Catalog (MongoDB)
**Purpose:** Central catalog of all available products  
**Location:** MongoDB Atlas (your account)  
**Contains:**
- Products from all brands
- Wholesale pricing
- Images & specifications
- Inventory availability

**Flow:** Tenants browse catalog → "Activate" products → Copy to their DB with custom pricing

---

## 🔄 Request Flow

```
1. User visits: https://joessmokeshop.com
              ↓
┌─────────────────────────────────────────────────────┐
│  Next.js Middleware (middleware.ts)                 │
│  - Extract domain: "joessmokeshop.com"              │
│  - Connect to MASTER DB                             │
│  - Query: SELECT * FROM tenants                     │
│           WHERE custom_domain = 'joessmokeshop.com' │
│  - Get: tenant_id, db_connection_string            │
└─────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────┐
│  Tenant Database Connector (tenant-connector.ts)    │
│  - Parse connection string                          │
│  - Create Prisma client for THIS tenant             │
│  - Check connection pool cache                      │
│  - Store in request context                         │
└─────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────┐
│  Page Renders                                       │
│  - Use tenant's Prisma client                       │
│  - All queries go to tenant's DB only               │
│  - Complete data isolation                          │
│  - No cross-tenant data access possible             │
└─────────────────────────────────────────────────────┘
```

---

## 🔐 Security & Isolation

### Database Isolation
✅ **Physical Separation:** Each tenant = separate PostgreSQL instance  
✅ **No RLS Needed:** Can't query other tenant's data even if you try  
✅ **Connection String Security:** Encrypted in master DB  
✅ **Credential Rotation:** Can update tenant DB password without affecting others

### Authentication Flow
```
1. User logs in at joessmokeshop.com/login
2. Middleware identifies tenant from domain
3. Connect to tenant's DB
4. Validate credentials in tenant's `users` table
5. Generate JWT with: { userId, tenantId, tenantSlug }
6. Store in httpOnly cookie
7. All subsequent requests use tenant's DB connection
```

### Authorization
- **No cross-tenant access:** Middleware enforces tenant isolation
- **Role-based:** Each tenant DB has user roles (owner, manager, staff, cashier)
- **API routes:** Always extract tenant from request context

---

## 🛠️ Provisioning New Tenant

### Manual Process (Phase 1)
```bash
# Step 1: Tenant signs up on your platform
# Step 2: You create Supabase project
# Go to: https://supabase.com/dashboard
# Click: New Project
# Name: tenant-joessmokeshop
# Region: us-east-1
# Save connection details

# Step 3: Run provisioning script
npm run provision-tenant -- \
  --name "Joe's Smoke Shop" \
  --slug "joes-smoke-shop" \
  --domain "joessmokeshop.com" \
  --email "joe@joessmokeshop.com" \
  --db-host "db.xyz123.supabase.co" \
  --db-password "secure-password"

# Script does:
# 1. Add to master `tenants` table
# 2. Run Prisma migrations on tenant DB
# 3. Create default admin user
# 4. Seed initial data
# 5. Send welcome email
```

### Automated Process (Phase 2+)
```javascript
// API: POST /api/admin/provision-tenant

const tenant = await provisionTenant({
  name: "Joe's Smoke Shop",
  email: "joe@joessmokeshop.com",
  domain: "joessmokeshop.com"
});

// Automatically:
// 1. Call Supabase API to create project
// 2. Get connection string
// 3. Register in master DB
// 4. Run migrations
// 5. Create default user
// 6. Return tenant credentials
```

---

## 📦 Schema Migrations

### Challenge
When you update the schema (add new table/column), you need to apply it to ALL tenant databases.

### Solution: Migration Orchestrator

```bash
# Create new migration
npx prisma migrate dev --name add_loyalty_program

# Apply to all tenants
npm run migrate-all-tenants

# Script does:
1. Get all active tenants from master DB
2. For each tenant:
   - Connect to their DB
   - Run pending migrations
   - Update tenant_migrations table
   - Log success/failure
3. Generate report
```

**Example Migration:**
```sql
-- Migration: 002_add_loyalty_program.sql

CREATE TABLE loyalty_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID REFERENCES customers(id),
  points INTEGER DEFAULT 0,
  earned_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE customers 
ADD COLUMN loyalty_tier VARCHAR(50) DEFAULT 'bronze';
```

**Applied to all tenant DBs:**
- tenant-joes-smokeshop → runs migration
- tenant-mikes-vapes → runs migration  
- tenant-best-smoke → runs migration

---

## 🌐 Domain & SSL Setup

### DNS Configuration (Tenant's Responsibility)
```
Tenant needs to add CNAME record:
Type: CNAME
Name: @ (or www)
Value: cname.vercel-dns.com (or your platform domain)
TTL: 3600

Verification:
dig joessmokeshop.com CNAME
# Should return: cname.vercel-dns.com
```

### SSL Certificate (Automatic)
- Vercel/Cloudflare auto-provisions SSL
- Let's Encrypt free certificates
- Auto-renewal every 90 days
- No manual work needed

### Domain Verification Flow
```
1. Tenant adds their domain in dashboard
2. System shows DNS instructions
3. Tenant updates DNS with their registrar
4. System periodically checks DNS propagation
5. Once verified, domain becomes active
6. SSL certificate auto-provisioned
```

---

## 🧪 Testing Strategy

### Local Development
```bash
# .env.local
MASTER_DATABASE_URL="postgresql://postgres:pass@localhost:5432/master"

TENANT_1_DB="postgresql://postgres:pass@localhost:5433/tenant1"
TENANT_2_DB="postgresql://postgres:pass@localhost:5434/tenant2"
TENANT_3_DB="postgresql://postgres:pass@localhost:5435/tenant3"

# Run multiple PostgreSQL instances via Docker
docker-compose up -d
```

### /etc/hosts for Domain Testing
```
127.0.0.1  tenant1.localhost
127.0.0.1  tenant2.localhost
127.0.0.1  tenant3.localhost
```

Visit:
- `http://tenant1.localhost:3000` → connects to tenant1 DB
- `http://tenant2.localhost:3000` → connects to tenant2 DB

---

## 💾 Connection Pooling

### Problem
Creating new Prisma client per request is expensive (100ms+ overhead).

### Solution: Connection Cache
```typescript
// lib/db/connection-pool.ts

const connectionPool = new Map<string, PrismaClient>();

export function getTenantClient(tenantId: string, connectionString: string) {
  // Check cache
  if (connectionPool.has(tenantId)) {
    return connectionPool.get(tenantId);
  }
  
  // Create new client
  const client = new PrismaClient({
    datasources: {
      db: { url: connectionString }
    }
  });
  
  // Cache it (with TTL/LRU eviction)
  connectionPool.set(tenantId, client);
  
  return client;
}
```

**Benefits:**
- First request: 100ms (new connection)
- Subsequent: 2ms (cached)
- Max 100 connections per process
- Auto-cleanup stale connections

---

## 🎯 Master Catalog Product Activation

### Flow

```
1. Tenant browses MongoDB master catalog
   GET /api/catalog/products?category=vaporizers
   
2. Tenant clicks "Activate Product"
   POST /api/tenant/products/activate
   Body: { masterProductId: "PUFFCO-PEAK-PRO" }
   
3. System:
   a. Fetch product from MongoDB
   b. Copy to tenant's PostgreSQL `products` table
   c. Set default pricing (can edit later)
   d. Link: master_product_id = "PUFFCO-PEAK-PRO"
   
4. Tenant can now:
   - Customize pricing
   - Manage inventory
   - Set low stock alerts
   - Add to POS system
```

### Schema Relationship
```sql
-- Tenant's products table
CREATE TABLE products (
  id UUID PRIMARY KEY,
  master_product_id VARCHAR(100),  -- Links to MongoDB
  name VARCHAR(255),                -- Can customize
  sale_price DECIMAL(10, 2),        -- Tenant sets their price
  stock_quantity INTEGER,           -- Tenant manages inventory
  ...
);
```

### Why This Works
- ✅ Tenant gets copy of product data (can customize)
- ✅ You update master catalog → tenants see updates
- ✅ Tenant's pricing/inventory is independent
- ✅ Can deactivate products (soft delete)

---

## 📊 Admin Dashboard (Your Platform)

### Features
```
Admin Panel Routes:
/admin/tenants              - List all tenants
/admin/tenants/new          - Provision new tenant
/admin/tenants/[id]         - View tenant details
/admin/migrations           - Migration status
/admin/catalog              - Manage master catalog
/admin/analytics            - Platform-wide stats
```

### Tenant Management UI
```
┌─────────────────────────────────────────────────┐
│  Tenants                           [+ New]      │
├─────────────────────────────────────────────────┤
│  Name              Domain           Status  DB  │
│  Joe's Smoke Shop  joessmoke.com   Active  OK  │
│  Mike's Vapes      mikesvapes.com  Active  OK  │
│  Best Smoke        bestsmoke.net   Trial   OK  │
└─────────────────────────────────────────────────┘
```

---

## 💰 Cost Breakdown

### Your Costs (Monthly)
- Master PostgreSQL: $25 (Supabase Pro)
- MongoDB Atlas: $0-57 (M0 free, M10 $57/mo)
- Vercel hosting: $20 (Pro plan for multiple domains)
- Domain: $12/year ($1/mo)
- **Total: ~$50-100/month**

### Per Tenant Costs (They Pay)
- Supabase PostgreSQL: $25/month (Pro tier)
- Domain: $10-15/year
- Optional: Custom email

### Pricing Strategy Example
- **Starter:** $49/month (includes DB, 1 location, 500 products)
- **Growth:** $99/month (includes DB, 3 locations, unlimited products)
- **Enterprise:** $299/month (includes DB, unlimited everything, priority support)

**Margin:** You charge $49, tenant DB costs $25 = $24/tenant profit

---

## 🚀 Rollout Plan

### Week 1-2: Foundation
- ✅ Authentication system (DONE)
- ⬜ Master database schema
- ⬜ Tenant database schema
- ⬜ Dynamic connector

### Week 3-4: Core Multi-Tenancy
- ⬜ Domain resolver middleware
- ⬜ Provisioning script
- ⬜ Migration orchestrator
- ⬜ Test with 3 tenant DBs

### Week 5-6: Product Catalog
- ⬜ Master catalog browser
- ⬜ Product activation flow
- ⬜ Tenant product management
- ⬜ Inventory tracking

### Week 7-8: Admin Dashboard
- ⬜ Tenant management UI
- ⬜ Migration dashboard
- ⬜ Activity monitoring
- ⬜ Analytics

### Week 9-10: POS System
- ⬜ POS interface
- ⬜ Barcode scanning
- ⬜ Cash drawer
- ⬜ Receipt printing

---

## ❓ Key Decisions Made

1. ✅ **Separate DBs:** Each tenant = own PostgreSQL instance
2. ✅ **Custom Domains:** No subdomains, full white-label
3. ✅ **Manual Provisioning First:** Start simple, automate later
4. ✅ **Tenant Pays DB:** Pass costs to customer
5. ✅ **Master Catalog:** MongoDB for central product library
6. ✅ **Downtime Acceptable:** Can run migrations with brief outages

---

## 🎯 Next Immediate Steps

1. Create master database Prisma schema
2. Update tenant database schema (remove org_id fields)
3. Set up master Supabase project
4. Create 3 test tenant databases
5. Build tenant connector utility
6. Test domain resolution locally

---

**Ready to build the most scalable smoke shop platform! 🚀**
