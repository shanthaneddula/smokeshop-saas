// MongoDB Master Product Catalog Types
// These products are managed by the platform and browsable by all tenants

export interface MasterProduct {
  _id: string; // MongoDB ObjectId as string, used as masterProductId reference
  
  // Product Identification
  sku: string;
  barcode: string; // Primary manufacturer barcode (UPC/EAN)
  alternateBarcodes?: string[]; // Multiple barcodes for variants
  
  // Basic Info
  name: string;
  description: string;
  shortDescription?: string;
  
  // Categorization
  brand: string;
  category: string;
  subcategory?: string;
  tags?: string[];
  
  // Pricing (Reference Only - Tenants set their own prices)
  wholesalePrice?: number; // What you might charge tenants
  suggestedRetailPrice?: number; // MSRP for reference
  
  // Media
  images: string[]; // Array of image URLs
  primaryImage?: string; // Main product image
  videos?: string[];
  
  // Specifications (Flexible attributes)
  specifications?: {
    [key: string]: string | number | boolean;
  };
  
  // Variants (for products with options)
  variants?: MasterProductVariant[];
  
  // Product Details
  weight?: number; // in grams
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
    unit?: 'in' | 'cm';
  };
  
  // Supplier Info (for your inventory management)
  supplier?: string;
  supplierSku?: string;
  
  // Availability
  isAvailable: boolean; // Can tenants activate this product?
  isActive: boolean; // Is this product in your catalog?
  isFeatured?: boolean;
  
  // Compliance (for age-restricted products)
  ageRestricted?: boolean;
  minimumAge?: number; // 18, 21, etc.
  restrictions?: string[]; // ['online-only', 'in-store-only', 'prescription-required']
  
  // SEO & Marketing
  seoTitle?: string;
  seoDescription?: string;
  keywords?: string[];
  
  // Metadata
  metadata?: {
    [key: string]: any;
  };
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
}

export interface MasterProductVariant {
  id: string;
  name: string; // "Black", "Red", "Large", etc.
  sku: string;
  barcode?: string;
  wholesalePrice?: number;
  suggestedRetailPrice?: number;
  image?: string;
  attributes?: {
    color?: string;
    size?: string;
    [key: string]: any;
  };
}

export interface MasterBrand {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  website?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface MasterCategory {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  parentId?: string; // For subcategories
  image?: string;
  order?: number; // Display order
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// Search/Filter Types
export interface ProductSearchFilters {
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  tags?: string[];
  query?: string; // Text search
}

export interface ProductSearchResult {
  products: MasterProduct[];
  total: number;
  page: number;
  pageSize: number;
  filters: ProductSearchFilters;
}

// Product Activation Request (from tenant)
export interface ProductActivationRequest {
  masterProductId: string;
  
  // Tenant's pricing
  costPrice?: number;
  salePrice: number;
  compareAtPrice?: number;
  
  // Tenant's inventory
  stockQuantity: number;
  lowStockThreshold?: number;
  
  // Tenant's identifiers
  sku?: string;
  customBarcode?: string;
  
  // Use original or custom barcode
  useCustomBarcode: boolean;
}

// Product Activation Response
export interface ProductActivationResponse {
  success: boolean;
  product?: {
    id: string;
    name: string;
    barcode: string;
    salePrice: number;
    stockQuantity: number;
  };
  error?: string;
}
