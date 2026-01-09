/**
 * MongoDB Tenant Database Provisioning
 * 
 * Creates isolated MongoDB databases for each tenant.
 * Each tenant gets their own database (tenant-{slug}) with proper collections and indexes.
 */

import mongoose from 'mongoose';
import { connectToMongoDB } from '@/lib/db/mongodb';

export interface MongoProvisioningResult {
  success: boolean;
  databaseName: string;
  collections: string[];
  error?: string;
}

/**
 * Creates a new MongoDB database for a tenant with all required collections
 * 
 * @param tenantSlug - The tenant's unique slug (used as database identifier)
 * @returns Result of the provisioning operation
 */
export async function createTenantMongoDatabase(
  tenantSlug: string
): Promise<MongoProvisioningResult> {
  const dbName = `tenant-${tenantSlug}`;
  
  console.log(`[MongoProvisioning] Creating database: ${dbName}`);
  
  try {
    // Ensure we're connected to MongoDB
    await connectToMongoDB();
    
    // Get a connection to the tenant's database
    // MongoDB creates the database automatically on first write
    const db = mongoose.connection.useDb(dbName, { useCache: true });
    
    // Create products collection with validation schema
    try {
      await db.createCollection('products', {
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['tenantId', 'name', 'salePrice'],
            properties: {
              tenantId: { 
                bsonType: 'string',
                description: 'Tenant ID - required for isolation verification'
              },
              masterProductId: { 
                bsonType: ['string', 'null'],
                description: 'Reference to master catalog product'
              },
              name: { 
                bsonType: 'string',
                description: 'Product name - required'
              },
              slug: { bsonType: 'string' },
              description: { bsonType: ['string', 'null'] },
              sku: { bsonType: ['string', 'null'] },
              barcode: { bsonType: ['string', 'null'] },
              originalBarcode: { bsonType: ['string', 'null'] },
              customBarcode: { bsonType: ['string', 'null'] },
              barcodeType: { 
                bsonType: 'string',
                enum: ['upc', 'ean', 'custom']
              },
              category: { bsonType: ['string', 'null'] },
              brand: { bsonType: ['string', 'null'] },
              costPrice: { bsonType: ['number', 'null'] },
              salePrice: { 
                bsonType: 'number',
                description: 'Sale price - required'
              },
              compareAtPrice: { bsonType: ['number', 'null'] },
              stockQuantity: { bsonType: 'number' },
              trackInventory: { bsonType: 'bool' },
              lowStockThreshold: { bsonType: 'number' },
              imageUrl: { bsonType: ['string', 'null'] },
              images: { bsonType: 'array' },
              specifications: { bsonType: 'object' },
              isActive: { bsonType: 'bool' },
              metadata: { bsonType: 'object' },
            },
          },
        },
      });
      console.log(`[MongoProvisioning] Created 'products' collection`);
    } catch (err) {
      // Collection might already exist
      if (!(err instanceof Error && err.message.includes('already exists'))) {
        throw err;
      }
    }
    
    // Create indexes for the products collection
    const productsCollection = db.collection('products');
    await productsCollection.createIndexes([
      { key: { tenantId: 1 }, name: 'idx_tenantId' },
      { key: { barcode: 1 }, name: 'idx_barcode' },
      { key: { sku: 1 }, name: 'idx_sku' },
      { key: { category: 1 }, name: 'idx_category' },
      { key: { brand: 1 }, name: 'idx_brand' },
      { key: { isActive: 1 }, name: 'idx_isActive' },
      { key: { stockQuantity: 1 }, name: 'idx_stockQuantity' },
      { key: { masterProductId: 1 }, name: 'idx_masterProductId' },
      { key: { name: 'text', description: 'text', brand: 'text' }, name: 'idx_text_search' },
      { key: { tenantId: 1, barcode: 1 }, name: 'idx_tenant_barcode' },
      { key: { tenantId: 1, sku: 1 }, name: 'idx_tenant_sku' },
      { key: { tenantId: 1, category: 1 }, name: 'idx_tenant_category' },
      { key: { tenantId: 1, isActive: 1, stockQuantity: 1 }, name: 'idx_tenant_active_stock' },
    ]);
    console.log(`[MongoProvisioning] Created indexes on 'products' collection`);
    
    // Create inventory_history collection for tracking stock changes
    try {
      await db.createCollection('inventory_history', {
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['tenantId', 'productId', 'changeType', 'quantityChange', 'timestamp'],
            properties: {
              tenantId: { bsonType: 'string' },
              productId: { bsonType: 'string' },
              changeType: { 
                bsonType: 'string',
                enum: ['sale', 'restock', 'adjustment', 'return', 'transfer', 'damage']
              },
              quantityChange: { bsonType: 'number' },
              previousQuantity: { bsonType: 'number' },
              newQuantity: { bsonType: 'number' },
              reason: { bsonType: ['string', 'null'] },
              referenceId: { bsonType: ['string', 'null'] },
              userId: { bsonType: ['string', 'null'] },
              timestamp: { bsonType: 'date' },
            },
          },
        },
      });
      console.log(`[MongoProvisioning] Created 'inventory_history' collection`);
    } catch (err) {
      if (!(err instanceof Error && err.message.includes('already exists'))) {
        throw err;
      }
    }
    
    // Create indexes for inventory_history
    const inventoryHistoryCollection = db.collection('inventory_history');
    await inventoryHistoryCollection.createIndexes([
      { key: { tenantId: 1 }, name: 'idx_tenantId' },
      { key: { productId: 1 }, name: 'idx_productId' },
      { key: { timestamp: -1 }, name: 'idx_timestamp_desc' },
      { key: { changeType: 1 }, name: 'idx_changeType' },
      { key: { tenantId: 1, productId: 1, timestamp: -1 }, name: 'idx_tenant_product_time' },
    ]);
    console.log(`[MongoProvisioning] Created indexes on 'inventory_history' collection`);
    
    console.log(`[MongoProvisioning] ✅ Successfully created database: ${dbName}`);
    
    return {
      success: true,
      databaseName: dbName,
      collections: ['products', 'inventory_history'],
    };
  } catch (error) {
    console.error(`[MongoProvisioning] Failed to create database: ${dbName}`, error);
    
    return {
      success: false,
      databaseName: dbName,
      collections: [],
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Deletes a tenant's MongoDB database
 * 
 * ⚠️ WARNING: This permanently deletes all data in the tenant's database.
 * Only use for cleanup after failed provisioning or explicit deletion.
 * 
 * @param tenantSlug - The tenant's unique slug
 */
export async function deleteTenantMongoDatabase(
  tenantSlug: string
): Promise<{ success: boolean; error?: string }> {
  const dbName = `tenant-${tenantSlug}`;
  
  console.log(`[MongoProvisioning] Deleting database: ${dbName}`);
  
  try {
    await connectToMongoDB();
    
    const db = mongoose.connection.useDb(dbName);
    await db.dropDatabase();
    
    console.log(`[MongoProvisioning] ✅ Successfully deleted database: ${dbName}`);
    
    return { success: true };
  } catch (error) {
    console.error(`[MongoProvisioning] Failed to delete database: ${dbName}`, error);
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if a tenant's MongoDB database exists
 */
export async function tenantMongoDatabaseExists(
  tenantSlug: string
): Promise<boolean> {
  const dbName = `tenant-${tenantSlug}`;
  
  try {
    await connectToMongoDB();
    
    // List all databases
    const admin = mongoose.connection.db?.admin();
    if (!admin) return false;
    
    const result = await admin.listDatabases();
    return result.databases.some(db => db.name === dbName);
  } catch (error) {
    console.error(`[MongoProvisioning] Failed to check database existence:`, error);
    return false;
  }
}

/**
 * Get statistics for a tenant's MongoDB database
 */
export async function getTenantMongoDatabaseStats(
  tenantSlug: string
): Promise<{
  exists: boolean;
  productCount?: number;
  storageSize?: number;
  error?: string;
}> {
  const dbName = `tenant-${tenantSlug}`;
  
  try {
    await connectToMongoDB();
    
    const db = mongoose.connection.useDb(dbName);
    
    // Get product count
    const productCount = await db.collection('products').countDocuments();
    
    // Get database stats
    const dbInstance = db.db;
    if (!dbInstance) {
      return { exists: false, error: 'Database instance not available' };
    }
    const stats = await dbInstance.stats();
    
    return {
      exists: true,
      productCount,
      storageSize: stats.storageSize,
    };
  } catch (error) {
    return {
      exists: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
