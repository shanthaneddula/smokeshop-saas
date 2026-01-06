# 📦 Product Catalog & Inventory Management - Data Flow

**Date:** January 4, 2026

## 🎯 Core Principle

**MongoDB = Product Information Library** (Read-Only for Tenants)  
**PostgreSQL = Operational Inventory** (Tenant Manages Stock)

---

## 🗄️ What Each Database Stores

### MongoDB Master Catalog
```javascript
// Purpose: Central product information library
// Who Owns: YOU (platform owner)
// Tenants: Browse and activate products

{
  _id: "PUFFCO-PEAK-PRO",
  sku: "PUFFCO-PEAK-PRO",
  
  // Product Information
  name: "Puffco Peak Pro",
  description: "Premium smart rig with app control...",
  brand: "Puffco",
  category: "Vaporizers",
  subcategory: "Dab Rigs",
  
  // Media
  images: [
    "https://cdn.example.com/puffco-1.jpg",
    "https://cdn.example.com/puffco-2.jpg"
  ],
  
  // Specifications
  specifications: {
    battery: "2 hour battery life",
    heating_time: "20 seconds",
    temperature_modes: 4,
    warranty: "1 year"
  },
  
  // Suggested Pricing (Reference Only)
  suggested_wholesale_price: 299.99,  // What YOU might charge tenant
  suggested_retail_price: 399.99,      // Suggested customer price
  
  // ❌ NO INVENTORY DATA
  // ❌ NO stock_quantity
  // ❌ NO tenant_id
  // ❌ NO tenant-specific pricing
  
  // Metadata
  is_available: true,       // You control if product is available to activate
  created_at: ISODate("..."),
  updated_at: ISODate("...")
}
```

### Tenant's PostgreSQL Database
```sql
-- Purpose: Operational inventory and sales data
-- Who Owns: TENANT (each shop has their own DB)
-- Tenants: Full control over pricing, inventory, stock

CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Link to Master Catalog (optional, for updates)
  master_product_id VARCHAR(100),  -- "PUFFCO-PEAK-PRO"
  
  -- Product Info (copied from MongoDB at activation)
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  brand VARCHAR(100),
  image_url TEXT,
  
  -- ✅ TENANT CONTROLS PRICING
  cost_price DECIMAL(10, 2),        -- What tenant paid supplier: $280
  sale_price DECIMAL(10, 2) NOT NULL, -- What tenant charges customer: $349.99
  compare_at_price DECIMAL(10, 2),  -- Original price for "sale" display
  
  -- ✅ TENANT MANAGES INVENTORY
  stock_quantity INTEGER DEFAULT 0,           -- Current stock: 5 units
  low_stock_threshold INTEGER DEFAULT 5,      -- Alert when below: 2 units
  
  -- Product Identifiers (tenant sets these)
  sku VARCHAR(100),                  -- Tenant's internal SKU
  barcode VARCHAR(100),              -- Scanned barcode
  
  -- Status
  is_active BOOLEAN DEFAULT true,    -- Can tenant sell this?
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_products_master_id ON products(master_product_id);
CREATE INDEX idx_products_barcode ON products(barcode);
CREATE INDEX idx_products_sku ON products(sku);
```

---

## 🔄 Product Activation Flow

### Step 1: Tenant Browses Master Catalog
```
Route: /catalog
API: GET /api/catalog/products

Request to MongoDB:
db.master_products.find({
  is_available: true,
  category: "Vaporizers"
})

Response:
[
  {
    _id: "PUFFCO-PEAK-PRO",
    name: "Puffco Peak Pro",
    brand: "Puffco",
    images: [...],
    suggested_retail_price: 399.99,
    is_activated: false  // Check if already in tenant DB
  },
  ...
]
```

### Step 2: Click "Activate Product"
```
UI: Modal/Form opens

┌─────────────────────────────────────────────────┐
│  Add Product to Your Inventory                  │
├─────────────────────────────────────────────────┤
│  Product: Puffco Peak Pro                       │
│  Brand: Puffco                                  │
│  [Product Image]                                │
│                                                 │
│  Suggested Retail: $399.99                      │
│                                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                                 │
│  Set Your Pricing:                              │
│  Cost Price:    $ [280.00]                      │
│    (What you paid the supplier)                 │
│                                                 │
│  Sale Price:    $ [349.99]                      │
│    (What customers will pay)                    │
│                                                 │
│  Compare Price: $ [399.99] (optional)           │
│    (Show as "on sale")                          │
│                                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                                 │
│  Set Your Inventory:                            │
│  Initial Quantity: [5] units                    │
│  Low Stock Alert:  [2] units                    │
│                                                 │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━   │
│                                                 │
│  Product Identifiers:                           │
│  SKU:     [STORE-PUFFCO-001] (optional)        │
│  Barcode: [123456789012___] (optional)         │
│                                                 │
│  [Cancel]              [Add to Inventory]      │
└─────────────────────────────────────────────────┘
```

### Step 3: Save to Tenant Database
```javascript
// POST /api/tenant/products/activate

// 1. Get product details from MongoDB
const masterProduct = await mongodb.collection('master_products')
  .findOne({ _id: req.body.masterProductId });

// 2. Insert into tenant's PostgreSQL
const newProduct = await tenantPrisma.product.create({
  data: {
    masterProductId: masterProduct._id,
    
    // Copy from MongoDB
    name: masterProduct.name,
    description: masterProduct.description,
    category: masterProduct.category,
    brand: masterProduct.brand,
    imageUrl: masterProduct.images[0],
    
    // From tenant's form input
    costPrice: req.body.costPrice,        // 280.00
    salePrice: req.body.salePrice,        // 349.99
    compareAtPrice: req.body.compareAtPrice, // 399.99
    stockQuantity: req.body.stockQuantity,  // 5
    lowStockThreshold: req.body.lowStockThreshold, // 2
    sku: req.body.sku,                    // "STORE-PUFFCO-001"
    barcode: req.body.barcode,            // "123456789012"
    isActive: true
  }
});

// 3. Return success
return { success: true, product: newProduct };
```

---

## 📊 Real-World Example

### Scenario: Three Tenants Activate Same Product

**MongoDB has:**
```javascript
{
  _id: "PUFFCO-PEAK-PRO",
  name: "Puffco Peak Pro",
  suggested_retail_price: 399.99,
  // NO inventory
}
```

**Tenant 1 (Joe's Smoke Shop):**
```sql
INSERT INTO products VALUES (
  master_product_id: 'PUFFCO-PEAK-PRO',
  sale_price: 349.99,      -- Joe's price
  stock_quantity: 5,        -- Joe's inventory
  sku: 'JOE-PUFFCO-001'
);
```

**Tenant 2 (Mike's Vapes):**
```sql
INSERT INTO products VALUES (
  master_product_id: 'PUFFCO-PEAK-PRO',
  sale_price: 399.99,      -- Mike's price (higher!)
  stock_quantity: 12,       -- Mike's inventory (more stock)
  sku: 'MIKE-PPP-001'
);
```

**Tenant 3 (Best Smoke):**
```sql
INSERT INTO products VALUES (
  master_product_id: 'PUFFCO-PEAK-PRO',
  sale_price: 379.99,      -- Best Smoke's price
  stock_quantity: 0,        -- Out of stock!
  sku: 'BS-PEAK-PRO'
);
```

**Result:** Same product, 3 completely independent inventories!

---

## 🔄 Ongoing Inventory Management

### Update Stock (After Sale)
```javascript
// POST /api/tenant/products/[id]/adjust-stock

// Customer buys 1 unit
await tenantPrisma.product.update({
  where: { id: productId },
  data: {
    stockQuantity: { decrement: 1 }  // 5 → 4
  }
});

// Check if low stock alert needed
if (product.stockQuantity <= product.lowStockThreshold) {
  // Send notification to tenant
  await sendLowStockAlert(product);
}
```

### Update Pricing
```javascript
// PATCH /api/tenant/products/[id]

await tenantPrisma.product.update({
  where: { id: productId },
  data: {
    salePrice: 329.99,  // Price drop sale!
    compareAtPrice: 399.99  // Show original price
  }
});
```

### Restock Inventory
```javascript
// POST /api/tenant/products/[id]/restock

await tenantPrisma.product.update({
  where: { id: productId },
  data: {
    stockQuantity: { increment: 10 }  // 4 → 14
  }
});
```

---

## 🔄 Syncing Product Updates from Master

**Scenario:** You update product description in MongoDB

**Option 1: Manual Refresh**
```
Tenant clicks "Refresh Product Details" in UI
→ Fetches latest data from MongoDB
→ Updates name, description, images
→ Preserves pricing and inventory
```

**Option 2: Automatic Sync (Future)**
```
Webhook when MongoDB product updated
→ Notify all tenants who have product activated
→ Show "Update Available" badge
→ Tenant approves update
→ Merge new info, keep pricing/inventory
```

**What Gets Updated:**
- ✅ Product name
- ✅ Description
- ✅ Images
- ✅ Specifications
- ❌ Pricing (tenant's custom pricing preserved)
- ❌ Inventory (tenant's stock preserved)

---

## 🎯 Benefits of This Approach

### ✅ Complete Pricing Freedom
- Tenant A: Premium positioning ($399)
- Tenant B: Competitive pricing ($349)
- Tenant C: Budget pricing ($329)

### ✅ Independent Inventory
- No shared stock pool
- Each shop manages own inventory
- No "out of stock" conflicts

### ✅ Centralized Product Info
- You maintain master catalog
- Update once, tenants can sync
- Consistent product data

### ✅ Scalability
- MongoDB handles millions of products
- Each tenant DB only has their active products
- Fast queries, no bloat

---

## 📋 Summary

| Feature | MongoDB Master | Tenant PostgreSQL |
|---------|----------------|-------------------|
| **Product Info** | ✅ Master copy | ✅ Copy at activation |
| **Pricing** | ❌ Suggested only | ✅ Tenant controls |
| **Inventory** | ❌ None | ✅ Tenant manages |
| **Stock Qty** | ❌ None | ✅ Real-time tracking |
| **Updates** | ✅ You update | 🔄 Tenant can sync |
| **Custom SKU** | ❌ None | ✅ Tenant sets |
| **Barcodes** | ❌ None | ✅ Tenant scans |

---

**This is the correct architecture! MongoDB = Library, PostgreSQL = Inventory** ✅
