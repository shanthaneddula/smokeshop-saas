import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/tenant-context';
import { getTenantProductModel } from '@/lib/db/mongodb';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const updateProductSchema = z.object({
  name: z.string().min(1).optional(),
  barcode: z.string().min(1).optional(),
  sku: z.string().optional(),
  brand: z.string().optional(),
  category: z.string().optional(),
  description: z.string().optional(),
  costPrice: z.number().min(0).optional(),
  salePrice: z.number().min(0).optional(),
  stockQuantity: z.number().int().min(0).optional(),
  lowStockThreshold: z.number().int().min(0).optional(),
  imageUrl: z.string().url().optional().nullable(),
  isActive: z.boolean().optional(),
});

/**
 * GET /api/products/[id]
 * Get single product details from MongoDB
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenant = await requireTenant(request);
    const TenantProduct = await getTenantProductModel(tenant.slug);
    
    const product = await TenantProduct.findOne({
      _id: id,
      tenantId: tenant.id,
    }).lean();
    
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
    console.error('[Products] GET error:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to load product' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/products/[id]
 * Update product details in MongoDB
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenant = await requireTenant(request);
    const TenantProduct = await getTenantProductModel(tenant.slug);
    
    // Check if product exists
    const existing = await TenantProduct.findOne({
      _id: id,
      tenantId: tenant.id,
    });
    
    if (!existing) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }
    
    // Parse and validate request body
    const body = await request.json();
    const validation = updateProductSchema.safeParse(body);
    
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
    
    // If barcode is being changed, check for conflicts
    if (data.barcode && data.barcode !== existing.barcode) {
      const conflict = await TenantProduct.findOne({
        tenantId: tenant.id,
        barcode: data.barcode,
        _id: { $ne: id },
      });
      
      if (conflict) {
        return NextResponse.json(
          { error: 'Another product with this barcode already exists' },
          { status: 409 }
        );
      }
    }
    
    // Update product in MongoDB
    const product = await TenantProduct.findOneAndUpdate(
      { _id: id, tenantId: tenant.id },
      { $set: data },
      { new: true }
    ).lean();
    
    console.log(`[Products] Tenant ${tenant.name} updated product: ${product.name}`);
    
    return NextResponse.json({
      success: true,
      product,
      message: 'Product updated successfully',
    });
    
  } catch (error) {
    console.error('[Products] PUT error:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/products/[id]
 * Delete product from inventory (MongoDB)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const tenant = await requireTenant(request);
    const TenantProduct = await getTenantProductModel(tenant.slug);
    
    // Check if product exists
    const product = await TenantProduct.findOne({
      _id: id,
      tenantId: tenant.id,
    }).lean();
    
    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }
    
    // Note: Transaction history check removed - productId is now a string reference to MongoDB
    // Consider implementing soft delete by setting isActive: false instead
    
    // Delete product from MongoDB
    await TenantProduct.deleteOne({
      _id: id,
      tenantId: tenant.id,
    });
    
    console.log(`[Products] Tenant ${tenant.name} deleted product: ${product.name}`);
    
    return NextResponse.json({
      success: true,
      message: 'Product deleted successfully',
    });
    
  } catch (error) {
    console.error('[Products] DELETE error:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    );
  }
}
