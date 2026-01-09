import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/auth/platform';
import { connectToMongoDB, MasterProduct } from '@/lib/db/mongodb';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/platform/products
 * List all products in master catalog
 */
export async function GET(request: NextRequest) {
  try {
    requirePlatformAdmin(request);
    
    await connectToMongoDB();
    
    const products = await MasterProduct.find()
      .sort({ createdAt: -1 })
      .lean();
    
    return NextResponse.json({
      success: true,
      products,
      count: products.length,
    });
  } catch (error) {
    console.error('[PlatformProducts] GET error:', error);
    
    if (error instanceof Error && error.message.includes('authenticated')) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to load products' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/platform/products
 * Create new product in master catalog
 */
export async function POST(request: NextRequest) {
  try {
    const admin = requirePlatformAdmin(request);
    
    const body = await request.json();
    const { barcode, name, brand, category, description, msrp, images, specs } = body;
    
    // Validate required fields
    if (!barcode || !name || !brand || !category) {
      return NextResponse.json(
        { error: 'Missing required fields: barcode, name, brand, category' },
        { status: 400 }
      );
    }
    
    await connectToMongoDB();
    
    // Check if product with barcode already exists
    const existing = await MasterProduct.findOne({ barcode });
    if (existing) {
      return NextResponse.json(
        { error: 'Product with this barcode already exists' },
        { status: 409 }
      );
    }
    
    // Generate SKU from barcode if not provided
    const sku = barcode;
    const productId = `${brand.toUpperCase().replace(/\s+/g, '-')}-${name.substring(0, 20).toUpperCase().replace(/\s+/g, '-')}`;
    
    // Create new product
    const product = await MasterProduct.create({
      _id: productId,
      sku,
      barcode,
      name,
      brand,
      category,
      description: description || '',
      suggestedRetailPrice: msrp || 0,
      images: images || [],
      primaryImage: images?.[0],
      specifications: specs || {},
      isAvailable: true,
      isActive: true,
      createdBy: admin.email,
    });
    
    console.log('[PlatformProducts] Created product:', product._id, admin.email);
    
    return NextResponse.json({
      success: true,
      product,
    }, { status: 201 });
  } catch (error) {
    console.error('[PlatformProducts] POST error:', error);
    
    if (error instanceof Error && error.message.includes('authenticated')) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    );
  }
}
