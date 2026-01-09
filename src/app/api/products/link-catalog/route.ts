import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/tenant-context';
import { connectToMongoDB, MasterProduct, getTenantProductModel } from '@/lib/db/mongodb';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const linkProductSchema = z.object({
  masterProductId: z.string().min(1, 'Master product ID is required'),
  costPrice: z.number().min(0, 'Cost price must be positive'),
  salePrice: z.number().min(0, 'Sale price must be positive'),
  stockQuantity: z.number().int().min(0, 'Quantity must be zero or greater').default(0),
});

/**
 * POST /api/products/link-catalog
 * 
 * Add a product from the master catalog to tenant's inventory
 * Copies product details from MongoDB master catalog and creates tenant-specific product
 */
export async function POST(request: NextRequest) {
  try {
    // Verify tenant context
    const tenant = await requireTenant(request);
    const TenantProduct = await getTenantProductModel(tenant.slug);
    
    // Parse and validate request body
    const body = await request.json();
    const validation = linkProductSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Invalid request data', 
          details: validation.error.issues 
        },
        { status: 400 }
      );
    }
    
    const { masterProductId, costPrice, salePrice, stockQuantity } = validation.data;
    
    // Connect to MongoDB and fetch master product
    await connectToMongoDB();
    const masterProduct = await MasterProduct.findById(masterProductId).lean();
    
    if (!masterProduct) {
      return NextResponse.json(
        { error: 'Product not found in master catalog' },
        { status: 404 }
      );
    }
    
    // Check if product already exists in tenant's inventory
    const existingProduct = await TenantProduct.findOne({
      tenantId: tenant.id,
      $or: [
        { masterProductId },
        { barcode: masterProduct.barcode },
      ],
    });
    
    if (existingProduct) {
      return NextResponse.json(
        { 
          error: 'Product already exists in your inventory',
          existingProduct: {
            id: existingProduct._id,
            name: existingProduct.name,
            barcode: existingProduct.barcode,
          }
        },
        { status: 409 }
      );
    }
    
    // Generate slug from product name
    const slug = masterProduct.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    
    // Create product in tenant's MongoDB database
    const newProduct = await TenantProduct.create({
      // Link to master catalog
      masterProductId: masterProduct._id,
      
      // Tenant ID for isolation
      tenantId: tenant.id,
      
      // Copy product details from catalog
      name: masterProduct.name,
      slug,
      description: masterProduct.description || '',
      barcode: masterProduct.barcode,
      sku: masterProduct.sku,
      brand: masterProduct.brand || '',
      category: masterProduct.category || '',
      
      // Tenant-specific pricing
      costPrice,
      salePrice,
      
      // Inventory
      stockQuantity,
      lowStockThreshold: 10, // Default low stock alert
      
      // Product attributes from catalog
      imageUrl: masterProduct.primaryImage || masterProduct.images?.[0] || null,
      images: masterProduct.images || [],
      specifications: masterProduct.specifications || {},
      
      // Status
      isActive: true,
    });
    
    console.log(`[ProductLink] Tenant ${tenant.name} added product: ${newProduct.name} from catalog`);
    
    return NextResponse.json({
      success: true,
      product: {
        id: newProduct._id,
        name: newProduct.name,
        barcode: newProduct.barcode,
        brand: newProduct.brand,
        category: newProduct.category,
        costPrice: newProduct.costPrice,
        salePrice: newProduct.salePrice,
        stockQuantity: newProduct.stockQuantity,
        masterProductId: newProduct.masterProductId,
      },
      message: 'Product added to your inventory',
    }, { status: 201 });
    
  } catch (error) {
    console.error('[ProductLink] Error:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to add product to inventory' },
      { status: 500 }
    );
  }
}
