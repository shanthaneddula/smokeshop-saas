'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Product {
  _id: string;
  barcode: string;
  name: string;
  brand: string;
  category: string;
  description?: string;
  msrp?: number;
  images: string[];
  specs?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export default function PlatformProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadProducts();
  }, []);

  const loadProducts = async () => {
    try {
      const response = await fetch('/api/platform/products');
      
      if (response.status === 401) {
        router.push('/platform/login');
        return;
      }
      
      if (!response.ok) throw new Error('Failed to load products');
      
      const data = await response.json();
      setProducts(data.products);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.barcode.includes(search) ||
    p.brand.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (productId: string) => {
    if (!confirm('Delete this product from master catalog?')) return;
    
    try {
      const response = await fetch(`/api/platform/products/${productId}`, {
        method: 'DELETE',
      });
      
      if (response.ok) {
        setProducts(products.filter(p => p._id !== productId));
      }
    } catch (error) {
      console.error('Error deleting product:', error);
      alert('Failed to delete product');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-lg">Loading products...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-4 mb-2">
                <button
                  onClick={() => router.push('/platform/dashboard')}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  ← Dashboard
                </button>
                <div className="inline-block px-3 py-1 bg-blue-600/20 border border-blue-500/30 rounded text-xs text-blue-400 font-semibold">
                  MASTER CATALOG
                </div>
              </div>
              <h1 className="text-2xl font-bold">Product Catalog</h1>
              <p className="text-gray-400 text-sm">Shared across all tenants</p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors font-semibold"
            >
              + Add Product
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Search & Stats */}
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex-1 max-w-md">
            <input
              type="text"
              placeholder="Search by name, barcode, or brand..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="text-gray-400">
            {filteredProducts.length} of {products.length} products
          </div>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((product) => (
            <div
              key={product._id}
              className="bg-gray-800 border border-gray-700 rounded-lg overflow-hidden hover:border-gray-600 transition-colors"
            >
              {/* Product Image */}
              <div className="aspect-square bg-gray-900 flex items-center justify-center">
                {product.images[0] ? (
                  <img
                    src={product.images[0]}
                    alt={product.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-gray-600 text-4xl">📦</div>
                )}
              </div>

              {/* Product Info */}
              <div className="p-4">
                <div className="text-xs text-gray-500 mb-1">{product.brand}</div>
                <h3 className="font-semibold mb-1 line-clamp-2">{product.name}</h3>
                <div className="text-sm text-gray-400 mb-2">
                  UPC: {product.barcode}
                </div>
                <div className="flex items-center justify-between">
                  <div className="text-xs text-gray-500">{product.category}</div>
                  {product.msrp && (
                    <div className="text-sm font-semibold text-green-400">
                      ${product.msrp.toFixed(2)}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={() => router.push(`/platform/products/${product._id}`)}
                    className="flex-1 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(product._id)}
                    className="px-3 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded text-sm transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            {search ? 'No products found matching your search' : 'No products in catalog yet'}
          </div>
        )}
      </main>

      {/* Add Product Modal - Placeholder */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h2 className="text-xl font-bold mb-4">Add Product</h2>
            <p className="text-gray-400 mb-4">
              Product form will be created next. For now, use:
            </p>
            <code className="block bg-gray-900 p-3 rounded text-sm text-green-400 mb-4">
              POST /api/platform/products
            </code>
            <button
              onClick={() => setShowAddModal(false)}
              className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
