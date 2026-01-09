import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || '';

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
let cached: MongooseCache = (global as unknown as { mongoose?: MongooseCache }).mongoose || { conn: null, promise: null };

if (!cached) {
  cached = (global as unknown as { mongoose: MongooseCache }).mongoose = { conn: null, promise: null };
}

export async function connectToMongoDB(): Promise<typeof mongoose> {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts);
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}

// ============================================
// MASTER PRODUCT SCHEMA
// ============================================

const masterProductVariantSchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  sku: { type: String, required: true },
  barcode: String,
  wholesalePrice: Number,
  suggestedRetailPrice: Number,
  image: String,
  attributes: mongoose.Schema.Types.Mixed,
});

const masterProductSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true }, // Custom ID like "PUFFCO-PEAK-PRO"
    
    // Product Identification
    sku: { type: String, required: true, unique: true },
    barcode: { type: String, required: true },
    alternateBarcodes: [String],
    
    // Basic Info
    name: { type: String, required: true },
    description: { type: String, required: true },
    shortDescription: String,
    
    // Categorization
    brand: { type: String, required: true, index: true },
    category: { type: String, required: true, index: true },
    subcategory: String,
    tags: [String],
    
    // Pricing (Reference Only)
    wholesalePrice: Number,
    suggestedRetailPrice: Number,
    
    // Media
    images: { type: [String], default: [] },
    primaryImage: String,
    videos: [String],
    
    // Specifications
    specifications: mongoose.Schema.Types.Mixed,
    
    // Variants
    variants: [masterProductVariantSchema],
    
    // Product Details
    weight: Number,
    dimensions: {
      length: Number,
      width: Number,
      height: Number,
      unit: { type: String, enum: ['in', 'cm'] },
    },
    
    // Supplier Info
    supplier: String,
    supplierSku: String,
    
    // Availability
    isAvailable: { type: Boolean, default: true, index: true },
    isActive: { type: Boolean, default: true, index: true },
    isFeatured: { type: Boolean, default: false },
    
    // Compliance
    ageRestricted: { type: Boolean, default: false },
    minimumAge: Number,
    restrictions: [String],
    
    // SEO
    seoTitle: String,
    seoDescription: String,
    keywords: [String],
    
    // Metadata
    metadata: mongoose.Schema.Types.Mixed,
  },
  {
    timestamps: true,
    collection: 'master_products',
  }
);

// Text search index for product search
masterProductSchema.index({
  name: 'text',
  description: 'text',
  brand: 'text',
  tags: 'text',
});

// Compound indexes for filtering
masterProductSchema.index({ brand: 1, category: 1 });
masterProductSchema.index({ isAvailable: 1, isActive: 1 });
masterProductSchema.index({ barcode: 1 });

// ============================================
// TENANT PRODUCT SCHEMA
// Purpose: Tenant's inventory with custom pricing/stock
// Storage: Separate MongoDB database per tenant (tenant-{tenantId})
// ============================================

const tenantProductSchema = new mongoose.Schema(
  {
    // Link to master catalog
    masterProductId: { type: String, index: true }, // Reference to MasterProduct._id (optional)
    
    // Tenant isolation (database-level, but kept for queries)
    tenantId: { type: String, required: true, index: true },
    
    // Product details (copied from catalog, can be customized)
    name: { type: String, required: true },
    slug: { type: String, required: true },
    description: String,
    category: String,
    brand: String,
    
    // Barcode management
    barcode: { type: String, index: true },
    originalBarcode: String, // From manufacturer
    customBarcode: String,   // Tenant's custom sticker
    barcodeType: { type: String, enum: ['upc', 'ean', 'custom'], default: 'upc' },
    
    // SKU (tenant's internal code)
    sku: { type: String, index: true },
    
    // Pricing (tenant controls)
    costPrice: Number,           // What tenant paid
    salePrice: { type: Number, required: true },  // Customer price
    compareAtPrice: Number,      // Original price for sales
    
    // Inventory (tenant manages)
    stockQuantity: { type: Number, required: true, default: 0 },
    trackInventory: { type: Boolean, default: true },
    lowStockThreshold: { type: Number, default: 10 },
    
    // Media
    imageUrl: String,
    images: { type: [String], default: [] },
    
    // Product specifications (flexible)
    specifications: mongoose.Schema.Types.Mixed,
    
    // Status
    isActive: { type: Boolean, default: true, index: true },
    
    // Flexible metadata
    metadata: mongoose.Schema.Types.Mixed,
  },
  {
    timestamps: true,
    collection: 'products',
  }
);

// Indexes for tenant product queries
tenantProductSchema.index({ tenantId: 1, barcode: 1 });
tenantProductSchema.index({ tenantId: 1, sku: 1 });
tenantProductSchema.index({ tenantId: 1, category: 1 });
tenantProductSchema.index({ tenantId: 1, brand: 1 });
tenantProductSchema.index({ tenantId: 1, stockQuantity: 1 });
tenantProductSchema.index({ tenantId: 1, isActive: 1 });

// Text search for tenant products
tenantProductSchema.index({
  name: 'text',
  description: 'text',
  brand: 'text',
});

// ============================================
// MASTER BRAND SCHEMA
// ============================================

const masterBrandSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    slug: { type: String, required: true, unique: true },
    description: String,
    logo: String,
    website: String,
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    collection: 'master_brands',
  }
);

// ============================================
// MASTER CATEGORY SCHEMA
// ============================================

const masterCategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    description: String,
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'MasterCategory' },
    image: String,
    order: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    collection: 'master_categories',
  }
);

// Export models
export const MasterProduct =
  mongoose.models.MasterProduct ||
  mongoose.model('MasterProduct', masterProductSchema);

export const TenantProduct =
  mongoose.models.TenantProduct ||
  mongoose.model('TenantProduct', tenantProductSchema);

export const MasterBrand =
  mongoose.models.MasterBrand ||
  mongoose.model('MasterBrand', masterBrandSchema);

export const MasterCategory =
  mongoose.models.MasterCategory ||
  mongoose.model('MasterCategory', masterCategorySchema);

// ============================================
// TENANT MONGODB CONNECTION
// ============================================

// Cache tenant MongoDB connections
const tenantMongoConnections: Map<string, typeof mongoose> = new Map();

/**
 * Connect to tenant's MongoDB database
 * Each tenant gets their own database: tenant-{slug}
 * @param tenantSlug - The tenant slug (e.g., "joes-smoke-shop")
 * @returns Mongoose connection to tenant database
 */
export async function connectToTenantMongoDB(tenantSlug: string) {
  // Check if connection exists and is active
  if (tenantMongoConnections.has(tenantSlug)) {
    const conn = tenantMongoConnections.get(tenantSlug);
    if (conn && conn.connection?.readyState === 1) {
      return conn;
    } else {
      // Remove stale/failed connection from cache
      tenantMongoConnections.delete(tenantSlug);
    }
  }

  // Build tenant database URI
  const baseUri = process.env.MONGODB_URI || '';
  if (!baseUri) {
    throw new Error('MONGODB_URI not configured');
  }

  // Replace database name with tenant-specific database
  // Format: mongodb+srv://user:pass@cluster.mongodb.net/original-db
  // Becomes: mongodb+srv://user:pass@cluster.mongodb.net/tenant-{slug}
  const tenantDbName = `tenant-${tenantSlug}`;
  
  // Validate database name length (MongoDB limit is 38 bytes)
  if (tenantDbName.length > 38) {
    throw new Error(`Tenant database name too long: ${tenantDbName} (max 38 chars)`);
  }
  
  const tenantUri = baseUri.replace(/\/[^\/]+(\?|$)/, `/${tenantDbName}$1`);

  try {
    // Create new connection for this tenant
    const tenantConnection = await mongoose.createConnection(tenantUri, {
      bufferCommands: false,
    }).asPromise();

    // Register TenantProduct model on this connection
    if (!tenantConnection.models.TenantProduct) {
      tenantConnection.model('TenantProduct', tenantProductSchema);
    }

    // Cache the connection
    tenantMongoConnections.set(tenantSlug, tenantConnection as any);

    console.log(`[MongoDB] Connected to tenant database: ${tenantDbName}`);

    return tenantConnection;
  } catch (error) {
    console.error(`[MongoDB] Failed to connect to tenant database: ${tenantDbName}`, error);
    throw error;
  }
}

/**
 * Get TenantProduct model for specific tenant
 * @param tenantSlug - The tenant slug (e.g., "joes-smoke-shop")
 * @returns TenantProduct model connected to tenant's database
 */
export async function getTenantProductModel(tenantSlug: string) {
  const connection = await connectToTenantMongoDB(tenantSlug);
  return connection.models.TenantProduct;
}

// Helper functions
export async function findProductByBarcode(barcode: string) {
  await connectToMongoDB();
  
  return MasterProduct.findOne({
    $or: [
      { barcode },
      { alternateBarcodes: barcode },
    ],
    isAvailable: true,
    isActive: true,
  });
}

export async function searchProducts(filters: {
  query?: string;
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  page?: number;
  pageSize?: number;
}) {
  await connectToMongoDB();
  
  const {
    query,
    category,
    brand,
    minPrice,
    maxPrice,
    page = 1,
    pageSize = 20,
  } = filters;
  
  const searchQuery: any = {
    isAvailable: true,
    isActive: true,
  };
  
  if (query) {
    searchQuery.$text = { $search: query };
  }
  
  if (category) {
    searchQuery.category = category;
  }
  
  if (brand) {
    searchQuery.brand = brand;
  }
  
  if (minPrice !== undefined || maxPrice !== undefined) {
    searchQuery.suggestedRetailPrice = {};
    if (minPrice !== undefined) searchQuery.suggestedRetailPrice.$gte = minPrice;
    if (maxPrice !== undefined) searchQuery.suggestedRetailPrice.$lte = maxPrice;
  }
  
  const skip = (page - 1) * pageSize;
  
  const [products, total] = await Promise.all([
    MasterProduct.find(searchQuery)
      .skip(skip)
      .limit(pageSize)
      .sort({ createdAt: -1 }),
    MasterProduct.countDocuments(searchQuery),
  ]);
  
  return {
    products,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}
