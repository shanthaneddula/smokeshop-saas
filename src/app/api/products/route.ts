import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/tenant-context';
import { getTenantProductModel } from '@/lib/db/mongodb';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const createProductSchema = z.object({
  name: z.string().min(1, 'Product name is required'),
  barcode: z.string().min(1, 'Barcode is required'),
  sku: z.string().optional(),
  brand: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  costPrice: z.number().min(0, 'Cost price must be positive').optional(),
  salePrice: z.number().min(0, 'Sale price must be positive'),
  stockQuantity: z.number().int().min(0, 'Quantity must be zero or greater').default(0),
  lowStockThreshold: z.number().int().min(0).default(10).optional(),
  imageUrl: z.string().url().optional().nullable(),
});

/**
 * GET /api/products
 * List all products in tenant's inventory (MongoDB)
 */
export async function GET(request: NextRequest) {
  try {
    const tenant = await requireTenant(request);
    const TenantProduct = await getTenantProductModel(tenant.slug);
    
    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const category = searchParams.get('category');
    const brand = searchParams.get('brand');
    const lowStock = searchParams.get('lowStock') === 'true';
    
    // Build MongoDB query
    const query: any = { tenantId: tenant.id };
    
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { barcode: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } },
        { brand: { $regex: search, $options: 'i' } },
      ];
    }
    
    if (category) {
      query.category = category;
    }
    
    if (brand) {
      query.brand = brand;
    }
    
    if (lowStock) {
      // Find products where stock is below threshold
      query.$expr = { $lte: ['$stockQuantity', '$lowStockThreshold'] };
    }
    
    // Fetch products from MongoDB
    const products = await TenantProduct.find(query)
      .sort({ createdAt: -1 })
      .lean();
    
    // Get summary stats
    const allProducts = await TenantProduct.find({ tenantId: tenant.id }).lean();
    const stats = {
      total: allProducts.length,
      lowStock: allProducts.filter((p: any) => p.stockQuantity <= (p.lowStockThreshold || 10)).length,
      outOfStock: allProducts.filter((p: any) => p.stockQuantity === 0).length,
      totalValue: allProducts.reduce((sum: number, p: any) => sum + (p.salePrice * p.stockQuantity), 0),
    };
    
    return NextResponse.json({
      success: true,
      products,
      stats,
      tenant: {
        id: tenant.id,
        name: tenant.name,
      },
    });
    
  } catch (error) {
    console.error('[Products] GET error:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to load products' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/products
 * Create a new product manually (not from catalog) in MongoDB
 */
export async function POST(request: NextRequest) {
  try {
    const tenant = await requireTenant(request);
    const TenantProduct = await getTenantProductModel(tenant.slug);
    
    // Parse and validate request body
    const body = await request.json();
    const validation = createProductSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { 
          error: 'Invalid product data', 
          details: validation.error.issues 
        },
        { status: 400 }
      );
    }
    
    const data = validation.data;
    
    // Check if barcode already exists
    const existing = await TenantProduct.findOne({
      tenantId: tenant.id,
      barcode: data.barcode,
    });
    
    if (existing) {
      return NextResponse.json(
        { error: 'A product with this barcode already exists' },
        { status: 409 }
      );
    }
    
    // Generate slug from name
    const slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    
    // Create product in MongoDB
    const product = await TenantProduct.create({
      ...data,
      tenantId: tenant.id,
      slug,
      sku: data.sku || data.barcode,
      isActive: true,
    });
    
    console.log(`[Products] Tenant ${tenant.name} created product: ${product.name}`);
    
    return NextResponse.json({
      success: true,
      product,
      message: 'Product created successfully',
    }, { status: 201 });
    
  } catch (error) {
    console.error('[Products] POST error:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    );
  }
}
