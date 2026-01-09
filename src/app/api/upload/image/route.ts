import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { requireTenant } from '@/lib/tenant-context';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/upload/image
 * Upload image to Vercel Blob storage
 * 
 * Note: For production, you should add BLOB_READ_WRITE_TOKEN to your .env
 * Get it from: https://vercel.com/dashboard/stores
 */
export async function POST(request: NextRequest) {
  try {
    // Verify tenant context (only authenticated tenants can upload)
    const tenant = await requireTenant(request);
    
    // Check if Vercel Blob is configured
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { 
          error: 'Image upload not configured. Add BLOB_READ_WRITE_TOKEN to environment variables.',
          helpUrl: 'https://vercel.com/docs/storage/vercel-blob'
        },
        { status: 503 }
      );
    }
    
    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only JPEG, PNG, WebP, and GIF images are allowed.' },
        { status: 400 }
      );
    }
    
    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 5MB.' },
        { status: 400 }
      );
    }
    
    // Generate unique filename
    const timestamp = Date.now();
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `products/${tenant.id}/${timestamp}-${sanitizedName}`;
    
    // Upload to Vercel Blob
    const blob = await put(filename, file, {
      access: 'public',
      addRandomSuffix: false,
    });
    
    console.log(`[Upload] Tenant ${tenant.name} uploaded image: ${blob.url}`);
    
    return NextResponse.json({
      success: true,
      url: blob.url,
      filename: sanitizedName,
      size: file.size,
      type: file.type,
    });
    
  } catch (error) {
    console.error('[Upload] Error:', error);
    
    if (error instanceof Error && error.message.includes('not found')) {
      return NextResponse.json(
        { error: 'Tenant not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to upload image' },
      { status: 500 }
    );
  }
}
