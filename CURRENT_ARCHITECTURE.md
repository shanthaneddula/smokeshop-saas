# 🏗️ Current Architecture Reference

**Last Updated**: January 6, 2026  
**Status**: ✅ Production Ready

## 📊 Database Architecture

### PostgreSQL (Supabase) - Transactional Data

```
Master DB (gxgmtgkepikakcfpncyg.supabase.co)
├── tenants (registry)
├── admin_users (platform admins)
├── tenant_migrations (schema versions)
└── tenant_activity_logs (audit trail)

Tenant DB (per tenant, e.g., uxwqhvfbtfrvuvbezrdw.supabase.co)
├── users (staff/owners)
├── stores (physical locations)
├── customers (customer database)
├── orders → order_items (productId: String)
├── pos_transactions → pos_transaction_items (productId: String)
└── pos_sessions (cash drawer sessions)
```

### MongoDB (Atlas) - Product Data

```
Master Catalog (smokeshop-catalog database)
├── master_products (manufacturer specs, MSRP, images)
├── master_brands
└── master_categories

Tenant Products (tenant-{slug} databases)
└── products (inventory with tenant pricing/stock)
    Example: tenant-joes-smoke-shop
```

## 🔌 Key Connections

### Tenant Resolution
```typescript
// 1. Middleware extracts domain (Edge runtime)
const domain = request.headers.get('host'); // joessmokeshop.local
headers.set('x-tenant-domain', domain);

// 2. API route resolves tenant (Node.js runtime)
const tenant = await requireTenant(request); // { id, slug, name, ... }

// 3. Connect to tenant PostgreSQL
const tenantDb = await requireTenantDb(tenant);

// 4. Connect to tenant MongoDB
const TenantProduct = await getTenantProductModel(tenant.slug);
```

### Product References
```typescript
// OrderItem / PosTransactionItem (PostgreSQL)
{
  id: "uuid",
  orderId: "uuid",
  productId: "695de219a36b025718c28f47", // MongoDB _id (String)
  name: "Puffco Peak Pro",               // Denormalized
  price: 379.99,
  quantity: 1
}

// Product (MongoDB)
{
  _id: ObjectId("695de219a36b025718c28f47"),
  tenantId: "344613e0...",
  masterProductId: "PUFFCO-PEAK-PRO",
  name: "Puffco Peak Pro",
  salePrice: 379.99,
  stockQuantity: 15
}
```

## 🛣️ API Patterns

### Multi-Tenant PostgreSQL Query
```typescript
export async function GET(request: NextRequest) {
  const tenant = await requireTenant(request);
  const tenantDb = await requireTenantDb(tenant);
  
  const orders = await tenantDb.order.findMany();
  return NextResponse.json({ orders });
}
```

### Multi-Tenant MongoDB Query
```typescript
export async function GET(request: NextRequest) {
  const tenant = await requireTenant(request);
  const TenantProduct = await getTenantProductModel(tenant.slug);
  
  const products = await TenantProduct.find({ tenantId: tenant.id });
  return NextResponse.json({ products });
}
```

## 📁 File Structure

```
src/
├── middleware.ts                    # Domain extraction (Edge)
├── lib/
│   ├── tenant-context.ts           # Tenant resolution (Node)
│   ├── db/
│   │   ├── master-db.ts            # Master PostgreSQL client
│   │   ├── tenant-connector.ts     # Tenant PostgreSQL pooling
│   │   └── mongodb.ts              # MongoDB (master + tenant)
│   └── auth/
│       ├── jwt.ts                  # JWT helpers
│       ├── password.ts             # bcrypt
│       ├── session.ts              # Session management
│       └── platform.ts             # Platform admin auth
└── app/
    ├── api/
    │   ├── auth/                   # Tenant authentication
    │   ├── platform/               # Platform admin APIs
    │   ├── products/               # Product management (MongoDB)
    │   └── tenant/                 # Tenant info
    ├── dashboard/                  # Tenant dashboard
    ├── platform/                   # Platform admin UI
    └── login/                      # Tenant login
```

## 🔐 Authentication

### Tenant Users
- **Database**: Tenant PostgreSQL
- **Token**: `auth-token` cookie (JWT)
- **Payload**: `{ userId, tenantId, role }`
- **Routes**: `/api/auth/*`, `/dashboard/*`

### Platform Admins
- **Database**: Master PostgreSQL
- **Token**: `platform-auth-token` cookie (JWT)
- **Payload**: `{ adminId, role, issuer: 'smokeshop-saas' }`
- **Routes**: `/api/platform/*`, `/platform/*`

## 🎯 Test Credentials

### Tenant User (Joe's Smoke Shop)
- **Email**: joe@joessmokeshop.com
- **Password**: Password123!
- **URL**: http://localhost:3000/login
- **Domain**: joessmokeshop.local

### Platform Admin
- **Email**: shanthaneddula@gmail.com
- **Password**: Admin123!@#
- **URL**: http://localhost:3000/platform/login

## 📦 Environment Variables

```bash
# Master PostgreSQL
MASTER_DATABASE_URL="postgresql://postgres:...@db.gxgmtgkepikakcfpncyg.supabase.co:5432/postgres"

# Tenant PostgreSQL (for testing)
TENANT_1_DATABASE_URL="postgresql://postgres:...@db.uxwqhvfbtfrvuvbezrdw.supabase.co:5432/postgres"

# MongoDB
MONGODB_URI="mongodb+srv://...@cluster0.n6m43gv.mongodb.net/smokeshop-catalog"

# JWT
JWT_SECRET="0d6cef8c-475a-4e20-a851-9ab85a753063"

# Vercel Blob (optional)
BLOB_READ_WRITE_TOKEN="vercel_blob_..."
```

## 🚀 Common Tasks

### Add Product to Inventory
1. Tenant logs in
2. Navigate to Products
3. Click "Add from Catalog"
4. Search for product
5. Set cost/sale price and quantity
6. Product saved to `tenant-{slug}` MongoDB

### Create Order
1. Create order record (PostgreSQL)
2. Add order items with productId (MongoDB _id as string)
3. Denormalize product name/price in order item
4. Product lookup happens at runtime from MongoDB

### POS Transaction
1. Scan barcode
2. Lookup product in MongoDB by barcode
3. Create transaction (PostgreSQL)
4. Add transaction item with productId (MongoDB _id)
5. Update stock in MongoDB

## 🛠️ Development Commands

```bash
# Start dev server
npm run dev

# Generate Prisma clients
npx prisma generate --schema=prisma/schema-master.prisma
npx prisma generate --schema=prisma/schema-tenant.prisma

# Run migrations
npx prisma migrate dev --schema=prisma/schema-master.prisma
# (Tenant migrations applied per tenant manually)

# Check MongoDB connection
# Products saved to: tenant-{tenant.slug}
```

## 📚 Documentation

- [Architecture Refactor](./ARCHITECTURE_REFACTOR_COMPLETE.md) - Full migration details
- [Cleanup Summary](./CLEANUP_SUMMARY.md) - Files removed
- [Copilot Instructions](./.github/copilot-instructions.md) - AI context
- [Product Inventory Flow](./PRODUCT_INVENTORY_FLOW.md) - Product management
- [Next Steps](./NEXT_STEPS.md) - Future features

---

**Key Principle**: PostgreSQL for transactions, MongoDB for products. Complete tenant isolation at database level.
