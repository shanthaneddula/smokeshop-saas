'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthProvider';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import CatalogSearch from '@/components/catalog/CatalogSearch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Product {
  _id: string; // MongoDB _id
  tenantId: string;
  masterProductId?: string;
  name: string;
  slug: string;
  barcode: string;
  brand: string;
  category: string;
  costPrice?: number;
  salePrice: number;
  stockQuantity: number;
  lowStockThreshold?: number;
  imageUrl: string | null;
  images?: string[];
  specifications?: any;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface ProductStats {
  total: number;
  lowStock: number;
  outOfStock: number;
  totalValue: number;
}

export default function ProductsPage() {
  const router = useRouter();
  const { user, logout } = useAuth();
  
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<ProductStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddCatalog, setShowAddCatalog] = useState(false);

  useEffect(() => {
    loadProducts();
  }, [search]);

  const loadProducts = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      
      const response = await fetch(`/api/products?${params}`);
      
      if (response.status === 401) {
        router.push('/login');
        return;
      }
      
      if (!response.ok) throw new Error('Failed to load products');
      
      const data = await response.json();
      setProducts(data.products);
      setStats(data.stats);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStockBadge = (product: Product) => {
    if (product.stockQuantity === 0) {
      return <Badge variant="destructive">Out of Stock</Badge>;
    }
    if (product.stockQuantity <= (product.lowStockThreshold || 10)) {
      return <Badge className="bg-yellow-600">Low Stock</Badge>;
    }
    return <Badge className="bg-green-600">In Stock</Badge>;
  };

  return (
    <ProtectedRoute requireOrg={false}>
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <header className="bg-white border-b sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold">Products</h1>
                <p className="text-sm text-slate-600">Manage your inventory</p>
              </div>
              <div className="flex items-center gap-4">
                <Button variant="outline" onClick={() => router.push('/dashboard')}>
                  ← Dashboard
                </Button>
                <Button variant="outline" onClick={logout}>
                  Log Out
                </Button>
              </div>
            </div>
            
            {/* Stats */}
            {stats && (
              <div className="grid grid-cols-4 gap-4 mb-4">
                <Card className="p-4">
                  <div className="text-2xl font-bold">{stats.total}</div>
                  <div className="text-sm text-slate-600">Total Products</div>
                </Card>
                <Card className="p-4">
                  <div className="text-2xl font-bold text-yellow-600">{stats.lowStock}</div>
                  <div className="text-sm text-slate-600">Low Stock</div>
                </Card>
                <Card className="p-4">
                  <div className="text-2xl font-bold text-red-600">{stats.outOfStock}</div>
                  <div className="text-sm text-slate-600">Out of Stock</div>
                </Card>
                <Card className="p-4">
                  <div className="text-2xl font-bold text-green-600">
                    ${stats.totalValue.toFixed(2)}
                  </div>
                  <div className="text-sm text-slate-600">Inventory Value</div>
                </Card>
              </div>
            )}
            
            {/* Search and Actions */}
            <div className="flex gap-4">
              <Input
                type="search"
                placeholder="Search products by name, barcode, brand..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1"
              />
              <Button onClick={() => setShowAddCatalog(true)}>
                📦 Add from Catalog
              </Button>
              <Button variant="outline" onClick={() => router.push('/dashboard/products/new')}>
                ➕ Add Manually
              </Button>
            </div>
          </div>
        </header>

        {/* Products Table */}
        <main className="container mx-auto px-4 py-8">
          {loading ? (
            <div className="text-center py-12 text-slate-600">Loading products...</div>
          ) : products.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="text-6xl mb-4">📦</div>
              <h3 className="text-xl font-semibold mb-2">No products yet</h3>
              <p className="text-slate-600 mb-6">
                Start by adding products from the master catalog or create your own
              </p>
              <div className="flex gap-4 justify-center">
                <Button onClick={() => setShowAddCatalog(true)}>
                  Add from Catalog
                </Button>
                <Button variant="outline" onClick={() => router.push('/dashboard/products/new')}>
                  Add Manually
                </Button>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-100 border-b">
                    <tr>
                      <th className="text-left p-4 font-semibold">Product</th>
                      <th className="text-left p-4 font-semibold">Barcode</th>
                      <th className="text-left p-4 font-semibold">Category</th>
                      <th className="text-right p-4 font-semibold">Cost</th>
                      <th className="text-right p-4 font-semibold">Price</th>
                      <th className="text-right p-4 font-semibold">Quantity</th>
                      <th className="text-left p-4 font-semibold">Status</th>
                      <th className="text-right p-4 font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr key={product._id} className="border-b hover:bg-slate-50">
                        <td className="p-4">
                          <div className="font-medium">{product.name}</div>
                          <div className="text-sm text-slate-600">{product.brand}</div>
                        </td>
                        <td className="p-4 font-mono text-sm">{product.barcode}</td>
                        <td className="p-4 text-sm">{product.category}</td>
                        <td className="p-4 text-right text-sm">
                          ${(product.costPrice ?? 0).toFixed(2)}
                        </td>
                        <td className="p-4 text-right font-semibold">
                          ${(product.salePrice ?? 0).toFixed(2)}
                        </td>
                        <td className="p-4 text-right">
                          <span className={
                            product.stockQuantity === 0 
                              ? 'text-red-600 font-semibold'
                              : product.stockQuantity <= (product.lowStockThreshold || 10)
                              ? 'text-yellow-600 font-semibold'
                              : 'font-semibold'
                          }>
                            {product.stockQuantity}
                          </span>
                        </td>
                        <td className="p-4">
                          {getStockBadge(product)}
                        </td>
                        <td className="p-4 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => router.push(`/dashboard/products/${product._id}`)}
                          >
                            Edit
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </main>

        {/* Add from Catalog Modal */}
        {showAddCatalog && (
          <div 
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowAddCatalog(false)}
          >
            <Card 
              className="w-full max-w-4xl max-h-[90vh] overflow-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold">Add from Catalog</h2>
                    <p className="text-sm text-slate-600">
                      Search and add products from the master catalog
                    </p>
                  </div>
                  <Button variant="outline" onClick={() => setShowAddCatalog(false)}>
                    ✕ Close
                  </Button>
                </div>
                
                <CatalogSearch 
                  onProductAdded={() => {
                    loadProducts();
                    setShowAddCatalog(false);
                  }}
                  onClose={() => setShowAddCatalog(false)}
                />
              </div>
            </Card>
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
