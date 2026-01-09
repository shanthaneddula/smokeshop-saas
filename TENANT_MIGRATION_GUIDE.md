# 🔧 Tenant Platform Migration Guide

**Goal**: Copy Z SMOKE SHOP (zsmokeshop) features into SaaS platform (smokeshop-saas)  
**Challenge**: Convert single-tenant to multi-tenant architecture  
**Timeline**: 4 weeks

---

## 🎯 Overview: What You're Doing

```
BEFORE (Current State):
┌─────────────────────────┐
│ zsmokeshop              │
│ (Single Tenant)         │
├─────────────────────────┤
│ • Complete website ✓    │
│ • Admin dashboard ✓     │
│ • Works perfectly ✓     │
│ • ONE smoke shop only   │
└─────────────────────────┘

AFTER (Target State):
┌─────────────────────────────────────────┐
│ smokeshop-saas (Multi-Tenant Platform) │
├─────────────────────────────────────────┤
│ Joe's Shop  ┃ Mike's Shop ┃ Austin Shop│
│ joes.com    ┃ mikes.com   ┃ austin.com │
│             ┃             ┃            │
│ Same code, different domains & data     │
└─────────────────────────────────────────┘
```

**Key Principle**: Every request resolves to a tenant, every query filters by tenantId

---

## 🗺️ Migration Strategy

### Step 1: Copy Files (No Changes Yet)
Copy everything from zsmokeshop → smokeshop-saas

### Step 2: Add Tenant Context
Wrap all code with tenant resolution logic

### Step 3: Update Database Queries
Add tenantId filter to all queries

### Step 4: Test with Multiple Domains
Verify isolation between tenants

---

## 📋 Week 1: Foundation & Domain Routing

### Day 1: Copy Core Structure

**Task**: Copy all files from zsmokeshop to smokeshop-saas

```bash
# Run from /Users/shanthaneddula/Desktop/

# Copy public website pages
cp -r zsmokeshop/src/app/page.tsx smokeshop-saas/src/app/
cp -r zsmokeshop/src/app/shop smokeshop-saas/src/app/
cp -r zsmokeshop/src/app/products smokeshop-saas/src/app/
cp -r zsmokeshop/src/app/cart smokeshop-saas/src/app/
cp -r zsmokeshop/src/app/checkout smokeshop-saas/src/app/
cp -r zsmokeshop/src/app/orders smokeshop-saas/src/app/
cp -r zsmokeshop/src/app/account smokeshop-saas/src/app/
cp -r zsmokeshop/src/app/locations smokeshop-saas/src/app/
cp -r zsmokeshop/src/app/contact smokeshop-saas/src/app/
cp -r zsmokeshop/src/app/support smokeshop-saas/src/app/

# Copy admin dashboard (rename to /dashboard to avoid conflict)
cp -r zsmokeshop/src/app/admin smokeshop-saas/src/app/dashboard-copy

# Copy components
cp -r zsmokeshop/src/components/layout smokeshop-saas/src/components/
cp -r zsmokeshop/src/components/shop smokeshop-saas/src/components/
cp -r zsmokeshop/src/components/checkout smokeshop-saas/src/components/
cp -r zsmokeshop/src/components/admin smokeshop-saas/src/components/tenant-admin

# Copy contexts
cp zsmokeshop/src/contexts/CartContext.tsx smokeshop-saas/src/contexts/
cp zsmokeshop/src/contexts/BannerContext.tsx smokeshop-saas/src/contexts/

# Copy utilities
cp -r zsmokeshop/src/lib/order-storage-service.ts smokeshop-saas/src/lib/
cp -r zsmokeshop/src/lib/twilio-service.ts smokeshop-saas/src/lib/

# Copy API routes (will need heavy modification)
cp -r zsmokeshop/src/app/api/orders smokeshop-saas/src/app/api/
cp -r zsmokeshop/src/app/api/shop smokeshop-saas/src/app/api/
```

**Note**: Don't copy `admin` API routes yet - they conflict with platform admin

---

### Day 2: Enhance Middleware for Domain Routing

**File**: `src/middleware.ts`

The middleware already exists but needs enhancement:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getTenantByDomain } from '@/lib/db/master-db';

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';
  const pathname = request.nextUrl.pathname;

  // Skip platform admin routes
  if (pathname.startsWith('/platform')) {
    return NextResponse.next();
  }

  // Extract domain
  let domain = hostname;
  
  // Handle localhost → subdomain mapping for testing
  if (hostname.includes('localhost')) {
    // localhost:3000 → default tenant
    // joes.localhost:3000 → "joes" tenant
    const subdomain = hostname.split('.')[0];
    if (subdomain !== 'localhost') {
      domain = `${subdomain}.yourplatform.com`;
    } else {
      domain = 'default.yourplatform.com'; // Default test tenant
    }
  }

  // Look up tenant by domain
  const tenant = await getTenantByDomain(domain);

  if (!tenant) {
    // Domain not registered
    return new NextResponse('Shop not found. This domain is not registered.', {
      status: 404,
    });
  }

  if (tenant.status === 'suspended') {
    // Tenant suspended (payment issue)
    return new NextResponse('This shop is temporarily unavailable.', {
      status: 403,
    });
  }

  // Inject tenant context into request headers
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-tenant-id', tenant.id);
  requestHeaders.set('x-tenant-slug', tenant.slug);
  requestHeaders.set('x-tenant-name', tenant.name);
  requestHeaders.set('x-tenant-domain', tenant.domain);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - /platform/* (platform admin)
     * - /_next/* (Next.js internals)
     * - /api/platform/* (platform admin API)
     * - Static files
     */
    '/((?!platform|_next/static|_next/image|favicon.ico|api/platform).*)',
  ],
};
```

---

### Day 3: Create Tenant Context Provider

**File**: `src/contexts/TenantContext.tsx`

```typescript
'use client';

import { createContext, useContext, ReactNode } from 'react';

interface TenantInfo {
  id: string;
  slug: string;
  name: string;
  domain: string;
  logo?: string;
  primaryColor?: string;
  settings?: Record<string, any>;
}

const TenantContext = createContext<TenantInfo | null>(null);

export function TenantProvider({
  children,
  tenant,
}: {
  children: ReactNode;
  tenant: TenantInfo;
}) {
  return (
    <TenantContext.Provider value={tenant}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error('useTenant must be used within TenantProvider');
  }
  return context;
}
```

---

### Day 4: Update Root Layout with Tenant Context

**File**: `src/app/layout.tsx`

```typescript
import { headers } from 'next/headers';
import { TenantProvider } from '@/contexts/TenantContext';

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const headersList = headers();
  
  // Get tenant info from middleware
  const tenant = {
    id: headersList.get('x-tenant-id') || '',
    slug: headersList.get('x-tenant-slug') || '',
    name: headersList.get('x-tenant-name') || '',
    domain: headersList.get('x-tenant-domain') || '',
  };

  // If no tenant, this is platform admin access
  if (!tenant.id) {
    return (
      <html lang="en">
        <body>{children}</body>
      </html>
    );
  }

  return (
    <html lang="en">
      <body>
        <TenantProvider tenant={tenant}>
          {children}
        </TenantProvider>
      </body>
    </html>
  );
}
```

---

### Day 5: Test Domain Routing

**Create Test Tenants**:

```sql
-- Run in Master Database (Supabase)
INSERT INTO tenants (id, name, slug, subdomain, domain, status, plan_id)
VALUES
  ('test-joe', 'Joe''s Smoke Shop', 'joes', 'joes', 'joes.localhost', 'active', 'basic'),
  ('test-mike', 'Mike''s Vapes', 'mikes', 'mikes', 'mikes.localhost', 'active', 'pro');
```

**Test URLs**:
- `http://joes.localhost:3000` → Should show "Joe's Smoke Shop"
- `http://mikes.localhost:3000` → Should show "Mike's Vapes"
- `http://unknown.localhost:3000` → Should show 404

**Edit `/etc/hosts` (Mac/Linux)**:
```bash
sudo nano /etc/hosts

# Add:
127.0.0.1 joes.localhost
127.0.0.1 mikes.localhost
```

---

## 📋 Week 2: Public Website Migration

### Day 1: Update Homepage

**File**: `src/app/page.tsx`

```typescript
import { useTenant } from '@/contexts/TenantContext';
import Header from '@/components/layout/Header';
import HeroSection from '@/components/shop/HeroSection';
import FeaturedProducts from '@/components/shop/FeaturedProducts';

export default async function HomePage() {
  // Tenant info available from context
  const { id: tenantId, name: shopName } = await getTenantFromHeaders();
  
  // Fetch featured products for this tenant
  const products = await getTenantProducts(tenantId, { featured: true, limit: 8 });

  return (
    <div>
      <Header shopName={shopName} />
      <HeroSection shopName={shopName} />
      <FeaturedProducts products={products} />
    </div>
  );
}

async function getTenantFromHeaders() {
  const { headers } = await import('next/headers');
  const headersList = headers();
  return {
    id: headersList.get('x-tenant-id') || '',
    name: headersList.get('x-tenant-name') || '',
  };
}

async function getTenantProducts(tenantId: string, filters: any) {
  // Query MongoDB tenant database
  const { getTenantProductModel } = await import('@/lib/db/mongodb');
  const { getTenantBySlug } = await import('@/lib/db/master-db');
  
  // This is pseudocode - adjust based on your actual implementation
  const TenantProduct = await getTenantProductModel('tenant-slug');
  
  return await TenantProduct.find({
    tenantId,
    isActive: true,
    ...filters,
  }).limit(filters.limit || 20);
}
```

**Key Pattern**: Always filter by `tenantId` in database queries

---

### Day 2: Update Product Catalog

**File**: `src/app/shop/page.tsx`

```typescript
import { headers } from 'next/headers';
import ProductGrid from '@/components/shop/ProductGrid';

export default async function ShopPage({
  searchParams,
}: {
  searchParams: { category?: string; brand?: string; search?: string };
}) {
  const headersList = headers();
  const tenantId = headersList.get('x-tenant-id')!;
  const tenantSlug = headersList.get('x-tenant-slug')!;

  // Get tenant products
  const { getTenantProductModel } = await import('@/lib/db/mongodb');
  const TenantProduct = await getTenantProductModel(tenantSlug);
  
  const query: any = {
    tenantId,
    isActive: true,
  };
  
  if (searchParams.category) {
    query.category = searchParams.category;
  }
  
  if (searchParams.brand) {
    query.brand = searchParams.brand;
  }
  
  if (searchParams.search) {
    query.$text = { $search: searchParams.search };
  }
  
  const products = await TenantProduct.find(query)
    .sort({ createdAt: -1 })
    .lean();

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold uppercase tracking-wide mb-8">
        Shop All Products
      </h1>
      <ProductGrid products={products} />
    </div>
  );
}
```

---

### Day 3: Update Shopping Cart & Checkout

**CartContext** already exists but needs tenant awareness:

```typescript
'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { useTenant } from './TenantContext';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const tenant = useTenant();
  const [cart, setCart] = useState<CartItem[]>([]);

  // Load cart from localStorage (tenant-specific key)
  useEffect(() => {
    const savedCart = localStorage.getItem(`cart-${tenant.id}`);
    if (savedCart) {
      setCart(JSON.parse(savedCart));
    }
  }, [tenant.id]);

  // Save cart to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem(`cart-${tenant.id}`, JSON.stringify(cart));
  }, [cart, tenant.id]);

  // ... rest of cart logic
}
```

**Checkout Page**: Update to include tenantId in order creation:

```typescript
// src/app/checkout/page.tsx
async function handleSubmitOrder(formData: any) {
  const response = await fetch('/api/orders/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...formData,
      items: cart,
      // tenantId injected by API route from headers
    }),
  });
  
  // ... handle response
}
```

---

### Day 4: Update Order Creation API

**File**: `src/app/api/orders/create/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { requireTenant, requireTenantDb } from '@/lib/tenant-context';

export async function POST(request: NextRequest) {
  try {
    // Get tenant from middleware headers
    const tenant = await requireTenant(request);
    const tenantDb = await requireTenantDb(tenant);

    const body = await request.json();
    const { customerName, customerEmail, customerPhone, items, notes } = body;

    // Create order in tenant's PostgreSQL database
    const order = await tenantDb.order.create({
      data: {
        orderNumber: generateOrderNumber(), // e.g., "ZS-123456"
        customerName,
        customerEmail,
        customerPhone,
        notes,
        status: 'pending',
        subtotal: calculateSubtotal(items),
        total: calculateTotal(items),
        items: {
          create: items.map((item: any) => ({
            productId: item.productId, // MongoDB _id as string
            name: item.name,
            sku: item.sku,
            price: item.price,
            quantity: item.quantity,
            subtotal: item.price * item.quantity,
          })),
        },
      },
      include: { items: true },
    });

    // Send SMS notifications (Twilio)
    await sendOrderNotifications(tenant, order);

    return NextResponse.json({ success: true, order });
  } catch (error: any) {
    console.error('Order creation error:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

function generateOrderNumber() {
  return `ZS-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
}
```

**Key Changes**:
- Use `requireTenant()` to get tenant from headers
- Use `tenantDb` (tenant's PostgreSQL) for orders
- All SMS/email uses tenant's Twilio/Resend credentials (from settings)

---

### Day 5: Test Public Website

**Test Checklist**:
- [ ] Homepage loads for both tenants
- [ ] Product catalog shows only tenant's products
- [ ] Shopping cart persists per tenant
- [ ] Checkout creates order in correct tenant DB
- [ ] SMS notifications sent to correct phone numbers
- [ ] Order tracking works

---

## 📋 Week 3: Admin Dashboard Migration

### Day 1: Copy Admin Dashboard

**Rename Routes**: In zsmokeshop, admin is `/admin`. In SaaS, use `/dashboard` to avoid conflict with platform admin:

```bash
# Already copied to dashboard-copy, now integrate:
cd /Users/shanthaneddula/Desktop/smokeshop-saas

# Move dashboard-copy to dashboard (merge with existing)
# Carefully merge files to not overwrite existing dashboard
```

**Structure**:
```
src/app/dashboard/
├── page.tsx              # Dashboard overview
├── products/
│   ├── page.tsx          # Product list
│   └── add/page.tsx      # Add from catalog
├── orders/
│   ├── page.tsx          # Order list
│   └── [id]/page.tsx     # Order detail
├── inventory/
│   └── page.tsx          # Stock management
├── customers/
│   ├── page.tsx          # Customer list
│   └── [id]/page.tsx     # Customer detail
├── settings/
│   └── page.tsx          # Business settings
└── users/
    └── page.tsx          # Staff management
```

---

### Day 2: Update Product Management

**File**: `src/app/dashboard/products/page.tsx`

```typescript
import { headers } from 'next/headers';
import ProductTable from '@/components/tenant-admin/ProductTable';

export default async function ProductsPage() {
  const headersList = headers();
  const tenantId = headersList.get('x-tenant-id')!;
  const tenantSlug = headersList.get('x-tenant-slug')!;

  // Fetch tenant's products from MongoDB
  const { getTenantProductModel } = await import('@/lib/db/mongodb');
  const TenantProduct = await getTenantProductModel(tenantSlug);
  
  const products = await TenantProduct.find({ tenantId })
    .sort({ createdAt: -1 })
    .lean();

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold uppercase tracking-wide">
          Products
        </h1>
        <a
          href="/dashboard/products/add"
          className="px-6 py-3 bg-black text-white uppercase tracking-wide"
        >
          Add Product
        </a>
      </div>
      
      <ProductTable products={products} />
    </div>
  );
}
```

**Add Product from Catalog**:

```typescript
// src/app/dashboard/products/add/page.tsx
import MasterCatalogBrowser from '@/components/catalog/MasterCatalogBrowser';

export default function AddProductPage() {
  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold uppercase tracking-wide mb-8">
        Add Product from Catalog
      </h1>
      <MasterCatalogBrowser />
    </div>
  );
}
```

**Activate Product API**:

```typescript
// src/app/api/products/activate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/tenant-context';
import { getMasterProductById } from '@/lib/db/mongodb';

export async function POST(request: NextRequest) {
  const tenant = await requireTenant(request);
  const { masterProductId, costPrice, salePrice, stockQuantity } = await request.json();

  // 1. Fetch product from master catalog
  const masterProduct = await getMasterProductById(masterProductId);
  
  if (!masterProduct) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  // 2. Create tenant product in tenant's MongoDB database
  const { getTenantProductModel } = await import('@/lib/db/mongodb');
  const TenantProduct = await getTenantProductModel(tenant.slug);
  
  const tenantProduct = await TenantProduct.create({
    tenantId: tenant.id,
    masterProductId: masterProduct._id,
    
    // Copy from master
    name: masterProduct.name,
    sku: masterProduct.sku,
    barcode: masterProduct.barcode,
    brand: masterProduct.brand,
    category: masterProduct.category,
    description: masterProduct.description,
    images: masterProduct.images,
    msrp: masterProduct.msrp,
    
    // Tenant-specific
    costPrice,
    salePrice,
    stockQuantity,
    lowStockThreshold: 5,
    isActive: true,
  });

  return NextResponse.json({ success: true, product: tenantProduct });
}
```

---

### Day 3: Update Order Management

**File**: `src/app/dashboard/orders/page.tsx`

```typescript
import { headers } from 'next/headers';
import OrderTable from '@/components/tenant-admin/OrderTable';

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const headersList = headers();
  const tenantId = headersList.get('x-tenant-id')!;
  const tenantSlug = headersList.get('x-tenant-slug')!;

  // Get tenant's PostgreSQL database
  const { getTenantDb } = await import('@/lib/tenant-context');
  const { getTenantBySlug } = await import('@/lib/db/master-db');
  const tenant = await getTenantBySlug(tenantSlug);
  const tenantDb = await getTenantDb(tenant);

  // Fetch orders
  const where: any = {};
  if (searchParams.status) {
    where.status = searchParams.status;
  }

  const orders = await tenantDb.order.findMany({
    where,
    include: { items: true },
    orderBy: { createdAt: 'desc' },
  });

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold uppercase tracking-wide mb-8">
        Orders
      </h1>
      <OrderTable orders={orders} />
    </div>
  );
}
```

**Order Status Update API**:

```typescript
// src/app/api/orders/[id]/status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { requireTenant, requireTenantDb } from '@/lib/tenant-context';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const tenant = await requireTenant(request);
  const tenantDb = await requireTenantDb(tenant);
  const { status } = await request.json();

  // Update order status
  const order = await tenantDb.order.update({
    where: { id: params.id },
    data: { status },
    include: { items: true },
  });

  // Send SMS notification to customer
  await sendStatusUpdateSMS(tenant, order, status);

  return NextResponse.json({ success: true, order });
}
```

---

### Day 4: Settings & Business Configuration

**File**: `src/app/dashboard/settings/page.tsx`

```typescript
import SettingsForm from '@/components/tenant-admin/SettingsForm';

export default async function SettingsPage() {
  const headersList = headers();
  const tenantId = headersList.get('x-tenant-id')!;

  // Fetch tenant settings from master DB
  const { getTenantById } = await import('@/lib/db/master-db');
  const tenant = await getTenantById(tenantId);

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold uppercase tracking-wide mb-8">
        Business Settings
      </h1>
      <SettingsForm tenant={tenant} />
    </div>
  );
}
```

**Settings Stored In**:
- **Master DB** (tenants table): Logo, branding, domain
- **Tenant Metadata**: Twilio credentials, business hours, pickup instructions

---

### Day 5: Test Admin Dashboard

**Test Checklist**:
- [ ] Dashboard shows correct tenant's data
- [ ] Product activation works
- [ ] Order management works
- [ ] Status updates send SMS
- [ ] Settings persist correctly
- [ ] No data leakage between tenants

---

## 📋 Week 4: Polish & Launch

### Day 1: Tenant Onboarding Flow

Create welcome wizard for new tenants:

```typescript
// src/app/dashboard/onboarding/page.tsx
export default function OnboardingPage() {
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">Welcome to Your Smoke Shop! 🎉</h1>
      
      <OnboardingChecklist
        steps={[
          { id: 1, title: 'Customize Settings', completed: false },
          { id: 2, title: 'Add Products', completed: false },
          { id: 3, title: 'Set Up Location', completed: false },
          { id: 4, title: 'Configure Notifications', completed: false },
          { id: 5, title: 'Invite Staff', completed: false },
          { id: 6, title: 'Test Your Website', completed: false },
        ]}
      />
    </div>
  );
}
```

---

### Day 2: Custom Domain Setup Guide

Create documentation for tenants:

```markdown
# Custom Domain Setup

## Step 1: Purchase Domain
Buy a domain from Namecheap, GoDaddy, etc.
Example: joessmokeshop.com

## Step 2: Add CNAME Record
In your domain registrar's DNS settings:

Type: CNAME
Name: www
Value: cname.vercel-dns.com
TTL: 3600

## Step 3: Add A Record
Type: A
Name: @
Value: 76.76.21.21 (Vercel IP)
TTL: 3600

## Step 4: Verify in Dashboard
1. Go to Settings → Domain
2. Enter your domain: joessmokeshop.com
3. Click "Verify"
4. Wait 24-48 hours for DNS propagation

## Step 5: Enable SSL
Vercel automatically provisions SSL certificate
```

---

### Day 3: Performance Optimization

**Caching Strategy**:
- Cache product catalog (revalidate every hour)
- Cache tenant settings (revalidate on change)
- Don't cache orders/cart

**Example**:
```typescript
// src/app/shop/page.tsx
export const revalidate = 3600; // 1 hour

export default async function ShopPage() {
  // ... fetch products
}
```

**Image Optimization**:
- Use Next.js `<Image>` component
- Store images in Vercel Blob
- Set proper width/height

---

### Day 4: Testing & QA

**Test Matrix**:

| Feature | Tenant 1 (Joe's) | Tenant 2 (Mike's) | Isolation Check |
|---------|------------------|-------------------|-----------------|
| Homepage | ✓ | ✓ | Different products |
| Products | ✓ | ✓ | Separate inventories |
| Orders | ✓ | ✓ | No cross-visibility |
| Cart | ✓ | ✓ | Separate carts |
| Admin | ✓ | ✓ | No data leakage |
| SMS | ✓ | ✓ | Correct phone numbers |

---

### Day 5: Documentation & Launch

**Create Guides**:
1. Tenant Getting Started Guide
2. Admin Dashboard Guide
3. Product Management Guide
4. Order Processing Guide
5. Custom Domain Setup Guide

**Launch Checklist**:
- [ ] All features tested
- [ ] Domain routing works
- [ ] Multi-tenancy verified
- [ ] SMS notifications work
- [ ] Documentation complete
- [ ] Error handling in place
- [ ] Analytics tracking setup
- [ ] Support contact available

---

## 🎯 Key Success Factors

1. **Tenant Isolation**: Every query MUST filter by tenantId
2. **Context Everywhere**: Use tenant context in all components
3. **Test with Real Domains**: Use ngrok or Vercel preview for testing
4. **Monitor**: Track errors, slow queries, failed SMS
5. **Backup**: Regular database backups per tenant

---

## 🐛 Common Pitfalls

### ❌ Forgetting tenantId Filter
```typescript
// WRONG - Returns all tenants' products
const products = await TenantProduct.find({ isActive: true });

// CORRECT - Returns only this tenant's products
const products = await TenantProduct.find({
  tenantId: tenant.id,
  isActive: true,
});
```

### ❌ Hardcoded Values
```typescript
// WRONG - Uses same logo for all tenants
<img src="/logo.png" alt="Logo" />

// CORRECT - Uses tenant-specific logo
<img src={tenant.logo || '/default-logo.png'} alt={tenant.name} />
```

### ❌ Shared localStorage Keys
```typescript
// WRONG - Cart shared between tenants
localStorage.setItem('cart', JSON.stringify(cart));

// CORRECT - Separate cart per tenant
localStorage.setItem(`cart-${tenant.id}`, JSON.stringify(cart));
```

---

## 🚀 Next Steps After Migration

1. **Deploy to Vercel**: Test with real subdomains
2. **Connect Custom Domains**: Help first tenant set up their domain
3. **Monitor Performance**: Use Vercel Analytics
4. **Collect Feedback**: Iterate based on tenant feedback
5. **Add POS System**: Build point-of-sale features (optional)

---

**You have everything you need! Start with Week 1 and work systematically. The key is tenant isolation at every level.** 🎉
