// Common types used across the application

export interface MasterProduct {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  shortDescription?: string;
  barcode?: string;
  sku?: string;
  brand: string;
  category: string;
  subcategory?: string;
  tags?: string[];
  suggestedPrice?: number;
  msrp?: number;
  image?: string;
  images?: string[];
  attributes?: Record<string, any>;
  variants?: ProductVariant[];
  ageRestriction?: number;
  status: 'active' | 'inactive' | 'discontinued';
  activationCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ProductVariant {
  name: string;
  sku?: string;
  barcode?: string;
  price?: number;
  attributes?: Record<string, any>;
}

export interface Brand {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  logo?: string;
  website?: string;
  status: 'active' | 'inactive';
  productCount: number;
  createdAt: string;
}

export interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  image?: string;
  parentCategory?: string;
  sortOrder: number;
  status: 'active' | 'inactive';
  productCount: number;
}

export interface TenantProduct {
  id: string;
  organizationId: string;
  masterProductId?: string;
  name: string;
  slug: string;
  description?: string;
  barcode?: string;
  sku?: string;
  price: number;
  compareAtPrice?: number;
  cost?: number;
  stockQuantity: number;
  trackInventory: boolean;
  lowStockThreshold?: number;
  category?: string;
  brand?: string;
  tags: string[];
  image?: string;
  images: string[];
  status: string;
  isActive: boolean;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Organization {
  id: string;
  slug: string;
  name: string;
  email: string;
  phone?: string;
  subscriptionTier: 'free' | 'starter' | 'pro';
  subscriptionStatus: 'active' | 'suspended' | 'cancelled';
  trialEndsAt?: Date;
  settings: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserSession {
  userId: string;
  email: string;
  name: string;
  organizationId: string;
  organizationSlug: string;
  role: 'owner' | 'manager' | 'staff' | 'cashier';
}

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  barcode?: string;
  image?: string;
}

export interface POSCart {
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
}
