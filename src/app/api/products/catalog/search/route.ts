import { NextRequest, NextResponse } from 'next/server';
import { requireTenant } from '@/lib/tenant-context';
import { connectToMongoDB, MasterProduct } from '@/lib/db/mongodb';
import { z } from 'zod';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const searchSchema = z.object({
  barcode: z.string().optional(),
  query: z.string().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/**
 * GET /api/products/catalog/search
 * 
 * Search master product catalog for tenants
 * Used when tenant wants to add products from master catalog to their inventory
 */
export async function GET(request: NextRequest) {
  try {
    // Verify tenant context (only authenticated tenants can search catalog)
    const tenant = await requireTenant(request);
    
    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const params = searchSchema.parse({
      barcode: searchParams.get('barcode') || undefined,
      query: searchParams.get('query') || undefined,
      category: searchParams.get('category') || undefined,
      brand: searchParams.get('brand') || undefined,
      limit: searchParams.get('limit') || 50,
    });
    
    await connectToMongoDB();
    
    // Build search query
    const searchQuery: any = { isActive: true };
    
    // Barcode search (exact match or alternate barcodes)
    if (params.barcode) {
      searchQuery.$or = [
        { barcode: params.barcode },
        { alternateBarcodes: params.barcode },
      ];
    }
    
    // Text search across name, description, brand
    if (params.query) {
      searchQuery.$text = { $search: params.query };
    }
    
    // Filter by category
    if (params.category) {
      searchQuery.category = params.category;
    }
    
    // Filter by brand
    if (params.brand) {
      searchQuery.brand = params.brand;
    }
    
    // Execute search
    const products = await MasterProduct.find(searchQuery)
      .limit(params.limit)
      .select('_id sku barcode name description brand category suggestedRetailPrice wholesalePrice images primaryImage specifications isAvailable')
      .lean();
    
    console.log(`[CatalogSearch] Tenant ${tenant.name} searched catalog: ${products.length} results`);
    
    return NextResponse.json({
      success: true,
      products,
      count: products.length,
      tenant: {
        id: tenant.id,
        name: tenant.name,
      },
    });
    
  } catch (error) {
    console.error('[CatalogSearch] Error:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid search parameters', details: error.issues },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to search product catalog' },
      { status: 500 }
    );
  }
}
