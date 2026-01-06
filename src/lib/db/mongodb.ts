import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || '';

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
let cached = global.mongoose;

if (!cached) {
  cached = global.mongoose = { conn: null, promise: null };
}

export async function connectToMongoDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongoose) => {
      return mongoose;
    });
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

export const MasterBrand =
  mongoose.models.MasterBrand ||
  mongoose.model('MasterBrand', masterBrandSchema);

export const MasterCategory =
  mongoose.models.MasterCategory ||
  mongoose.model('MasterCategory', masterCategorySchema);

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
