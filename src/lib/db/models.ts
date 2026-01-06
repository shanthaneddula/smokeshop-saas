import mongoose, { Schema, model, models } from 'mongoose';

// Master Product Schema for MongoDB
// This is the global product catalog that all tenants can browse and activate

const MasterProductSchema = new Schema({
  // Basic info
  name: {
    type: String,
    required: true,
    index: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  description: {
    type: String,
  },
  shortDescription: {
    type: String,
  },
  
  // Identification
  barcode: {
    type: String,
    index: true,
  },
  sku: {
    type: String,
  },
  upc: {
    type: String,
  },
  
  // Categorization
  brand: {
    type: String,
    required: true,
    index: true,
  },
  category: {
    type: String,
    required: true,
    index: true,
  },
  subcategory: {
    type: String,
  },
  tags: [String],
  
  // Pricing (suggested retail)
  suggestedPrice: {
    type: Number,
  },
  msrp: {
    type: Number,
  },
  wholesaleCost: {
    type: Number,
  },
  
  // Images
  image: {
    type: String,
  },
  images: [String],
  
  // Flexible attributes for brand-specific features
  // Examples: { wattage: 80, capacity: "2ml", material: "glass", color: ["black", "silver"] }
  attributes: {
    type: Schema.Types.Mixed,
    default: {},
  },
  
  // Product variations (size, color, flavor, etc.)
  variants: [{
    name: String,
    sku: String,
    barcode: String,
    price: Number,
    attributes: Schema.Types.Mixed,
  }],
  
  // Specifications
  specifications: {
    type: Schema.Types.Mixed,
    default: {},
  },
  
  // Compliance
  ageRestriction: {
    type: Number,
    default: 21,
  },
  complianceLevel: {
    type: String,
    enum: ['age-restricted', 'prescription', 'general'],
    default: 'age-restricted',
  },
  
  // Status
  status: {
    type: String,
    enum: ['active', 'inactive', 'discontinued'],
    default: 'active',
    index: true,
  },
  
  // Activation tracking
  activationCount: {
    type: Number,
    default: 0,
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
  collection: 'master_products',
});

// Indexes for search performance
MasterProductSchema.index({ name: 'text', description: 'text', brand: 'text' });
MasterProductSchema.index({ brand: 1, category: 1 });
MasterProductSchema.index({ status: 1, brand: 1 });

// Update activationCount when product is activated by a tenant
MasterProductSchema.methods.incrementActivations = function() {
  this.activationCount += 1;
  return this.save();
};

// Export model
export const MasterProduct = models.MasterProduct || model('MasterProduct', MasterProductSchema);

// Brand Schema
const BrandSchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
  },
  logo: {
    type: String,
  },
  website: {
    type: String,
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },
  productCount: {
    type: Number,
    default: 0,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
  collection: 'brands',
});

export const Brand = models.Brand || model('Brand', BrandSchema);

// Category Schema
const CategorySchema = new Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
  },
  description: {
    type: String,
  },
  image: {
    type: String,
  },
  parentCategory: {
    type: String,
  },
  sortOrder: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
  },
  productCount: {
    type: Number,
    default: 0,
  },
}, {
  timestamps: true,
  collection: 'categories',
});

export const Category = models.Category || model('Category', CategorySchema);
