# SMOKESHOP SaaS - Multi-Tenant Platform Instructions

A production-ready multi-tenant SaaS platform for smoke shop businesses with POS, inventory management, and custom domain support.

## Tech Stack & Architecture

**Framework**: Next.js 16 (App Router) + TypeScript 5 + React 19  
**Styling**: Tailwind CSS with modern, clean design system  
**Databases**:
- **PostgreSQL (Supabase)**: Master database + Tenant databases (structured transactional data)
- **MongoDB Atlas**: Master catalog + Tenant product databases (flexible product data)
**Auth**: JWT-based (jsonwebtoken) with bcrypt password hashing  
**ORM**: Prisma 5 (dual clients: @prisma/master-client and @prisma/client)

### Multi-Tenant Architecture (CRITICAL)

**Database Isolation Strategy**:
- **Master PostgreSQL Database**: Central registry tracking all tenants (`@prisma/master-client`)
- **Tenant PostgreSQL Databases**: Separate PostgreSQL database per tenant (`@prisma/client`)
  - Stores: Orders, POS Transactions, Customers, Users, Stores (ACID-compliant transactional data)
- **Master MongoDB Database**: Shared product catalog (`smokeshop-catalog` database)
  - Master products with manufacturer specifications, pricing recommendations
- **Tenant MongoDB Databases**: Separate MongoDB database per tenant (`tenant-{tenantId}`)
  - Tenant products with custom pricing, inventory levels, specifications
  - Flexible schema for varied product attributes (bongs, vapes, papers all different)

### Domain Resolution Flow

**Complete Request Lifecycle**:
1. **Middleware (Edge Runtime)** - Extracts domain from request
   - Localhost → `joessmokeshop.local` (for development)
   - Custom domains → Use as-is (e.g., `joessmokeshop.com`)
   - Sets `x-tenant-domain` header
   - **NO database calls** (Prisma doesn't work in Edge)

2. **API Route (Node.js Runtime)** - Resolves tenant and connects to database
   - Calls `getTenantInfo(request)` → reads `x-tenant-domain` header
   - Queries **master database** to find tenant by domain
   - Returns tenant record with DB connection details
   - Calls `getTenantDb(tenant)` → builds connection string, gets pooled connection
   - Executes queries on **tenant's isolated database**

3. **Connection Pooling** - Prevents connection exhaustion
   - LRU cache (max 100 connections, 5min idle timeout)
   - One pool per tenant, keyed by tenant ID
   - Automatic cleanup of unused connections

**Critical Rule**: Middleware ONLY passes the domain. API routes do the actual tenant lookup.

### Critical Implementation Rules

**1. NO PRISMA IN EDGE RUNTIME** - Middleware runs in Edge runtime, cannot use Prisma directly:
```typescript
// ✅ CORRECT - Middleware just passes domain header
export async function middleware(request: NextRequest) {
  const domain = extractDomain(request);
  requestHeaders.set('x-tenant-domain', domain);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

// ❌ WRONG - Don't call database in middleware
const tenant = await getTenantByDomain(domain); // Prisma error!
```

**2. Tenant Context in API Routes** - Always resolve tenant in Node.js runtime:
```typescript
// ✅ CORRECT - Full tenant resolution flow
import { requireTenant, requireTenantDb } from '@/lib/tenant-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  // Step 1: Get tenant from domain (queries master DB)
  const tenant = await requireTenant(request); // Throws 404 if not found
  
  // Step 2: Get tenant's database connection (from pool)
  const tenantDb = await requireTenantDb(tenant); // Throws if connection fails
  
  // Step 3: Query isolated tenant database
  const user = await tenantDb.user.findUnique({ 
    where: { email: 'test@example.com' } 
  });
  
  return NextResponse.json({ user });
}

// ❌ WRONG - Don't expect tenant headers to be set by middleware
const tenantId = request.headers.get('x-tenant-id'); // Doesn't exist!
```

**Flow Explanation**:
- `requireTenant(request)` reads `x-tenant-domain` header → queries master DB → returns tenant record
- `requireTenantDb(tenant)` builds PostgreSQL connection string → gets pooled client
- `tenantDb` is now a Prisma client connected ONLY to that tenant's database
```

**3. Connection Pooling Pattern** - Always use `getTenantDatabase()` from tenant-connector:
```typescript
import { getTenantDatabase } from '@/lib/db/tenant-connector';

// ✅ Reuses pooled connections
const tenantDb = await getTenantDatabase(tenant);

// ❌ Don't create new clients manually
const tenantDb = new PrismaClient({ datasourceUrl: tenant.dbUrl });
```

## Database Schemas

### Master Database (`prisma/schema-master.prisma`)
- **tenants**: Registry of all smoke shop tenants (id, name, slug, custom_domain, db_*, status)
- **admin_users**: Platform administrators (NOT tenant users)
- **tenant_migrations**: Track schema versions per tenant
- **tenant_activity_logs**: Platform-level audit logs

### Tenant Database (`prisma/schema-tenant.prisma`)
- **users**: Store staff/owners (NO organization_id - complete isolation)
- **stores**: Physical locations for the tenant
- **customers**: Tenant's customer database
- **orders**: Sales orders (pickup/delivery)
- **order_items**: Order line items (productId references MongoDB _id as String)
- **pos_transactions**: POS sales records
- **pos_transaction_items**: Transaction line items (productId references MongoDB _id as String)
- **pos_sessions**: Cash drawer sessions

**Key Rule**: Tenant schemas have ZERO cross-tenant fields (no organization_id, no tenant_id). Complete database isolation.

**Products**: Stored in MongoDB (`tenant-{tenantId}` database), NOT in PostgreSQL. Order/transaction items only store productId as string reference.

## API Route Patterns

**Standard Multi-Tenant API Route (PostgreSQL)**:
```typescript
import { requireTenant, requireTenantDb } from '@/lib/tenant-context';

export const dynamic = 'force-dynamic'; // No caching
export const runtime = 'nodejs'; // Required for Prisma

export async function GET(request: NextRequest) {
  try {
    const tenant = await requireTenant(request);
    const tenantDb = await requireTenantDb(tenant);
    
    // Queries automatically isolated to this tenant's database
    const orders = await tenantDb.order.findMany();
    
    return NextResponse.json({ orders });
  } catch (error) {
    if (error.message.includes('not found')) {
      return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
```

**Multi-Tenant API Route with MongoDB Products**:
```typescript
import { requireTenant } from '@/lib/tenant-context';
import { getTenantProductModel } from '@/lib/db/mongodb';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const tenant = await requireTenant(request);
    const TenantProduct = await getTenantProductModel(tenant.id);
    
    // Queries tenant's MongoDB database (tenant-{tenantId})
    const products = await TenantProduct.find({ tenantId: tenant.id });
    
    return NextResponse.json({ products });
  } catch (error) {
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
```

## Authentication Flow

**Login Process**:
1. POST `/api/auth/login` with { email, password }
2. Lookup tenant via `x-tenant-domain` header (from middleware)
3. Query tenant database for user with matching email
4. Verify password with bcrypt
5. Generate JWT with { userId, tenantId, role }
6. Set httpOnly cookie `auth-token`

**Protected Routes**: Check JWT cookie, verify tenant matches domain

## MongoDB Product Catalog

**Purpose**: Shared manufacturer specifications + Tenant-specific product inventory

```typescript
// MASTER CATALOG (smokeshop-catalog database - shared)
// Universal product information from manufacturers
{
  _id: "PUFFCO-PEAK-PRO",
  barcode: "012345678905",
  name: "Puffco Peak Pro",
  manufacturer: "Puffco",
  category: "Vaporizers",
  specifications: { voltage: "3.7V", capacity: "0.5g" },
  wholesalePrice: 300.00,
  suggestedRetailPrice: 399.99,
  images: ["url1", "url2"]
}

// TENANT PRODUCTS (tenant-{tenantId} database - isolated)
// Tenant's inventory with custom pricing and stock levels
{
  _id: ObjectId("..."),
  tenantId: "344613e0-bcda-4917-a883-933eb6691296",
  masterProductId: "PUFFCO-PEAK-PRO", // Links to master catalog
  name: "Puffco Peak Pro",
  barcode: "012345678905",
  costPrice: 280.00,        // What tenant paid supplier
  salePrice: 379.99,        // What tenant charges customer
  stockQuantity: 15,        // Current inventory level
  lowStockThreshold: 5,
  specifications: { voltage: "3.7V", capacity: "0.5g" }, // Copied from master
  isActive: true
}

// TRANSACTIONS (tenant PostgreSQL database)
// OrderItems and PosTransactionItems reference MongoDB productId
{
  id: "uuid",
  orderId: "uuid",
  productId: "ObjectId(...)", // MongoDB _id reference (string)
  name: "Puffco Peak Pro",     // Denormalized for historical record
  price: 379.99,
  quantity: 1
}
```

**Key Principle**: 
- PostgreSQL = Transactional/relational data (orders, payments, customers)
- MongoDB = Product data (flexible attributes, varied specifications)

## Environment Variables (Required)

```bash
# Master Database (Central Registry)
MASTER_DATABASE_URL="postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres"

# MongoDB (Product Catalog)
MONGODB_URI="mongodb+srv://USER:PASS@cluster.mongodb.net/smokeshop-catalog"

# JWT Authentication
JWT_SECRET="your-secret-key"
NEXTAUTH_URL="http://localhost:3000"

# Tenant Databases (for development/testing)
TENANT_1_DATABASE_URL="postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:5432/postgres"
```

## Development Workflows

### Local Development with Test Tenant
```bash
npm run dev  # Starts on port 3000
```
- Localhost automatically maps to `joessmokeshop.local` (see middleware)
- Test credentials: joe@joessmokeshop.com / Password123!
- Master DB: gxgmtgkepikakcfpncyg.supabase.co
- Tenant DB: uxwqhvfbtfrvuvbezrdw.supabase.co

### Database Operations
```bash
# Generate Prisma clients
npx prisma generate --schema=prisma/schema-master.prisma
npx prisma generate --schema=prisma/schema-tenant.prisma

# Run migrations on master
npx prisma migrate dev --schema=prisma/schema-master.prisma

# Run migrations on tenant (manual per tenant)
npx prisma migrate deploy --schema=prisma/schema-tenant.prisma
```

### Adding New Tenants
1. Add tenant record to master database (tenants table)
2. Create new Supabase project for tenant
3. Run tenant schema migrations on new database
4. Create initial admin user in tenant database
5. Configure custom domain DNS → Vercel

## Common Pitfalls to Avoid

1. **DO NOT** call Prisma in middleware (Edge runtime limitation)
2. **DO NOT** create Prisma clients manually (breaks connection pooling)
3. **DO NOT** add tenant_id fields to tenant schemas (defeats isolation)
4. **DO NOT** query master DB for user auth (users stored in tenant DBs)
5. **DO NOT** store product inventory in PostgreSQL (use MongoDB per tenant)
6. **DO NOT** forget `dynamic = 'force-dynamic'` on real-time API routes
7. **DO NOT** use PostgreSQL for product catalog (flexible MongoDB schema needed)
8. **DO NOT** store products in shared MongoDB (each tenant gets own database)

## File Structure

```
src/
├── middleware.ts                 # Domain extraction only
├── lib/
│   ├── tenant-context.ts         # Tenant resolution (Node.js)
│   ├── db/
│   │   ├── master-db.ts          # Master DB client
│   │   ├── tenant-connector.ts   # Connection pooling
│   │   └── mongodb.ts            # Product catalog schemas
│   └── auth.ts                   # JWT helpers
├── app/
│   ├── api/
│   │   ├── auth/                 # Login, register, logout
│   │   ├── tenant/               # Tenant info endpoints
│   │   ├── products/             # Product management
│   │   ├── pos/                  # POS operations
│   │   └── orders/               # Order management
│   ├── login/                    # Login UI
│   └── (dashboard)/              # Tenant dashboard
└── prisma/
    ├── schema-master.prisma      # Tenant registry
    └── schema-tenant.prisma      # Template for tenant DBs
```

## Design Principles

- **Complete Isolation**: Each tenant gets separate database, zero shared tables
- **Performance**: Connection pooling prevents database connection exhaustion
- **Scalability**: Add tenants without code changes, just database provisioning
- **Security**: JWT auth, bcrypt passwords, httpOnly cookies
- **Developer Experience**: Clear separation between platform and tenant contexts

## Testing Checklist

- [ ] Localhost resolves to test tenant (joessmokeshop.local)
- [ ] Login works with test credentials
- [ ] API routes receive tenant context via headers
- [ ] Connection pool reuses database connections
- [ ] No Prisma errors in middleware
- [ ] Tenant data completely isolated (no cross-tenant queries)

---

## 🎯 GitHub Copilot Prompt Template

**Use this prompt when starting work in smokeshop-saas:**

```
I'm building a multi-tenant SaaS platform for smoke shops. Architecture:

Database Isolation:
- Master PostgreSQL: Central tenant registry (@prisma/master-client)
- Tenant PostgreSQL: Separate database per tenant (@prisma/client)
- MongoDB: Shared product catalog (manufacturer specs only, no inventory)

Request Flow:
1. Middleware extracts domain → sets x-tenant-domain header (Edge runtime, no Prisma)
2. API route calls requireTenant(request) → queries master DB for tenant (Node.js)
3. API route calls requireTenantDb(tenant) → gets pooled connection to tenant DB
4. Query tenant's isolated database (complete isolation, no tenant_id fields)

Key Files:
- src/middleware.ts - Domain extraction only
- src/lib/tenant-context.ts - Tenant lookup + connection management
- src/lib/db/master-db.ts - Master DB client
- src/lib/db/tenant-connector.ts - Connection pooling (LRU cache)

Test Locally:
- localhost:3000 maps to joessmokeshop.local
- Login: joe@joessmokeshop.com / Password123!
- Master DB: gxgmtgkepikakcfpncyg.supabase.co
- Tenant 1 DB: uxwqhvfbtfrvuvbezrdw.supabase.co

Follow patterns in src/app/api/auth/login/route.ts for multi-tenant API routes.
```

**Quick Task Prompts:**

**New API endpoint:**
```
Create a multi-tenant API route for [feature]. Use requireTenant(request) to query master DB, then requireTenantDb(tenant) for pooled connection. Follow pattern in src/app/api/auth/login/route.ts
```

**Add database table:**
```
Add [table] to tenant schema (prisma/schema-tenant.prisma). No tenant_id field - complete DB isolation. Include timestamps and proper relations.
```

**Debug tenant resolution:**
```
My API route says "tenant not found". Check: 1) middleware sets x-tenant-domain header, 2) getTenantInfo(request) queries master DB in Node.js runtime, 3) tenant exists in master DB with matching customDomain
```

**Test feature locally:**
```
How do I test [feature] with test tenant? Need joessmokeshop.local domain simulation and joe@joessmokeshop.com login flow.
```
