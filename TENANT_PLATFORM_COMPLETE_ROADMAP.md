# 🏪 Complete Tenant Platform Roadmap

**What Each Smoke Shop Owner Gets After Signup**  
**Reference**: Z SMOKE SHOP (zsmokeshop) - Your Production Template  
**Goal**: Turnkey smoke shop website + admin dashboard + POS system

---

## 🎯 Vision: What Happens After Tenant Signup

```
Tenant Signs Up (via Platform Admin or Self-Service):
├─ Business Name: "Joe's Smoke Shop"
├─ Domain: joessmokeshop.com (custom) or joes.yourplatform.com (subdomain)
├─ Owner: Joe Smith (joe@joessmokeshop.com)
└─ Plan: Pro ($149/mo)

Platform Automatically Provisions (5-10 seconds):
├─ 1. Database created (PostgreSQL + MongoDB)
├─ 2. Initial admin user created
├─ 3. Website goes live at joessmokeshop.com
├─ 4. Welcome email sent with login details
└─ 5. Onboarding checklist activated

Joe Logs In and Gets:
├─ ✅ Complete E-Commerce Website (public-facing)
│   ├─ Homepage with products
│   ├─ Product catalog with search/filters
│   ├─ Shopping cart
│   ├─ Checkout (pickup orders)
│   ├─ Customer accounts
│   └─ Contact/Support pages
│
├─ ✅ Admin Dashboard (joessmokeshop.com/admin)
│   ├─ Product management (add from master catalog)
│   ├─ Order management (pickup orders)
│   ├─ Customer database
│   ├─ Inventory tracking
│   ├─ Business settings
│   ├─ Staff management
│   └─ Reports & analytics
│
└─ ✅ Point of Sale (POS) System (optional add-on)
    ├─ In-store transactions
    ├─ Barcode scanning
    ├─ Cash drawer management
    ├─ Receipt printing
    └─ Daily sales reports
```

---

## 📊 Current State Analysis (Based on zsmokeshop)

### ✅ What Exists in zsmokeshop (Your Template)

**Public Website:**
- ✅ Homepage (`/`)
- ✅ Product catalog (`/shop`)
- ✅ Individual product pages (`/products/[slug]`)
- ✅ Shopping cart (`/cart`)
- ✅ Checkout (pickup orders) (`/checkout`)
- ✅ Order tracking (`/orders/track`)
- ✅ Customer account (`/account`)
- ✅ Locations page (`/locations`)
- ✅ Contact page (`/contact`)
- ✅ Support page (`/support`)

**Admin Dashboard:**
- ✅ Login (`/admin/login`)
- ✅ Dashboard (`/admin/dashboard`)
- ✅ Product management (`/admin/products`)
- ✅ Category management (`/admin/categories`)
- ✅ Order management (`/admin/orders`)
- ✅ User management (`/admin/users`)
- ✅ Settings (`/admin/settings`)
- ✅ Store photos (`/admin/store-photos`)
- ✅ Timesheet (staff hours) (`/admin/timesheet`)
- ✅ Profile (`/admin/profile`)

**Features:**
- ✅ Multi-tenant architecture ready
- ✅ JWT authentication
- ✅ Product activation from master catalog
- ✅ Pickup order system with SMS notifications
- ✅ Redis/KV storage
- ✅ Vercel Blob image storage
- ✅ Adidas-inspired design system

---

## 🚧 What Needs to be Built/Migrated to SaaS Platform

### 🔴 PHASE 1: Core Tenant Infrastructure (CRITICAL)

#### 1.1 Domain & Routing
**Priority**: 🔴 CRITICAL  
**What**: Multi-tenant routing with custom domains

**Current State**: zsmokeshop is single-tenant, smokeshop-saas has middleware but incomplete

**Needed**:
- [ ] **Domain Resolution Middleware** (enhance existing)
  - Detect domain (joessmokeshop.com)
  - Look up tenant in master DB
  - Inject tenant context into all requests
  - Handle subdomain fallback (joes.yourplatform.com)
  
- [ ] **Custom Domain Setup**
  - DNS configuration guide for tenants
  - SSL certificate automation (via Vercel)
  - Domain verification workflow
  - CNAME/A record instructions

- [ ] **Tenant Context Provider**
  - React context for tenant info
  - Server-side tenant resolution
  - Tenant-specific theming/branding

**Files to Create**:
```
src/middleware.ts                        # ✅ Exists, needs enhancement
src/lib/tenant-context.ts                # ✅ Exists
src/contexts/TenantContext.tsx           # ❌ Create (React context)
src/app/api/tenant/verify-domain/route.ts # ❌ Create
```

**Reference**: Z SMOKE SHOP doesn't need this (single tenant)

---

#### 1.2 Tenant Authentication
**Priority**: 🔴 CRITICAL

**What**: Separate auth for each tenant's customers and staff

**Needed**:
- [ ] **Customer Authentication** (public website)
  - Register (`/register`)
  - Login (`/login`)
  - Password reset
  - Email verification
  - OAuth (Google, Facebook) - optional
  
- [ ] **Staff Authentication** (admin dashboard)
  - Admin login (`/admin/login`)
  - Role-based access (owner/manager/staff)
  - Permission system
  - Session management

**Database Schema** (Tenant DB):
```prisma
model User {
  id          String   @id @default(uuid())
  email       String   @unique
  password    String   // bcrypt hashed
  name        String
  phone       String?
  role        UserRole @default(customer)
  isActive    Boolean  @default(true)
  
  // Customer-specific
  addresses   Address[]
  orders      Order[]
  
  // Staff-specific
  storeId     String?
  store       Store?   @relation(fields: [storeId], references: [id])
  
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

enum UserRole {
  customer    // Can place orders
  staff       // Can use POS
  manager     // Can manage products/orders
  owner       // Full access
}
```

**Files to Migrate from zsmokeshop**:
```
src/app/login/page.tsx                   # ✅ Exists in both
src/app/register/page.tsx                # ✅ Exists in saas
src/app/admin/login/page.tsx             # ❌ Need to create in saas
src/lib/auth.ts                          # ✅ Exists in both
src/app/api/auth/*                       # ✅ Exists in saas
```

---

#### 1.3 Initial Onboarding Wizard
**Priority**: 🔴 CRITICAL  
**What**: Help tenant set up their shop after signup

**Onboarding Checklist** (shown on first login):
```
Welcome to Your Smoke Shop! 🎉
Complete these steps to get started:

□ 1. Customize Your Shop Settings
   - Business name
   - Logo upload
   - Contact information
   - Store hours
   
□ 2. Add Your First Products (from catalog)
   - Browse master catalog
   - Activate 10-20 products
   - Set your pricing
   
□ 3. Set Up Store Location(s)
   - Add physical address
   - Set timezone
   - Add phone number
   
□ 4. Configure Pickup Orders
   - Enable pickup orders
   - Set pickup instructions
   - Add Twilio for SMS (optional)
   
□ 5. Invite Your Staff
   - Add staff members
   - Assign roles
   - Send invitations
   
□ 6. Test Your Website
   - Visit joessmokeshop.com
   - Place a test order
   - Verify everything works

🎯 Progress: 2/6 Complete (33%)
```

**Files to Create**:
```
src/app/dashboard/onboarding/page.tsx
src/components/dashboard/OnboardingChecklist.tsx
src/app/api/tenant/onboarding/route.ts   # Track progress
```

---

### 🔴 PHASE 2: Public Website (Customer-Facing)

#### 2.1 Homepage & Navigation
**Priority**: 🔴 CRITICAL  
**Reference**: [zsmokeshop/src/app/page.tsx](file:///Users/shanthaneddula/Desktop/zsmokeshop/src/app/page.tsx)

**Features**:
- [ ] **Homepage Components**
  - Hero section with shop branding
  - Featured products carousel
  - Category showcase
  - Promotional banner
  - Store information (hours, locations)
  - Customer testimonials
  
- [ ] **Navigation**
  - Top header (logo, search, cart, account)
  - Category menu (desktop)
  - Mobile hamburger menu
  - Footer (links, contact, social media)

**Files to Migrate**:
```
src/app/page.tsx                         # Homepage
src/components/layout/Header.tsx         # ✅ Exists in zsmokeshop
src/components/layout/Footer.tsx         # ❌ Create
src/components/layout/MobileMenu.tsx     # ❌ Create
```

---

#### 2.2 Product Catalog & Shop
**Priority**: 🔴 CRITICAL  
**Reference**: zsmokeshop `/shop` and `/products/[slug]`

**Features**:
- [ ] **Product Listing Page** (`/shop`)
  - Grid/list view toggle
  - Category filters (sidebar)
  - Price range filter
  - Brand filter
  - Search functionality
  - Sort options (price, name, newest)
  - Pagination
  - "Out of Stock" indicators
  
- [ ] **Product Detail Page** (`/products/[slug]`)
  - Product images (gallery with zoom)
  - Product name, brand, SKU
  - Price (sale price + MSRP comparison)
  - Stock status
  - Product description
  - Add to cart button
  - Quantity selector
  - Related products
  - Product reviews (future)
  
- [ ] **Search Functionality**
  - Real-time search (as you type)
  - Search by name, brand, category
  - Search suggestions
  - "No results" handling

**Database Queries** (MongoDB - Tenant Database):
```typescript
// Product listing with filters
const products = await TenantProduct.find({
  tenantId: tenant.id,
  isActive: true,
  category: { $in: selectedCategories },
  salePrice: { $gte: minPrice, $lte: maxPrice },
  brand: { $in: selectedBrands },
}).sort({ [sortBy]: sortOrder });

// Product detail
const product = await TenantProduct.findOne({
  tenantId: tenant.id,
  slug: productSlug,
  isActive: true,
});
```

**Files to Migrate**:
```
src/app/shop/page.tsx                    # Product catalog
src/app/products/[slug]/page.tsx         # Product detail
src/components/shop/ProductCard.tsx      # ✅ Exists in zsmokeshop
src/components/shop/ProductGrid.tsx      # ❌ Create
src/components/shop/ProductFilters.tsx   # ❌ Create
src/components/shop/SearchBar.tsx        # ❌ Create
```

---

#### 2.3 Shopping Cart & Checkout
**Priority**: 🔴 CRITICAL  
**Reference**: zsmokeshop `/cart` and `/checkout`

**Features**:
- [ ] **Shopping Cart** (`/cart`)
  - Cart items list
  - Quantity adjustment (+/-)
  - Remove item
  - Subtotal calculation
  - "Continue shopping" link
  - "Checkout" button
  - Empty cart state
  - Cart persistence (localStorage)
  
- [ ] **Checkout Page** (`/checkout`)
  - Customer information form
    - Name, email, phone
    - Pickup location selection (if multiple stores)
  - Order summary
  - Order notes/special instructions
  - Terms & conditions checkbox
  - "Place Order" button
  - Loading/processing state
  
- [ ] **Order Confirmation**
  - Order number (ZS-XXXXXX format)
  - Order details
  - Pickup instructions
  - SMS notification sent
  - Email confirmation sent
  - "Track Order" link

**Order Flow**:
```
1. Customer adds products to cart
2. Clicks "Checkout"
3. Fills out contact info
4. Submits order
5. Order created in PostgreSQL (tenant DB)
   - Order record with customer info
   - Order items linked to products (MongoDB _id as string)
6. SMS sent to customer: "Order received! ZS-123456"
7. SMS sent to store: "New order from John Doe"
8. Admin marks order "confirmed" → SMS: "Your order is confirmed!"
9. Admin marks order "ready" (1hr timer) → SMS: "Your order is ready!"
10. Customer picks up → Admin marks "picked-up"
```

**Files to Migrate**:
```
src/app/cart/page.tsx                    # ✅ Exists in zsmokeshop
src/app/checkout/page.tsx                # ✅ Exists in zsmokeshop
src/contexts/CartContext.tsx             # ✅ Exists in zsmokeshop
src/lib/twilio-service.ts                # ✅ Exists in zsmokeshop
src/app/api/orders/create/route.ts       # ❌ Create in saas
```

---

#### 2.4 Customer Account
**Priority**: 🟡 HIGH  
**Reference**: zsmokeshop `/account`

**Features**:
- [ ] **Account Dashboard** (`/account`)
  - Welcome message
  - Order history
  - Account settings link
  - Logout button
  
- [ ] **Order History** (`/account/orders`)
  - List all past orders
  - Order status (pending/ready/picked-up)
  - Reorder button
  - Order details link
  
- [ ] **Profile Settings** (`/account/profile`)
  - Update name, email, phone
  - Change password
  - Email preferences
  - Delete account

**Files to Migrate**:
```
src/app/account/page.tsx                 # ✅ Exists in zsmokeshop
src/app/account/orders/page.tsx          # ❌ Create
src/app/account/profile/page.tsx         # ❌ Create
```

---

#### 2.5 Additional Pages
**Priority**: 🟢 MEDIUM

- [ ] **Order Tracking** (`/orders/track`)
  - Enter order number
  - Show order status
  - Estimated pickup time
  
- [ ] **Locations** (`/locations`)
  - Store addresses with maps
  - Store hours
  - Phone numbers
  - Directions link
  
- [ ] **Contact** (`/contact`)
  - Contact form
  - Store information
  - Social media links
  
- [ ] **Support/FAQ** (`/support`)
  - Common questions
  - Policies (returns, refunds)
  - Contact options

**Files to Migrate**:
```
src/app/orders/track/page.tsx            # ✅ Exists in zsmokeshop
src/app/locations/page.tsx               # ✅ Exists in zsmokeshop
src/app/contact/page.tsx                 # ✅ Exists in zsmokeshop
src/app/support/page.tsx                 # ✅ Exists in zsmokeshop
```

---

### 🟡 PHASE 3: Tenant Admin Dashboard

#### 3.1 Dashboard Overview
**Priority**: 🔴 CRITICAL  
**Reference**: zsmokeshop `/admin/dashboard`

**Features**:
- [ ] **Key Metrics Cards**
  - Total orders (today, this week, this month)
  - Revenue (today, this week, this month)
  - Active products count
  - Low stock alerts
  - Pending orders count
  
- [ ] **Recent Orders List**
  - Last 10 orders
  - Customer name, items, total
  - Status indicators
  - Quick actions (view, update status)
  
- [ ] **Charts**
  - Daily sales (line chart - last 30 days)
  - Top products (bar chart)
  - Sales by category (pie chart)
  
- [ ] **Quick Actions**
  - Add product
  - View pending orders
  - Manage inventory
  - View reports

**Files to Migrate**:
```
src/app/dashboard/page.tsx               # ⚠️ Exists but basic
src/components/dashboard/MetricCard.tsx  # ❌ Create
src/components/dashboard/RecentOrders.tsx # ❌ Create
src/components/dashboard/SalesChart.tsx  # ❌ Create
```

---

#### 3.2 Product Management
**Priority**: 🔴 CRITICAL  
**Reference**: zsmokeshop `/admin/products`

**Features**:
- [ ] **Product List**
  - All activated products
  - Search & filters
  - Sort options
  - Bulk actions (activate/deactivate, update pricing)
  - Stock quantity visible
  - Quick edit inline
  
- [ ] **Add Product from Catalog**
  - Browse master catalog
  - Search master products
  - Filter by brand/category
  - Preview product details
  - Set cost price & sale price
  - Set initial stock quantity
  - Activate product
  
- [ ] **Edit Product**
  - Update pricing (cost, sale, MSRP)
  - Update stock quantity
  - Toggle active status
  - Add product notes
  - Update images (optional override)
  
- [ ] **Bulk Import**
  - CSV upload
  - Barcode scanning
  - Bulk pricing updates

**Database Flow**:
```typescript
// When tenant activates a product from master catalog:
1. Fetch from master catalog (MongoDB - master_products)
2. Create tenant product (MongoDB - tenant-{slug}/products):
   {
     tenantId: "abc123",
     masterProductId: "PUFFCO-PEAK-PRO",
     name: "Puffco Peak Pro",  // Copy from master
     images: [...],            // Copy from master
     barcode: "123456789",     // Copy from master
     
     // Tenant-specific pricing:
     costPrice: 300.00,        // What tenant pays
     salePrice: 379.99,        // What customer pays
     msrp: 399.99,             // From master catalog
     
     // Tenant-specific inventory:
     stockQuantity: 10,
     lowStockThreshold: 2,
     
     isActive: true,
   }
```

**Files to Migrate**:
```
src/app/dashboard/products/page.tsx      # ⚠️ Exists
src/app/dashboard/products/add/page.tsx  # ❌ Create
src/app/dashboard/products/[id]/page.tsx # ❌ Create
src/components/dashboard/ProductTable.tsx # ❌ Create
src/components/catalog/MasterCatalogBrowser.tsx # ❌ Create
```

---

#### 3.3 Order Management
**Priority**: 🔴 CRITICAL  
**Reference**: zsmokeshop `/admin/orders`

**Features**:
- [ ] **Order List**
  - Filter by status (pending/confirmed/ready/picked-up/no-show)
  - Filter by date range
  - Search by order number, customer name
  - Sort by date, total
  - Quick status update
  
- [ ] **Order Detail View**
  - Customer information
  - Order items with images
  - Subtotal, taxes (if applicable), total
  - Order notes
  - Status timeline
  - Actions: Confirm, Mark Ready, Mark Picked Up, Cancel
  
- [ ] **Status Updates**
  - Pending → Confirmed (send SMS)
  - Confirmed → Ready (send SMS, start 1hr timer)
  - Ready → Picked Up
  - Ready → No Show (after timer expires)
  - Cancel order (with reason)
  
- [ ] **Notifications**
  - SMS to customer on status change
  - SMS to store on new order
  - Email confirmations

**Order Statuses**:
```typescript
enum OrderStatus {
  pending      // Just created
  confirmed    // Store confirmed
  ready        // Ready for pickup (1hr timer)
  picked_up    // Customer picked up
  no_show      // Customer didn't show up (after 1hr)
  cancelled    // Cancelled by store/customer
}
```

**Files to Migrate**:
```
src/app/admin/orders/page.tsx            # ✅ Exists in zsmokeshop
src/app/admin/orders/[id]/page.tsx       # ❌ Create
src/components/admin/OrderTable.tsx      # ❌ Create
src/components/admin/OrderStatusBadge.tsx # ❌ Create
src/app/api/orders/[id]/status/route.ts  # ❌ Create
```

---

#### 3.4 Inventory Management
**Priority**: 🟡 HIGH

**Features**:
- [ ] **Stock Overview**
  - All products with stock levels
  - Low stock alerts (< threshold)
  - Out of stock products
  - Filter by category/brand
  
- [ ] **Stock Adjustments**
  - Update stock quantity
  - Reason for adjustment (sale, damage, restock)
  - Stock history log
  
- [ ] **Restock Alerts**
  - Email/SMS when product below threshold
  - Suggested reorder quantity
  - Reorder from supplier (future)

**Files to Create**:
```
src/app/dashboard/inventory/page.tsx
src/components/dashboard/StockTable.tsx
src/app/api/inventory/adjust/route.ts
```

---

#### 3.5 Customer Management
**Priority**: 🟢 MEDIUM

**Features**:
- [ ] **Customer List**
  - All registered customers
  - Search by name, email, phone
  - Sort by signup date, order count
  - View customer details
  
- [ ] **Customer Detail View**
  - Contact information
  - Order history
  - Total spent
  - Last order date
  - Notes about customer
  
- [ ] **Customer Actions**
  - Send email
  - Send SMS
  - Add notes
  - Block/unblock customer

**Files to Create**:
```
src/app/dashboard/customers/page.tsx
src/app/dashboard/customers/[id]/page.tsx
src/components/dashboard/CustomerTable.tsx
```

---

#### 3.6 Business Settings
**Priority**: 🟡 HIGH  
**Reference**: zsmokeshop `/admin/settings`

**Features**:
- [ ] **General Settings**
  - Shop name
  - Logo upload
  - Tagline/description
  - Timezone
  - Currency
  
- [ ] **Store Information**
  - Physical address(es)
  - Phone number(s)
  - Email
  - Store hours (per location)
  
- [ ] **Order Settings**
  - Enable/disable online orders
  - Pickup instructions
  - Order notification settings
  - SMS templates
  
- [ ] **Notification Settings**
  - Twilio credentials (SMS)
  - Resend credentials (Email)
  - Notification preferences
  
- [ ] **Branding** (if white-label plan)
  - Custom colors
  - Custom fonts
  - Remove "Powered by" footer

**Files to Migrate**:
```
src/app/admin/settings/page.tsx          # ✅ Exists in zsmokeshop
src/components/admin/SettingsForm.tsx    # ❌ Create
src/app/api/tenant/settings/route.ts     # ❌ Create
```

---

#### 3.7 Staff Management
**Priority**: 🟢 MEDIUM  
**Reference**: zsmokeshop `/admin/users`

**Features**:
- [ ] **Staff List**
  - All staff members
  - Role (owner/manager/staff)
  - Status (active/inactive)
  - Last login
  
- [ ] **Add Staff**
  - Email invitation
  - Assign role
  - Set permissions
  - Send welcome email
  
- [ ] **Edit Staff**
  - Change role
  - Update permissions
  - Deactivate/reactivate
  - Reset password

**Permissions by Role**:
```typescript
const permissions = {
  owner: [
    'products:*',
    'orders:*',
    'customers:*',
    'staff:*',
    'settings:*',
    'reports:*',
  ],
  manager: [
    'products:read', 'products:write',
    'orders:*',
    'customers:read',
    'reports:read',
  ],
  staff: [
    'products:read',
    'orders:read', 'orders:update_status',
    'customers:read',
  ],
};
```

**Files to Migrate**:
```
src/app/admin/users/page.tsx             # ✅ Exists in zsmokeshop
src/app/admin/users/[id]/page.tsx        # ❌ Create
src/components/admin/StaffTable.tsx      # ❌ Create
```

---

#### 3.8 Reports & Analytics
**Priority**: 🟢 MEDIUM

**Features**:
- [ ] **Sales Reports**
  - Daily sales summary
  - Weekly sales summary
  - Monthly sales summary
  - Sales by category
  - Sales by product
  - Sales by hour (peak times)
  
- [ ] **Product Reports**
  - Best sellers
  - Slow movers
  - Stock value
  - Profit margins
  
- [ ] **Customer Reports**
  - New customers
  - Repeat customers
  - Customer lifetime value
  
- [ ] **Export Options**
  - Download as PDF
  - Download as CSV
  - Email report
  - Scheduled reports (future)

**Files to Create**:
```
src/app/dashboard/reports/page.tsx
src/app/dashboard/reports/sales/page.tsx
src/app/dashboard/reports/products/page.tsx
src/components/dashboard/ReportChart.tsx
src/app/api/reports/sales/route.ts
```

---

### 🟢 PHASE 4: Point of Sale (POS) System (Optional)

#### 4.1 POS Interface
**Priority**: 🟢 MEDIUM (Add-on feature)

**Features**:
- [ ] **Product Search**
  - Barcode scanner integration
  - Quick search by name/SKU
  - Category browse
  - Recently sold items
  
- [ ] **Cart/Register**
  - Add items to transaction
  - Quantity adjustment
  - Remove items
  - Apply discounts
  - Calculate tax (if applicable)
  - Split payment (cash + card)
  
- [ ] **Checkout**
  - Payment method selection (cash/card)
  - Cash tendered / change calculation
  - Print receipt
  - Email receipt
  - SMS receipt
  
- [ ] **Customer Lookup**
  - Search existing customer
  - Add new customer
  - Apply customer loyalty/discounts

**POS Session Flow**:
```typescript
1. Staff opens POS session (records starting cash)
2. Staff processes transactions
   - Scan/search products
   - Add to cart
   - Collect payment
   - Print receipt
   - Update inventory (decrement stock)
3. Staff closes POS session (cash out)
   - Count ending cash
   - System calculates expected vs actual
   - Generate session report
```

**Database Schema**:
```prisma
model POSSession {
  id            String   @id @default(uuid())
  tenantId      String
  storeId       String
  userId        String   // Staff member
  
  openedAt      DateTime @default(now())
  closedAt      DateTime?
  
  startingCash  Decimal  // Opening cash drawer
  endingCash    Decimal? // Closing cash count
  expectedCash  Decimal? // System calculated
  variance      Decimal? // Difference
  
  transactions  POSTransaction[]
  
  status        SessionStatus @default(open)
}

model POSTransaction {
  id            String   @id @default(uuid())
  tenantId      String
  sessionId     String
  session       POSSession @relation(fields: [sessionId], references: [id])
  
  customerId    String?
  customer      User?    @relation(fields: [customerId], references: [id])
  
  subtotal      Decimal
  tax           Decimal  @default(0)
  discount      Decimal  @default(0)
  total         Decimal
  
  paymentMethod PaymentMethod
  cashTendered  Decimal? // If cash payment
  change        Decimal? // If cash payment
  
  items         POSTransactionItem[]
  
  createdAt     DateTime @default(now())
}

model POSTransactionItem {
  id            String   @id @default(uuid())
  transactionId String
  transaction   POSTransaction @relation(fields: [transactionId], references: [id])
  
  productId     String   // MongoDB _id
  name          String   // Denormalized
  sku           String
  price         Decimal
  quantity      Int
  subtotal      Decimal
}

enum PaymentMethod {
  cash
  card
  digital_wallet
}

enum SessionStatus {
  open
  closed
}
```

**Files to Create**:
```
src/app/pos/page.tsx                     # POS main interface
src/app/pos/sessions/page.tsx            # Session management
src/components/pos/POSCart.tsx           # Shopping cart
src/components/pos/ProductSearch.tsx     # Product lookup
src/components/pos/PaymentModal.tsx      # Checkout modal
src/app/api/pos/sessions/route.ts        # Session CRUD
src/app/api/pos/transactions/route.ts    # Transaction CRUD
```

---

### 🔵 PHASE 5: Advanced Features (Future)

#### 5.1 Product Reviews & Ratings
**Priority**: 🔵 FUTURE

- [ ] Customer reviews
- [ ] Star ratings
- [ ] Review moderation
- [ ] Response to reviews

#### 5.2 Loyalty Program
**Priority**: 🔵 FUTURE

- [ ] Points system
- [ ] Rewards redemption
- [ ] Customer tiers
- [ ] Exclusive deals

#### 5.3 Email Marketing
**Priority**: 🔵 FUTURE

- [ ] Newsletter signup
- [ ] Promotional emails
- [ ] Abandoned cart emails
- [ ] Customer segmentation

#### 5.4 Age Verification
**Priority**: 🔵 FUTURE (Regulatory compliance)

- [ ] Age gate on homepage
- [ ] ID verification (in-store)
- [ ] Compliance reporting

#### 5.5 Multi-Location Management
**Priority**: 🔵 FUTURE (Enterprise plans)

- [ ] Per-location inventory
- [ ] Per-location staff
- [ ] Transfer stock between locations
- [ ] Consolidated reporting

---

## 📋 Migration Checklist (zsmokeshop → smokeshop-saas)

### Phase 1: Copy Core Files
- [ ] Copy all `/app` routes from zsmokeshop
- [ ] Copy all `/components` from zsmokeshop
- [ ] Copy all `/lib` utilities from zsmokeshop
- [ ] Copy all `/contexts` from zsmokeshop
- [ ] Update imports to use tenant context

### Phase 2: Adapt for Multi-Tenancy
- [ ] Wrap all pages with tenant context provider
- [ ] Update all API routes to use tenant DB
- [ ] Update all MongoDB queries to filter by tenantId
- [ ] Add tenant domain resolution
- [ ] Test with multiple tenant domains

### Phase 3: Branding & Theming
- [ ] Create tenant settings table
- [ ] Allow logo upload per tenant
- [ ] Allow color customization per tenant
- [ ] Dynamic theme based on tenant settings
- [ ] White-label option (remove "Powered by")

### Phase 4: Testing
- [ ] Test product activation flow
- [ ] Test order creation flow
- [ ] Test SMS notifications
- [ ] Test domain routing
- [ ] Test authentication (customer + staff)
- [ ] Test POS system (if applicable)

---

## 🎨 Design System (Adidas-Inspired)

**Already Defined in zsmokeshop:**
- Uppercase text, tracking-wide
- Sharp rectangular borders (rounded-none)
- Black/white contrast
- Minimal color usage
- Clean spacing
- Chevron indicators

**Apply to SaaS Platform:**
- Maintain same aesthetic across all tenant sites
- Allow theme customization (colors only)
- Keep typography consistent

---

## 📊 Success Metrics (Per Tenant)

Track these for each tenant:

**Activation Metrics**:
- Products activated from catalog
- Orders placed
- Customers registered
- Staff members added

**Engagement Metrics**:
- Daily active users (staff logging in)
- Orders per day/week/month
- Average order value
- Customer retention rate

**Business Metrics**:
- Revenue (orders × average order value)
- Inventory turnover
- Most popular products
- Peak sales hours

---

## 🚀 Quick Start Priorities

**Week 1: Domain & Authentication**
- Set up tenant domain routing
- Migrate authentication system
- Test multi-tenant context

**Week 2: Public Website**
- Migrate homepage, shop, product pages
- Set up shopping cart
- Implement checkout flow

**Week 3: Admin Dashboard**
- Migrate product management
- Migrate order management
- Set up dashboard overview

**Week 4: Testing & Polish**
- End-to-end testing
- Bug fixes
- Performance optimization
- Documentation

---

## 💡 Key Insights

1. **You Already Have Everything**: zsmokeshop is a complete template - just adapt for multi-tenancy
2. **Domain Routing is Key**: Once you solve domain → tenant lookup, everything else follows
3. **Tenant Context Everywhere**: Every request needs tenant context (middleware + React context)
4. **Product Activation is Core**: Tenants don't create products from scratch - they activate from master catalog
5. **POS is Optional**: Focus on online orders first, add POS later as premium feature

---

## 🎯 MVP Definition (Tenant Side)

**Must Have for Launch**:
- ✅ Custom domain support
- ✅ Public product catalog
- ✅ Shopping cart + checkout
- ✅ Order management (admin)
- ✅ Product activation (from master catalog)
- ✅ Basic inventory tracking
- ✅ SMS notifications

**Can Wait**:
- ⏸️ POS system
- ⏸️ Advanced analytics
- ⏸️ Customer reviews
- ⏸️ Loyalty program
- ⏸️ Multi-location

---

## 📚 Documentation Structure

Create these guides for tenants:

1. **Getting Started Guide** - First steps after signup
2. **Product Management Guide** - How to add products from catalog
3. **Order Management Guide** - How to process pickup orders
4. **Settings Guide** - Customize shop settings
5. **Staff Management Guide** - Add and manage staff
6. **Domain Setup Guide** - Connect custom domain
7. **POS Guide** - Use POS system (if applicable)

---

**Next Step**: Start with domain routing and tenant context. Once that works, copy zsmokeshop files and adapt for multi-tenancy. You're 70% there! 🚀
