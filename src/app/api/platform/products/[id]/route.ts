import { NextRequest, NextResponse } from 'next/server';
import { requirePlatformAdmin } from '@/lib/auth/platform';
import { connectToMongoDB, MasterProduct } from '@/lib/db/mongodb';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/platform/products/[id]
 * Get single product details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    requirePlatformAdmin(request);
    
    const { id } = await params;
    
    await connectToMongoDB();
    
    const product = await MasterProduct.findById(id);
    
    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      product,
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
      { error: 'Failed to load product' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/platform/products/[id]
 * Update product in master catalog
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = requirePlatformAdmin(request);
    
    const { id } = await params;
    const body = await request.json();
    const { barcode, name, brand, category, description, msrp, images, specs } = body;
    
    await connectToMongoDB();
    
    const product = await MasterProduct.findById(id);
    
    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }
    
    // Update fields
    if (barcode !== undefined) product.barcode = barcode;
    if (name !== undefined) product.name = name;
    if (brand !== undefined) product.brand = brand;
    if (category !== undefined) product.category = category;
    if (description !== undefined) product.description = description;
    if (msrp !== undefined) product.suggestedRetailPrice = msrp;
    if (images !== undefined) {
      product.images = images;
      product.primaryImage = images[0];
    }
    if (specs !== undefined) product.specifications = specs;
    
    product.updatedBy = admin.email;
    
    await product.save();
    
    console.log('[PlatformProducts] Updated product:', product._id, admin.email);
    
    return NextResponse.json({
      success: true,
      product,
    });
  } catch (error) {
    console.error('[PlatformProducts] PUT error:', error);
    
    if (error instanceof Error && error.message.includes('authenticated')) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/platform/products/[id]
 * Delete product from master catalog
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = requirePlatformAdmin(request);
    
    const { id } = await params;
    
    await connectToMongoDB();
    
    const product = await MasterProduct.findById(id);
    
    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }
    
    await product.deleteOne();
    
    console.log('[PlatformProducts] Deleted product:', id, admin.email);
    
    return NextResponse.json({
      success: true,
      message: 'Product deleted',
    });
  } catch (error) {
    console.error('[PlatformProducts] DELETE error:', error);
    
    if (error instanceof Error && error.message.includes('authenticated')) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    );
  }
}
