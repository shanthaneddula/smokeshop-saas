#!/usr/bin/env tsx

/**
 * Clean Up Simple Products & Add MasterProduct Samples
 * 
 * 1. Deletes old "products" collection (simple schema)
 * 2. Adds sample products to "master_products" collection
 * Run: npx tsx scripts/setup-master-products.ts
 */

import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';

// Load .env.local manually
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envFile = fs.readFileSync(envPath, 'utf-8');
  envFile.split('\n').forEach(line => {
    const match = line.match(/^([^=:#]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  });
}

const MONGODB_URI = process.env.MONGODB_URI || '';

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI environment variable not set in .env.local');
  process.exit(1);
}

// MasterProduct Schema (matches mongodb.ts)
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
    _id: { type: String, required: true },
    sku: { type: String, required: true, unique: true },
    barcode: { type: String, required: true },
    alternateBarcodes: [String],
    name: { type: String, required: true },
    description: { type: String, required: true },
    shortDescription: String,
    brand: { type: String, required: true, index: true },
    category: { type: String, required: true, index: true },
    subcategory: String,
    tags: [String],
    wholesalePrice: Number,
    suggestedRetailPrice: Number,
    images: { type: [String], default: [] },
    primaryImage: String,
    videos: [String],
    specifications: mongoose.Schema.Types.Mixed,
    variants: [masterProductVariantSchema],
    weight: Number,
    dimensions: {
      length: Number,
      width: Number,
      height: Number,
    },
    packageDimensions: {
      length: Number,
      width: Number,
      height: Number,
      weight: Number,
    },
    manufacturer: String,
    manufacturerPartNumber: String,
    countryOfOrigin: String,
    materials: [String],
    colors: [String],
    stockStatus: { type: String, enum: ['in_stock', 'out_of_stock', 'discontinued'], default: 'in_stock' },
    minimumOrderQuantity: { type: Number, default: 1 },
    isAvailable: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    createdBy: String,
    updatedBy: String,
  },
  {
    timestamps: true,
    collection: 'master_products',
  }
);

const MasterProduct = mongoose.models.MasterProduct || mongoose.model('MasterProduct', masterProductSchema);

const sampleProducts = [
  {
    _id: 'PUFFCO-PEAK-PRO',
    sku: '810074760478',
    barcode: '810074760478',
    name: 'Puffco Peak Pro',
    description: 'The Peak Pro represents a new standard for concentrate consumption technology. Embedded with the most advanced sensor technology, tuned to capture the full flavor profile of your concentrates at the optimal temperature.',
    shortDescription: 'Premium smart dab rig with precision temperature control',
    brand: 'Puffco',
    category: 'Vaporizers',
    subcategory: 'Dab Rigs',
    tags: ['concentrate', 'electric', 'smart device', 'premium'],
    suggestedRetailPrice: 399.99,
    wholesalePrice: 280.00,
    images: [
      'https://cdn.shopify.com/s/files/1/0074/5832/5613/products/peak-pro-opal-front_1200x1200.jpg'
    ],
    primaryImage: 'https://cdn.shopify.com/s/files/1/0074/5832/5613/products/peak-pro-opal-front_1200x1200.jpg',
    specifications: {
      voltage: '3.7V',
      heatupTime: '20 seconds',
      batteryLife: '2 hours',
      warranty: '2 years',
      chamberMaterial: 'Ceramic',
      bluetooth: true,
      appControlled: true,
    },
    weight: 1.5,
    dimensions: { length: 7, width: 3.5, height: 7 },
    manufacturer: 'Puffco',
    colors: ['Black', 'White', 'Opal'],
    isAvailable: true,
    isActive: true,
    createdBy: 'system'
  },
  {
    _id: 'RAW-KING-SIZE-SLIM',
    sku: '850014978051',
    barcode: '850014978051',
    name: 'RAW Classic King Size Slim',
    description: 'RAW Classic is a pure, less processed rolling paper unlike anything that you have ever seen or smoked. Because it contains a hybrid blend of unbleached fibers, the paper is a translucent natural light brown color.',
    shortDescription: 'Natural unrefined rolling papers, 32 papers per pack',
    brand: 'RAW',
    category: 'Rolling Papers',
    subcategory: 'King Size',
    tags: ['natural', 'unbleached', 'hemp', 'slow burn'],
    suggestedRetailPrice: 2.99,
    wholesalePrice: 1.50,
    images: [
      'https://cdn.shopify.com/s/files/1/0277/4645/9163/products/raw-rolling-papers-raw-classic-king-size-slim-32806821462184_1200x1200.jpg'
    ],
    primaryImage: 'https://cdn.shopify.com/s/files/1/0277/4645/9163/products/raw-rolling-papers-raw-classic-king-size-slim-32806821462184_1200x1200.jpg',
    specifications: {
      size: 'King Size Slim (110mm)',
      papers: 32,
      material: 'Natural hemp',
      thickness: 'Thin',
      gumType: 'Natural sugar gum',
    },
    weight: 0.02,
    manufacturer: 'HBI International',
    countryOfOrigin: 'Spain',
    materials: ['Hemp', 'Flax'],
    minimumOrderQuantity: 25,
    isAvailable: true,
    isActive: true,
    createdBy: 'system'
  },
  {
    _id: 'STORZ-BICKEL-MIGHTY-PLUS',
    sku: '850028039731',
    barcode: '850028039731',
    name: 'Storz & Bickel Mighty+',
    description: 'The Mighty+ features a powerful Dual Heater that pre-heats in about 60 seconds, with a supercharged battery providing up to 2 hours of autonomy, fully charged in 100 minutes via USB-C.',
    shortDescription: 'Portable dry herb vaporizer with USB-C charging',
    brand: 'Storz & Bickel',
    category: 'Vaporizers',
    subcategory: 'Portable',
    tags: ['dry herb', 'medical grade', 'German engineering', 'premium'],
    suggestedRetailPrice: 399.00,
    wholesalePrice: 299.00,
    images: [
      'https://cdn.shopify.com/s/files/1/0277/4645/9163/products/mighty-plus-vaporizer_1200x1200.jpg'
    ],
    primaryImage: 'https://cdn.shopify.com/s/files/1/0277/4645/9163/products/mighty-plus-vaporizer_1200x1200.jpg',
    specifications: {
      heatupTime: '60 seconds',
      batteryLife: '2 hours',
      temperature: '40-210°C',
      warranty: '3 years',
      chargingTime: '100 minutes',
      chargingPort: 'USB-C',
      displayType: 'LED',
    },
    weight: 0.8,
    dimensions: { length: 5.6, width: 3.2, height: 2.0 },
    manufacturer: 'Storz & Bickel GmbH',
    countryOfOrigin: 'Germany',
    colors: ['Black'],
    isAvailable: true,
    isActive: true,
    createdBy: 'system'
  },
];

async function setupMasterProducts() {
  console.log('🔧 Setting up Master Product Catalog...\n');

  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Step 1: Delete old "products" collection (simple schema)
    console.log('🗑️  Cleaning up old simple products collection...');
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('Database connection not established');
    }
    const collections = await db.listCollections().toArray();
    const hasProductsCollection = collections.some(c => c.name === 'products');
    
    if (hasProductsCollection) {
      await db.dropCollection('products');
      console.log('✅ Deleted old "products" collection\n');
    } else {
      console.log('ℹ️  No old "products" collection found\n');
    }

    // Step 2: Add sample MasterProducts
    console.log('📦 Adding sample master products...\n');
    
    let added = 0;
    let skipped = 0;

    for (const productData of sampleProducts) {
      try {
        const existing = await MasterProduct.findById(productData._id);
        
        if (existing) {
          console.log(`⏭️  Skipped: ${productData.name} (already exists)`);
          skipped++;
          continue;
        }

        await MasterProduct.create(productData);
        console.log(`✅ Added: ${productData.name} (${productData.barcode})`);
        added++;
      } catch (error) {
        console.error(`❌ Failed to add ${productData.name}:`, error);
      }
    }

    console.log(`\n📊 Summary:`);
    console.log(`  Added: ${added}`);
    console.log(`  Skipped: ${skipped}`);
    console.log(`  Total: ${sampleProducts.length}`);
    console.log('\n✨ Done! View products at: http://localhost:3000/platform/products');

  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

setupMasterProducts();
