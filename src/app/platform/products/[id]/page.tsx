'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

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
}

export default function EditProductPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [product, setProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    barcode: '',
    name: '',
    brand: '',
    category: '',
    description: '',
    msrp: 0,
    images: [] as string[],
    specs: {} as Record<string, any>,
  });

  useEffect(() => {
    loadProduct();
  }, [productId]);

  const loadProduct = async () => {
    try {
      const response = await fetch(`/api/platform/products/${productId}`);
      
      if (response.status === 401) {
        router.push('/platform/login');
        return;
      }
      
      if (!response.ok) throw new Error('Failed to load product');
      
      const data = await response.json();
      setProduct(data.product);
      setFormData({
        barcode: data.product.barcode,
        name: data.product.name,
        brand: data.product.brand,
        category: data.product.category,
        description: data.product.description || '',
        msrp: data.product.suggestedRetailPrice || 0,
        images: data.product.images || [],
        specs: data.product.specifications || {},
      });
    } catch (error) {
      console.error('Error loading product:', error);
      alert('Failed to load product');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const response = await fetch(`/api/platform/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update product');
      }

      router.push('/platform/products');
    } catch (error) {
      console.error('Error saving product:', error);
      alert(error instanceof Error ? error.message : 'Failed to save product');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-white text-lg">Loading product...</div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="text-red-400 text-lg">Product not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <button
            onClick={() => router.push('/platform/products')}
            className="text-gray-400 hover:text-white transition-colors mb-2"
          >
            ← Back to Products
          </button>
          <h1 className="text-2xl font-bold">Edit Product</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Barcode */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Barcode / UPC *
            </label>
            <input
              type="text"
              value={formData.barcode}
              onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Product Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>

          {/* Brand & Category */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Brand *
              </label>
              <input
                type="text"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Category *
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={4}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* MSRP */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              MSRP (USD)
            </label>
            <input
              type="number"
              step="0.01"
              value={formData.msrp}
              onChange={(e) => setFormData({ ...formData, msrp: parseFloat(e.target.value) || 0 })}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Images */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Image URLs (one per line)
            </label>
            <textarea
              value={formData.images.join('\n')}
              onChange={(e) => setFormData({ 
                ...formData, 
                images: e.target.value.split('\n').filter(url => url.trim()) 
              })}
              rows={3}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              placeholder="https://example.com/image1.jpg"
            />
          </div>

          {/* Specs (JSON) */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Specifications (JSON)
            </label>
            <textarea
              value={JSON.stringify(formData.specs, null, 2)}
              onChange={(e) => {
                try {
                  setFormData({ ...formData, specs: JSON.parse(e.target.value) });
                } catch {}
              }}
              rows={6}
              className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-4 pt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-lg transition-colors"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
            <button
              type="button"
              onClick={() => router.push('/platform/products')}
              className="px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}
